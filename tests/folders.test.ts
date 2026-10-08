import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listFolders } from '../src/server/folders.js';
import type { FolderListing } from '../src/shared/protocol.js';

/** A folder tree to browse: what the picker shows, and what it leaves out. */
function tree(t: { after(fn: () => void): void }) {
  const home = mkdtempSync(path.join(tmpdir(), 'agent-office-folders-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  for (const dir of ['raspnas/development/projects/web_apps', 'raspnas/development/projects/automation', 'raspnas/.git', 'raspnas/node_modules/left-pad']) {
    mkdirSync(path.join(home, dir), { recursive: true });
  }
  writeFileSync(path.join(home, 'raspnas', 'README.md'), '# raspnas\n');
  return home;
}

test("the picker lists a folder's own sub-folders, and only the ones a project can be", (t) => {
  const home = tree(t);
  const raspnas = path.join(home, 'raspnas');

  assert.deepEqual(listFolders(raspnas, home), { path: raspnas, parent: home, home, dirs: ['development'] });
  // Sorted, and the office's own machinery and the OS's (dot-folders) and dependencies left out.
  const projects = path.join(raspnas, 'development', 'projects');
  assert.deepEqual((listFolders(projects, home) as FolderListing).dirs, ['automation', 'web_apps']);
  // A person types a path the way they write it: ~ is the home folder, and no path at all is home.
  assert.deepEqual((listFolders('~/raspnas', home) as FolderListing).path, raspnas);
  assert.deepEqual((listFolders('', home) as FolderListing).path, home);
  // The root of the filesystem has nowhere to go up to.
  assert.equal((listFolders('/', home) as FolderListing).parent, undefined);
});

test('a folder the office cannot show says why, and never invents a listing', (t) => {
  const home = tree(t);

  assert.match(listFolders(path.join(home, 'nowhere'), home) as string, /no folder at/);
  assert.match(listFolders(path.join(home, 'raspnas', 'README.md'), home) as string, /isn't a folder/);
  // Reading a folder the office has no permission for is a message, not a crash.
  const secret = path.join(home, 'secret');
  mkdirSync(secret, { mode: 0o000 });
  if (process.getuid?.() !== 0) assert.match(listFolders(secret, home) as string, /can't read/);
  chmodSync(secret, 0o700); // so the folder can be cleaned up again
});
