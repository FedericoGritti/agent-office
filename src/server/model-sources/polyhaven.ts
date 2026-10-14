// Poly Haven's models, as the office reads them (see shared/model-sources for what the office knows of the
// source, and store.ts for where the files go). Their API is free, needs no key and asks two things in
// return: every call says who is asking, and — while their API is the one listing the models — whoever
// shows them says where they came from (the credit in features/layout-editor). The models themselves
// are CC0, and ask for nothing at all once downloaded.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { modelName, type ModelInfo } from '../../shared/model-sources.js';
import type { ModelAdapter } from './types.js';

const API = 'https://api.polyhaven.com';
/** Who is asking, as their terms require: the office's own name, and where it can be found. */
const UA = 'agent-office/1.0 (+https://github.com/AgentSystemLabs/agent-office)';
/** How long the list of everything they hold is kept: half a megabyte, and it moves slowly. */
const LIST_MS = 60 * 60 * 1000;
/** How long one request may take. */
const TIMEOUT_MS = 30_000;
/** How many models a search answers with: it's a catalog to pick from, not everything they have. */
const MAX_RESULTS = 60;

/** What their API says about one model (the fields the office reads). */
export interface Asset {
  name?: string;
  categories?: string[];
  tags?: string[];
  authors?: Record<string, string>;
  polycount?: number;
  /** Width, depth and height in **millimetres**, as their own tooling measures it. */
  dimensions?: number[];
  download_count?: number;
}

/** One file their API names: where it is, and what it weighs. */
interface FileRef {
  url: string;
  size?: number;
}

/** What they hold for one model: one entry per resolution, each a glTF and the files it names. */
export interface PolyFiles {
  gltf?: Record<string, { gltf?: FileRef & { include?: Record<string, FileRef> } }>;
}

async function apiJson<T>(where: string): Promise<T> {
  const res = await fetch(`${API}${where}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Poly Haven answered ${res.status}`);
  return (await res.json()) as T;
}

let list: { at: number; assets: Record<string, Asset> } | null = null;

/** Everything they hold, kept between searches: one big answer that doesn't change by the minute. */
async function assets(): Promise<Record<string, Asset>> {
  if (list && Date.now() - list.at < LIST_MS) return list.assets;
  const got = await apiJson<Record<string, Asset>>('/assets?t=models');
  list = { at: Date.now(), assets: got };
  return got;
}

/** What a model measures in metres, from their millimetres. */
export function sizeInMetres(dimensions: readonly number[] | undefined): [number, number, number] {
  const m = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v / 10) / 100 : 0);
  return [m(dimensions?.[0]), m(dimensions?.[1]), m(dimensions?.[2])];
}

/** Where its picture is: 256 pixels, which is all a row of the window needs (the office fetches it, like
 *  the pictures on the walls). */
export function thumbUrl(id: string): string {
  return `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256&height=256&format=webp`;
}

/** One of their models as the window shows it. */
export function toInfo(id: string, a: Asset): ModelInfo {
  return {
    id,
    name: a.name?.trim() || modelName(id),
    categories: [...(a.categories ?? []), ...(a.tags ?? [])].slice(0, 10),
    polycount: Math.max(0, Math.round(a.polycount ?? 0)),
    size: sizeInMetres(a.dimensions),
    authors: Object.keys(a.authors ?? {}).slice(0, 4),
    thumbnail: thumbUrl(id),
  };
}

/** The words a model answers to: its id, its name, its categories and its tags. */
function words(id: string, a: Asset): string {
  return [id, a.name ?? '', ...(a.categories ?? []), ...(a.tags ?? [])].join(' ').toLowerCase();
}

/** The number in a resolution's name (`1k` is a thousand pixels across), for picking the smallest one. */
function resolution(res: string): number {
  const n = Number(/^(\d+)k$/i.exec(res.trim())?.[1]);
  return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
}

/**
 * The glTF to download: the smallest resolution they offer, with everything that file names. The
 * smallest is plenty for a room drawn in flat colors, and the largest can be hundreds of megabytes.
 */
export function pickGltf(files: PolyFiles): { url: string; include: Record<string, FileRef> } | { error: string } {
  const sizes = Object.entries(files.gltf ?? {})
    .filter(([, one]) => !!one?.gltf?.url)
    .map(([res, one]) => ({ res: resolution(res), gltf: one.gltf! }))
    .sort((a, b) => a.res - b.res);
  const pick = sizes[0];
  if (!pick) return { error: 'Poly Haven has no glTF of that model' };
  return { url: pick.gltf.url, include: pick.gltf.include ?? {} };
}

/** A name inside a model's folder: a relative path of plain parts, and never one that climbs out. */
const INNER = /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/;

/** Downloads one file of a model into the folder `dir`, under the name the model asks for it by. */
async function get(url: string, dir: string, name: string): Promise<void> {
  if (!INNER.test(name) || name.split('/').includes('..')) throw new Error(`${name} is not a name to write`);
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
  if (!res.ok) throw new Error(`${name}: they answered ${res.status}`);
  const to = path.join(dir, name);
  await mkdir(path.dirname(to), { recursive: true });
  await writeFile(to, Buffer.from(await res.arrayBuffer()));
}

export const polyhaven: ModelAdapter = {
  async search(q) {
    const all = await assets();
    const want = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits: { info: ModelInfo; downloads: number }[] = [];
    for (const [id, a] of Object.entries(all)) {
      const text = words(id, a);
      if (!want.every((w) => text.includes(w))) continue;
      hits.push({ info: toInfo(id, a), downloads: a.download_count ?? 0 });
    }
    // The most downloaded first: a catalog isn't a ranking, but a model many people reached for is a
    // better first guess than the alphabet.
    hits.sort((x, y) => y.downloads - x.downloads);
    return hits.slice(0, MAX_RESULTS).map((h) => h.info);
  },

  async fetch(id, dir) {
    let files: PolyFiles;
    try {
      files = await apiJson<PolyFiles>(`/files/${id}`);
    } catch (err) {
      return { error: `Poly Haven didn't say what ${id} is made of (${(err as Error).message})` };
    }
    const pick = pickGltf(files);
    if ('error' in pick) return pick;
    // The model's own file, named as they name it: the loader asks the folder for it, and reads its
    // neighbours by the names inside it.
    const entry = decodeURIComponent(new URL(pick.url).pathname).split('/').pop() ?? '';
    if (!entry) return { error: 'Poly Haven gave no name to that model' };
    try {
      await mkdir(dir, { recursive: true });
      // The model's own file first (the load waits on it), then everything it names, all at once: they
      // are five or six files, and one at a time it's a handful of seconds for whoever is waiting.
      await get(pick.url, dir, entry);
      await Promise.all(Object.entries(pick.include).map(([name, file]) => get(file.url, dir, name)));
    } catch (err) {
      // Half a model is worse than none: a folder with no manifest in it is fetched again next time, and
      // what's in it now is in the way.
      await rm(dir, { recursive: true, force: true }).catch(() => {});
      return { error: `Couldn't download ${id}: ${(err as Error).message}` };
    }
    return { entry };
  },
};
