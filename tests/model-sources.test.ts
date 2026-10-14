// The online catalogs of models: what the office reads off Poly Haven's API, and the folder a floor
// keeps a downloaded model in. Nothing here goes to the network: the mapping is pure arithmetic, and the
// store is tried on a folder of our own with a manifest in it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { externalKind, isAdditionKind, isModelId, modelFolderPath, modelName, parseExternal } from '../src/shared/model-sources.js';
import { pickGltf, sizeInMetres, toInfo } from '../src/server/model-sources/polyhaven.js';
import { ModelStore, readManifest } from '../src/server/model-sources/store.js';

/** A folder of our own for one test, thrown away after it. */
function where(t: { after(fn: () => void): void }): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'models-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('an added model is a source and an id, and nothing else is a model', () => {
  assert.equal(externalKind('polyhaven', 'ArmChair_01'), 'polyhaven:ArmChair_01');
  assert.deepEqual(parseExternal('polyhaven:ArmChair_01'), { source: 'polyhaven', id: 'ArmChair_01' });
  // A kind of the office's own is not an external one, and a source nobody has isn't either.
  assert.equal(parseExternal('monstera'), null);
  assert.equal(parseExternal('rockery:Rock_01'), null);
  // An id names a folder and part of a URL: one that could climb out of either is no id at all.
  for (const bad of ['polyhaven:', 'polyhaven:..', 'polyhaven:../etc', 'polyhaven:a/b', 'polyhaven:a b']) {
    assert.equal(parseExternal(bad), null, bad);
  }
  assert.ok(!isModelId('.') && !isModelId('..') && !isModelId('a/b') && isModelId('Rock_01-2.set'));

  assert.ok(isAdditionKind('fountain'));
  assert.ok(isAdditionKind('polyhaven:ArmChair_01'));
  assert.ok(!isAdditionKind('nonsense') && !isAdditionKind('rockery:Rock_01') && !isAdditionKind(7));

  assert.equal(modelName('ArmChair_01'), 'ArmChair 01');
  assert.equal(modelFolderPath('polyhaven', 'ArmChair_01'), '/api/models/files/polyhaven/ArmChair_01/');
});

test('Poly Haven says what a model is in millimetres, and what the window shows in metres', () => {
  assert.deepEqual(sizeInMetres([848.4309017658234, 765.7602727413177, 1065.087635157397]), [0.85, 0.77, 1.07]);
  assert.deepEqual(sizeInMetres(undefined), [0, 0, 0]);

  const info = toInfo('ArmChair_01', {
    name: 'Arm Chair 01',
    categories: ['furniture', 'seating'],
    tags: ['chair', 'wood'],
    authors: { 'Kirill Sannikov': 'All' },
    polycount: 5626,
    dimensions: [848.4, 765.8, 1065.1],
  });
  assert.deepEqual(info, {
    id: 'ArmChair_01',
    name: 'Arm Chair 01',
    categories: ['furniture', 'seating', 'chair', 'wood'],
    polycount: 5626,
    size: [0.85, 0.77, 1.07],
    authors: ['Kirill Sannikov'],
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/ArmChair_01.png?width=256&height=256&format=webp',
  });
  // A model they haven't named yet goes by its id, and one with no numbers at all is nothing across.
  assert.equal(toInfo('Rock_03', {}).name, 'Rock 03');
  assert.deepEqual(toInfo('Rock_03', {}).size, [0, 0, 0]);
});

test('the glTF to download is the smallest one they offer, with everything it names', () => {
  const files = {
    gltf: {
      '4k': { gltf: { url: 'https://dl/x/Model_4k.gltf', include: { 'Model.bin': { url: 'https://dl/x/Model.bin' } } } },
      '1k': { gltf: { url: 'https://dl/x/Model_1k.gltf', include: { 'Model.bin': { url: 'https://dl/x/Model.bin' }, 'textures/Model_diff_1k.jpg': { url: 'https://dl/x/tex.jpg' } } } },
    },
  };
  const pick = pickGltf(files);
  assert.ok(!('error' in pick));
  if ('error' in pick) return;
  assert.equal(pick.url, 'https://dl/x/Model_1k.gltf');
  assert.deepEqual(Object.keys(pick.include), ['Model.bin', 'textures/Model_diff_1k.jpg']);
  assert.ok('error' in pickGltf({}));
  assert.ok('error' in pickGltf({ gltf: { '1k': {} } }));
});

test('a floor serves the files of the models it has, and nothing outside their folder', async (t) => {
  const dir = where(t);
  const store = new ModelStore(dir);
  assert.deepEqual(await store.add('polyhaven', '../escape'), { error: 'No such model' });
  assert.equal(store.file('polyhaven', 'ArmChair_01', ''), null, 'nothing downloaded yet');

  // What a download leaves behind: the model's own file, its neighbours, and the manifest.
  const model = path.join(dir, 'models', 'polyhaven', 'ArmChair_01');
  mkdirSync(path.join(model, 'textures'), { recursive: true });
  writeFileSync(path.join(model, 'ArmChair_01_1k.gltf'), '{"asset":{"version":"2.0"}}');
  writeFileSync(path.join(model, 'textures', 'diff_1k.jpg'), 'not really a jpeg');
  writeFileSync(path.join(model, '.model.json'), JSON.stringify({ source: 'polyhaven', id: 'ArmChair_01', entry: 'ArmChair_01_1k.gltf', at: 1 }));
  writeFileSync(path.join(dir, 'secret.txt'), 'not the room\'s');
  assert.equal(readManifest(model)?.entry, 'ArmChair_01_1k.gltf');

  // The folder asks for the model's own file, and that file's neighbours come from the same place.
  assert.deepEqual(store.file('polyhaven', 'ArmChair_01', ''), { path: path.join(model, 'ArmChair_01_1k.gltf'), type: 'model/gltf+json' });
  assert.equal(store.file('polyhaven', 'ArmChair_01', 'textures/diff_1k.jpg')?.type, 'image/jpeg');
  // Out of the folder is out of the question, whichever way it's asked.
  for (const bad of ['../../secret.txt', 'textures/../../../secret.txt', '/etc/passwd']) {
    assert.equal(store.file('polyhaven', 'ArmChair_01', bad), null, bad);
  }
  assert.equal(store.file('polyhaven', 'Rock_03', ''), null);
  assert.equal(store.file('nowhere', 'ArmChair_01', ''), null);

  // A folder whose manifest can't be read is one whose download didn't finish: nothing is served from it.
  writeFileSync(path.join(model, '.model.json'), 'not json');
  assert.equal(readManifest(model), null);
  assert.equal(store.file('polyhaven', 'ArmChair_01', ''), null);
});
