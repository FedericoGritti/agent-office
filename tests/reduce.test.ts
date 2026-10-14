import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REDUCE_ABOVE, REDUCE_TO, reduceModel } from '../src/server/models/reduce.js';

/** How many triangles the heavy half of the fixture has: above the budget, so it is worth reducing. */
const HEAVY = 50_000;

/** A flat grid of `tris`-ish triangles: positions, uvs and the triangles between them. */
function grid(tris: number) {
  const across = Math.ceil(Math.sqrt(tris / 2));
  const down = across;
  const positions = new Float32Array((across + 1) * (down + 1) * 3);
  const uvs = new Float32Array((across + 1) * (down + 1) * 2);
  let at = 0;
  let uvAt = 0;
  for (let y = 0; y <= down; y++) {
    for (let x = 0; x <= across; x++) {
      positions[at++] = x / across;
      positions[at++] = Math.sin((x / across) * Math.PI) * 0.2;
      positions[at++] = y / down;
      uvs[uvAt++] = x / across;
      uvs[uvAt++] = y / down;
    }
  }
  const stride = across + 1;
  const indices = new Uint32Array(across * down * 6);
  let i = 0;
  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      const a = y * stride + x;
      indices[i++] = a;
      indices[i++] = a + 1;
      indices[i++] = a + stride;
      indices[i++] = a + 1;
      indices[i++] = a + stride + 1;
      indices[i++] = a + stride;
    }
  }
  return { positions, uvs, indices };
}

/** Writes a model of two parts — a heavy one and a light one — as a floor's folder has it. */
function modelFolder() {
  const dir = mkdtempSync(path.join(tmpdir(), 'reduce-'));
  const heavy = grid(HEAVY);
  const light = grid(300);
  const parts: Buffer[] = [];
  const bufferViews: unknown[] = [];
  const accessors: unknown[] = [];
  let offset = 0;
  const put = (values: Float32Array | Uint32Array, type: string, componentType: number, target?: number) => {
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      parts.push(Buffer.alloc(pad));
      offset += pad;
    }
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
    parts.push(bytes);
    offset += bytes.length;
    accessors.push({ bufferView: bufferViews.length - 1, componentType, count: values.length / (type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1), type });
    return accessors.length - 1;
  };
  const primitiveOf = (part: { positions: Float32Array; uvs: Float32Array; indices: Uint32Array }) => ({
    attributes: { POSITION: put(part.positions, 'VEC3', 5126), TEXCOORD_0: put(part.uvs, 'VEC2', 5126) },
    indices: put(part.indices, 'SCALAR', 5125),
    material: 0,
  });
  const document = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'the model' }],
    materials: [{ name: 'bark', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }],
    images: [{ uri: 'textures/colour.png' }],
    accessors,
    bufferViews,
    meshes: [{ primitives: [primitiveOf(heavy), primitiveOf(light)] }],
    buffers: [{ uri: 'thing.bin', byteLength: offset }],
  };
  writeFileSync(path.join(dir, 'thing.bin'), Buffer.concat(parts, offset));
  writeFileSync(path.join(dir, 'thing.gltf'), JSON.stringify(document));
  writeFileSync(path.join(dir, '.model.json'), JSON.stringify({ source: 'polyhaven', id: 'thing', entry: 'thing.gltf', at: Date.now() }));
  return { dir, heavy: heavy.indices.length / 3, light: light.indices.length / 3 };
}

test('a heavy model is written smaller beside itself, and the model that came down is untouched', async () => {
  const { dir, heavy, light } = modelFolder();
  const originalGltf = readFileSync(path.join(dir, 'thing.gltf'));
  const originalBin = readFileSync(path.join(dir, 'thing.bin'));

  const done = await reduceModel(dir);
  assert.ok('entry' in done, `expected a reduction, got ${JSON.stringify(done)}`);
  if (!('entry' in done)) return;
  assert.equal(done.entry, 'thing.reduced.gltf');
  assert.equal(done.before, heavy + light);
  assert.ok(done.after < done.before * 0.7, `${done.before} → ${done.after} is not much of a reduction`);
  assert.ok(done.after >= REDUCE_TO * 0.5, `reduced to ${done.after}, well under what it aims for`);

  // The files that came down are exactly as they were: a reduced model is written beside them.
  assert.deepEqual(readFileSync(path.join(dir, 'thing.gltf')), originalGltf);
  assert.deepEqual(readFileSync(path.join(dir, 'thing.bin')), originalBin);

  // And the manifest now names the smaller model, saying what it was made from.
  const manifest = JSON.parse(readFileSync(path.join(dir, '.model.json'), 'utf8'));
  assert.equal(manifest.entry, 'thing.reduced.gltf');
  assert.deepEqual(manifest.reduced, { from: 'thing.gltf', before: done.before, after: done.after });
});

