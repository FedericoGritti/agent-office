// A quarter turn turns a piece where it stands: its own middle stays put, and what the piece is made of
// swings round it. It used to turn about the place the room was built with, which walked the whole
// piece back towards its old spot every time you pressed R.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setPlacements } from '../src/shared/placement.js';
import { applyPiece, clearPieces, placed, placedPieces } from '../src/client/world/office/placed.js';

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
