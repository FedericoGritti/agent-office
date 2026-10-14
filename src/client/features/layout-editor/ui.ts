// The catalog: everything the editor can put in the room, a line each (see shared/catalog for the list
// and world/office/catalog.ts for what each one is). Picking one puts it in the room in front of you and
// closes the window, so it can be carried and put down straight away — Canc takes it away again.

import './ui.css';
import { CATALOG, CATALOG_KINDS, type CatalogKind } from '../../../shared/catalog';
import { h, openModal } from '../../ui/dom';

/** What picking a thing off the catalog does (see features/layout-editor/index.ts). */
export interface CatalogOptions {
  add(kind: CatalogKind): void;
}

export function openCatalog(opts: CatalogOptions): void {
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
      const pick = () => {
        modal.close();
        opts.add(kind);
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
    ),
  );
  const modal = openModal(el);
  setTimeout(() => (list.querySelector('li[tabindex="0"]') as HTMLElement | null)?.focus(), 30);
}
