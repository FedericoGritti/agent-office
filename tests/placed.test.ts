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

/** A measurement, compared the way the room's own arithmetic deserves: a tenth of a millimetre is the
 *  size of nobody's furniture. */
function near(got: number, want: number): void {
  assert.ok(Math.abs(got - want) < 1e-9, `${got} is not ${want}`);
}

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

test('a piece made bigger grows on its own spot, standing on the floor, with what you walk into', () => {
  setPlacements(null);
  clearPieces();
  const group = new THREE.Object3D();
  group.position.set(2, 0, -1);
  // A pot two thirds of a metre across standing on the floor, the way footprint() writes one.
  const box: Collider = { minX: 1.7, maxX: 2.3, minZ: -1.3, maxZ: -0.7, bottom: 0, top: 0.5 };
  placed(group, 'add-1', { x: 2, z: -1 }, [box]);
  const piece = placedPieces()[0];

  applyPiece(piece, { x: 2, z: -1, rotY: 0, scale: 2, hidden: false });
  // The object itself, twice the size, with its middle still on the spot it was put.
  near(group.scale.x, 2);
  assert.deepEqual([group.position.x, group.position.z], [2, -1]);
  // Twice as wide and twice as tall, and no further off the floor than it was.
  near(box.minX, 1.4);
  near(box.maxX, 2.6);
  near(box.bottom!, 0);
  near(box.top!, 1);

  // Down to the size it came: exactly that size, on the spot it grew about.
  applyPiece(piece, { x: 2, z: -1, rotY: 0, scale: 1, hidden: false });
  near(group.scale.x, 1);
  near(box.minX, 1.7);
  near(box.maxX, 2.3);
  near(box.top!, 0.5);

  // Twice at the same size grows nothing twice: it is the size, not the turning of the wheel, that
  // says how big the piece is.
  applyPiece(piece, { x: 2, z: -1, rotY: 0, scale: 1.5, hidden: false });
  applyPiece(piece, { x: 2, z: -1, rotY: 0, scale: 1.5, hidden: false });
  near(group.scale.x, 1.5);
  // Half again as wide about its middle: a third of a metre out becomes 45 cm out.
  near(box.maxX, 2.45);
});

test('a piece carried up into the air stays there, with what you walk into', () => {
  setPlacements(null);
  clearPieces();
  const group = new THREE.Object3D();
  group.position.set(4, 0, -3);
  const box: Collider = { minX: 3.7, maxX: 4.3, minZ: -3.3, maxZ: -2.7, bottom: 0, top: 0.5 };
  placed(group, 'add-1', { x: 4, y: 0, z: -3 }, [box], undefined, true);
  const piece = placedPieces()[0];
  assert.equal(piece.at.y, 0, 'it starts on the floor its spot says');

  // Lifted two metres: the object and its box go up, and it is still over the same spot.
  applyPiece(piece, { x: 4, y: 2, z: -3, rotY: 0, hidden: false });
  near(group.position.y, 2);
  near(box.bottom!, 2);
  near(box.top!, 2.5);
  assert.deepEqual([group.position.x, group.position.z], [4, -3]);

  // Left up there, nothing brings it down: the height is where it was left, not where it was built.
  applyPiece(piece, { x: 4, y: 2, z: -3, rotY: 0, hidden: false });
  near(group.position.y, 2);

  // Grown while it hangs, it grows about the height it stands at, not about the floor below it.
  applyPiece(piece, { x: 4, y: 2, z: -3, rotY: 0, scale: 2, hidden: false });
  near(box.bottom!, 2);
  near(box.top!, 3);
  near(box.maxX, 4.6);
});

test('a piece grows about its own middle while it is being carried somewhere else', () => {
  setPlacements(null);
  clearPieces();
  const group = new THREE.Object3D();
  const box: Collider = { minX: -0.3, maxX: 0.3, minZ: -0.3, maxZ: 0.3, bottom: 0, top: 0.4 };
  placed(group, 'add-2', { x: 0, z: 0 }, [box]);
  // Moved and grown in one go, the way the editor does it every frame: the collider follows the piece
  // to where it is now, and is as big as it is now, not as big as it was where it stood before.
  applyPiece(placedPieces()[0], { x: 5, z: -2, rotY: 0, scale: 3, hidden: false });
  assert.deepEqual([group.position.x, group.position.z], [5, -2]);
  near(box.minX, 5 - 0.9);
  near(box.maxX, 5 + 0.9);
  near(box.minZ, -2 - 0.9);
  near(box.top!, 1.2);
});
