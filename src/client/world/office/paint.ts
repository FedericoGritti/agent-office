// Paint: what a palette does to the room's own things (see client/palette.ts for the colours and
// ui/settings-palette.ts for the rows).
//
// The office builds its furniture from about a hundred colours, and world/toon.ts hands every material
// of a colour to everything that asks for it. So a part of the room is painted by the colours the
// office builds it with — listed here once, under the part it belongs to — and painting one repaints
// every mesh that colour was used for. The accents are the exception: a rug, a chair or a pouf is made
// through accent(), which gives it a material of the palette's own, so painting those never reaches
// the office's other colours (its yellows are the lamps, its greens the boards' ticks).

import type * as THREE from 'three';
import type { Palette } from '../../palette';
import { shade } from '../../palette';
import { toon, toonUnique } from '../toon';
import { PALETTE } from './materials';

/**
 * The parts of the room a palette paints by colour, and how far each of the office's own runs from the
 * palette's: the wood's grain, the ink's fittings, the metals' highlights, the leaves against the
 * leaves' shadows. A colour the office builds nothing paintable with is not here, and pure white is
 * left alone on purpose: it is the glazing, the paper and the ball, and it reads as white in any room.
 *
 * Exported for the test that no colour is claimed by two parts: two would mean whichever part is
 * painted last wins, and which one that is is not something to leave to the order of a table.
 */
export const PARTS = {
  // The woods: the boards' frames, the tables, the shelves, the stairs' treads, the trunks, the soil.
  wood: [
    [PALETTE.wood, 1],
    ['#8a5a3b', 0.72],
    ['#7a5236', 0.62],
    ['#6b4226', 0.58],
    ['#6f4518', 0.62],
    ['#4a2c1d', 0.48],
    ['#6b3f2a', 0.62],
    ['#8a5a34', 0.74],
    ['#c68b59', 1.02],
    ['#d8a86a', 1.1],
    ['#b98457', 0.94],
    ['#c0a062', 1.06],
    ['#d6a574', 1.12],
    ['#8d5524', 0.56],
    ['#7f5539', 0.64],
    ['#9c6644', 0.8],
    ['#6b4428', 0.6],
    ['#8d7b6a', 0.88],
    ['#e9d8a6', 1.28],
  ],
  // The darks: the fittings, the frames of everything, the boards' plates, the poles, the tyres.
  ink: [
    [PALETTE.ink, 1],
    [PALETTE.deskLeg, 0.94],
    ['#1d1d1d', 0.78],
    ['#1b1b1b', 0.78],
    ['#141414', 0.76],
    ['#111111', 0.74],
    ['#343a40', 0.95],
    ['#1b1d2e', 0.85],
    ['#141320', 0.8],
    ['#1b1d3a', 0.88],
    ['#22223b', 0.88],
    ['#3a3d4f', 0.98],
    ['#4a4e69', 1.06],
    ['#5c5f73', 1.12],
    ['#26332d', 0.9],
    ['#0b1320', 0.76],
    ['#070b14', 0.72],
    ['#565a75', 1.16],
    ['#6d6875', 1.2],
    ['#3a3a3a', 0.88],
    ['#111018', 0.78],
    ['#15141c', 0.8],
    ['#07060d', 0.72],
    ['#1f1f26', 0.8],
    ['#233347', 0.95],
  ],
  // The grey metals: the ladder's rails, the board and whiteboard frames and stands, the desk legs,
  // the door bars, the machine's case, the concrete under everything.
  metal: [
    ['#8d99ae', 1],
    ['#aab4be', 1.14],
    ['#adb5bd', 1.16],
    ['#b9bdc6', 1.2],
    ['#b8c1cc', 1.2],
    ['#c9d1d9', 1.28],
    ['#d3d6dd', 1.32],
    ['#d9dbe3', 1.36],
    ['#c9ccd3', 1.28],
    ['#aeb6bf', 1.16],
    ['#6c757d', 0.82],
  ],
  // The warm metal and paint: the lamps' shades, the ladder's rungs, the hoop's ring, the signs, the gong.
  brass: [
    ['#ffd166', 1],
    ['#e09f3e', 0.86],
    ['#f2c14e', 0.98],
    ['#ffe08a', 1.08],
    ['#ffe3a3', 1.14],
    ['#ffd27a', 1.02],
    ['#e9b949', 0.92],
    ['#ffb703', 1],
    ['#c9952c', 0.78],
    ['#ffe6b0', 1.16],
    ['#ffd8a8', 1.1],
  ],
  // The pale neutrals: the desk tops, the papers, the panels, the backboard, the machine's shell.
  desk: [
    [PALETTE.desk, 1],
    ['#f8f9fa', 1.02],
    ['#fffaf3', 1.03],
    ['#f4f1ea', 0.98],
    ['#f3eee4', 0.97],
    ['#fbf7ef', 1.02],
    ['#efe8dc', 0.95],
    ['#e6e8ee', 0.94],
    ['#e3dccf', 0.92],
    ['#d9cfbe', 0.9],
    ['#d8d3ca', 0.9],
    ['#e9ecef', 0.94],
    ['#eaeaea', 0.94],
    ['#f5f5f5', 0.98],
    ['#f1f1ea', 0.96],
    ['#f7f9fb', 1.01],
    ['#dfe6ee', 0.92],
    ['#dfe3e8', 0.92],
    ['#c9c4bb', 0.86],
    ['#b8b2a7', 0.82],
    ['#cfc9c0', 0.86],
    ['#b6b0a6', 0.8],
    ['#efe3c8', 0.94],
    ['#f3ead8', 0.96],
  ],
  // The greens: the plants, the green outside the windows, the ticks on the boards.
  plant: [
    [PALETTE.plant, 1],
    [PALETTE.plantDark, 0.7],
    ['#9bc53d', 1.06],
    ['#6cc24a', 1.02],
    ['#7ed957', 1.1],
    ['#7fc463', 1.04],
    ['#8fd16f', 1.08],
    ['#9be07a', 1.14],
    ['#2a9d4b', 0.78],
    ['#1f7a3a', 0.68],
    ['#2d6a4f', 0.62],
    ['#52b788', 1],
    ['#80b918', 1.02],
    ['#6a994e', 0.9],
    ['#06d6a0', 1.1],
    ['#7cf29a', 1.3],
  ],
  // The pots.
  pot: [[PALETTE.pot, 1]],
} as const satisfies Record<'wood' | 'ink' | 'metal' | 'brass' | 'desk' | 'plant' | 'pot', readonly (readonly [string, number])[]>;

