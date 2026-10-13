// The pictures of a floor's project: its `images/` folder at the root — one images folder per
// repository, the file names are the index (see the project's own rules). The gallery in the office
// (features/gallery/) shows them, one at a time, off this list and these bytes.

import { existsSync, watch, type FSWatcher } from 'node:fs';
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
/** A figure written again is several filesystem events: one notice goes out this long after the last. */
const SETTLE_MS = 250;

/** A floor's figures: what's in its `images/` folder, and the bytes of one. */
export class Images {
  constructor(private dir: string) {}

  /**
   * The pictures under `images/`, by name — the file names are the index. The folder is walked every
   * time: nothing is held back, so a figure added or written again is listed on the very next ask
   * (see features/figures, which asks again on a timer rather than keeping what it was shown).
   */
  async list(): Promise<ImageList> {
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
    return { files: out.slice(0, MAX), more: out.length > MAX };
  }

  /**
   * Watches `images/` and calls `onChange` whenever something in it moves: a figure added, taken
   * away, or written again under its own name. The figures boards read the folder and their picture
   * again when it does (see features/figures); nothing is held back between times. Returns what
   * stops watching.
   *
   * With no `images/` folder yet it watches the project itself, for the folder's arriving, and takes
   * up the folder the moment it's there.
   */
  watch(onChange: () => void): () => void {
    const root = path.join(this.dir, DIR);
    let timer: NodeJS.Timeout | undefined;
    let watcher: FSWatcher | undefined;
    /** Whether `watcher` is on the folder itself (rather than on the project, waiting for one). */
    let onFolder = false;

    /** One notice, out once the writing has stopped. */
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // The folder came or went while we watched the project: watch the other one from now on.
        if (existsSync(root) !== onFolder) arm();
        onChange();
      }, SETTLE_MS);
    };
    /** Watches the folder, or the project it's missing from. */
    const arm = () => {
      watcher?.close();
      watcher = undefined;
      onFolder = existsSync(root);
      try {
        watcher = onFolder ? watch(root, { recursive: true }, settle) : watch(this.dir, settle);
      } catch {
        // Nothing to watch: the boards still read on E, and when you come back to the floor.
      }
    };

    arm();
    return () => {
      clearTimeout(timer);
      watcher?.close();
    };
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
