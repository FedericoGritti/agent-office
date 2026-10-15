// Carrying a window about the office: it slides along the wall you're looking at, and it goes on to
// another wall when you look at that one — not only along the wall it started on (see
// features/layout-editor/windows.ts). What it can't do is land where a window can't be.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLOOR } from '../src/shared/layout.js';
import { setWindows } from '../src/shared/windows.js';
import { Windows } from '../src/client/features/layout-editor/windows.js';

/** A length without the last bits of floating-point noise: a step of a quarter metre lands on the grid. */
const exact = (n: number): number => Math.round(n * 1000) / 1000;

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

test('a window follows the look up and down a wall', () => {
  setWindows(null);
  const { windows, look } = make();
  windows.toggle();
  const stands = (w: Windows) => [w.carrying?.y0, w.carrying?.y1].map((y) => Math.round((y ?? -1) * 1000) / 1000);

  // The lounge's west wall has room above it, so the window there can be lifted.
  look(-8, 10, FLOOR.minX, 2.2, 10);
  assert.equal(windows.looking?.id, 'window-west-4');
  assert.ok(windows.pickUp());
  assert.deepEqual(stands(windows), [1.1, 3.3], 'where the room built it, though the look is not on a step');

  // Looking higher up the same wall lifts it in quarter-metre steps, keeping its height.
  look(-8, 10, FLOOR.minX, 4.6, 10);
  assert.deepEqual(stands(windows), [3.6, 5.8]);

  // Looking above the ceiling leaves it under the ceiling, and below the floor on the floor.
  look(-8, 10, FLOOR.minX, 9, 10);
  assert.deepEqual(stands(windows), [4.6, 6.8]);
  look(-8, 10, FLOOR.minX, -4, 10);
  assert.deepEqual(stands(windows), [0, 2.2]);
});

test('a window still cannot be carried into another one, which says which', () => {
  setWindows(null);
  const { windows, look } = make();
  windows.toggle();

  // The room's own west windows have one of the high row straight above them: lifted, that is refused,
  // and the window stays where it was.
  look(-8, -3, FLOOR.minX, 2.2, -3);
  assert.equal(windows.looking?.id, 'window-west-2');
  assert.ok(windows.pickUp());
  look(-8, -3, FLOOR.minX, 4.6, -3);
  assert.deepEqual([windows.carrying?.y0, windows.carrying?.y1], [1.1, 3.3]);
  assert.equal(windows.refused, 'West window 6 is there');
});

test('a window is sized while you carry it', () => {
  setWindows(null);
  const { windows, look } = make();
  windows.toggle();

  // The lounge's own window on the west wall, beside the exit door and short of the end of the wall.
  look(-8, 10, FLOOR.minX, 2.2, 10);
  assert.equal(windows.looking?.id, 'window-west-4');
  assert.ok(windows.pickUp());
  assert.equal(windows.width, 3);

  // A step wider, and it stays where it stands: a hole grows about its own middle.
  assert.ok(windows.resize(1));
  assert.equal(exact(windows.width), 3.25);
  assert.equal(windows.carrying?.u, 10);

  // Taller from its sill up, which is where the room's row put it, up to the ceiling.
  assert.equal(exact(windows.height), 2.2);
  assert.ok(windows.heighten(1));
  assert.equal(exact(windows.height), 2.45);
  assert.equal(windows.carrying?.y0, 1.1);

  // Followed to where it stops: the doorway on that wall is 0.4 m from its edge at 4.75 m wide, and the
  // step after that one changes nothing at all.
  for (let i = 0; i < 20; i++) windows.resize(1);
  assert.equal(windows.width, 4.75);
  assert.equal(windows.carrying?.y0, 1.1, 'and widening never moves it along the wall');
});

test('a window beside another one cannot be widened into it', () => {
  setWindows(null);
  const { windows, look } = make();
  windows.toggle();

  // The boss's office's pair on the east wall stand exactly the 0.4 m apart the room leaves between two
  // windows: a step wider each way would be inside the other one, so no step is taken.
  look(0, 9.4, FLOOR.maxX, 4.7, 9.4);
  assert.equal(windows.looking?.id, 'loft-east-1');
  assert.ok(windows.pickUp());
  assert.equal(windows.width, 1.8);

  assert.ok(!windows.resize(1), 'where a window would be inside another, nothing happens');
  assert.equal(windows.width, 1.8);

  // Narrower the other way there is room, and it goes there.
  assert.ok(windows.resize(-1));
  assert.equal(windows.width, 1.55);
});
