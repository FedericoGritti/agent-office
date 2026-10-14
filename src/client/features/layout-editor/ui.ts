// The catalog: what the editor can put in the room — the office's own things (shared/catalog), and
// models fetched from an online catalog (shared/model-sources, one section per source). Picking one puts it in
// the room in front of you and closes the window, so it can be carried and put down straight away.

import './ui.css';
import { CATALOG, CATALOG_KINDS, type CatalogKind } from '../../../shared/catalog';
import { MODEL_SEARCH_PATH, MODEL_SOURCES, MODEL_SOURCE_IDS, type ModelInfo, type ModelSource } from '../../../shared/model-sources';
import { h, openModal } from '../../ui/dom';

/** What picking something does. Either may refuse, saying what went wrong — the window shows it and
 *  stays open; when one works the window closes. */
export interface CatalogOptions {
  add(kind: CatalogKind): Promise<void>;
  addModel(source: ModelSource, id: string): Promise<void>;
}

export function openCatalog(opts: CatalogOptions): void {
  /** Set once the window exists: what a row calls when what it picked is in the room. */
  let close = () => {};

  const trouble = h('p.setting-note.bad');
  const list = h(
    'ul.svc-list.cat-grid',
    {},
    ...CATALOG_KINDS.map((kind) => {
      const entry = CATALOG[kind];
      const li = h(
        'li',
        { tabindex: 0, role: 'button', title: `Put a ${entry.label} in the room` },
        h('div.svc-main', {}, h('div.svc-title', {}, entry.label), h('div.svc-meta', {}, entry.blurb)),
      );
      const pick = () =>
        void opts.add(kind).then(close, (err: Error) => {
          trouble.textContent = err.message;
        });
      li.addEventListener('click', pick);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      });
      return li;
    }),
  );

  const el = h(
    'div.modal.catalog',
    { role: 'dialog', 'aria-label': 'Catalog' },
    h('header', {}, h('h2', {}, '🧰 Catalog')),
    h(
      'div.body',
      {},
      h('p.setting-note', {}, 'What goes in the room. It lands in front of you: R turns it a quarter, E puts it down where you look, Canc takes it away again.'),
      list,
      trouble,
      ...MODEL_SOURCE_IDS.map((source) => section(source, opts, () => close())),
    ),
  );
  const modal = openModal(el);
  close = () => modal.close();
  setTimeout(() => (list.querySelector('li[tabindex="0"]') as HTMLElement | null)?.focus(), 30);
}

/**
 * One online catalog: a search box over what it holds, and a row per model. The office does the asking
 * (see src/server/http/routes/models.ts), so a source that needs a key or a signature needs nothing of
 * the browser, and the results say who made the models and under what licence.
 */
function section(source: ModelSource, opts: CatalogOptions, close: () => void): HTMLElement {
  const info = MODEL_SOURCES[source];
  const query = h('input.cat-search', { type: 'search', placeholder: 'chair, lamp, rock, plant…', 'aria-label': `Search ${info.name}` });
  const search = h('button.btn', { type: 'button' }, 'Search');
  const results = h('div.cat-results');
  /** Which search is the last one asked: a slow answer to an old question doesn't overwrite a new one. */
  let asked = 0;

  async function look(): Promise<void> {
    const mine = ++asked;
    results.replaceChildren(h('p.setting-note', {}, 'Looking…'));
    let body: { models?: ModelInfo[]; error?: string };
    try {
      const res = await fetch(`${MODEL_SEARCH_PATH}?source=${source}&q=${encodeURIComponent(query.value.trim())}`, { headers: { accept: 'application/json' } });
      body = (await res.json().catch(() => ({}))) as typeof body;
      if (!res.ok || !body.models) throw new Error(body.error ?? `the office answered ${res.status}`);
    } catch (err) {
      if (mine === asked) results.replaceChildren(h('p.setting-note.bad', {}, `Couldn't look: ${(err as Error).message}`));
      return;
    }
    if (mine !== asked) return;
    const models = body.models;
    results.replaceChildren(
      ...(models.length ? models.map((m) => row(source, m, opts, close)) : [h('p.setting-note', {}, 'Nothing by that name.')]),
    );
  }

  search.addEventListener('click', () => void look());
  query.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void look();
    }
  });
  // What they have, without anyone typing anything: the most reached-for models first.
  void look();

  return h(
    'section.cat-source',
    {},
    h('h3', {}, `🌐 From ${info.name}`),
    h('div.cat-search-row', {}, query, search),
    results,
    h(
      'p.setting-note',
      {},
      `${info.licence}, made by other people · `,
      h('a', { href: info.site, target: '_blank', rel: 'noreferrer noopener' }, info.credit),
    ),
  );
}

/** One model of a source, as a row: its picture, what it costs the room (triangles and metres), who made
 *  it, and the button that fetches it. */
function row(source: ModelSource, m: ModelInfo, opts: CatalogOptions, close: () => void): HTMLElement {
  const add = h('button.btn.cat-add', { type: 'button' }, 'Add');
  const note = h('div.cat-error');
  const size = m.size.map((s) => s.toFixed(2)).join(' × ');
  const li = h(
    'li.cat-model',
    {},
    h('img.cat-thumb', { src: `/api/image?url=${encodeURIComponent(m.thumbnail)}`, alt: '', loading: 'lazy' }),
    h(
      'div.svc-main',
      {},
      h('div.svc-title', {}, m.name),
      h('div.svc-meta', {}, `${m.polycount.toLocaleString()} triangles · ${size} m${m.authors.length ? ` · ${m.authors.join(', ')}` : ''}`),
    ),
    add,
    note,
  );
  add.addEventListener('click', async () => {
    add.disabled = true;
    add.textContent = 'Fetching…';
    note.textContent = '';
    try {
      await opts.addModel(source, m.id);
      close();
    } catch (err) {
      add.disabled = false;
      add.textContent = 'Add';
      note.textContent = (err as Error).message;
    }
  });
  return li;
}
