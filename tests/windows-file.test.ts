// The file the windows are kept in: one for the whole building (the room is one room, on every floor),
// read back when the office starts again, and read with care when someone has been at it with an editor.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Windows } from '../src/server/windows.js';

const dir = () => mkdtempSync(path.join(tmpdir(), 'windows-'));

test('what the editor saves is written down and read back', () => {
  const where = dir();
  const one = new Windows(where);
  assert.deepEqual(one.state(), {});
  assert.equal(one.set({ 'window-west-2': { u: -5.5 } }), true);
  assert.equal(one.set({ 'window-west-2': { u: -5.5 } }), false, 'nothing changed, nothing written');
  assert.deepEqual(new Windows(where).state(), { 'window-west-2': { u: -5.5 } });
  assert.deepEqual(JSON.parse(readFileSync(path.join(where, 'windows.json'), 'utf8')), { 'window-west-2': { u: -5.5 } });
});

test('a window put back leaves the file, and an office nobody touched has none', () => {
  const where = dir();
  const one = new Windows(where);
  one.set({ 'window-east-1': { deleted: true } });
  one.set({});
  assert.deepEqual(new Windows(where).state(), {});
});

test('a file written by hand is read the way a saved one is', () => {
  const where = dir();
  writeFileSync(path.join(where, 'windows.json'), '{"window-south-2":{"u":"somewhere"},"loft-east-1":{"deleted":true}}');
  assert.deepEqual(new Windows(where).state(), { 'loft-east-1': { deleted: true } });
  writeFileSync(path.join(where, 'windows.json'), 'not json at all');
  assert.deepEqual(new Windows(where).state(), {});
});
