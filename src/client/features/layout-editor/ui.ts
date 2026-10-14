// The catalog: what the editor can put in the room — the office's own furniture (shared/catalog), which
// the room builds then and there, and models fetched from an online catalog (shared/model-sources). The
// two are two different things, so the window keeps them in two panes with a tab each: the room's own
// things are a shelf you pick from, and the online ones are searched and fetched. Picking one puts it in
// the room in front of you, so it can be carried and put down straight away.

import './ui.css';
import { CATALOG, CATALOG_KINDS, type CatalogEntry, type CatalogKind } from '../../../shared/catalog';
import { MODEL_SEARCH_PATH, MODEL_SOURCES, MODEL_SOURCE_IDS, type ModelInfo, type ModelSource } from '../../../shared/model-sources';
import { h, openModal } from '../../ui/dom';

/** What picking something does. Either may refuse, saying what went wrong — the window shows it and
 *  stays open; when one works the window closes. */
export interface CatalogOptions {
  add(kind: CatalogKind): Promise<void>;
  addModel(source: ModelSource, id: string): Promise<void>;
  /** What the floor's file has taken out of the room, to put back: the one way a Canc pressed by mistake
   *  is undone, and the only way back for the furniture that can't be copied yet (see Carrying.bringBack). */
  gone(): { id: string; label: string; forgettable: boolean }[];
  forget(id: string): void;
  restore(id: string): void;
}

export function openCatalog(opts: CatalogOptions): void {
  /** Set once the window exists: what a row calls when what it picked is in the room. */
  let close = () => {};

  const trouble = h('p.setting-note.bad');

  // --- The room's own furniture: a dozen things, in groups, with a box to narrow them down.
  const filter = h('input.cat-search', { type: 'search', placeholder: 'plant, rug, cushion…', 'aria-label': 'Search the room’s own furniture' });
  const shelf = h('div.cat-own');
  function drawShelf(): void {
    const want = filter.value.trim().toLowerCase();
    const hits = CATALOG_KINDS.map((kind) => ({ kind, entry: CATALOG[kind] as CatalogEntry })).filter(
      ({ entry }) => !want || `${entry.label} ${entry.blurb} ${entry.group}`.toLowerCase().includes(want),
    );
    // In groups, each under the heading it names, in the order the catalog happens to list them.
    const groups = new Map<string, HTMLElement>();
    for (const { kind, entry } of hits) {
      let list = groups.get(entry.group);
      if (!list) groups.set(entry.group, (list = h('ul.svc-list.cat-grid')));
      list.append(ownRow(kind, entry, opts, () => close(), trouble));
    }
    shelf.replaceChildren(
      ...(hits.length
        ? [...groups].map(([group, list]) => h('section.cat-group', {}, h('h3', {}, group), list))
        : [h('p.setting-note', {}, 'Nothing by that name.')]),
    );
  }
  filter.addEventListener('input', drawShelf);
  drawShelf();
  const own = h(
    'div.cat-pane',
    {},
    h('p.setting-note', {}, 'The room builds a copy of any of these, wherever you want it — as many as you want. They are furniture: nothing here is a seat the office hires into.'),
    h('div.cat-search-row', {}, filter),
    shelf,
  );

  // --- The online catalogs, one section each. They are only asked when this pane is opened: nothing
  // goes over the network because a window was opened.
  const online = h('div.cat-pane.hidden');
  let askedOnline = false;

  const tab = (text: string, open: () => void) => {
    const el = h('button.btn.cat-tab', { type: 'button', onclick: open }, text);
    return el;
  };
  const ownTab = tab('🧰 The office’s own', () => show('own'));
  const onlineTab = tab('🌐 Online catalogs', () => show('online'));
  function show(which: 'own' | 'online'): void {
    const mine = which === 'own';
    own.classList.toggle('hidden', !mine);
    online.classList.toggle('hidden', mine);
    ownTab.classList.toggle('on', mine);
    onlineTab.classList.toggle('on', !mine);
    if (mine || askedOnline) return;
    askedOnline = true;
    online.replaceChildren(...MODEL_SOURCE_IDS.map((source) => section(source, opts, () => close())));
  }

  // --- What was cancelled by mistake: not what the window is for, so it stays behind one button at the
  // bottom and out of the way — but it is there, and it costs one click. It is also the only way back for
  // the furniture that cannot be copied yet (the whiteboard, the television and the other screens).
  const back = h('section.cat-back-list.hidden');
  const backMore = h('button.btn.cat-back', { type: 'button' }, '↩️ Put back something cancelled…');
  function drawBack(): void {
    const gone = opts.gone();
    back.replaceChildren(
      ...(gone.length
        ? [
            h('p.setting-note', {}, 'What the floor’s file has taken out of the room. Click one to put it back where it was, as big and as high as it was left — or press its ✕ to forget it for good: it leaves the room and the file, and nothing brings it back. A piece of the room’s own has no ✕: cancelling is what keeps it out.'),
            h(
              'ul.svc-list.cat-grid',
              {},
              ...gone.map((piece) => {
                const li = h('li', { tabindex: 0, role: 'button', title: `Put the ${piece.label} back` }, h('div.svc-main', {}, h('div.svc-title', {}, piece.label)));
                if (piece.forgettable) {
                  const cross = h('button.btn', { type: 'button', title: `Forget the ${piece.label} for good — it leaves the room and the floor’s file`, 'aria-label': `Forget the ${piece.label} for good` }, '✕');
                  cross.addEventListener('click', (e) => {
                    // Not the row's own click: this one is not a way back.
                    e.stopPropagation();
                    opts.forget(piece.id);
                    drawBack();
                  });
                  li.append(cross);
                }
                const pick = () => {
                  opts.restore(piece.id);
                  drawBack();
                };
                li.addEventListener('click', pick);
                li.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick();
                  }
                });
                return li;
              }),
            ),
          ]
        : [h('p.setting-note', {}, 'Nothing has been taken out of the room.')]),
    );
    backMore.classList.toggle('hidden', gone.length === 0);
  }
  // The button is only there when there is something behind it (see drawBack: it hides itself on an empty
  // list), and the list itself only when it is asked for.
  backMore.addEventListener('click', () => {
    drawBack();
    back.classList.remove('hidden');
  });
  drawBack();

  const el = h(
    'div.modal.catalog',
    { role: 'dialog', 'aria-label': 'Catalog' },
    h('header', {}, h('h2', {}, '🧰 Catalog')),
    h(
      'div.body',
      {},
      h('div.cat-tabs', {}, ownTab, onlineTab),
      own,
      online,
      trouble,
      backMore,
      back,
    ),
  );
  const modal = openModal(el);
  show('own');
  close = () => modal.close();
  setTimeout(() => filter.focus(), 30);
}

/** One thing the room's own catalog holds: what it is, what it is like, and a click to put one down. */
function ownRow(kind: CatalogKind, entry: CatalogEntry, opts: CatalogOptions, close: () => void, trouble: HTMLElement): HTMLElement {
  const li = h('li', { tabindex: 0, role: 'button', title: `Put a ${entry.label} in the room` }, h('div.svc-main', {}, h('div.svc-title', {}, entry.label), h('div.svc-meta', {}, entry.blurb)));
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
  const results = h('div.cat-results', {}, h('p.setting-note', {}, `Search ${info.name} for what you are after — a chair, a lamp, a rock — or search with the box empty to see what they hold.`));
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
