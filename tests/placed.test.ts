// Moving a piece of furniture: the parts, the colliders and the use-point turn together about the
// piece's own middle, and a thing hung on a wall stays on it. Both were wrong in ways you could see:
// a quarter turn walked the piece back towards where the room built it, and a collider that was left
// behind stood in the room as an invisible wall the piece had long left.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setPlacements } from '../src/shared/placement.js';
import { applyPiece, clearPieces, placed, placedPieces } from '../src/client/world/office/placed.js';
import type { Collider } from '../src/client/world/types.js';

test('a quarter turn turns a piece on the spot, not about where it was built', () => {
  setPlacements(null);
  clearPieces();
  const middle = new THREE.Object3D();
  const plaque = new THREE.Object3D();
  plaque.position.set(1, 0, 0);
  placed([middle, plaque], 'test-piece', { x: 0, z: 0 });
  const piece = placedPieces()[0];

  // Somewhere else first, then a quarter turn there.
  applyPiece(piece, { x: 5, z: -2, rotY: 0, hidden: false });
  assert.deepEqual([middle.position.x, middle.position.z], [5, -2]);
  applyPiece(piece, { x: 5, z: -2, rotY: Math.PI / 2, hidden: false });

  // The middle hasn't travelled...
  assert.deepEqual([middle.position.x, middle.position.z], [5, -2]);
  // ...and the plaque, a metre out to the east, is a metre out to the north of it (a right-handed turn
  // about y takes +x to -z).
  assert.ok(Math.abs(plaque.position.x - 5) < 1e-9, `x ${plaque.position.x}`);
  assert.ok(Math.abs(plaque.position.z - -3) < 1e-9, `z ${plaque.position.z}`);
  assert.ok(Math.abs(plaque.rotation.y - Math.PI / 2) < 1e-9, `rot ${plaque.rotation.y}`);
});

test('a piece takes its colliders with it when it moves', () => {
  setPlacements(null);
  clearPieces();
  const group = new THREE.Object3D();
  group.position.set(4, 0, -3);
  // A box round the piece's middle, the way every builder writes one: the whiteboard's, a desk's.
  const box: Collider = { minX: 3, maxX: 5, minZ: -3.5, maxZ: -2.5, top: 1.2 };
  placed(group, 'test-box', { x: 4, z: -3, rotY: Math.PI }, [box]);
  applyPiece(placedPieces()[0], { x: 6, z: -1, rotY: Math.PI, hidden: false });

  assert.deepEqual([group.position.x, group.position.z], [6, -1]);
  // The box goes with it: left where it was, it's a wall you walk into and can't see.
  assert.deepEqual([(box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2], [6, -1]);
  assert.deepEqual([box.maxX - box.minX, box.maxZ - box.minZ], [2, 1]);
});

test('a board goes wherever you carry it, and keeps the height it hangs at', () => {
  setPlacements(null);
  clearPieces();
  const group = new THREE.Object3D();
  // A wall board two metres up: carried across the room it stays two metres up, so it floats.
  group.position.set(-9.84, 2.1, -12.92);
  placed(group, 'test-board', { x: -9.84, z: -12.92, rotY: 0 });
  applyPiece(placedPieces()[0], { x: 2.5, z: -4, rotY: 0, hidden: false });
  assert.deepEqual([group.position.x, group.position.y, group.position.z], [2.5, 2.1, -4]);
});
