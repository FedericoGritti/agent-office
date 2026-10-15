// A worker's face, past its eyes: the brows over them and the mouth under them, built with it and moved
// each frame by whatever it is doing (see worker-stance.ts for the brow and mouth it is posed from).
//
// The eyes are the worker's own (they blink, and look about: see worker.ts), and this is the rest of it.

import * as THREE from 'three';
import { mesh } from '../toon';
import type { Stance } from './worker-stance';

/** Where the face sits on the body: the eyes are at 0.7, and the bean reaches out to z 0.28. */
const BROW_Y = 0.84;
const MOUTH_Y = 0.585;
const FACE_Z = 0.25;

export interface Face {
  /** What the brows and the mouth are built into: added to the worker's body. */
  root: THREE.Group;
  /** What this frame's stance makes of it: brows drawn down while it works, up when it's pleased, and
   *  a mouth that opens with whatever it is at. */
  pose(s: Stance): void;
}

export function buildFace(ink: THREE.Material): Face {
  const root = new THREE.Group();
  const brows: { mesh: THREE.Mesh; side: number }[] = [];
  for (const sx of [-1, 1]) {
    const brow = mesh(new THREE.CapsuleGeometry(0.016, 0.06, 4, 8).rotateZ(Math.PI / 2), ink, sx * 0.11, BROW_Y, FACE_Z, false);
    root.add(brow);
    brows.push({ mesh: brow, side: sx });
  }
  // A flattened ball for a mouth: shut it is a line, and it opens as the stance asks.
  const mouth = mesh(new THREE.SphereGeometry(0.05, 12, 10), ink, 0, MOUTH_Y, FACE_Z, false);
  mouth.scale.set(0.9, 0.32, 0.6);
  root.add(mouth);

  return {
    root,
    pose(s) {
      for (const b of brows) {
        // The inner end goes down when the brow is drawn down: each one tilts the other way.
        b.mesh.rotation.z = b.side * s.brow * 0.5;
        b.mesh.position.y = BROW_Y - s.brow * 0.02;
      }
      mouth.scale.y = 0.32 + Math.max(0, s.mouth) * 1.1;
    },
  };
}
