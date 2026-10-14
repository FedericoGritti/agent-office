// The models a floor has fetched from an online catalog, and the bytes of one of their files. They live
// in the floor's own .agent-office folder, beside layout.json: out of git, out of the sync, and thrown
// away with the floor's state if anyone ever wants the room's furniture gone (see shared/model-sources).

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isModelId, isModelSource, type ModelSource } from '../../shared/model-sources.js';
import { MODEL_ADAPTERS } from './index.js';

/** What a downloaded model's folder says about itself: which file is the model's own, and when it came. */
export interface ModelManifest {
  source: ModelSource;
  id: string;
  /** The file the loader asks for first; everything else it needs is named inside that file. */
  entry: string;
  at: number;
}

const MANIFEST = '.model.json';
/** A file name the office wrote: one plain part of a path, never one that climbs out of the folder. */
const ENTRY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

/** What a file is, by its name: what a browser has to be told for a glTF and the files it names. */
const TYPES: Record<string, string> = {
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
};

/** What a model's folder says about itself, or null when there is nothing (or nothing readable) there:
 *  a folder whose manifest is missing is one whose download didn't finish, and it gets fetched again. */
export function readManifest(dir: string): ModelManifest | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(dir, MANIFEST), 'utf8')) as ModelManifest;
    return typeof raw?.entry === 'string' && ENTRY.test(raw.entry) ? raw : null;
  } catch {
    return null;
  }
}

/** A floor's models: fetching one, and serving what came down. */
export class ModelStore {
  private dir: string;

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, 'models');
  }

  /** Where a model lives, or null for a source or an id the office would never have written (an id off a
   *  file names a folder, so it is checked before it is one). */
  private folder(source: string, id: string): string | null {
    if (!isModelSource(source) || !isModelId(id)) return null;
    return path.join(this.dir, source, id);
  }

  /** Fetches a model into this floor's folder, unless it is already down. Says what went wrong, or that
   *  the room can build it now. */
  async add(source: ModelSource, id: string): Promise<{ error: string } | { ok: true }> {
    const dir = this.folder(source, id);
    if (!dir) return { error: 'No such model' };
    if (readManifest(dir)) return { ok: true };
    const got = await MODEL_ADAPTERS[source].fetch(id, dir);
    if ('error' in got) return got;
    const manifest: ModelManifest = { source, id, entry: got.entry, at: Date.now() };
    try {
      writeFileSync(path.join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
    } catch (err) {
      return { error: `The office could not keep ${id}: ${(err as Error).message}` };
    }
    return { ok: true };
  }

  /** One file of a downloaded model: where it is and what it is, or null — nothing of that name, no
   *  model there, or a path that would leave the model's own folder. An empty `file` is the model's own. */
  file(source: string, id: string, file: string): { path: string; type: string } | null {
    const dir = this.folder(source, id);
    if (!dir) return null;
    const manifest = readManifest(dir);
    if (!manifest) return null;
    const full = path.resolve(dir, file || manifest.entry);
    if (full !== dir && !full.startsWith(`${dir}${path.sep}`)) return null;
    try {
      if (!statSync(full).isFile()) return null;
    } catch {
      return null;
    }
    return { path: full, type: TYPES[path.extname(full).toLowerCase()] ?? 'application/octet-stream' };
  }
}
