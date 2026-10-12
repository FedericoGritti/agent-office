// The office's furniture, as moved and deleted from inside the office itself (see
// features/layout-editor): kept in .agent-office/layout.json, one file per floor. Only what differs
// from layout.ts is written down (see shared/placement), so a floor that nobody has rearranged has no
// file at all, and a piece put back stops being remembered.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sanitize, type Placements } from '../shared/placement.js';

export class Layout {
  private file: string;
  private saved: Placements = {};

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'layout.json');
    this.load();
  }

  /** Where the furniture stands on this floor: what the editor saved, or nothing. */
  placements(): Placements {
    return this.saved;
  }

  /** Keeps what the editor saved. Says whether it changed anything, so the floor only tells everyone
   *  when there is something to tell. */
  set(next: Placements): boolean {
    const before = JSON.stringify(this.saved);
    this.saved = next;
    if (JSON.stringify(next) === before) return false;
    try {
      writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`);
    } catch (e) {
      // A floor whose folder can't be written keeps it in memory: the room still moves, it just
      // doesn't outlive the office.
      console.warn(`could not save ${path.basename(this.file)}:`, e);
    }
    return true;
  }

  private load(): void {
    try {
      if (existsSync(this.file)) this.saved = sanitize(JSON.parse(readFileSync(this.file, 'utf8')));
    } catch {
      // A file that can't be read is a floor as built: no rearranging at all.
      this.saved = {};
    }
  }
}
