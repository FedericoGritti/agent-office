// Making a downloaded model smaller.
//
// A model from an online catalog can arrive with two million triangles — one of the floor's does, thirty
// times everything the office builds on its own — and that is a cost paid on every frame: in the drawing,
// and in the ray that works out what you are facing (see client/core/raycast.ts, which is where the
// measured half of it was). So it comes down to the size the room can afford, once.
//
// Here, on the server, when the model is fetched — and again on demand for models already fetched
// (`agent-office reduce-models`). Never in the browser and never per frame: three's simplifier is
// meshoptimizer compiled to WebAssembly and takes about 300 ms per 100k triangles (measured on this
// machine), so a two-million-triangle model is seconds of work. Once is fine; every page load is not.
//
// What survives: materials, textures, samplers, the node hierarchy and every transform — only the
// triangles change, and the simplifier counts UVs and normals in its error metric, so the textures stay
// where they were (see three's SimplifyModifier, which is what does the work).
// What is never touched: the file that came down. The reduced model is written beside it and the model's
// manifest points at it, so the original is always one line away from being the model again.

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BufferAttribute, BufferGeometry } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { readManifest, type ModelManifest } from '../model-sources/store.js';

/** Above this many triangles a primitive is reduced: below it there is nothing to gain. */
export const REDUCE_ABOVE = 30_000;
/** What a primitive heavier than that is brought down to. */
export const REDUCE_TO = 20_000;

/** What was done to a model, for the manifest and for the command's own report. */
export interface Reduction {
  /** The file the model's manifest now names: the reduced one. */
  entry: string;
  /** Triangles before and after, over the whole model. */
  before: number;
  after: number;
}

/** A glTF's parts, as much of them as this rewrites (the rest is carried through untouched). */
interface Gltf {
  asset?: unknown;
  scene?: number;
  scenes?: unknown[];
  nodes?: unknown[];
  meshes?: { primitives: Primitive[]; targets?: unknown[] }[];
  materials?: unknown[];
  textures?: unknown[];
  images?: { bufferView?: number; uri?: string }[];
  samplers?: unknown[];
  skins?: unknown[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  accessors: Accessor[];
  bufferViews: BufferView[];
  buffers: { uri?: string; byteLength: number }[];
}

interface Primitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

interface Accessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  sparse?: unknown;
  /** A glTF wants these written beside a POSITION accessor, and they are part of the format. */
  min?: number[];
  max?: number[];
}

interface BufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

/** The numbers an accessor holds, in the shape the file keeps them. */
type Numbers = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int16Array | Int8Array;

/** How many numbers an accessor's own `type` holds. */
const ITEMS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
/** How wide one number is, and what reads it. */
const COMPONENTS: Record<number, { bytes: number; read: (b: Buffer, at: number) => number; of: (n: number) => Numbers; gl: number }> = {
  5120: { bytes: 1, read: (b, at) => b.readInt8(at), of: (n) => new Int8Array(n), gl: 5120 },
  5121: { bytes: 1, read: (b, at) => b.readUInt8(at), of: (n) => new Uint8Array(n), gl: 5121 },
  5122: { bytes: 2, read: (b, at) => b.readInt16LE(at), of: (n) => new Int16Array(n), gl: 5122 },
  5123: { bytes: 2, read: (b, at) => b.readUInt16LE(at), of: (n) => new Uint16Array(n), gl: 5123 },
  5125: { bytes: 4, read: (b, at) => b.readUInt32LE(at), of: (n) => new Uint32Array(n), gl: 5125 },
  5126: { bytes: 4, read: (b, at) => b.readFloatLE(at), of: (n) => new Float32Array(n), gl: 5126 },
};

/** The numbers of one accessor, un-interleaved. */
function readAccessor(gltf: Gltf, bin: Buffer, index: number): { values: Numbers; item: number; component: number; count: number } | null {
  const accessor = gltf.accessors[index];
  const view = accessor && gltf.bufferViews[accessor.bufferView];
  const item = accessor && ITEMS[accessor.type];
  const component = accessor && COMPONENTS[accessor.componentType];
  if (!accessor || !view || !item || !component || accessor.sparse) return null;
  const at = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? component.bytes * item;
  const values = component.of(accessor.count * item);
  for (let v = 0; v < accessor.count; v++) for (let k = 0; k < item; k++) values[v * item + k] = component.read(bin, at + v * stride + k * component.bytes);
  return { values, item, component: component.gl, count: accessor.count };
}

