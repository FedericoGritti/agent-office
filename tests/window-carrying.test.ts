// Carrying a window about the office: it slides along the wall you're looking at, and it goes on to
// another wall when you look at that one — not only along the wall it started on (see
// features/layout-editor/windows.ts). What it can't do is land where a window can't be.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLOOR } from '../src/shared/layout.js';
import { setWindows } from '../src/shared/windows.js';
import { Windows } from '../src/client/features/layout-editor/windows.js';

/** An editor carrying windows, with a camera it looks through: `look` stands it somewhere and aims it. */
function make() {
  const camera = new THREE.PerspectiveCamera(70, 1.6, 0.1, 200);
  const windows = new Windows({ group: new THREE.Object3D() }, camera, { save: () => {}, rebuild: () => {}, changed: () => {} });
  return {
    windows,
    /** Stand at (x, z), eye height, looking at (atX, atY, atZ). */
    look(x: number, z: number, atX: number, atY: number, atZ: number) {
      camera.position.set(x, 1.7, z);
      camera.lookAt(atX, atY, atZ);
      camera.updateMatrixWorld(true);
      windows.update();
    },
  };
}

test('a window slides along its own wall', () => {
  setWindows(null);
  const { windows, look } = make();
  windows.toggle();

  // Standing in the room looking at one of the west wall's windows, and taking it.
  look(-8, -3, FLOOR.minX, 2.2, -3);
  assert.equal(windows.looking?.id, 'window-west-2');
  assert.ok(windows.pickUp());

  // Looking a little further along the same wall: it follows, on the same wall.
  look(-10, -2.5, FLOOR.minX, 2.2, -2.5);
  assert.equal(windows.carrying?.wall, 'west');
  assert.equal(windows.carrying?.u, -2.5);
});

test('a window goes on to another wall when you look at that one', () => {
  setWindows(null);
  const { windows, look } = make();
  windows.toggle();
  look(-8, -3, FLOOR.minX, 2.2, -3);
  assert.ok(windows.pickUp());

  // Carried round the corner: looking at the south wall puts it in the south wall, where it fits.
  look(6, 6, 6, 2.2, FLOOR.maxZ);
  assert.equal(windows.carrying?.wall, 'south');
  assert.equal(windows.carrying?.u, 6);

  // And on to the wall opposite the one it was built in: looking at the east wall.
  look(8, -6, FLOOR.maxX, 2.2, -6);
  assert.equal(windows.carrying?.wall, 'east');
  assert.equal(windows.carrying?.u, -6);

  // Where it can't be, it stays where it is instead: in the balcony's doorway.
  look(0, 8, -4, 2.2, FLOOR.maxZ);
  assert.equal(windows.carrying?.wall, 'east', 'the doorway is refused, and it stays on the east wall');
  assert.equal(windows.carrying?.u, -6);
  assert.match(windows.refused ?? '', /doorway/);
});
