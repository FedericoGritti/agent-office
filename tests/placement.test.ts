// The saved placements: the base in layout.ts, what the editor wrote over it, and the reading of a file
// that came off the disk or off the wire.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SCALE_MAX, SCALE_MIN, change, clampScale, labelFor, nextSpawnId, place, placeAdded, placements, resizeBy, sanitize, scaleOf, setPlacements, spawn, spawned } from '../src/shared/placement.js';

const BASE = { x: -16.63, z: -12.56, rotY: 0 } as const;
const TURNED = { x: -2, z: -4, rotY: Math.PI } as const;

test('a piece stands where layout.ts puts it until something moves it', () => {
  setPlacements(null);
  assert.deepEqual(place('jukebox', BASE), { x: BASE.x, z: BASE.z, rotY: 0, scale: 1, hidden: false });
  assert.deepEqual(place('whiteboard', TURNED).rotY, Math.PI);

  setPlacements({ jukebox: { x: 1.5 } });
  assert.deepEqual(place('jukebox', BASE), { x: 1.5, z: BASE.z, rotY: 0, scale: 1, hidden: false });
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
    jukebox: { x: 4, z: 'over there', rotY: Number.NaN, y: 3, deleted: 'yes' },
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
  assert.deepEqual(spawned(), [{ id: 'add-1', kind: 'monstera', x: 2.25, y: 0, z: -3.5, rotY: 0, scale: 1, deleted: false }]);
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
  assert.deepEqual(placeAdded('add-1', { x: 0, z: 0 }), { x: 1, z: 2, rotY: 0, scale: 1, y: 3, hidden: false });
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

test('a piece the editor resized keeps its size in the file, and the size it came at is nothing said', () => {
  setPlacements(null);
  spawn('add-1', 'fountain', { x: 1, y: 0, z: 2, rotY: 0 });
  // As it came: the file says nothing about a size, and a piece read back is 1.
  assert.deepEqual(placements()['add-1'], { kind: 'fountain', x: 1, z: 2, rotY: 0 });
  assert.equal(place('add-1', { x: 0, z: 0 }).scale, 1);
  assert.equal(spawned()[0]?.scale, 1);

  // Three notches of the wheel up: the size goes into the file, and comes back out of it.
  let big = 1;
  for (let i = 0; i < 3; i++) big = resizeBy(big, 1);
  assert.equal(Math.round(big * 1000) / 1000, 1.331);
  change('add-1', { x: 1, z: 2 }, { x: 1, z: 2, rotY: 0, scale: big, hidden: false });
  assert.equal(placements()['add-1']?.scale, 1.331);
  assert.equal(scaleOf(place('add-1', { x: 0, z: 0 })), 1.331);
  assert.equal(spawned()[0]?.scale, 1.331);

  // And three notches down again is the size it came, with nothing left to remember: the wheel's own
  // arithmetic lands a hair off 1, which the file must not keep.
  let back = big;
  for (let i = 0; i < 3; i++) back = resizeBy(back, -1);
  assert.notEqual(back, 1);
  change('add-1', { x: 1, z: 2 }, { x: 1, z: 2, rotY: 0, scale: back, hidden: false });
  assert.equal(placements()['add-1']?.scale, undefined);
  assert.deepEqual(placements()['add-1'], { kind: 'fountain', x: 1, z: 2, rotY: 0 });
});

test('a thing you added can be left up in the air, and the file remembers how high', () => {
  setPlacements(null);
  spawn('add-1', 'fountain', { x: 1, y: 0, z: 2, rotY: 0 });
  assert.equal(place('add-1', { x: 0, z: 0 }).y, 0, "the room's floor is the height it came at");

  // Carried up: the file keeps where it was left, and a piece read back stands up there.
  change('add-1', { x: 1, z: 2 }, { x: 1, y: 2.75, z: 2, rotY: 0, hidden: false });
  assert.equal(placements()['add-1']?.y, 2.75);
  assert.equal(place('add-1', { x: 0, z: 0 }).y, 2.75);
  assert.equal(spawned()[0]?.y, 2.75);

  // Brought back down, there is nothing left to say about a height of none.
  change('add-1', { x: 1, z: 2 }, { x: 1, y: 0, z: 2, rotY: 0, hidden: false });
  assert.deepEqual(placements()['add-1'], { kind: 'fountain', x: 1, z: 2, rotY: 0 });

  // The room's own furniture has no height of its own: it is built where its builder put it (a board
  // two metres up, a desk on the floor), so there is nothing to read and nothing the editor may write.
  setPlacements(null);
  assert.equal('y' in place('jukebox', BASE), false);
  change('jukebox', BASE, { ...BASE, y: 3, hidden: false });
  assert.deepEqual(placements(), {});
  assert.deepEqual(sanitize({ jukebox: { x: 4, y: 3 } }), { jukebox: { x: 4 } });
});

test('a size stops at the ends of what a piece may be made, and the room\'s own furniture has none', () => {
  let big = 1;
  let small = 1;
  for (let i = 0; i < 40; i++) {
    big = resizeBy(big, 1);
    small = resizeBy(small, -1);
  }
  assert.equal(big, SCALE_MAX);
  assert.equal(small, SCALE_MIN);
  assert.equal(clampScale(0), SCALE_MIN);
  assert.equal(clampScale(Number.NaN), 1, 'a size arithmetic cannot make is the size it came');

  // A size written by hand is brought to the nearest end rather than losing the piece, and one that
  // isn't a number at all is no size (the piece still stands).
  const cleaned = sanitize({
    'add-1': { kind: 'rug', x: 1, z: 2, scale: 100 },
    'add-2': { kind: 'rug', x: 1, z: 2, scale: 'big' },
    'add-3': { kind: 'rug', x: 1, z: 2, scale: 0.01 },
    'add-4': { kind: 'rug', x: 1, z: 2, scale: 1.2000000000000002 },
  });
  assert.deepEqual(
    ['add-1', 'add-2', 'add-3', 'add-4'].map((id) => cleaned[id]?.scale),
    [SCALE_MAX, undefined, SCALE_MIN, 1.2],
  );

  // The room's own furniture is only ever where it was measured: a size written for one is not read,
  // and the editor never writes one.
  setPlacements(sanitize({ jukebox: { x: 2, scale: 3 } }));
  assert.deepEqual(placements().jukebox, { x: 2 });
  assert.equal(place('jukebox', BASE).scale, 1);
  change('jukebox', BASE, { x: 2, rotY: 0, scale: 3, hidden: false });
  assert.deepEqual(placements().jukebox, { x: 2 });
});
