// The file the editor writes: one per floor, read back when the office starts again, and read with
// care when someone has been at it with an editor.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Layout } from '../src/server/layout.js';

const dir = () => mkdtempSync(path.join(tmpdir(), 'layout-'));

test('what the editor saves is written down and read back', () => {
  const where = dir();
  const one = new Layout(where);
  assert.deepEqual(one.placements(), {});
  assert.equal(one.set({ jukebox: { x: 3, z: -4 } }), true);
  assert.equal(one.set({ jukebox: { x: 3, z: -4 } }), false, 'nothing changed, nothing written');
  assert.deepEqual(new Layout(where).placements(), { jukebox: { x: 3, z: -4 } });
  assert.deepEqual(JSON.parse(readFileSync(path.join(where, 'layout.json'), 'utf8')), { jukebox: { x: 3, z: -4 } });
});

test('a piece put back leaves the file, and a floor nobody touched has none', () => {
  const where = dir();
  const one = new Layout(where);
  one.set({ gong: { deleted: true } });
  one.set({});
  assert.deepEqual(new Layout(where).placements(), {});
});

test('a file written by hand is read the way a saved one is', () => {
  const where = dir();
  writeFileSync(path.join(where, 'layout.json'), '{"gong":{"z":"over there"},"whiteboard":{"deleted":true}}');
  assert.deepEqual(new Layout(where).placements(), { whiteboard: { deleted: true } });
  writeFileSync(path.join(where, 'layout.json'), 'not json at all');
  assert.deepEqual(new Layout(where).placements(), {});
});
