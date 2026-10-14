// Bringing the models a floor has already downloaded down to a size the room can afford. The office does
// this by itself when a model is fetched; this is for the ones that were fetched before there was anything
// to do it with — and for a second look after the size it aims for changes (see models/reduce.ts).

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { REDUCE_ABOVE, REDUCE_TO, reduceModel } from './models/reduce.js';

const HELP = `agent-office reduce-models — make the models a floor downloaded smaller

Usage:
  agent-office reduce-models [dir] [options]

Every model a project has fetched from an online catalog lives in
<dir>/.agent-office/models/. This reduces the ones heavier than
${REDUCE_ABOVE.toLocaleString('en-US')} triangles down to about ${REDUCE_TO.toLocaleString('en-US')} each, and writes the
smaller model beside the original. The original is never touched: the office
serves the smaller one from then on, and a model goes back to how it came by
deleting the reduced file. Materials, textures and every transform are kept —
only the triangles change (see docs/how-it-works.md).

A model that is already reduced is left alone, and so is one that can't be
rewritten — a .glb container, a compressed, skinned or morphing model — with the
reason said out loud: either way the office keeps drawing it.

Options:
  -n, --dry-run   List what would be reduced and change nothing
  -h, --help      Show this help
`;

/** Every downloaded model of a project, as `<source>/<id>` folder names. */
function modelFolders(root: string): string[] {
  const found: string[] = [];
  for (const source of readdirSync(root, { withFileTypes: true })) {
    if (!source.isDirectory()) continue;
    for (const id of readdirSync(path.join(root, source.name), { withFileTypes: true })) {
      if (id.isDirectory()) found.push(`${source.name}/${id.name}`);
    }
  }
  return found.sort();
}

export async function reduceModels(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  const dryRun = argv.includes('-n') || argv.includes('--dry-run');
  const dir = path.resolve(argv.find((a) => !a.startsWith('-')) ?? process.cwd());
  const root = path.join(dir, '.agent-office', 'models');
  let folders: string[];
  try {
    folders = modelFolders(root);
  } catch {
    console.log(`agent-office: no downloaded models in ${root}`);
    return 0;
  }
  if (!folders.length) {
    console.log(`agent-office: no downloaded models in ${root}`);
    return 0;
  }

  let reduced = 0;
  let skipped = 0;
  let before = 0;
  let after = 0;
  for (const name of folders) {
    const folder = path.join(root, ...name.split('/'));
    const done = dryRun ? { skipped: 'not looked at (--dry-run)' } : await reduceModel(folder);
    if ('skipped' in done) {
      skipped++;
      // Only worth saying when it is a model the office chose not to touch rather than one with nothing
      // to do: a model that is already reduced needs no line every time.
      if (done.skipped !== 'already reduced' && !done.skipped.startsWith('not looked at')) console.log(`  ${name}: left as it is — ${done.skipped}`);
      continue;
    }
    reduced++;
    before += done.before;
    after += done.after;
    console.log(`  ${name}: ${done.before.toLocaleString('en-US')} → ${done.after.toLocaleString('en-US')} triangles (now ${done.entry})`);
  }
  console.log(
    dryRun
      ? `agent-office: ${folders.length} model${folders.length === 1 ? '' : 's'} in ${root} (nothing changed)`
      : `agent-office: reduced ${reduced} of ${folders.length} models (${before.toLocaleString('en-US')} → ${after.toLocaleString('en-US')} triangles), ${skipped} left as they were`,
  );
  return 0;
}