test('the smaller model is a glTF the office can load: its own numbers hold together', async () => {
  const { dir } = modelFolder();
  await reduceModel(dir);
  const gltf = JSON.parse(readFileSync(path.join(dir, 'thing.reduced.gltf'), 'utf8'));
  const bin = readFileSync(path.join(dir, 'thing.reduced.bin'));

  // Everything that isn't geometry comes through untouched: the room's furniture still has its textures.
  assert.deepEqual(gltf.materials, [{ name: 'bark', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }]);
  assert.deepEqual(gltf.images, [{ uri: 'textures/colour.png' }]);
  assert.equal(gltf.nodes[0].name, 'the model');
  assert.equal(gltf.buffers.length, 1);
  assert.equal(gltf.buffers[0].uri, 'thing.reduced.bin');
  assert.equal(gltf.buffers[0].byteLength, bin.length);

  // Every accessor is inside the buffer it names, and every view inside the buffer.
  for (const view of gltf.bufferViews) assert.ok((view.byteOffset ?? 0) + view.byteLength <= bin.length, 'a view runs past the buffer');
  for (const accessor of gltf.accessors) {
    const view = gltf.bufferViews[accessor.bufferView];
    assert.ok(view, 'an accessor names a view that is not there');
    assert.ok(accessor.count > 0);
  }

  // Both parts are still there, in the same order, with the same material — and the indices all point at
  // vertices that exist.
  const primitives = gltf.meshes[0].primitives;
  assert.equal(primitives.length, 2);
  for (const primitive of primitives) {
    assert.equal(primitive.material, 0);
    assert.deepEqual(Object.keys(primitive.attributes).sort(), ['POSITION', 'TEXCOORD_0']);
    const positions = gltf.accessors[primitive.attributes.POSITION];
    const uv = gltf.accessors[primitive.attributes.TEXCOORD_0];
    const indices = gltf.accessors[primitive.indices];
    assert.equal(positions.type, 'VEC3');
    assert.equal(uv.type, 'VEC2');
    assert.equal(indices.type, 'SCALAR');
    // Position and uv belong to the same vertices, and nothing is asked for that isn't there.
    assert.equal(positions.count, uv.count);
    const view = gltf.bufferViews[indices.bufferView];
    const start = (view.byteOffset ?? 0);
    let highest = 0;
    for (let i = 0; i < indices.count; i++) highest = Math.max(highest, bin.readUInt32LE(start + i * 4));
    assert.ok(highest < positions.count, `an index points at vertex ${highest} of ${positions.count}`);
    // The heavy half was reduced (a grid's triangles are about twice its vertices); the light one wasn't.
    assert.ok(indices.count / 3 < REDUCE_ABOVE);
  }
  const heavyPart = primitives[0];
  assert.ok(gltf.accessors[heavyPart.indices].count / 3 < REDUCE_ABOVE);
});

test('a model already light enough is left exactly as it came', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'reduce-light-'));
  const light = grid(2_000);
  const parts = [Buffer.from(light.positions.buffer, light.positions.byteOffset, light.positions.byteLength), Buffer.from(light.indices.buffer, light.indices.byteOffset, light.indices.byteLength)];
  writeFileSync(path.join(dir, 'thing.bin'), Buffer.concat(parts));
  writeFileSync(
    path.join(dir, 'thing.gltf'),
    JSON.stringify({
      asset: { version: '2.0' },
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: light.positions.length / 3, type: 'VEC3' },
        { bufferView: 1, componentType: 5125, count: light.indices.length, type: 'SCALAR' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: light.positions.byteLength },
        { buffer: 0, byteOffset: light.positions.byteLength, byteLength: light.indices.byteLength },
      ],
      buffers: [{ uri: 'thing.bin', byteLength: light.positions.byteLength + light.indices.byteLength }],
    }),
  );
  writeFileSync(path.join(dir, '.model.json'), JSON.stringify({ source: 'polyhaven', id: 'thing', entry: 'thing.gltf', at: Date.now() }));
  const done = await reduceModel(dir);
  assert.ok('skipped' in done, JSON.stringify(done));
  // No copy is written, and the manifest is not touched.
  assert.deepEqual(readdirSync(dir).sort(), ['.model.json', 'thing.bin', 'thing.gltf']);
  assert.equal(JSON.parse(readFileSync(path.join(dir, '.model.json'), 'utf8')).entry, 'thing.gltf');
  rmSync(dir, { recursive: true, force: true });
});

test('a model already reduced, and one that cannot be rewritten, are both left alone', async () => {
  const { dir } = modelFolder();
  await reduceModel(dir);
  assert.deepEqual(await reduceModel(dir), { skipped: 'already reduced' });

  // A container this doesn't rewrite: the office keeps drawing it exactly as it came.
  writeFileSync(path.join(dir, '.model.json'), JSON.stringify({ source: 'polyhaven', id: 'thing', entry: 'thing.glb', at: Date.now() }));
  const binary = await reduceModel(dir);
  assert.ok('skipped' in binary && binary.skipped.includes('.glb'), JSON.stringify(binary));
  rmSync(dir, { recursive: true, force: true });
});
