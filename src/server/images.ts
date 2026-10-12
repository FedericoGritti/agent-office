// The pictures of a floor's project: its `images/` folder at the root — one images folder per
// repository, the file names are the index (see the project's own rules). The gallery in the office
// (features/gallery/) shows them, one at a time, off this list and these bytes.

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { changedImageType } from '../shared/protocol.js';
import type { ImageList } from '../shared/images.js';
import { insideCheckout } from './changes.js';
import type { ImageResult } from './decor.js';

/** The folder the figures live in, at the project's root. */
const DIR = 'images';
/** How many pictures the gallery lists. */
const MAX = 500;
/** The biggest picture it serves. */
const MAX_BYTES = 12 * 1024 * 1024;
/** How deep it looks under `images/`. */
const MAX_DEPTH = 6;
/** A listing this fresh is handed out again rather than walking the folder. */
const FRESH_MS = 3000;

/** A floor's figures: what's in its `images/` folder, and the bytes of one. */
export class Images {
  private last: { at: number; list: ImageList } | null = null;

  constructor(private dir: string) {}

  /** The pictures under `images/`, by name — the file names are the index. */
  async list(): Promise<ImageList> {
    if (this.last && Date.now() - this.last.at < FRESH_MS) return this.last.list;
    const root = path.join(this.dir, DIR);
    const out: string[] = [];
    const queue: [string, number][] = [['', 0]];
    while (queue.length && out.length <= MAX) {
      const [rel, depth] = queue.shift()!;
      let entries;
      try {
        entries = await readdir(path.join(root, rel), { withFileTypes: true });
      } catch {
        break; // no images folder: nothing to show
      }
      for (const e of entries) {
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (depth < MAX_DEPTH && !e.name.startsWith('.')) queue.push([p, depth + 1]);
        } else if (e.isFile() && changedImageType(p)) out.push(`${DIR}/${p}`);
      }
    }
    // The names sort the way a person reads them: 02.4 before 02.10.
    out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const list: ImageList = { files: out.slice(0, MAX), more: out.length > MAX };
    this.last = { at: Date.now(), list };
    return list;
  }

  /** One of them, as bytes. Only pictures, and only inside the project (not through a link out of it). */
  async picture(file: string): Promise<ImageResult> {
    const type = changedImageType(file);
    if (!type) return { status: 415, error: 'Only pictures' };
    const abs = await insideCheckout(this.dir, file);
    if (!abs) return { status: 404, error: 'That file is not in the project' };
    try {
      const s = await stat(abs);
      if (!s.isFile()) return { status: 404, error: 'That is not a file' };
      if (s.size > MAX_BYTES) return { status: 413, error: `That picture is over ${MAX_BYTES / 1024 / 1024} MB` };
      return { type, body: await readFile(abs) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { status: 404, error: 'That file is gone' };
      return { status: 500, error: (err as Error).message };
    }
  }
}
