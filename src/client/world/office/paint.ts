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
 * The parts of the room a palette paints by colour, and how dark each of the office's own runs against
 * the palette's: the wood's grain, the ink's fittings, the leaves against the leaves' shadows.
 */
const PARTS = {
  wood: [
    [PALETTE.wood, 1],
    ['#8a5a3b', 0.72],
    ['#7a5236', 0.62],
  ],
  ink: [
    [PALETTE.ink, 1],
    [PALETTE.deskLeg, 0.92],
  ],
  desk: [[PALETTE.desk, 1]],
  plant: [
    [PALETTE.plant, 1],
    [PALETTE.plantDark, 0.68],
  ],
  pot: [[PALETTE.pot, 1]],
} as const satisfies Record<'wood' | 'ink' | 'desk' | 'plant' | 'pot', readonly (readonly [string, number])[]>;

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
