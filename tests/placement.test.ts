// The saved placements: the base in layout.ts, what the editor wrote over it, and the reading of a file
// that came off the disk or off the wire.

import test from 'node:test';
import assert from 'node:assert/strict';
import { change, labelFor, place, placements, sanitize, setPlacements } from '../src/shared/placement.js';

const BASE = { x: -16.63, z: -12.56, rotY: 0 } as const;
const TURNED = { x: -2, z: -4, rotY: Math.PI } as const;

test('a piece stands where layout.ts puts it until something moves it', () => {
  setPlacements(null);
  assert.deepEqual(place('jukebox', BASE), { x: BASE.x, z: BASE.z, rotY: 0, hidden: false });
  assert.deepEqual(place('whiteboard', TURNED).rotY, Math.PI);

  setPlacements({ jukebox: { x: 1.5 } });
  assert.deepEqual(place('jukebox', BASE), { x: 1.5, z: BASE.z, rotY: 0, hidden: false });
  // The piece nobody saved is untouched.
  assert.deepEqual(place('whiteboard', TURNED).x, TURNED.x);
});

test('a deleted piece is out of the room, wherever the base had it', () => {
  setPlacements({ whiteboard: { deleted: true } });
  assert.equal(place('whiteboard', TURNED).hidden, true);
  assert.equal(place('jukebox', BASE).hidden, false);
});

test('only what differs from the base is saved, and putting a piece back leaves the file', () => {
  setPlacements(null);
  change('jukebox', BASE, { ...BASE, x: 3.25, hidden: false });
  assert.deepEqual(placements(), { jukebox: { x: 3.25 } });

  change('whiteboard', TURNED, { ...TURNED, hidden: true });
  assert.deepEqual(placements().whiteboard, { deleted: true });

  // Back where it was, and back on the wall: nothing left to remember.
  change('jukebox', BASE, { ...BASE, hidden: false });
  change('whiteboard', TURNED, { ...TURNED, hidden: false });
  assert.deepEqual(placements(), {});
});

test('a floor reads only its own file', () => {
  setPlacements({ jukebox: { x: 4 } });
  setPlacements({ gong: { z: 2 } });
  assert.deepEqual(placements(), { gong: { z: 2 } });
  assert.deepEqual(place('jukebox', BASE).x, BASE.x);
});

test('a file written by hand is read only where it makes sense', () => {
  const cleaned = sanitize({
    jukebox: { x: 4, z: 'over there', rotY: Number.NaN, deleted: 'yes' },
    gong: { z: -4, deleted: true },
    [''.padEnd(70, 'x')]: { x: 1 },
    board: 3,
    empty: {},
  });
  assert.deepEqual(cleaned, { jukebox: { x: 4 }, gong: { z: -4, deleted: true } });
  assert.deepEqual(sanitize(null), {});
  assert.deepEqual(sanitize('nonsense'), {});
});

test('every piece has a name for the panel', () => {
  assert.equal(labelFor('jukebox'), '🎵 Jukebox');
  assert.equal(labelFor('plant-12'), '🌿 Plant 12');
  assert.equal(labelFor('something-else'), 'something-else');
});
