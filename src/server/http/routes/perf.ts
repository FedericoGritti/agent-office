// What a browser measured about its own frames, written down where the office can be asked for it.
//
// Why it comes to the server at all: the browser that is drawing slowly is exactly the one whose user
// should not have to copy a number out of it. A reading changes every second, the interesting one is the
// worst window, and it has to be read while the office is still stuttering — asking the person who is
// watching a slow screen is asking the wrong reporter. Kept in the floor's own folder, one JSON line per
// reading, and only while someone has the measurement switched on (see core/perf.ts and
// ui/settings-graphics.ts: the strip, and the switch that starts it).
//
// Nothing reads it back: it is a diagnostic, not state. It is capped, and it starts again when it's full.

import { appendFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readBody, send } from '../util.js';
import { floorParam } from './files.js';
import type { Route } from '../router.js';

/** Where the readings go on each floor (`.agent-office` is the office's own folder, and never in git). */
const PERF_LOG = join('.agent-office', 'perf.log');
/** Past this the file starts again: what's wanted is what the frames are doing now, not a chronicle. */
const MAX_BYTES = 256 * 1024;

export const perfReport: Route = {
  path: '/api/perf',
  method: 'POST',
  auth: 'session',
  async handle(ctx, { req, res, url }) {
    const floor = floorParam(ctx, url);
    if (!floor) return send(res, 404, { error: 'No such floor' });
    // The reading itself, as the client wrote it: the office keeps a log line and doesn't interpret it.
    const line = (await readBody(req, 16 * 1024)).trim();
    if (!line) return send(res, 400, { error: 'Nothing to write down' });
    const file = join(floor.dir, PERF_LOG);
    try {
      mkdirSync(join(floor.dir, '.agent-office'), { recursive: true });
      if ((statSync(file, { throwIfNoEntry: false })?.size ?? 0) > MAX_BYTES) writeFileSync(file, '');
      appendFileSync(file, `${line}\n`);
    } catch (err) {
      return send(res, 500, { error: (err as Error).message });
    }
    return send(res, 200, { ok: true });
  },
};
