import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { boundsIn, placeBaseAt } from '../src/client/features/chess/placement.js';

const close = (actual: number, wanted: number) => assert.ok(Math.abs(actual - wanted) < 1e-8, `${actual} should be ${wanted}`);

function baseIn(object: THREE.Object3D, frame: THREE.Object3D): THREE.Vector3 {
  const box = boundsIn(object, frame);
  const middle = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(middle.x, box.min.y, middle.z);
}

test('a piece is stood on a square through the furniture and model transforms', () => {
  const furniture = new THREE.Group();
  furniture.position.set(7, 1.4, -3);
  furniture.rotation.y = Math.PI * 0.37;
  furniture.scale.setScalar(2.6);
  const frame = new THREE.Group();
  frame.position.set(-0.03, 0.12, 0.04);
  furniture.add(frame);
  const holder = new THREE.Group();
  holder.position.set(0.02, -0.01, 0.03);
  frame.add(holder);
  const piece = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.03));
  piece.position.set(0.2, 0.077, -0.15);
  holder.add(piece);

  for (const wanted of [new THREE.Vector3(0.24, 0.02, -0.24), new THREE.Vector3(-0.17, 0.02, 0.1)]) {
    assert.equal(placeBaseAt(piece, frame, wanted), true);
    const actual = baseIn(piece, frame);
    close(actual.x, wanted.x);
    close(actual.y, wanted.y);
    close(actual.z, wanted.z);
  }
});

test('board bounds stay in model metres when the furniture is turned and scaled', () => {
  const furniture = new THREE.Group();
  furniture.position.set(-4, 0.7, 9);
  furniture.rotation.y = Math.PI * 0.63;
  furniture.scale.setScalar(3.4);
  const frame = new THREE.Group();
  furniture.add(frame);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.5532, 0.0173, 0.5532));
  board.position.y = 0.0173 / 2;
  frame.add(board);

  const size = boundsIn(board, frame).getSize(new THREE.Vector3());
  close(size.x, 0.5532);
  close(size.y, 0.0173);
  close(size.z, 0.5532);
});