/** A geometry three's simplifier can work on, or null when a part of it is missing. */
function geometryOf(gltf: Gltf, bin: Buffer, primitive: Primitive): BufferGeometry | null {
  const position = readAccessor(gltf, bin, primitive.attributes.POSITION);
  if (!position || position.item !== 3 || position.component !== 5126) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(position.values as Float32Array), 3));
  const normal = primitive.attributes.NORMAL === undefined ? null : readAccessor(gltf, bin, primitive.attributes.NORMAL);
  if (normal?.item === 3 && normal.component === 5126) geometry.setAttribute('normal', new BufferAttribute(Float32Array.from(normal.values as Float32Array), 3));
  const uv = primitive.attributes.TEXCOORD_0 === undefined ? null : readAccessor(gltf, bin, primitive.attributes.TEXCOORD_0);
  if (uv?.item === 2 && uv.component === 5126) geometry.setAttribute('uv', new BufferAttribute(Float32Array.from(uv.values as Float32Array), 2));
  if (primitive.indices === undefined) return null;
  const indices = readAccessor(gltf, bin, primitive.indices);
  if (!indices || indices.item !== 1) return null;
  geometry.setIndex(new BufferAttribute(Uint32Array.from(indices.values as Uint32Array), 1));
  return geometry;
}

/**
 * Reduces one downloaded model, beside itself, and says what it did. Anything this can't rewrite — a `.glb`
 * container, a compressed, skinned or morphing model, a model whose textures live inside its own buffer —
 * is left exactly as it was, with the reason.
 */
