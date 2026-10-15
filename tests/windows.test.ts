// The office's windows: where the room builds them, where the editor moves them, what a file written by
// hand may say, and the wall that is built round them. A window is a hole in a wall, so what has to be
// right is where the hole is — and that nothing lands where a window can't be (see shared/windows).

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BALCONY_DOOR, EXIT_DOOR, FLOOR, WALL_T, type Opening } from '../src/shared/layout.js';
import {
  changeWindow,
  heighten,
  newWindowId,
  removeWindow,
  sanitizeWindows,
  setWindows,
  SIZE_STEP,
  sizeOn,
  widen,
  WINDOW_DEFS,
  windowFits,
  windowLabel,
  windowPlacements,
  windows,
} from '../src/shared/windows.js';
import { buildWalls } from '../src/client/world/office/shell.js';
import type { Looks } from '../src/client/world/office/materials.js';
import { toonUnique } from '../src/client/world/toon.js';
import type { Collider } from '../src/client/world/types.js';

/** A stretch of wall, or a hole in one, as (u0, u1, y0, y1) along that wall. */
interface Rect {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

const rectOf = (o: Opening): Rect => ({ u0: o.u - o.width / 2, u1: o.u + o.width / 2, y0: o.y0, y1: o.y1 });

/** A length without the last bits of floating-point noise: a step of a quarter metre lands on the grid. */
const exact = (n: number): number => Math.round(n * 1000) / 1000;

/** The room's outside walls, built with the windows as they stand: what the shell fixture does at build time. */
function built(list = windows()): THREE.Group {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const looks: Looks = { wall: toonUnique('#fffaf3'), trim: toonUnique('#e8e8e8'), planks: [] };
  buildWalls(group, colliders, [...list, EXIT_DOOR, BALCONY_DOOR], looks);
  return group;
}

/** Every stretch of one outside wall that is wall, read off the boxes the walls are built from. */
function wallPieces(group: THREE.Group, side: 'south' | 'east' | 'west'): Rect[] {
  const out: Rect[] = [];
  const alongX = side === 'south';
  const at = side === 'south' ? FLOOR.maxZ + WALL_T / 2 : side === 'west' ? FLOOR.minX - WALL_T / 2 : FLOOR.maxX + WALL_T / 2;
  for (const child of group.children) {
    const piece = child as THREE.Mesh<THREE.BoxGeometry>;
    if (!piece.userData.wall) continue;
    // The south wall runs along x (a piece is `width` wide there and WALL_T deep); the others along z.
    const length = alongX ? piece.geometry.parameters.width : piece.geometry.parameters.depth;
    if (Math.abs((alongX ? piece.position.z : piece.position.x) - at) > 1e-6) continue;
    const middle = alongX ? piece.position.x : piece.position.z;
    const half = piece.geometry.parameters.height / 2;
    out.push({ u0: middle - length / 2, u1: middle + length / 2, y0: piece.position.y - half, y1: piece.position.y + half });
  }
  return out;
}

/** Whether some stretch of wall covers `rect` whole: what a hole must leave uncovered, and what taking one out leaves. */
function covered(pieces: readonly Rect[], rect: Rect): boolean {
  return pieces.some((p) => p.u0 <= rect.u0 + 1e-6 && p.u1 >= rect.u1 - 1e-6 && p.y0 <= rect.y0 + 1e-6 && p.y1 >= rect.y1 - 1e-6);
}

test('the room is built with windows that fit where they are', () => {
  setWindows(null);
  for (const w of WINDOW_DEFS) {
    assert.equal(windowFits(w.wall, w, WINDOW_DEFS, w.id), undefined, `${w.id} does not fit where the room builds it`);
  }
});

test('a window moved, put in or taken out is what every builder reads', () => {
  setWindows(null);
  const west = WINDOW_DEFS.find((w) => w.id === 'window-west-2')!;
  const moved = { ...west, u: west.u + 2 };

  changeWindow(west.id, west, moved);
  assert.equal(windows().find((w) => w.id === west.id)!.u, west.u + 2);
  assert.deepEqual(windowPlacements()[west.id], { u: west.u + 2 });

  // Back where the room builds it: the file forgets it, and remembers nothing at all.
  changeWindow(west.id, west, west);
  assert.deepEqual(windowPlacements(), {});
  assert.equal(windows().find((w) => w.id === west.id)!.u, west.u);

  // A window the room never built: whole in the file, and gone from the file when it goes.
  const extra: Opening = { wall: 'east', u: 6, width: 3, y0: 1.1, y1: 3.3 };
  const id = newWindowId();
  changeWindow(id, undefined, extra);
  assert.ok(windows().some((w) => w.id === id), 'the new window is in the walls');
  assert.equal(windowPlacements()[id]!.u, 6);
  removeWindow(id);
  assert.ok(!windows().some((w) => w.id === id));
  assert.deepEqual(windowPlacements(), {});

  // One of the room's own, taken out: remembered as gone, so it doesn't come back with the next reload.
  removeWindow('loft-east-2');
  assert.ok(!windows().some((w) => w.id === 'loft-east-2'));
  assert.deepEqual(windowPlacements()['loft-east-2'], { deleted: true });
});

test('a window only goes where a window can be', () => {
  setWindows(null);
  const base = WINDOW_DEFS.find((w) => w.id === 'window-south-1')!;
  const at = (over: Partial<Opening>) => ({ ...base, ...over });

  // On top of another window, in the doorway, off the end of the wall, out through the ceiling, across
  // the slab the boss's office stands on, and on a wall with nothing to look out at.
  assert.equal(windowFits('south', at({ u: -9 }), WINDOW_DEFS, base.id), 'South window 2 is there');
  assert.equal(windowFits('south', at({ u: -4, y0: 0.5, y1: 2.4 }), WINDOW_DEFS, base.id), 'the doorway is there');
  assert.equal(windowFits('south', at({ u: 17.5 }), WINDOW_DEFS, base.id), 'the wall ends there');
  assert.equal(windowFits('south', at({ u: 6, y1: 7.2 }), WINDOW_DEFS, base.id), 'it runs out of the wall at the ceiling');
  assert.equal(windowFits('south', at({ u: 13.6 }), WINDOW_DEFS, base.id), "the boss's office floor is there");
  assert.equal(windowFits('north', at({ wall: 'north' }), WINDOW_DEFS, base.id), 'nothing looks out of that wall');

  // And the same window in the meeting room, safely under the boss's floor: it fits.
  const meeting = WINDOW_DEFS.find((w) => w.id === 'meeting-east-1')!;
  assert.equal(windowFits('east', meeting, WINDOW_DEFS, meeting.id), undefined);
});

test('a file written by hand cannot hang a window over the doorway', () => {
  setWindows(null);
  const file = sanitizeWindows({
    // A window moved somewhere it can be: kept, with only what the file says.
    'window-west-1': { u: -9.5 },
    // One taken out, and one pushed into the balcony's doorway, which is not where it can be.
    'window-south-1': { deleted: true },
    'window-south-2': { u: -4 },
    // One moved by something that is not a number, one put off the end of the wall, one added without a
    // size, and a key that was never a window.
    'window-south-3': { u: 'somewhere else' },
    'window-off-the-wall': { wall: 'south', u: 999, width: 3, y0: 1.1, y1: 3.3 },
    'window-half': { wall: 'east', u: 2 },
    junk: 5,
  });
  assert.deepEqual(file, { 'window-west-1': { u: -9.5 }, 'window-south-1': { deleted: true } });

  setWindows(file);
  assert.equal(windows().find((w) => w.id === 'window-west-1')!.u, -9.5);
  assert.ok(!windows().some((w) => w.id === 'window-south-1'), 'the taken-out one is not in the walls');
  assert.equal(windows().find((w) => w.id === 'window-south-2')!.u, -9, 'the doorway is left alone');
  assert.equal(windows().length, WINDOW_DEFS.length - 1, 'nothing was added');
});

test('the wall is built round the window where the file says it stands', () => {
  setWindows(null);
  const base = WINDOW_DEFS.find((w) => w.id === 'window-south-1')!;
  const moved = { ...base, u: 6 };
  const asBuilt = wallPieces(built(), 'south');
  assert.ok(!covered(asBuilt, rectOf(base)), 'the room is built with a hole where the window is');
  assert.ok(covered(asBuilt, rectOf(moved)), 'and wall where it is not');

  changeWindow(base.id, base, moved);
  const pieces = wallPieces(built(), 'south');
  assert.ok(!covered(pieces, rectOf(moved)), 'the hole is where the file moved it to');
  assert.ok(covered(pieces, rectOf(base)), 'and the wall is back where the room had it');

  // Taken out of the wall: a plain stretch of wall stands there.
  setWindows(null);
  removeWindow(base.id);
  assert.ok(covered(wallPieces(built(), 'south'), rectOf(base)));
});

test('a new window takes the size of the row it lands in, and says what it is called', () => {
  setWindows(null);
  // The lounge's own stretch of the west wall, and the east wall's two rows: the boss's office above,
  // the meeting room below.
  assert.deepEqual(sizeOn('west', 9.5, 1.7), { width: 3, y0: 1, y1: 3.25 });
  assert.deepEqual(sizeOn('east', 11, 1.7), { width: 1.75, y0: 1, y1: 2.5 });
  assert.deepEqual(sizeOn('east', 11, 4.5), { width: 1.75, y0: 4, y1: 5.5 });

  assert.equal(windowLabel('window-south-2'), 'South window 2');
  assert.equal(windowLabel('loft-east-1'), "Boss's window 1");
  assert.equal(windowLabel('meeting-east-2'), 'Meeting room window 2');
  assert.equal(windowLabel('window-3'), 'Window 3');
});

test('a window is widened about its middle and heightened from its sill', () => {
  setWindows(null);
  const built = WINDOW_DEFS[0]!;

  const wider = widen(built, 1);
  assert.equal(wider.width, built.width + 0.25);
  assert.equal(wider.u, built.u, 'it grows about its own middle, so it stays where it stands');
  assert.deepEqual([wider.y0, wider.y1], [built.y0, built.y1], 'and as high as it was');

  const taller = heighten(built, 1);
  assert.equal(exact(taller.y1), exact(built.y1 + 0.25));
  assert.equal(taller.y0, built.y0, 'a hole grows upwards: the sill the room put it on stays');
  assert.equal(taller.width, built.width);

  // Neither step goes under the smallest hole that is a window, which is the least the room leaves
  // between two of them: a window narrowed by hand stops where a window stops, and there the wall takes
  // it (see windowFits).
  const small: Opening = { wall: 'south', u: -16.5, width: 0.5, y0: 1.1, y1: 2.1 };
  let narrowest = small;
  let squat = small;
  for (let i = 0; i < 10; i++) {
    narrowest = widen(narrowest, -1);
    squat = heighten(squat, -1);
  }
  assert.equal(narrowest.width, 0.5);
  assert.equal(exact(squat.y1 - squat.y0), 0.5);
  assert.equal(windowFits(narrowest.wall, narrowest), undefined, 'and what it stops at is a hole the wall takes');
  assert.equal(windowFits(squat.wall, squat), undefined);
});

test('every window is on the room\'s 25 cm grid, and stays on it when it is sized', () => {
  const rung = (n: number) => Math.abs(n / SIZE_STEP - Math.round(n / SIZE_STEP)) < 1e-9;
  for (const w of WINDOW_DEFS) {
    const parts = [['u', w.u], ['width', w.width], ['sill', w.y0], ['head', w.y1], ['height', w.y1 - w.y0]] as const;
    for (const [what, at] of parts) assert.ok(rung(at), `${w.id}'s ${what} (${at}) is not a rung of the grid`);
  }
  // A window stepped about keeps its place on the ladder, down to the smallest and up again.
  let at: Opening = { ...WINDOW_DEFS[0]! };
  for (let i = 0; i < 12; i++) {
    at = widen(at, i % 3 ? -1 : 1);
    at = heighten(at, i % 2 ? 1 : -1);
    for (const [what, n] of [['width', at.width], ['height', at.y1 - at.y0], ['sill', at.y0], ['head', at.y1]] as const) {
      assert.ok(rung(n), `${what} is ${n} after ${i + 1} steps`);
    }
  }
});
