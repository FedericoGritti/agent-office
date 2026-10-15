import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { boundsIn, fitColliderTo, gridFromPieces, placeBaseAt } from '../src/client/features/chess/placement.js';

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

test('the playable grid comes from the model pieces, not from the board frame', () => {
  const furniture = new THREE.Group();
  furniture.position.set(5, 2, -7);
  furniture.rotation.y = Math.PI / 2;
  furniture.scale.setScalar(6);
  const frame = new THREE.Group();
  furniture.add(frame);
  const node = (name: string, x: number, z: number) => {
    const piece = new THREE.Object3D();
    piece.name = name;
    piece.position.set(x, 0.017392655834555626, z);
    frame.add(piece);
    return piece;
  };
  const pieces = [
    node('piece_rook_white_01', 0.20260828733444214, -0.20260828733444214),
    node('piece_rook_white_02', -0.20260828733444214, -0.20260828733444214),
    node('piece_rook_black_02', 0.20260828733444214, 0.2018999457359314),
  ];

  const grid = gridFromPieces(pieces, frame);
  assert.ok(grid);
  close(grid.x, 0);
  close(grid.z, -0.0003541707992553711);
  close(grid.side, 0.4631046567644392);
  assert.ok(grid.side < 0.5532, 'the marble border is outside the playable squares');
});

test('the collider follows the board slab instead of the tallest chess piece', () => {
  const furniture = new THREE.Group();
  furniture.position.set(3, 0.4, -2);
  furniture.rotation.y = Math.PI / 2;
  furniture.scale.setScalar(8);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.5532, 0.0173, 0.5532));
  board.position.y = 0.0173 / 2;
  furniture.add(board);
  const collider = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, bottom: 0, top: 99 };

  assert.equal(fitColliderTo(collider, board), true);
  const box = new THREE.Box3().setFromObject(board);
  close(collider.minX, box.min.x);
  close(collider.maxX, box.max.x);
  close(collider.minZ, box.min.z);
  close(collider.maxZ, box.max.z);
  close(collider.bottom, box.min.y);
  close(collider.top, box.max.y);
  close(collider.top - collider.bottom, 0.0173 * 8);
});
