// The figures a floor's project shows: its `images/` folder, and the bytes of one (see
// src/server/images.ts). Nothing is held back — an addition, a removal and a figure written again
// under the same name are all seen on the very next ask, which is what the boards rely on.
import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Images } from '../src/server/images.js';

/** A project folder with an `images/` in it, a figure written into it, and its Images. */
function project(t: TestContext) {
  const dir = mkdtempSync(path.join(tmpdir(), 'office-images-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const folder = path.join(dir, 'images');
  mkdirSync(folder, { recursive: true });
  return {
    dir,
    images: new Images(dir),
    write: (name: string, body: string) => writeFileSync(path.join(folder, name), body),
    remove: (name: string) => rmSync(path.join(folder, name)),
  };
}

/** The bytes `picture()` handed back, failing the test if it refused the file. */
async function bytes(images: Images, file: string): Promise<string> {
  const r = await images.picture(file);
  assert.ok(!('error' in r), `picture(${file}) refused it: ${'error' in r ? r.error : ''}`);
  return r.body.toString('utf8');
}

test('the folder is read again every time: added, taken away and written again all show at once', async (t) => {
  const { images, write, remove } = project(t);
  write('one.png', 'first');
  assert.deepEqual((await images.list()).files, ['images/one.png']);
  // Added: in the very next listing, with no cache to wait out.
  write('two.png', 'second');
  assert.deepEqual((await images.list()).files, ['images/one.png', 'images/two.png']);
  // Written again under the same name: the bytes are the new ones, not the ones already handed out.
  write('one.png', 'a whole new picture');
  assert.equal(await bytes(images, 'images/one.png'), 'a whole new picture');
  // Taken away: gone from the next listing too.
  remove('two.png');
  assert.deepEqual((await images.list()).files, ['images/one.png']);
});

test('only pictures are listed, subfolders included', async (t) => {
  const { dir, images, write } = project(t);
  write('note.txt', 'not a picture');
  write('figure.png', 'a picture');
  mkdirSync(path.join(dir, 'images', 'nested'), { recursive: true });
  writeFileSync(path.join(dir, 'images', 'nested', 'deep.png'), 'a picture in a subfolder');
  assert.deepEqual((await images.list()).files, ['images/figure.png', 'images/nested/deep.png']);
});
