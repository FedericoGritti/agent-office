// Building a worker's body: the bean it is, its eyes and its face, the headset and the antenna with the
// status light on top, its arms (with a hand at the end of each) and its feet.
//
// Worker.ts keeps what it does with them — where they are each frame, what they wear, what they hold
// (see worker-stance.ts, worker-dress.ts and worker-props.ts) — and this is only how they are made.

import * as THREE from 'three';
import { mesh, toon, toonUnique } from '../toon';
import { STATUS_BULB } from './worker-badges';
import { buildFace, type Face } from './worker-face';

/** Where a worker's body starts out: its hips, where its arms hang from, and the light on its antenna. */
const ARM_Y = 0.55;

/** What a worker's body is made of, in the order worker.ts builds it. */
export interface Body {
  skin: THREE.MeshToonMaterial;
  eyes: THREE.Mesh[];
  pupils: THREE.Mesh[];
  headset: THREE.Object3D[];
  armL: THREE.Group;
  armR: THREE.Group;
  feet: THREE.Mesh[];
  /** The status light, and the mesh it is on. */
  bulb: THREE.MeshToonMaterial;
  bulbMesh: THREE.Mesh;
  /** Its brows and its mouth, posed each frame (see worker-face.ts). */
  face: Face;
}

/** Builds the body into `into` (the worker's own body group), and hands back what it is made of. */
export function buildWorkerBody(into: THREE.Group, color: string): Body {
  const skin = toonUnique(color);
  const white = toon('#ffffff');
  const ink = toon('#1d1d1d');
  const dark = toon('#2b2d42');

  // Bean-shaped body.
  into.add(mesh(new THREE.CapsuleGeometry(0.28, 0.3, 8, 16), skin, 0, 0.55, 0));
  // Big cartoon eyes.
  const eyes: THREE.Mesh[] = [];
  const pupils: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.09, 12, 10), white, sx * 0.11, 0.7, 0.23, false);
    eye.scale.z = 0.6;
    into.add(eye);
    const pupil = mesh(new THREE.SphereGeometry(0.045, 10, 8), ink, sx * 0.11, 0.7, 0.29, false);
    into.add(pupil);
    eyes.push(eye, pupil);
    pupils.push(pupil);
  }
  // A mouth, and brows over the eyes: what it looks like it's thinking, on a face that had none.
  const face = buildFace(ink);
  into.add(face.root);
  // Headset: band over the bean, and a cup each side.
  const headset: THREE.Object3D[] = [];
  const band = mesh(new THREE.TorusGeometry(0.29, 0.025, 6, 20, Math.PI), dark, 0, 0.72, 0, false);
  band.rotation.y = Math.PI / 2;
  into.add(band);
  headset.push(band);
  for (const sx of [-1, 1]) {
    const cup = mesh(new THREE.SphereGeometry(0.07, 10, 8), dark, sx * 0.29, 0.72, 0, false);
    into.add(cup);
    headset.push(cup);
  }
  // Antenna, with the status light on top of it.
  into.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), dark, 0, 1.07, 0, false));
  const bulb = toonUnique(STATUS_BULB.starting);
  bulb.emissive = new THREE.Color(STATUS_BULB.starting).multiplyScalar(0.6);
  const bulbMesh = mesh(new THREE.SphereGeometry(0.075, 12, 10), bulb, 0, 1.2, 0, false);
  into.add(bulbMesh);

  const arm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, ARM_Y, 0.05);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.055, 0.16, 4, 8), skin, 0, -0.12, 0));
    // A hand at the end of it, so the arm ends in a fist rather than a cut tube.
    pivot.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), skin, 0, -0.26, 0, false));
    into.add(pivot);
    return pivot;
  };
  const armL = arm(-0.3);
  const armR = arm(0.3);
  const feet: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const foot = mesh(new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), skin, sx * 0.12, 0.2, 0.05);
    into.add(foot);
    feet.push(foot);
  }

  return { skin, eyes, pupils, headset, armL, armR, feet, bulb, bulbMesh, face };
}
