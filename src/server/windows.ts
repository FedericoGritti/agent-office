// The office's windows, as moved, added and taken out from inside the office itself (see
// features/layout-editor): kept in .agent-office/windows.json, next to the sky and the decorations.
// The room is one room, shared by every floor, and the building's outside carries its windows on every
// floor too, so this is the office's file and not a floor's — unlike the furniture, which is per floor
// (see layout.ts). Only what differs from shared/windows.ts is written down, so an office nobody has
// touched has no file at all.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sanitizeWindows, type WindowPlacements } from '../shared/windows.js';

export class Windows {
  private file: string;
  private saved: WindowPlacements = {};

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'windows.json');
    this.load();
  }

  /** The windows as they stand: what the editor saved, or nothing. */
  state(): WindowPlacements {
    return this.saved;
  }

  /** Keeps what the editor saved. Says whether it changed anything, so the office only tells everyone
   *  when there is something to tell. */
  set(next: WindowPlacements): boolean {
    const before = JSON.stringify(this.saved);
    this.saved = next;
    if (JSON.stringify(next) === before) return false;
    try {
      writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`);
    } catch (e) {
      // An office whose folder can't be written keeps it in memory: the windows still move, they just
      // don't outlive the office.
      console.warn(`could not save ${path.basename(this.file)}:`, e);
    }
    return true;
  }

  private load(): void {
    try {
      if (existsSync(this.file)) this.saved = sanitizeWindows(JSON.parse(readFileSync(this.file, 'utf8')));
    } catch {
      // A file that can't be read is an office as built: no window moved at all.
      this.saved = {};
    }
  }
}
