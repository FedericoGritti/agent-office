// The online catalogs of models: searching one, fetching a model into the floor's own folder, and
// serving what came down (see shared/model-sources for the sources and the shape of it, and server/models for
// the folder). Per floor, because a model lives in the floor's .agent-office folder — and the room that
// names it in layout.json is that floor's too.

import { readFileSync } from 'node:fs';
import { MODEL_ADD_PATH, MODEL_FILES_PREFIX, MODEL_SEARCH_PATH, MODEL_SOURCES, isModelSource } from '../../../shared/model-sources.js';
import { MODEL_ADAPTERS } from '../../model-sources/index.js';
import { sameOrigin, send } from '../util.js';
import { floorParam } from './files.js';
import type { Route } from '../router.js';

export const modelRoutes = {
  search: {
    method: 'GET',
    path: MODEL_SEARCH_PATH,
    auth: 'session',
    async handle(_ctx, { res, url }) {
      // What a catalog has: the office asks it, so the browser never has to reach across (and so the
      // call goes out signed as the office, as their terms ask).
      const source = url.searchParams.get('source') ?? '';
      if (!isModelSource(source)) return send(res, 400, { error: 'No such catalog of models' });
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
      const info = MODEL_SOURCES[source];
      try {
        const models = await MODEL_ADAPTERS[source].search(q);
        return send(res, 200, { source, models, credit: info.credit, licence: info.licence });
      } catch (err) {
        return send(res, 502, { error: `${info.name} could not be reached (${(err as Error).message})` });
      }
    },
  },
  add: {
    method: 'POST',
    path: MODEL_ADD_PATH,
    auth: 'session',
    async handle(ctx, { req, res, url }) {
      // Fetching a model writes into the floor's folder, so it comes from the office's own pages.
      if (!sameOrigin(req, ctx.cfg)) return send(res, 403, { error: 'Forbidden' });
      const floor = floorParam(ctx, url);
      if (!floor) return send(res, 404, { error: 'No such floor' });
      const source = url.searchParams.get('source') ?? '';
      if (!isModelSource(source)) return send(res, 400, { error: 'No such catalog of models' });
      const got = await floor.models.add(source, url.searchParams.get('id') ?? '');
      return 'error' in got ? send(res, 502, got) : send(res, 200, { ok: true });
    },
  },
  files: {
    prefix: MODEL_FILES_PREFIX,
    auth: 'session',
    async handle(ctx, { res, url, path: p }) {
      // `/api/models/files/<source>/<id>/<file…>`: the last part is a name the model itself asked for,
      // which is how a glTF that came in several pieces is read (see shared/model-sources' modelFolderPath).
      const floor = floorParam(ctx, url);
      if (!floor) return send(res, 404, { error: 'No such floor' });
      const [source, id, ...file] = p.slice(MODEL_FILES_PREFIX.length).split('/');
      const found = floor.models.file(source ?? '', id ?? '', file.join('/'));
      if (!found) return send(res, 404, { error: 'No such model' });
      const body = readFileSync(found.path);
      res.writeHead(200, {
        'content-type': found.type,
        'content-length': String(body.length),
        // Kept for an hour: the folder is ours and only changes when a model is fetched again.
        'cache-control': 'private, max-age=3600',
        'x-content-type-options': 'nosniff',
      });
      res.end(body);
    },
  },
} satisfies Record<string, Route>;
