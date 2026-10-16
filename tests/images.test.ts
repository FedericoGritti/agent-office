// The figures a floor shows: its selected folder (the project's `images/` by default), and the bytes
// of one picture. Nothing is held back — an addition, a removal and a figure written again under the
// same name are all seen on the very next ask, which is what the boards rely on.
import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
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
  assert.deepEqual((await images.list()).files, ['one.png']);
  // Added: in the very next listing, with no cache to wait out.
  write('two.png', 'second');
  assert.deepEqual((await images.list()).files, ['one.png', 'two.png']);
  // Written again under the same name: the bytes are the new ones, not the ones already handed out.
  write('one.png', 'a whole new picture');
  assert.equal(await bytes(images, 'one.png'), 'a whole new picture');
  // Taken away: gone from the next listing too.
  remove('two.png');
  assert.deepEqual((await images.list()).files, ['one.png']);
});

test('only pictures are listed, subfolders included', async (t) => {
  const { dir, images, write } = project(t);
  write('note.txt', 'not a picture');
  write('figure.png', 'a picture');
  mkdirSync(path.join(dir, 'images', 'nested'), { recursive: true });
  writeFileSync(path.join(dir, 'images', 'nested', 'deep.png'), 'a picture in a subfolder');
  assert.deepEqual((await images.list()).files, ['figure.png', 'nested/deep.png']);
});

test('a selected folder becomes the source, is confined, and survives a restart', async (t) => {
  const { dir, images } = project(t);
  const selected = mkdtempSync(path.join(tmpdir(), 'office-selected-images-'));
  t.after(() => rmSync(selected, { recursive: true, force: true }));
  writeFileSync(path.join(selected, 'picked.png'), 'chosen picture');
  writeFileSync(path.join(dir, 'outside.png'), 'not in the chosen folder');

  assert.equal(images.setFolder(selected), undefined);
  assert.deepEqual(await images.list(), { folder: selected, files: ['picked.png'], more: false });
  assert.equal(await bytes(images, 'picked.png'), 'chosen picture');
  assert.ok('error' in (await images.picture('../outside.png')));
  assert.equal((await new Images(dir).list()).folder, selected);

  assert.ok(images.setFolder(path.join(selected, 'missing')));
  assert.equal((await images.list()).folder, selected);
});

test('a figure added, taken away or written again in the selected folder is said once', async (t) => {
  const { images } = project(t);
  const selected = mkdtempSync(path.join(tmpdir(), 'office-watched-images-'));
  t.after(() => rmSync(selected, { recursive: true, force: true }));
  assert.equal(images.setFolder(selected), undefined);
  let notices = 0;
  t.after(images.watch(() => notices++));

  /** Waits for one more notice than there was, polling rather than sleeping a fixed time. */
  const noticed = async (what: string) => {
    const was = notices;
    const until = Date.now() + 5000;
    while (notices === was && Date.now() < until) await delay(20);
    assert.ok(notices > was, `nothing was said about a figure ${what}`);
  };

  const file = path.join(selected, 'one.png');
  writeFileSync(file, 'first');
  await noticed('added');
  writeFileSync(file, 'written again under its own name');
  await noticed('written again');
  rmSync(file);
  await noticed('taken away');
});
