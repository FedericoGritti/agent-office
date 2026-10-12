import * as THREE from 'three';
import { FIGURES, type FiguresBoard } from '../../../shared/layout';
import { mesh, roundedBox, toon } from '../../world/toon';
import type { Collider, Interactable } from '../../world/types';
import type { Fixture } from '../../world/office/fixture';

// The figures board: a rolling stand where the potted plant used to stand, in the middle of the
// desks. Its face shows one picture from the project's `images/` folder at a time, with the file
// name along the bottom (see index.ts). A click, or E, moves to the next.

const ALU = '#aab4be';
const RUBBER = '#3a3a3a';
/** The face's canvas, in pixels per meter. */
const PX = 700;

export interface FiguresStand {
  group: THREE.Group;
  colliders: Collider[];
  /** Walk up and click it, or press E. */
  interactable: Interactable;
  /** The face the feature draws the current figure on, and the texture to refresh after. */
  face: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
}

export function buildFigures(board: FiguresBoard): FiguresStand {
  const { x, z, width, height, bottom } = board;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  // Turned to face into the room the way the desks are: the face (and the picture on it) looks -z.
  group.rotation.y = Math.PI;
  const alu = toon(ALU);
  const mid = bottom + height / 2;
  const post = width / 2 + 0.1;

  // The surface in its aluminium frame; the back is a plain panel. The frame is a board lying flat,
  // turned up on edge: without that it lies across the face and hides it.
  const frame = mesh(roundedBox(width + 0.14, 0.07, height + 0.14, 0.04), alu, 0, mid, 0);
  frame.rotation.x = Math.PI / 2;
  group.add(frame);
  const face = document.createElement('canvas');
  face.width = Math.round(width * PX);
  face.height = Math.round(height * PX);
  const texture = new THREE.CanvasTexture(face);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  plane.position.set(0, mid, 0.04);
  group.add(plane);

  // Two posts on feet with a caster at each end, and a bar across the bottom.
  for (const sx of [-post, post]) {
    group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, bottom + height + 0.2, 8), alu, sx, (bottom + height + 0.2) / 2, 0, false));
    group.add(mesh(roundedBox(0.5, 0.04, 0.06, 0.02), alu, sx, 0.06, 0, false));
    for (const dz of [-0.2, 0.2]) group.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), toon(RUBBER), sx, 0.035, dz, false));
  }
  group.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, post * 2, 8).rotateZ(Math.PI / 2), alu, 0, 0.3, 0, false));

  const colliders: Collider[] = [{ minX: x - post - 0.1, maxX: x + post + 0.1, minZ: z - 0.42, maxZ: z + 0.42, top: bottom + height + 0.3 }];
  const interactable: Interactable = { kind: 'figures', x, z: z - 1.6, radius: 2.2 };
  group.userData.interact = interactable;
  return { group, colliders, interactable, face, texture };
}

declare module '../../world/types' {
  interface OfficeHandles {
    /** The stands that show the project's figures, one picture each. */
    figures: FiguresStand[];
  }
}

/** The figures boards: the row of them in the middle aisle among the desks (see FIGURES). */
export const figures: Fixture<'figures'> = () => {
  const stands = FIGURES.map(buildFigures);
  const group = new THREE.Group();
  for (const s of stands) group.add(s.group);
  return { group, colliders: stands.flatMap((s) => s.colliders), interactables: stands.map((s) => s.interactable), handle: { figures: stands } };
};
