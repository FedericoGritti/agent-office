// Geometry placement for a chess set. The downloaded model may sit inside translated, turned and scaled
// furniture, so every measurement and move is expressed in the model frame rather than in world axes.

import * as THREE from 'three';
import { parsePiece, startSquare } from '../../../shared/chess';
import type { Collider } from '../../world/types';

/** The exact bounds of an object's geometry in `frame` coordinates, independent of the furniture's
 * world translation, rotation and scale. */
export function boundsIn(object: THREE.Object3D, frame: THREE.Object3D): THREE.Box3 {
  frame.updateWorldMatrix(true, false);
  object.updateWorldMatrix(true, true);
  const worldToFrame = frame.matrixWorld.clone().invert();
  const bounds = new THREE.Box3().makeEmpty();
  const corner = new THREE.Vector3();

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) return;
    for (let at = 0; at < 8; at++) {
      corner
        .set(at & 1 ? box.max.x : box.min.x, at & 2 ? box.max.y : box.min.y, at & 4 ? box.max.z : box.min.z)
        .applyMatrix4(mesh.matrixWorld)
        .applyMatrix4(worldToFrame);
      bounds.expandByPoint(corner);
    }
  });
  return bounds;
}

export interface BoardGrid {
  x: number;
  z: number;
  side: number;
}

/** The playable square grid read from the model's own starting pieces. The board mesh includes a marble
 * border, so its outer width is not eight squares. */
export function gridFromPieces(pieces: readonly THREE.Object3D[], frame: THREE.Object3D): BoardGrid | null {
  const starts = new Map<string, THREE.Object3D>();
  for (const object of pieces) {
    const piece = parsePiece(object.name);
    if (piece) starts.set(startSquare(piece), object);
  }
  const a1Object = starts.get('a1');
  const h1Object = starts.get('h1');
  const a8Object = starts.get('a8');
  if (!a1Object || !h1Object || !a8Object) return null;
  const inFrame = (object: THREE.Object3D) => frame.worldToLocal(object.getWorldPosition(new THREE.Vector3()));
  const a1 = inFrame(a1Object);
  const h1 = inFrame(h1Object);
  const a8 = inFrame(a8Object);
  const cell = (a1.x - h1.x) / 7;
  if (cell <= 0 || a8.z <= a1.z) return null;
  return { x: (a1.x + h1.x) / 2, z: (a1.z + a8.z) / 2, side: cell * 8 };
}

/** Replaces a model's generic solid box with the world-space slab one can actually stand on. For a
 * chess set that is the board, not an invisible block as tall as its king. */
export function fitColliderTo(collider: Collider, surface: THREE.Object3D): boolean {
  surface.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(surface);
  if (box.isEmpty()) return false;
  collider.minX = box.min.x;
  collider.maxX = box.max.x;
  collider.minZ = box.min.z;
  collider.maxZ = box.max.z;
  collider.bottom = box.min.y;
  collider.top = box.max.y;
  return true;
}

/** Moves one piece until the middle of its base is at `target` in the set's frame. The change is added
 * to its existing position: a displacement is not an absolute coordinate. */
export function placeBaseAt(object: THREE.Object3D, frame: THREE.Object3D, target: THREE.Vector3): boolean {
  const parent = object.parent;
  if (!parent) return false;
  const box = boundsIn(object, frame);
  if (box.isEmpty()) return false;
  const current = box.getCenter(new THREE.Vector3());
  current.y = box.min.y;
  const delta = target.clone().sub(current);

  // A vector in frame space is the difference between two points. Converting only its end as a point
  // would include the two nodes' origins and recreate the bug that scattered every piece.
  const originInWorld = frame.localToWorld(new THREE.Vector3());
  const endInWorld = frame.localToWorld(delta.clone());
  const originInParent = parent.worldToLocal(originInWorld);
  const endInParent = parent.worldToLocal(endInWorld);
  object.position.add(endInParent.sub(originInParent));
  object.updateWorldMatrix(false, true);
  return true;
}