type Part = keyof typeof PARTS;

/** An accent material made so far: the office colour it was made with, and which accent it answers to. */
interface Accent {
  material: THREE.MeshToonMaterial;
  own: string;
  slot: number;
}

const accents: Accent[] = [];
/** The materials made so far, by slot and office colour: a pair is only ever made once. */
const slots: Record<string, THREE.MeshToonMaterial> = {};

/** The palette in force, so an accent made after one was chosen comes out in it too. */
let current: Palette | null = null;

/**
 * One of the palette's accent slots, for a rug, a chair or a pouf: `slot` picks the accent in turn, so
 * no two neighbours in a row match and none of them is random (see the callers in seats.ts, room.ts,
 * catalog.ts and wing.ts). A material of its own, so a palette repaints these and nothing else.
 */
export function accent(slot: number, own: string): THREE.MeshToonMaterial {
  const key = `${slot}|${own}`;
  let material = slots[key];
  if (!material) {
    material = toonUnique(own);
    slots[key] = material;
    accents.push({ material, own, slot });
  }
  material.color.set(current ? current.accents[slot % current.accents.length] : own);
  return material;
}

/** Paints the room from `p`, or puts the office's own colours back when there is none. */
export function paintPalette(p: Palette | null): void {
  current = p;
  for (const [part, list] of Object.entries(PARTS) as [Part, readonly (readonly [string, number])[]][]) {
    for (const [own, dark] of list) toon(own).color.set(p ? shade(p[part], dark) : own);
  }
  for (const a of accents) a.material.color.set(p ? p.accents[a.slot % p.accents.length] : a.own);
}
