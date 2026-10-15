// Geometry placement for a chess set. The downloaded model may sit inside translated, turned and scaled
// furniture, so every measurement and move is expressed in the model frame rather than in world axes.

import * as THREE from 'three';

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
