import './elevator.css';
import type { CloneProgress, FloorInfo, ServerMsg } from '../../shared/protocol';
import { cloneLabel, floorPalette } from '../../shared/floors';
import { ROOF, ROOF_NAME } from '../../shared/rooftop';
import type { Net } from '../net';
import { store } from '../state';
import { h, openModal, toast, type Modal } from './dom';
import { confirmDialog } from './prompt';

// The elevator's panel: a button for every floor (every project), and "add a project", which makes a
// folder that is already on the office's machine a floor. Nothing is cloned, and nothing inside the
// folder is written: the office works in it where it is, and takes the floor off again without
// touching it. The first time the office runs there are no floors, and this is where you start.
// Admins can take a floor off the building here too. Under the floors, it goes down to the garage.

/**
 * The garage under the building, where the elevator goes too. It isn't a floor: it's down under the
 * one you're on (from the roof, the bottom one), level with the street.
 */
export const GARAGE = '@garage';

export interface ElevatorOptions {
  net: Net;
  /** Rides to a floor, the roof (ROOF) or the garage (GARAGE). */
  ride(floorId: string): void;
  /** You're down in the garage (or out on the street), under the floor you're on. */
  downstairs(): boolean;
}

/** How many folders the list shows at once; type a path to go somewhere else. */
const SHOWN = 300;

/** The folder the picker was last in: the next project is picked from where the last one was. */
const LAST_FOLDER_KEY = 'agent-office.elevator-folder';

/** Panels waiting on a floor being added; each says whether the answer was for it. */
const addedWaiters = new Set<(msg: Extract<ServerMsg, { t: 'floor.added' }>) => boolean>();

/** Main feeds server messages through here, so a panel waiting on its floor hears back. */
export function routeElevatorMessage(msg: ServerMsg) {
  if (msg.t !== 'floor.added') return;
  let heard = false;
  for (const fn of addedWaiters) heard = fn(msg) || heard;
  // The panel was closed while it worked: a floor that couldn't be made still says why.
  if (!heard && msg.error) toast(`🛗 ${msg.error}`, 'warn');
}

/** How far through its step a floor's clone is, as a bar (none until git gives a percentage). */
function cloneBar(p: CloneProgress | undefined): HTMLElement | null {
  if (p?.percent === undefined) return null;
  return h('span.clone-bar', { role: 'progressbar', 'aria-label': p.step, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p.percent) }, h('span', { style: `width:${p.percent}%` }));
}

/** A path as ~/… when it's the office's home folder or under it, the way a person writes it. */
function shortPath(p: string, home: string): string {
  if (!home) return p;
  if (p === home) return '~';
  return p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p;
}

/** A path's last part: what the folder is called. */
function folderName(p: string): string {
  const trimmed = p.replace(/\/+$/, '');
  const at = trimmed.lastIndexOf('/');
  return at >= 0 ? trimmed.slice(at + 1) : trimmed;
}

