// The saved placements: the base in layout.ts, what the editor wrote over it, and the reading of a file
// that came off the disk or off the wire.

import test from 'node:test';
import assert from 'node:assert/strict';
import { change, labelFor, nextSpawnId, place, placeAdded, placements, sanitize, setPlacements, spawn, spawned } from '../src/shared/placement.js';

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
  assert.equal(labelFor('rug-2'), '🧶 Rug 2');
  assert.equal(labelFor('tv'), '📺 Lounge TV');
  assert.equal(labelFor('something-else'), 'something-else');
});

test('a piece the editor adds is its own entry: what it is, and where it stands', () => {
  setPlacements(null);
  assert.equal(nextSpawnId(), 'add-1');
  spawn('add-1', 'monstera', { x: 2.25, y: 0, z: -3.5, rotY: 0 });
  // The ground floor needs no height said out loud.
  assert.deepEqual(placements(), { 'add-1': { kind: 'monstera', x: 2.25, z: -3.5, rotY: 0 } });
  assert.deepEqual(spawned(), [{ id: 'add-1', kind: 'monstera', x: 2.25, y: 0, z: -3.5, rotY: 0, deleted: false }]);
  assert.equal(labelFor('add-1'), '🌿 Monstera');
  assert.equal(nextSpawnId(), 'add-2');

  // Moved and turned, it is still what it was.
  change('add-1', { x: 2.25, z: -3.5 }, { x: 5.25, z: -3.5, rotY: 1.57, hidden: false });
  assert.deepEqual(placements()['add-1'], { kind: 'monstera', x: 5.25, z: -3.5, rotY: 1.57 });

  // Put back where it came in, it doesn't stop existing: it has no base to fall back on.
  change('add-1', { x: 2.25, z: -3.5 }, { x: 2.25, z: -3.5, rotY: 0, hidden: false });
  assert.deepEqual(placements()['add-1'], { kind: 'monstera', x: 2.25, z: -3.5, rotY: 0 });

  // Taken away, it's remembered as gone rather than forgotten — and the next one is still add-2.
  change('add-1', { x: 2.25, z: -3.5 }, { x: 2.25, z: -3.5, rotY: 0, hidden: true });
  assert.deepEqual(placements()['add-1'], { kind: 'monstera', x: 2.25, z: -3.5, rotY: 0, deleted: true });
  assert.equal(nextSpawnId(), 'add-2');
});

test('an added piece stands only where the file says', () => {
  setPlacements(null);
  // A floor whose file hasn't got it never had it — while a piece of the room's own is built wherever
  // layout.ts puts it, file or no file (see place()).
  assert.equal(placeAdded('add-1', { x: 1, z: 2 }).hidden, true);
  assert.equal(place('jukebox', BASE).hidden, false);

  spawn('add-1', 'rug', { x: 1, y: 3, z: 2, rotY: 0 });
  assert.deepEqual(placeAdded('add-1', { x: 0, z: 0 }), { x: 1, z: 2, rotY: 0, hidden: false });
  // Up on the loft it stays up there: the file is the only thing that says so.
  assert.equal(spawned()[0]?.y, 3);
});

test('an addition written by hand is read whole or not at all', () => {
  const cleaned = sanitize({
    'add-1': { kind: 'monstera', x: 4, z: 2, y: 3 },
    'add-2': { kind: 'dragon', x: 1, z: 1 },
    'add-3': { kind: 'rug', z: 1 },
    'add-4': { kind: 7, x: 1, z: 1 },
    'add-5': { kind: 'rug', x: 1, z: 1, deleted: 'yes' },
  });
  assert.deepEqual(cleaned, {
    'add-1': { kind: 'monstera', x: 4, z: 2, rotY: 0, y: 3 },
    'add-5': { kind: 'rug', x: 1, z: 1, rotY: 0 },
  });
  setPlacements(cleaned);
  assert.deepEqual(spawned().map((p) => p.id), ['add-1', 'add-5']);
  assert.equal(nextSpawnId(), 'add-6');
});

test('an addition can name a model fetched from an online catalog', () => {
  const cleaned = sanitize({
    'add-1': { kind: 'polyhaven:ArmChair_01', x: 2, z: -3, y: 3 },
    'add-2': { kind: 'rockery:Rock_01', x: 1, z: 1 },
    'add-3': { kind: 'polyhaven:../etc/passwd', x: 1, z: 1 },
  });
  // The source nobody has and the id that would climb out of the model's folder are no pieces at all.
  assert.deepEqual(cleaned, { 'add-1': { kind: 'polyhaven:ArmChair_01', x: 2, z: -3, rotY: 0, y: 3 } });
  setPlacements(cleaned);
  assert.deepEqual(spawned().map((p) => p.kind), ['polyhaven:ArmChair_01']);
  assert.equal(labelFor('add-1'), 'ArmChair 01');
});
