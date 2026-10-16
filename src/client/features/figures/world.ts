import * as THREE from 'three';
import { FIGURES, type FiguresBoard } from '../../../shared/layout';
import { placed } from '../../world/office/placed';
import { mesh, roundedBox, textPlane, toon } from '../../world/toon';
import type { Collider, Interactable } from '../../world/types';
import type { Fixture } from '../../world/office/fixture';

// The Figures board: a rolling stand where the potted plant used to stand, in the middle of the
// desks. Its face shows one picture from the floor's selected folder at a time, with the file name
// along the bottom (see index.ts). A click, or E, moves to the next; C chooses the folder.

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
  /** The plate under the board: the feature writes the file name on it (see features/figures/index.ts). */
  setLabel(text: string): void;
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

  // The plate goes under the board, on the stand's lower bar: a caption for the picture rather than a
  // name hung over it. It is rebuilt only when the name changes (the boards ask again on a timer, and a
  // name left alone must not be rebuilt every time).
  let plaque: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  let shown = '';
  const setLabel = (text: string) => {
    if (text === shown) return;
    shown = text;
    if (plaque) {
      group.remove(plaque);
      plaque.geometry.dispose();
      plaque.material.map?.dispose();
      plaque.material.dispose();
    }
    plaque = textPlane(text, { bg: '#fffaf3', size: 48 });
    plaque.scale.multiplyScalar(0.55);
    // The bar across the stand's feet, which the height of a plate this size fits over exactly.
    plaque.position.set(0, bottom - 0.2, 0.05);
    group.add(plaque);
  };
  setLabel('🖼️ Figures');

  return { group, colliders, interactable, face, texture, setLabel };
}

declare module '../../world/types' {
  interface OfficeHandles {
    /** The stands that show the project's figures, one picture each. */
    figures: FiguresStand[];
  }
}

/** The figures boards: the row of them in the middle aisle among the desks (see FIGURES). */
export const figures: Fixture<'figures'> = (site) => {
  const stands = FIGURES.map(buildFigures);
  const group = new THREE.Group();
  for (const s of stands) group.add(s.group);
  stands.forEach((s, i) => placed(s.group, `figures-${i + 1}`, { ...FIGURES[i], rotY: Math.PI }, s.colliders, site));
  return { group, colliders: stands.flatMap((s) => s.colliders), interactables: stands.map((s) => s.interactable), handle: { figures: stands } };
};
