// The folders of the office's machine, for any server-folder picker: adding a project from the
// elevator, or choosing what the Figures boards show. Browsing never writes to the selected folder.
import { readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import type { FolderListing } from '../shared/protocol.js';

/** How many sub-folders one listing shows. */
export const FOLDERS_SHOWN = 300;

/** `~` as the home folder, the way a person types a path. */
function untildify(text: string, home: string): string {
  if (text === '~') return home;
  return text.startsWith('~/') ? path.join(home, text.slice(1)) : text;
}

/**
 * The sub-folders of `raw` (a full path, `~`, or nothing for the home folder), for the picker to
 * choose from. Returns why it can't be shown, when it can't.
 */
export function listFolders(raw: string, home: string): FolderListing | string {
  const typed = raw.trim();
  const dir = path.resolve(typed ? untildify(typed, home) : home);
  let real: string;
  try {
    real = realpathSync(dir);
    if (!statSync(real).isDirectory()) return `${real} isn't a folder`;
  } catch {
    return `There's no folder at ${dir}`;
  }
  let dirs: string[];
  try {
    dirs = readdirSync(real, { withFileTypes: true })
      // Dot-folders are the office's own machinery (.git, .agent-office) and the OS's: not projects.
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  } catch {
    return `The office can't read ${real}`;
  }
  const up = path.dirname(real);
  return {
    path: real,
    parent: up === real ? undefined : up,
    home,
    dirs: dirs.slice(0, FOLDERS_SHOWN),
  };
}
