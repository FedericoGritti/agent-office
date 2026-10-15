// The office's palette: the colours a floor and everything in it is painted from, and the schemes to
// start from. Yours alone, kept in this browser (see state/persist.ts). Nothing here touches three.js:
// the 2D view reads the same settings. What applies it is core/appearance.ts, which paints the room's
// surfaces (world/office/build.ts) and everything in it (world/office/paint.ts).

import { FLOOR_PALETTES } from '../shared/floors';

/**
 * One colour scheme for a whole office floor. Ten colours with a job each rather than one per object:
 * cohesion is the point (see world/office/paint.ts for how a part of the room answers to each).
 */
export interface Palette {
  name: string;
  /** The walls. */
  wall: string;
  /** The skirting, and the window and door frames. */
  trim: string;
  /** The planks; the second row and the seams are this colour, run darker. */
  floor: string;
  /** The ceiling's tiles, as a tint over white. */
  ceiling: string;
  /** The wood: the boards' frames, the tables, the shelves, the stairs' treads. */
  wood: string;
  /** The fittings: the boards' plates, the lamp cords, the desk legs, the frames. */
  ink: string;
  /** The desk tops. */
  desk: string;
  /** The plants. */
  plant: string;
  /** Their pots. */
  pot: string;
  /** What the rugs, the chairs and the poufs take turns through: not one colour, and not random. */
  accents: readonly string[];
}

/** One of the palette's single colours: everything but its name and its accents. */
export type Colour = Exclude<keyof Palette, 'name' | 'accents'>;

/** `hex` darkened by `k`, in the sRGB everything is drawn in. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `#${[16, 8, 0].map((shift) => Math.round(((n >> shift) & 255) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** The office as it always was: what world/office/materials.ts paints it with. */
const OFFICE: Palette = {
  name: 'The office',
  wall: FLOOR_PALETTES[0].wall,
  trim: FLOOR_PALETTES[0].trim,
  floor: FLOOR_PALETTES[0].floor,
  ceiling: '#ffffff',
  wood: '#c98b5a',
  ink: '#2b2d42',
  desk: '#f7f3ea',
  plant: '#5fb760',
  pot: '#e76f51',
  accents: ['#bde0fe', '#ffd6a5', '#caffbf', '#ffc6ff'],
};

/** A floor's own scheme (see shared/floors.ts) with the office's furniture colours under it. */
export function atFloor(index: number): Palette {
  const f = FLOOR_PALETTES[((index % FLOOR_PALETTES.length) + FLOOR_PALETTES.length) % FLOOR_PALETTES.length];
  return { ...OFFICE, name: f.name, wall: f.wall, trim: f.trim, floor: f.floor };
}

/** Schemes drawn by hand, each a whole room's worth: the surfaces, the furniture and the accents together. */
const SCHEMES: Palette[] = [
  {
    name: 'Garden',
    wall: '#eef6ee',
    trim: '#5f8f6a',
    floor: '#d9c8a6',
    ceiling: '#fafdf9',
    wood: '#9a7a52',
    ink: '#2c3b33',
    desk: '#f4f7f2',
    plant: '#3f8f45',
    pot: '#c98b5a',
    accents: ['#a9d6a0', '#e6d3a3', '#8fbf87', '#cfe3c2'],
  },
  {
    name: 'Coast',
    wall: '#eef4fb',
    trim: '#4a86b8',
    floor: '#e2d3b6',
    ceiling: '#ffffff',
    wood: '#b98a5a',
    ink: '#24384d',
    desk: '#f5f8fc',
    plant: '#4f9d52',
    pot: '#cf7a4a',
    accents: ['#8ecae6', '#ffd6a5', '#bde0fe', '#a9d8f5'],
  },
  {
    name: 'Sunset',
    wall: '#fff0e4',
    trim: '#d9663f',
    floor: '#eac7a0',
    ceiling: '#fff8f0',
    wood: '#a9713f',
    ink: '#3c2a2a',
    desk: '#fdf3e8',
    plant: '#6a9d5a',
    pot: '#d4553a',
    accents: ['#ffb26b', '#ef7d57', '#ffd6a5', '#e0705f'],
  },
  {
    name: 'Midnight',
    wall: '#333a4d',
    trim: '#55617a',
    floor: '#3d4257',
    ceiling: '#272c3b',
    wood: '#6b5540',
    ink: '#141824',
    desk: '#4a5169',
    plant: '#4f8f5a',
    pot: '#9a5a4a',
    accents: ['#7aa2f7', '#bb9af7', '#e0af68', '#9ece6a'],
  },
  {
    name: 'Pastel',
    wall: '#fdf3f8',
    trim: '#c9a7e0',
    floor: '#e8dccb',
    ceiling: '#ffffff',
    wood: '#c9a98a',
    ink: '#4a4458',
    desk: '#fbf5fb',
    plant: '#8fbf7f',
    pot: '#e8a0a0',
    accents: ['#ffd6e0', '#c9f2ff', '#e0d6ff', '#fff3c9'],
  },
];

/** The schemes ⚙️ → Palette offers: every floor's own, then the ones drawn by hand. */
export const PALETTES: readonly Palette[] = [...FLOOR_PALETTES.map((_, i) => atFloor(i)), ...SCHEMES];

/** The colours, in the order ⚙️ → Palette shows them, grouped the way it groups them. */
export const PALETTE_GROUPS: readonly { title: string; keys: readonly Colour[] }[] = [
  { title: 'The room', keys: ['wall', 'trim', 'floor', 'ceiling'] },
  { title: 'The furniture', keys: ['wood', 'ink', 'desk', 'plant', 'pot'] },
];

const HEX = /^#[0-9a-f]{6}$/i;
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/**
 * A palette off localStorage, or null: every colour right, or none of it. A stored palette is a file
 * someone can edit, and half a palette is worse than the office's own.
 */
export function readPalette(v: unknown): Palette | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  for (const key of ['wall', 'trim', 'floor', 'ceiling', 'wood', 'ink', 'desk', 'plant', 'pot']) {
    if (!isHex(p[key])) return null;
  }
  if (!Array.isArray(p.accents) || p.accents.length < 2 || p.accents.length > 8 || !p.accents.every(isHex)) return null;
  return {
    name: typeof p.name === 'string' ? p.name.slice(0, 40) : 'Your own',
    wall: p.wall,
    trim: p.trim,
    floor: p.floor,
    ceiling: p.ceiling,
    wood: p.wood,
    ink: p.ink,
    desk: p.desk,
    plant: p.plant,
    pot: p.pot,
    accents: p.accents.map((c) => String(c).toLowerCase()),
  } as Palette;
}

/** A palette as it is stored: lower-cased, so two the same read the same. */
export function cleanPalette(p: Palette): Palette {
  return readPalette(p) ?? { ...OFFICE };
}
