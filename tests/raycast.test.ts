import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RAY_TRIANGLE_BUDGET, coarseMeshes } from '../src/client/core/raycast.js';

/** A model of `tris` triangles, all inside a box one unit across, so its box is worth testing. */
function heavy(tris: number): THREE.Mesh {
  const pos = new Float32Array(tris * 9);
  for (let i = 0; i < pos.length; i++) pos[i] = (Math.random() - 0.5) * 0.8;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
}

function sceneWith(light: THREE.Mesh, big: THREE.Mesh): THREE.Group {
  const scene = new THREE.Group();
  light.position.set(0, 0, -2);
  big.position.set(0, 0, -6);
  scene.add(light, big);
  scene.updateMatrixWorld(true);
  return scene;
}

const rayAt = () => new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));

test('a heavy model answers the ray with its box, and a light one keeps its triangles', () => {
  const scene = sceneWith(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()), heavy(RAY_TRIANGLE_BUDGET + 1000));
  const [light, big] = scene.children as THREE.Mesh[];

  const before = rayAt().intersectObjects([scene], true);
  const bigBefore = before.filter((h) => h.object === big);
  assert.ok(bigBefore.length > 1, `a model has one intersection per triangle, and it had ${bigBefore.length}`);

  assert.equal(coarseMeshes([scene]), 1);
  const after = rayAt().intersectObjects([scene], true);
  const bigAfter = after.filter((h) => h.object === big);
  // One intersection now, not one per triangle — and it's still there, blocking the same view.
  assert.equal(bigAfter.length, 1);
  assert.equal(after[0].object, light);
  // The box is the model's own box, so its near side is never further away than a triangle was.
  assert.ok(bigAfter[0].distance <= Math.min(...bigBefore.map((h) => h.distance)) + 1e-9);
  // And it is worth nothing to sweep the same scene again.
  assert.equal(coarseMeshes([scene]), 0);
});

test('a box that the ray misses blocks nothing, and a model under the budget is left alone', () => {
  const scene = sceneWith(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()), heavy(RAY_TRIANGLE_BUDGET + 1000));
  const [, big] = scene.children as THREE.Mesh[];
  coarseMeshes([scene]);
  // Off to one side, out of the ray's way.
  big.position.set(9, 9, -6);
  scene.updateMatrixWorld(true);
  assert.equal(rayAt().intersectObjects([scene], true).filter((h) => h.object === big).length, 0);

  const small = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  small.position.set(0, 0, -3);
  const lightScene = new THREE.Group();
  lightScene.add(small);
  lightScene.updateMatrixWorld(true);
  assert.equal(coarseMeshes([lightScene]), 0);
  assert.equal(small.raycast, THREE.Mesh.prototype.raycast);
});
