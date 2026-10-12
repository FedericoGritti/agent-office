// The figures boards follow the project's images/ folder (features/figures): the list says when the
// folder changed, so a figure added, taken away, or written again under the same name reaches them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Images } from '../src/server/images.js';

/** A project folder with an images/ folder in it, and its own subfolder. */
function project() {
  const dir = mkdtempSync(path.join(tmpdir(), 'office-images-'));
  mkdirSync(path.join(dir, 'images', 'screens'), { recursive: true });
  return dir;
}

/** Bytes that begin like a PNG: the office serves what is on disk, byte for byte. */
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

test('the list says when the folder changed', async () => {
  const dir = project();
  try {
    writeFileSync(path.join(dir, 'images', 'one.png'), PNG);
    const first = await new Images(dir).list();
    assert.deepEqual(first.files, ['images/one.png']);
    assert.ok(first.stamp, 'there is a stamp to compare with');
    // The same folder, read again: the same stamp, so nothing for the boards to do.
    assert.equal((await new Images(dir).list()).stamp, first.stamp);

    // Written again under the same name: still a change, and the one a board would otherwise miss.
    writeFileSync(path.join(dir, 'images', 'one.png'), Buffer.concat([PNG, Buffer.alloc(64)]));
    const rewritten = await new Images(dir).list();
    assert.deepEqual(rewritten.files, first.files);
    assert.notEqual(rewritten.stamp, first.stamp);

    // Added, in a subfolder.
    writeFileSync(path.join(dir, 'images', 'screens', 'two.webp'), PNG);
    const added = await new Images(dir).list();
    assert.deepEqual(added.files, ['images/one.png', 'images/screens/two.webp']);
    assert.notEqual(added.stamp, rewritten.stamp);

    // And taken away.
    rmSync(path.join(dir, 'images', 'one.png'));
    const gone = await new Images(dir).list();
    assert.deepEqual(gone.files, ['images/screens/two.webp']);
    assert.notEqual(gone.stamp, added.stamp);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a picture is the one on disk now, not the one it was', async () => {
  const dir = project();
  try {
    writeFileSync(path.join(dir, 'images', 'one.png'), PNG);
    const images = new Images(dir);
    assert.deepEqual(await images.picture('images/one.png'), { type: 'image/png', body: PNG });
    writeFileSync(path.join(dir, 'images', 'one.png'), Buffer.concat([PNG, Buffer.alloc(4)]));
    const again = await images.picture('images/one.png');
    assert.ok(!('error' in again), 'it is still served');
    assert.equal(again.body.length, PNG.length + 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