/** The folder the picker was last in, if this browser remembers one. */
function lastFolder(): string | undefined {
  try {
    return localStorage.getItem(LAST_FOLDER_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

let current: Modal | null = null;

export function elevatorPanelOpen(): boolean {
  return !!current;
}

export function openElevator(opts: ElevatorOptions): void {
  if (current) return;
  // Nowhere to go yet: the panel greets you. It closes like any other; the elevator (or the floor
  // name in the corner) opens it again.
  const setup = !store.floor;
  const { net } = opts;
  let adding = false;
  let error = '';
  let showAdd = setup || !store.floors.length;
  /** The search box and list are in place (rebuilding them would lose the focus mid-typing). */
  let built = false;

  const floorsEl = h('div.floors');
  const addEl = h('div.add');
  const input = h('input', { type: 'text', placeholder: '~/raspnas/development/projects/…', 'aria-label': 'Folder', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const listEl = h('div.folder-list', { role: 'listbox', 'aria-label': 'Folders' });
  const statusEl = h('div');
  const addBtn = h('button.btn.primary', { type: 'button' }, '🛗 Add floor');
  const refreshBtn = h('button.btn', { type: 'button', title: 'Look in this folder again' }, '↻');
  const close = h('button.btn.close', { type: 'button', 'aria-label': 'Close', title: 'Close (Esc)' }, '✕');

  /** Look at a folder (the home folder when none is named), and remember it for next time. */
  const look = (path?: string) => {
    store.folders = { ...store.folders, loading: true, error: undefined };
    net.send({ t: 'floor.folders', ...(path ? { path } : {}) });
  };

  const folderRow = (name: string) => {
    const full = `${store.folders.path.replace(/\/+$/, '')}/${name}`;
    const floor = store.floors.find((f) => f.dir === full);
    const row = h(
      'div.folder',
      { role: 'option', title: floor ? `${full} — floor ${floor.name}: click to ride there` : `${full} — click to look inside, double-click to make it a floor` },
      h('span.nm', {}, name),
      floor ? h('span.pill', {}, floor.id === store.floor ? 'you are here' : `floor ${store.floors.indexOf(floor) + 1}`) : null,
    );
    row.addEventListener('click', () => {
      if (adding) return;
      if (floor) {
        if (floor.id !== store.floor && !floor.cloning) {
          modal.close();
          opts.ride(floor.id);
        }
        return;
      }
      look(full);
    });
    row.addEventListener('dblclick', () => {
      if (!floor && !adding) add(full);
    });
    return row;
  };

  const upRow = (parent: string) => {
    const row = h('div.folder.up', { role: 'option', title: `Go up to ${shortPath(parent, store.folders.home)}` }, h('span.nm', {}, '⬆ ..'));
    row.addEventListener('click', () => {
      if (!adding) look(parent);
    });
    return row;
  };

  const renderFloors = () => {
    const floors = store.floors;
    const built = floors.some((f) => !f.cloning);
    // Top floor first, the way an elevator's buttons stack, with the roof over them, floor 1 and then the garage at the bottom.
    floorsEl.replaceChildren(
      ...(built ? [roofButton()] : []),
      ...(floors.length ? floors.map(floorRow).reverse() : [h('p.empty', {}, 'No floors yet.')]),
      ...(built ? [garageButton()] : []),
    );
  };

  const renderAdd = () => {
    if (!showAdd) {
      const open = h('button.btn', { type: 'button' }, '➕ Add a project');
      open.addEventListener('click', () => {
        showAdd = true;
        look(lastFolder());
        renderAdd();
        setTimeout(() => input.focus(), 0);
      });
      addEl.replaceChildren(open);
      addBtn.classList.add('hidden');
      return;
    }
    addBtn.classList.remove('hidden');
    const f = store.folders;
    const floor = store.floors.find((x) => x.dir === f.path);
    if (f.path && !f.error) {
      try {
        localStorage.setItem(LAST_FOLDER_KEY, f.path);
      } catch {
        // private mode: the picker just starts at home next time
      }
    }
    const rows: HTMLElement[] = [];
    if (f.parent) rows.push(upRow(f.parent));
    rows.push(...f.dirs.slice(0, SHOWN).map(folderRow));
    if (!rows.length) rows.push(h('p.empty', { style: 'padding:10px' }, f.loading ? 'Looking…' : f.error ? '' : 'Nothing inside. Type a path above, or press ⬆.'));
    listEl.replaceChildren(...rows);
    statusEl.replaceChildren(
      h('p.note', {}, 'A floor is a folder of this machine. The office works in it as it is, and taking the floor off the building leaves the folder alone.'),
      ...[f.error, error].filter((e): e is string => !!e).map((e) => h('p.err', {}, e)),
    );
    addBtn.disabled = adding || !f.path || !!f.error || !!floor;
    addBtn.textContent = adding ? '⏳ Adding…' : floor ? `${floor.name} is already a floor` : f.path ? `🛗 Add ${folderName(f.path)}` : '🛗 Add floor';
    input.disabled = adding;
    // You type the path yourself when you're in the box; the picker writes it otherwise.
    if (document.activeElement !== input) input.value = f.path ? shortPath(f.path, f.home) : '';
    if (!built) {
      built = true;
      addEl.replaceChildren(
        h('h3', {}, setup && !store.floors.length ? 'Pick your first project' : '➕ Add a project'),
        h('div.folder-search', {}, input, refreshBtn),
        listEl,
        statusEl,
      );
    }
  };

  const add = (dir: string) => {
    if (adding) return;
    adding = true;
    error = '';
    renderAdd();
    net.send({ t: 'floor.addFolder', path: dir });
  };

  const onAdded = (msg: Extract<ServerMsg, { t: 'floor.added' }>) => {
    if (!adding) return false;
    adding = false;
    if (msg.error) {
      error = msg.error;
      renderAdd();
      return true;
    }
    if (msg.floor) {
      modal.close();
      opts.ride(msg.floor);
      return true;
    }
    renderAdd();
    return true;
  };
  addedWaiters.add(onAdded);

  input.addEventListener('input', () => {
    error = '';
    renderAdd();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    // Enter looks in the folder you typed; the button makes the one you're looking at a floor.
    look(input.value.trim() || undefined);
  });
  addBtn.addEventListener('click', () => {
    if (store.folders.path) add(store.folders.path);
  });
  refreshBtn.addEventListener('click', () => look(store.folders.path || undefined));

  /** The floor's button, with a 🗑 beside it for admins to take it off the building (⏹ to stop it while it's cloned). */
  const floorRow = (f: FloorInfo, i: number) => {
    const btn = floorButton(f, i);
    if (f.cloning) {
      if (!store.me.admin) return btn;
      const stop = h('button.btn.floor-off', { type: 'button', title: `Stop cloning ${f.repo ?? f.name}`, 'aria-label': `Stop cloning ${f.name}` }, '⏹️');
      stop.addEventListener('click', () => confirmDialog(`Stop cloning ${f.repo ?? f.name}?`, "What's come down so far is thrown away. You can add it again any time.", '⏹️ Stop cloning', () => net.send({ t: 'floor.cancel', floor: f.id })));
      return h('div.floor-row', {}, btn, stop);
    }
    if (!store.me.admin) return btn;
    const off = h('button.btn.floor-off', { type: 'button', title: `Take ${f.name} off the building`, 'aria-label': `Remove ${f.name}` }, '🗑');
    off.addEventListener('click', () => confirmRemove(f));
    return h('div.floor-row', {}, btn, off);
  };

  const confirmRemove = (f: FloorInfo) => {
    const next = store.floors.find((o) => o.id !== f.id && !o.cloning);
    const workers = f.workers ? `Its ${f.workers} worker${f.workers === 1 ? '' : 's'} stop${f.workers === 1 ? 's' : ''}. ` : '';
    const people = f.people ? `Everyone on it rides the elevator to ${next ? next.name : 'the lobby'}. ` : '';
    // The office was started in it: its accounts, password and chat live in that .agent-office too, and stay.
    const own = f.local ? ' The office keeps its own settings there too, so it carries on as before, just without this floor.' : '';
    confirmDialog(`Take ${f.name} off the building?`, `${workers}${people}Nothing is deleted: the folder ${f.dir} stays exactly as it is.${own}`, '🗑 Remove floor', () => net.send({ t: 'floor.remove', floor: f.id }));
  };

  /** The roof, over every floor: the rooftop bar. */
  const roofButton = () => {
    const here = store.floor === ROOF;
    const people = [...store.peers.values()].filter((p) => p.floor === ROOF).length;
    const btn = h(
      'button.floor-btn',
      { type: 'button', class: here ? 'here' : '', disabled: here, title: here ? "You're up on the roof" : `Ride up to the ${ROOF_NAME.toLowerCase()}` },
      h('span.floor-no', { style: 'background:#2b2d42' }, '🍸'),
      h('span.floor-text', {}, h('span.floor-name', {}, ROOF_NAME, here ? h('span.here-tag', {}, 'you are here') : null), h('span.floor-sub', {}, 'The roof: a DJ playing drum and bass, a bar, and the city all around')),
      h('span.floor-stats', {}, people ? h('span', { title: 'People up there' }, `🧑 ${people}`) : ''),
    );
    btn.addEventListener('click', () => {
      if (here) return;
      modal.close();
      opts.ride(ROOF);
    });
    return btn;
  };

  const floorButton = (f: FloorInfo, i: number) => {
    // Down in the garage, your floor is somewhere to go back up to.
    const mine = f.id === store.floor;
    const here = mine && !opts.downstairs();
    const p = floorPalette(f.palette);
    const stats: (HTMLElement | string)[] = [];
    if (f.cloning) stats.push(h('span', { title: f.clone?.detail ?? 'Being cloned' }, cloneLabel(f.clone)));
    else {
      if (f.busy) stats.push(h('span', { title: 'Working' }, `👷 ${f.busy}`));
      if (f.waiting) stats.push(h('span.waiting', { title: 'Waiting on someone' }, `🙋 ${f.waiting}`));
      stats.push(h('span', { title: 'Workers at desks' }, `💻 ${f.workers}`));
      if (f.people) stats.push(h('span', { title: 'People on this floor' }, `🧑 ${f.people}`));
    }
    const btn = h(
      'button.floor-btn',
      { type: 'button', class: here ? 'here' : '', disabled: f.cloning || here, title: here ? "You're on this floor" : f.cloning ? 'Still being cloned' : `Ride ${mine ? 'back up ' : ''}to ${f.name}` },
      h('span.floor-no', { style: `background:${p.trim}` }, String(i + 1)),
      h(
        'span.floor-text',
        {},
        h('span.floor-name', {}, f.name, here ? h('span.here-tag', {}, 'you are here') : mine ? h('span.here-tag', {}, 'your floor') : null),
        h('span.floor-sub', {}, [f.repo ?? f.dir, f.cloning ? f.clone?.detail : ''].filter(Boolean).join(' · ')),
        f.cloning ? cloneBar(f.clone) : null,
      ),
      h('span.floor-stats', {}, ...stats.flatMap((s, j) => (j ? [' ', s] : [s]))),
    );
    btn.addEventListener('click', () => {
      if (here || f.cloning) return;
      modal.close();
      opts.ride(f.id);
    });
    return btn;
  };

  /** Under floor 1: the garage, level with the street. */
  const garageButton = () => {
    const here = opts.downstairs();
    const bottom = store.floors.find((f) => !f.cloning);
    const under = store.floor === ROOF ? `Under ${bottom?.name ?? 'the building'}, level with the street` : 'Under the building, level with the street: the cars, and the way out';
    const btn = h(
      'button.floor-btn',
      { type: 'button', class: here ? 'here' : '', disabled: here, title: here ? "You're down at the street" : 'Ride down to the garage' },
      h('span.floor-no', { style: 'background:#2b2d42' }, '🏎️'),
      h('span.floor-text', {}, h('span.floor-name', {}, 'Garage', here ? h('span.here-tag', {}, 'you are here') : null), h('span.floor-sub', {}, under)),
      h('span.floor-stats', {}),
    );
    btn.addEventListener('click', () => {
      if (here) return;
      modal.close();
      opts.ride(GARAGE);
    });
    return btn;
  };

  const intro = setup
    ? h(
        'p.intro',
        {},
        store.floors.length
          ? 'Every project is a floor of this building. Pick a floor to ride to, or add another project.'
          : 'Every project is a floor of this building, and it has none yet. Type the folder you keep it in, or pick one below: the office works in it as it is.',
      )
    : null;
  const el = h(
    'div.modal.elevator',
    { role: 'dialog', 'aria-label': 'Elevator' },
    h('header', {}, h('h2', {}, setup ? '🏢 Welcome to Agent Office' : '🛗 Elevator'), close),
    h('div.body', {}, intro, floorsEl, addEl),
    h('footer', {}, h('span.grow', {}, setup ? 'Your office, one floor per project · Esc to look around first' : 'Pick a floor · Esc to stay here'), addBtn),
  );
  const unsubs = [store.on('floors', () => (renderFloors(), renderAdd())), store.on('folders', renderAdd), store.on('floor', renderFloors), store.on('peers', renderFloors), store.on('me', () => (renderFloors(), renderAdd()))];
  const modal = openModal(el, {
    doing: '🛗 at the elevator',
    // A stray click shouldn't lose the first-run panel; ✕ and Esc still close it.
    backdropCloses: !setup,
    onClose: () => {
      current = null;
      addedWaiters.delete(onAdded);
      for (const off of unsubs) off();
    },
  });
  current = modal;
  close.addEventListener('click', () => modal.close());
  renderFloors();
  if (showAdd) look(lastFolder());
  renderAdd();
  if (showAdd) setTimeout(() => input.focus(), 30);
}