export async function reduceModel(dir: string): Promise<Reduction | { skipped: string }> {
  const manifest = readManifest(dir);
  if (!manifest) return { skipped: 'no model here' };
  if (manifest.reduced) return { skipped: 'already reduced' };
  if (!manifest.entry.endsWith('.gltf')) return { skipped: `${manifest.entry} is not a .gltf: only text glTF can be rewritten here` };

  let gltf: Gltf;
  try {
    gltf = JSON.parse(readFileSync(path.join(dir, manifest.entry), 'utf8')) as Gltf;
  } catch (err) {
    return { skipped: `unreadable (${(err as Error).message})` };
  }
  const primitives = (gltf.meshes ?? []).flatMap((m) => m.primitives);
  if (!primitives.length) return { skipped: 'nothing to draw' };
  if (gltf.skins?.length || (gltf.meshes ?? []).some((m) => m.targets?.length)) return { skipped: 'skinned or morphing: reducing it would break it' };
  if (primitives.some((p) => p.mode !== undefined && p.mode !== 4)) return { skipped: 'not all of it is triangles' };
  if ((gltf.extensionsRequired ?? []).some((e) => /compression/i.test(e))) return { skipped: 'its geometry is compressed' };
  if ((gltf.images ?? []).some((i) => i.bufferView !== undefined)) return { skipped: 'its textures live inside its own buffer' };
  const binName = gltf.buffers?.[0]?.uri;
  if (!binName || binName.startsWith('data:')) return { skipped: 'no .bin beside it' };
  let bin: Buffer;
  try {
    bin = readFileSync(path.join(dir, binName));
  } catch (err) {
    return { skipped: `the .bin is missing (${(err as Error).message})` };
  }

  // Every primitive is read, the heavy ones are simplified, and all of them are written out again.
  const outViews: BufferView[] = [];
  const outAccessors: Accessor[] = [];
  const parts: Buffer[] = [];
  let offset = 0;
  let before = 0;
  let after = 0;

  /** Writes one attribute's numbers into the new buffer and says which accessor they are. */
  const put = (values: Numbers, item: number, bounds: boolean): number => {
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      parts.push(Buffer.alloc(pad));
      offset += pad;
    }
    outViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    parts.push(bytes);
    offset += bytes.length;
    const componentType = values instanceof Float32Array ? 5126 : values instanceof Uint16Array ? 5123 : values instanceof Uint8Array ? 5121 : 5125;
    const accessor: Accessor = { bufferView: outViews.length - 1, componentType, count: values.length / item, type: (['SCALAR', 'VEC2', 'VEC3', 'VEC4'] as const)[item - 1] };
    if (bounds && componentType === 5126) {
      const floats = values as Float32Array;
      const min = new Array(item).fill(Infinity);
      const max = new Array(item).fill(-Infinity);
      for (let i = 0; i < floats.length; i += item) {
        for (let k = 0; k < item; k++) {
          min[k] = Math.min(min[k], floats[i + k]);
          max[k] = Math.max(max[k], floats[i + k]);
        }
      }
      accessor.min = min;
      accessor.max = max;
    }
    outAccessors.push(accessor);
    return outAccessors.length - 1;
  };

  const rebuilt: Primitive[] = [];
  for (const primitive of primitives) {
    const geometry = geometryOf(gltf, bin, primitive);
    const triangles = geometry ? geometry.getIndex()!.count / 3 : 0;
    before += triangles;
    let small = geometry;
    if (geometry && triangles > REDUCE_ABOVE) {
      try {
        // Welded first: the simplifier collapses edges of a mesh whose vertices are its own, and a model
        // that comes with duplicated vertices (as exported ones do) gives it nothing to collapse.
        const welded = mergeVertices(geometry);
        const vertices = welded.getAttribute('position').count;
        const remove = Math.max(0, vertices - Math.round(REDUCE_TO / 2));
        small = remove ? await new SimplifyModifier().modify(welded, remove) : welded;
      } catch {
        // A model this can't read the shape of stays as it came: it is still a model, and the frame is
        // what it was before rather than a hole in the room.
        small = geometry;
      }
    }
    if (!small) {
      // Not triangles this can rebuild: carried through exactly as it came in, which for a glTF whose
      // parts aren't in its own buffer means its numbers are copied into the new one unchanged.
      const carried = primitive.attributes.POSITION !== undefined ? geometryOf(gltf, bin, primitive) : null;
      if (!carried) return { skipped: 'a part of it this cannot read' };
      small = carried;
    }
    const attributes: Record<string, number> = { POSITION: put(small.getAttribute('position').array as Float32Array, 3, true) };
    const normal = small.getAttribute('normal');
    if (normal) attributes.NORMAL = put(normal.array as Float32Array, 3, false);
    const uv = small.getAttribute('uv');
    if (uv) attributes.TEXCOORD_0 = put(uv.array as Float32Array, 2, false);
    const index = small.getIndex()!;
    const indices = index.array instanceof Uint32Array ? index.array : Uint32Array.from(index.array);
    rebuilt.push({ ...primitive, attributes, indices: put(indices, 1, false) });
    after += indices.length / 3;
  }

  // A model already the size the room can afford is left exactly as it came: writing a copy of it would
  // be a second file to keep, for no triangles saved.
  if (after >= before) return { skipped: `nothing above ${REDUCE_ABOVE.toLocaleString('en-US')} triangles` };

  const stem = manifest.id;
  const reducedEntry = `${stem}.reduced.gltf`;
  const reducedBin = `${stem}.reduced.bin`;
  const out: Gltf = {
    asset: gltf.asset,
    scene: gltf.scene,
    scenes: gltf.scenes,
    nodes: gltf.nodes,
    materials: gltf.materials,
    textures: gltf.textures,
    images: gltf.images,
    samplers: gltf.samplers,
    extensionsUsed: gltf.extensionsUsed,
    meshes: (gltf.meshes ?? []).map((mesh) => ({ ...mesh, primitives: rebuilt.splice(0, mesh.primitives.length) })),
    accessors: outAccessors,
    bufferViews: outViews,
    buffers: [{ uri: reducedBin, byteLength: offset }],
  };

  try {
    // Written under other names and moved into place, so a model is never left half-written.
    writeFileSync(path.join(dir, `${reducedBin}.part`), Buffer.concat(parts, offset));
    writeFileSync(path.join(dir, `${reducedEntry}.part`), `${JSON.stringify(out)}\n`);
    renameSync(path.join(dir, `${reducedBin}.part`), path.join(dir, reducedBin));
    renameSync(path.join(dir, `${reducedEntry}.part`), path.join(dir, reducedEntry));
    const updated: ModelManifest = { ...manifest, entry: reducedEntry, reduced: { from: manifest.entry, before, after } };
    writeFileSync(path.join(dir, '.model.json'), `${JSON.stringify(updated, null, 2)}\n`);
  } catch (err) {
    return { skipped: `could not keep the reduced model (${(err as Error).message})` };
  }
  return { entry: reducedEntry, before, after };
}
