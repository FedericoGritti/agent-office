// The pictures a floor's Figures boards show: the project's `images/` folder by default, or another
// folder on the office machine chosen at the boards. The file names are the index; the selected
// folder is kept in the floor's `.agent-office` state.

import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { changedImageType } from '../shared/protocol.js';
import type { ImageList } from '../shared/images.js';
import { insideCheckout } from './changes.js';
import type { ImageResult } from './decor.js';

/** The default folder for figures, at the project's root. */
const DIR = 'images';
/** The floor-local file that remembers a different source folder. */
const CONFIG = 'images.json';
/** How many pictures the gallery lists. */
const MAX = 500;
/** The biggest picture it serves. */
const MAX_BYTES = 12 * 1024 * 1024;
/** How deep it looks under the selected folder. */
const MAX_DEPTH = 6;
/** A figure written again is several filesystem events: one notice goes out this long after the last. */
const SETTLE_MS = 250;

/** A floor's figures: the selected folder, the pictures under it, and the bytes of one. */
export class Images {
  private readonly file: string;
  private root: string;

  constructor(
    projectDir: string,
    dataDir = path.join(projectDir, '.agent-office'),
  ) {
    this.file = path.join(dataDir, CONFIG);
    this.root = this.load() ?? path.join(projectDir, DIR);
  }

  /**
   * Selects and remembers an existing folder. The resolved real path is kept so a later symlink
   * change cannot silently move the boards to a different tree.
   */
  setFolder(raw: string): string | undefined {
    let chosen: string;
    try {
      chosen = realpathSync(path.resolve(raw));
      if (!statSync(chosen).isDirectory()) return `${chosen} isn't a folder`;
    } catch {
      return `There's no folder at ${path.resolve(raw)}`;
    }
    try {
      mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
      writeFileSync(this.file, `${JSON.stringify({ folder: chosen }, null, 2)}\n`, { mode: 0o600 });
    } catch (err) {
      return `Couldn't remember the image folder: ${(err as Error).message}`;
    }
    this.root = chosen;
    return undefined;
  }

  /**
   * The pictures under the selected folder, by relative name. The folder is walked every time:
   * nothing is held back, so a figure added or written again is listed on the very next ask.
   */
  async list(): Promise<ImageList> {
    const out: string[] = [];
    const queue: [string, number][] = [['', 0]];
    while (queue.length && out.length <= MAX) {
      const [rel, depth] = queue.shift()!;
      let entries;
      try {
        entries = await readdir(path.join(this.root, rel), { withFileTypes: true });
      } catch {
        break; // no selected folder any more: nothing to show
      }
      for (const e of entries) {
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (depth < MAX_DEPTH && !e.name.startsWith('.')) queue.push([p, depth + 1]);
        } else if (e.isFile() && changedImageType(p)) out.push(p);
      }
    }
    // The names sort the way a person reads them: 02.4 before 02.10.
    out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { folder: this.root, files: out.slice(0, MAX), more: out.length > MAX };
  }

  /**
   * Watches the selected folder and calls `onChange` when a picture moves. If the folder disappears,
   * its parent is watched for its return. The Figures boards reread both the list and bytes on notice.
   */
  watch(onChange: () => void): () => void {
    const root = this.root;
    let timer: NodeJS.Timeout | undefined;
    let watcher: FSWatcher | undefined;
    let onFolder = false;
    const folderExists = () => {
      try {
        return statSync(root).isDirectory();
      } catch {
        return false;
      }
    };

    /** One notice, out once the writing has stopped. */
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (folderExists() !== onFolder) arm();
        onChange();
      }, SETTLE_MS);
    };
    /** Watches the folder, or its parent while it is missing. */
    const arm = () => {
      watcher?.close();
      watcher = undefined;
      onFolder = folderExists();
      try {
        const target = onFolder ? root : path.dirname(root);
        if (existsSync(target)) watcher = watch(target, onFolder ? { recursive: true } : {}, settle);
      } catch {
        // Nothing to watch: the boards still read on E, and when someone returns to the floor.
      }
    };

    arm();
    return () => {
      clearTimeout(timer);
      watcher?.close();
    };
  }

  /** One picture as bytes, confined to the selected folder even through symlinks. */
  async picture(file: string): Promise<ImageResult> {
    const type = changedImageType(file);
    if (!type) return { status: 415, error: 'Only pictures' };
    const abs = await insideCheckout(this.root, file);
    if (!abs) return { status: 404, error: 'That file is not in the selected folder' };
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

  private load(): string | undefined {
    try {
      const saved = JSON.parse(readFileSync(this.file, 'utf8')) as { folder?: unknown };
      return typeof saved.folder === 'string' && path.isAbsolute(saved.folder) ? path.resolve(saved.folder) : undefined;
    } catch {
      return undefined;
    }
  }
}
