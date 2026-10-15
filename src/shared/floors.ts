// The building: every project is a floor you ride the elevator to. Shared by the server (which
// assigns each floor its look) and the client (which paints it).

import type { CloneProgress } from './protocol.js';

/** The most floors a building has. */
export const MAX_FLOORS = 16;

/** How a floor looks: its walls, their trim, and its planks. */
export interface FloorPalette {
  name: string;
  wall: string;
  trim: string;
  floor: string;
  floorAlt: string;
  /** The gaps between planks. */
  seam: string;
}

/**
 * The first is the office as it always looked; every new floor takes the next one nobody has. Strong
 * on purpose from the second on — coffee, walnut, leather, forest, navy, petrol, steel, concrete, rust
 * — and no pastels: the first floor set the room's warmth, and a building where the floors on top of
 * yours are painted pale pink is a building nobody works in.
 */
export const FLOOR_PALETTES: FloorPalette[] = [
  { name: 'Maple', wall: '#fff6ea', trim: '#e8a87c', floor: '#f2d7b0', floorAlt: '#e9c89a', seam: '#d9b88c' },
  { name: 'Espresso', wall: '#3a332e', trim: '#6b5541', floor: '#4a3d33', floorAlt: '#413630', seam: '#332b26' },
  { name: 'Walnut', wall: '#d9cdbb', trim: '#7a4a2a', floor: '#a8763f', floorAlt: '#996a37', seam: '#7d5730' },
  { name: 'Leather', wall: '#4a3336', trim: '#7a3f42', floor: '#5c4636', floorAlt: '#523e30', seam: '#42342a' },
  { name: 'Forest', wall: '#3a4a3c', trim: '#24301f', floor: '#5c4a33', floorAlt: '#523f2d', seam: '#413327' },
  { name: 'Navy', wall: '#2c3a52', trim: '#16202f', floor: '#6b5a45', floorAlt: '#5f503d', seam: '#4e4233' },
  { name: 'Petrol', wall: '#243a3f', trim: '#122227', floor: '#5c5140', floorAlt: '#524839', seam: '#43392f' },
  { name: 'Gunmetal', wall: '#5a6068', trim: '#2e3239', floor: '#4a4e55', floorAlt: '#41454b', seam: '#35383d' },
  { name: 'Concrete', wall: '#b8b5ae', trim: '#4a4844', floor: '#9a968e', floorAlt: '#8a877f', seam: '#726f69' },
  { name: 'Rust', wall: '#8a6b52', trim: '#4a3327', floor: '#7a5a3f', floorAlt: '#6c5038', seam: '#59422e' },
];

export function floorPalette(i: number): FloorPalette {
  return FLOOR_PALETTES[((i % FLOOR_PALETTES.length) + FLOOR_PALETTES.length) % FLOOR_PALETTES.length];
}

/**
 * `owner/repo` from what someone typed or pasted: owner/repo, a github.com URL (https, ssh or
 * git@), with or without .git. Undefined for anything else, so it can never become a CLI option,
 * a path or another host.
 */
export function normalizeRepo(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let s = value.trim();
  if (s.length > 200) return undefined;
  s = s.replace(/^(?:https?:\/\/|ssh:\/\/)?(?:[\w.-]+@)?github\.com[/:]/i, '');
  s = s.replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/\.git$/i, '');
  const parts = s.split('/');
  // A URL may go on past the repository (…/owner/repo/issues/12).
  if (parts.length < 2) return undefined;
  const [owner, repo] = parts;
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(owner)) return undefined;
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(repo) || repo === '.' || repo === '..') return undefined;
  return `${owner}/${repo}`;
}

export function sameRepo(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** What a floor's clone is doing: "Downloading 64%". */
export function cloneStep(p: CloneProgress | undefined): string {
  return `${p?.step ?? 'Cloning'}${p?.percent !== undefined ? ` ${p.percent}%` : '…'}`;
}

/** A floor's clone in a few words, for the floor lists: "⏳ Downloading 64%". */
export function cloneLabel(p: CloneProgress | undefined): string {
  return `⏳ ${cloneStep(p)}`;
}
