import type { Net } from '../../net';
import { store } from '../../state';
import { h, openModal, type Modal } from '../../ui/dom';

/** A path as ~/… when it is the office machine's home folder or under it. */
function shortPath(path: string, home: string): string {
  if (!home) return path;
  if (path === home) return '~';
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/** Opens a server-folder browser and assigns its current folder to this floor's Figures boards. */
export function openFiguresFolder(net: Net, current: string): void {
  const input = h('input', { type: 'text', placeholder: '~/raspnas/…', 'aria-label': 'Folder', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const list = h('div.folder-list', { role: 'listbox', 'aria-label': 'Folders' });
  const status = h('div');
  const refresh = h('button.btn', { type: 'button', title: 'Look in this folder again' }, '↻');
  const choose = h('button.btn.primary', { type: 'button' }, 'Use this folder');
  const box = h(
    'div.modal.elevator',
    {},
    h('header', {}, h('h2', {}, '🖼️ Figures folder')),
    h('p.note', {}, 'The boards show pictures under this folder, including its subfolders.'),
    h('div.folder-search', {}, input, refresh),
    list,
    status,
    h('footer.actions', {}, choose),
  );
  let modal: Modal;

  /** Asks the office machine for one folder's children. */
  const look = (path?: string) => {
    store.folders = { ...store.folders, loading: true, error: undefined };
    net.send({ t: 'floor.folders', ...(path ? { path } : {}) });
    render();
  };

  const folderRow = (name: string) => {
    const base = store.folders.path.replace(/\/+$/, '');
    const full = `${base}/${name}`;
    const row = h('div.folder', { role: 'option', title: `Look inside ${full}` }, h('span.nm', {}, name));
    row.addEventListener('click', () => look(full));
    return row;
  };

  const render = () => {
    const folder = store.folders;
    const rows: HTMLElement[] = [];
    if (folder.parent) {
      const up = h('div.folder.up', { role: 'option', title: `Go up to ${shortPath(folder.parent, folder.home)}` }, h('span.nm', {}, '⬆ ..'));
      up.addEventListener('click', () => look(folder.parent));
      rows.push(up);
    }
    rows.push(...folder.dirs.map(folderRow));
    if (!rows.length) rows.push(h('p.empty', { style: 'padding:10px' }, folder.loading ? 'Looking…' : folder.error ? '' : 'No subfolders here. You can still use this folder.'));
    list.replaceChildren(...rows);
    const messages = [h('p.note', {}, folder.path ? `Selected: ${shortPath(folder.path, folder.home)}` : '')];
    if (folder.error) messages.push(h('p.err', {}, folder.error));
    status.replaceChildren(...messages);
    choose.disabled = folder.loading || !folder.path || !!folder.error;
    choose.textContent = folder.path ? `Use ${shortPath(folder.path, folder.home)}` : 'Use this folder';
    if (document.activeElement !== input) input.value = folder.path ? shortPath(folder.path, folder.home) : '';
  };

  const stop = store.on('folders', render);
  modal = openModal(box, { doing: 'choosing the Figures folder', onClose: () => stop() });
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    look(input.value.trim() || undefined);
  });
  refresh.addEventListener('click', () => look(store.folders.path || undefined));
  choose.addEventListener('click', () => {
    const path = store.folders.path;
    if (!path || store.folders.loading || store.folders.error) return;
    net.send({ t: 'images.folder', path });
    modal.close();
  });
  look(current || undefined);
  setTimeout(() => input.focus(), 0);
}
