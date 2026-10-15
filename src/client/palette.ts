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
  /** The grey metal: the ladder's rails, the board and whiteboard frames and stands, the desk legs, the door bars. */
  metal: string;
  /** The warm metal and paint: the lamp shades, the ladder's rungs, the hoop, the signs, the court. */
  brass: string;
  /** The desk tops, the papers and the pale neutrals. */
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

/** `hex` scaled by `k` (darker under 1, brighter over), in the sRGB everything is drawn in. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const byte = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * k)));
  return `#${[16, 8, 0].map((shift) => byte(shift).toString(16).padStart(2, '0')).join('')}`;
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
  metal: '#8d99ae',
  brass: '#ffd166',
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

/**
 * Schemes drawn by hand, each a whole room's worth: the surfaces, the furniture and the accents chosen
 * together. Strong ones on purpose — coffee, leather, walnut, brass, steel, petrol — and no pastels: a
 * floor painted pale pink is a floor nobody works on.
 */
const SCHEMES: Palette[] = [
  {
    name: 'Espresso',
    wall: '#3a332e',
    trim: '#6b5541',
    floor: '#4a3d33',
    ceiling: '#2b2521',
    wood: '#6b4a2f',
    ink: '#17130f',
    metal: '#7a6f63',
    brass: '#c08a3e',
    desk: '#55483c',
    plant: '#4a5c3a',
    pot: '#8a4a2f',
    accents: ['#a8622f', '#7a5c3f', '#c08a3e', '#4a5c3a'],
  },
  {
    name: 'Leather',
    wall: '#4a3336',
    trim: '#7a3f42',
    floor: '#5c4636',
    ceiling: '#3a2b2c',
    wood: '#6b4a35',
    ink: '#1e1416',
    metal: '#8a7a72',
    brass: '#b5863f',
    desk: '#5c4a48',
    plant: '#465a3c',
    pot: '#7a3f2f',
    accents: ['#8a3f42', '#b5863f', '#6b5544', '#465a3c'],
  },
  {
    name: 'Walnut',
    wall: '#d9cdbb',
    trim: '#7a4a2a',
    floor: '#a8763f',
    ceiling: '#efe8dc',
    wood: '#6b4426',
    ink: '#241f1a',
    metal: '#8a8177',
    brass: '#c9973f',
    desk: '#e8e0d2',
    plant: '#4f6b3a',
    pot: '#8a4a2f',
    accents: ['#8c4a2f', '#c9973f', '#5a6b4a', '#3f4a55'],
  },
  {
    name: 'Forest',
    wall: '#3a4a3c',
    trim: '#24301f',
    floor: '#5c4a33',
    ceiling: '#2f3a30',
    wood: '#5a4228',
    ink: '#141a13',
    metal: '#7a857a',
    brass: '#b08a44',
    desk: '#4a5a46',
    plant: '#3f6b3a',
    pot: '#7a4a30',
    accents: ['#3f6b3a', '#b08a44', '#6b5a3a', '#2f4a44'],
  },
  {
    name: 'Navy',
    wall: '#2c3a52',
    trim: '#16202f',
    floor: '#6b5a45',
    ceiling: '#26303f',
    wood: '#5c4632',
    ink: '#0f1622',
    metal: '#7d8899',
    brass: '#c39a4e',
    desk: '#43506a',
    plant: '#3f5c46',
    pot: '#8a5340',
    accents: ['#3f5c8a', '#c39a4e', '#2f4a3f', '#8a3f4a'],
  },
  {
    name: 'Petrol',
    wall: '#243a3f',
    trim: '#122227',
    floor: '#5c5140',
    ceiling: '#1e3034',
    wood: '#4a3a2c',
    ink: '#0c1416',
    metal: '#6e7f84',
    brass: '#b08a48',
    desk: '#3a4f55',
    plant: '#3f6b52',
    pot: '#7a4a3a',
    accents: ['#2f6b6b', '#b08a48', '#3f5a4a', '#8a4a3a'],
  },
  {
    name: 'Gunmetal',
    wall: '#5a6068',
    trim: '#2e3239',
    floor: '#4a4e55',
    ceiling: '#34383f',
    wood: '#5a4638',
    ink: '#1b1e23',
    metal: '#8b939d',
    brass: '#b08a4a',
    desk: '#6a717a',
    plant: '#4a6b4f',
    pot: '#7a4a3f',
    accents: ['#8b939d', '#b08a4a', '#4a6b4f', '#7a3f3f'],
  },
  {
    name: 'Concrete',
    wall: '#b8b5ae',
    trim: '#4a4844',
    floor: '#9a968e',
    ceiling: '#d8d5cf',
    wood: '#6b6154',
    ink: '#22211f',
    metal: '#8a8a86',
    brass: '#a89050',
    desk: '#cfccc4',
    plant: '#4f6b4a',
    pot: '#7a5a4a',
    accents: ['#4a4844', '#a89050', '#6b6b68', '#8a5a4a'],
  },
  {
    name: 'Rust',
    wall: '#8a6b52',
    trim: '#4a3327',
    floor: '#7a5a3f',
    ceiling: '#a08a72',
    wood: '#4a3324',
    ink: '#1a1410',
    metal: '#8a7a68',
    brass: '#c08a3e',
    desk: '#b09a80',
    plant: '#4a5c3a',
    pot: '#8a4a2f',
    accents: ['#a85a2f', '#c08a3e', '#4a5c3a', '#5a3f3a'],
  },
  {
    name: 'Bone',
    wall: '#e6e1d6',
    trim: '#2b2723',
    floor: '#b9a888',
    ceiling: '#f2efe8',
    wood: '#5c4632',
    ink: '#1f1c18',
    metal: '#8a8880',
    brass: '#b58a3f',
    desk: '#f0ece2',
    plant: '#4a5c3a',
    pot: '#7a4a35',
    accents: ['#2b2723', '#b58a3f', '#7a3f3a', '#4a5c3a'],
  },
];

/** The schemes ⚙️ → Palette offers: the office as it always was, then the strong ones. A floor's own
 *  (whatever the building gave it) is the first chip of the row rather than one of these. */
export const PALETTES: readonly Palette[] = [OFFICE, ...SCHEMES];

/** The colours, in the order ⚙️ → Palette shows them, grouped the way it groups them. */
export const PALETTE_GROUPS: readonly { title: string; keys: readonly Colour[] }[] = [
  { title: 'The room', keys: ['wall', 'trim', 'floor', 'ceiling'] },
  { title: 'The furniture', keys: ['wood', 'ink', 'metal', 'brass', 'desk', 'plant', 'pot'] },
];

/** Every colour a palette has, in a fixed order: what is stored, read back and shown. */
export const PALETTE_COLOURS: readonly Colour[] = PALETTE_GROUPS.flatMap((g) => g.keys);

const HEX = /^#[0-9a-f]{6}$/i;
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/**
 * A palette off localStorage, or null: every colour right, or none of it. A stored palette is a file
 * someone can edit, and half a palette is worse than the office's own.
 */
export function readPalette(v: unknown): Palette | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const colors = {} as Record<Colour, string>;
  for (const key of PALETTE_COLOURS) {
    const color = p[key];
    if (!isHex(color)) return null;
    colors[key] = color.toLowerCase();
  }
  if (!Array.isArray(p.accents) || p.accents.length < 2 || p.accents.length > 8 || !p.accents.every(isHex)) return null;
  return { name: typeof p.name === 'string' ? p.name.slice(0, 40) : 'Your own', ...colors, accents: p.accents.map((c) => String(c).toLowerCase()) };
}
