// Where the office's furniture stands, and whether it stands at all: layout.ts has the base every piece
// is built at, and this has what the editor saved over it (see features/layout-editor). The office is
// built through here, so a moved jukebox puts its colliders and its use-point at the new spot, and a
// deleted one isn't in the room at all. Nothing here touches the DOM or the scene: it's the file and
// the arithmetic, and the tests in tests/placement.test.ts pin it.
//
// A piece the editor *added* (see shared/catalog and spawn below) is the one kind of entry with no base
// in layout.ts to fall back on: the entry is the whole of it, which is why it carries a kind and its
// own height, and why change() below never lets one leave the file.

import { isCatalogKind, catalogEntry, type CatalogKind } from './catalog.js';
import { BEANBAGS, DESKS, SEATING, STATIONS } from './layout.js';
import type { DeskDef } from './layout.js';

/** What the editor saves for one piece: what differs from the base in layout.ts — or, for a piece it
 *  added, everything that says what the piece is. */
export interface Placement {
  x?: number;
  z?: number;
  /** Its facing, in radians, as the builder would have set it. */
  rotY?: number;
  /**
   * How high it stands, where the floor it stands on needs saying: an addition up on the loft has the
   * same x and z as the meeting room underneath it. Only additions carry it (every other piece is
   * built at its own height by its builder).
   */
  y?: number;
  /**
   * What the editor added here, off the catalog (see shared/catalog): the piece is built from this,
   * not from layout.ts, so this entry is the piece's whole self rather than a change to a base.
   */
  kind?: CatalogKind;
  /** Taken out of the room: built by nobody, and remembered as gone. */
  deleted?: boolean;
}

/** The saved file for one floor: a piece with no entry stands where layout.ts puts it. */
export type Placements = Record<string, Placement>;

/** Where a piece goes, as its builder asks for it: the base, and what the file says over it. */
export interface Placed {
  x: number;
  z: number;
  rotY: number;
  /** Gone: the builder leaves it out of the room entirely. */
  hidden: boolean;
}

/** What a builder passes: the base from layout.ts, and the facing that piece stands at. */
export interface Base {
  x: number;
  z: number;
  rotY?: number;
}

/** What each piece is called on the panel. A piece without an entry goes by its id. */
export const PLACEABLE_LABELS: Record<string, string> = {
  jukebox: '🎵 Jukebox',
  bookshelf: '📚 Bookshelf',
  whiteboard: '📝 Whiteboard',
  'figures-1': '🖼️ Figures (west)',
  'figures-2': '🖼️ Figures (middle)',
  'figures-3': '🖼️ Figures (east)',
  'board-issues': '📋 Checklist board',
  'board-queue': '🕓 Timeline board',
  'board-pulls': '🎯 Phase board',
  'board-services': '🪙 Token board',
  gong: '🎉 Merge gong',
  cabinet: '🕹️ Arcade cabinet',
  tv: '📺 Lounge TV',
  'machine-monitor': '🖥️ Machine monitor',
  kitchen: '☕ Kitchen counter',
  'lounge-table': '🛋️ Coffee table',
  'lounge-rug': '🟪 Lounge rug',
  couch: '🛋️ Couch',
  'meeting-table': '🪵 Meeting table',
  'loft-couch': '🛋️ Loft couch',
  'loft-rug': '🧶 Loft rug',
  ashtray: '🚬 Ashtray',
  'smoke-sign': '🚬 Smoke break sign',
  'boss-desk': "🪑 The boss's desk",
  'boss-telescope': '🔭 Telescope',
  'meeting-board': "📋 The meeting's board",
  'meeting-sign': '🚪 Meeting room panel',
  'station-coordinator': "🧑‍💼 The coordinator's desk",
};

/** What an id is called: a piece the editor added goes by what it is, a plant by its number (`plant-3`
 *  reading "Plant 3"). */
export function labelFor(id: string): string {
  const added = saved[id]?.kind;
  if (added && isCatalogKind(added)) return catalogEntry(added).label;
  const named = PLACEABLE_LABELS[id];
  if (named) return named;
  const plant = /^plant-(\d+)$/.exec(id);
  if (plant) return `🌿 Plant ${plant[1]}`;
  const rug = /^rug-(\d+)$/.exec(id);
  if (rug) return `🧶 Rug ${rug[1]}`;
  const cushion = /^(?:lounge-)?beanbag-(\d+)$/.exec(id);
  if (cushion) return `🪀 Cushion ${cushion[1]}`;
  const desk = /^desk-(\d+)$/.exec(id);
  return desk ? `🪑 Desk ${desk[1]}` : id;
}

let saved: Placements = {};

/** A seat the editor can move along with its furniture: the office hires by these, so they move as one. */
type MovableSeat = Pick<DeskDef, 'id' | 'x' | 'z' | 'rotY'>;

/** The couches, the lounge's and the loft's: seats whose furniture is one piece, moved together. */
const COUCHES: readonly MovableSeat[] = SEATING.filter((s) => s.id === 'couch' || s.id === 'loft-couch');

/**
 * The seats whose furniture the editor can move: a desk moved in the room is the *seat* moved too, or
 * the office would hire into where the desk used to be and walk through where it is now. Same for a
 * beanbag, a pouf, a couch. Their places are what the room was built with, kept here so a move can be
 * undone all the way.
 */
const MOVABLE_SEATS: readonly MovableSeat[] = [...DESKS, ...STATIONS, ...BEANBAGS, ...COUCHES];
const SEAT_BASE = new Map(MOVABLE_SEATS.map((s) => [s.id, { x: s.x, z: s.z, rotY: s.rotY }]));

/** Puts the seats where the file says, and the rest back where layout.ts has them. */
function applyToSeats(): void {
  for (const seat of MOVABLE_SEATS) {
    const base = SEAT_BASE.get(seat.id)!;
    const p = saved[seat.id];
    seat.x = num(p?.x) ?? base.x;
    seat.z = num(p?.z) ?? base.z;
    seat.rotY = num(p?.rotY) ?? base.rotY;
  }
}

/** The floor's saved file, before the room is built: what the editor wrote, or nothing at all. */
export function setPlacements(file: Placements | null | undefined): void {
  saved = file ?? {};
  applyToSeats();
}

/** The saved file as it stands, for the panel to show and to change. */
export function placements(): Placements {
  return saved;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Where a piece goes: its base, with `saved`'s numbers over it. An id nobody saved keeps the base. */
export function place(id: string, base: Base): Placed {
  const p = saved[id];
  return {
    x: num(p?.x) ?? base.x,
    z: num(p?.z) ?? base.z,
    rotY: num(p?.rotY) ?? base.rotY ?? 0,
    hidden: p?.deleted === true,
  };
}

/**
 * Where a piece the editor added goes (see shared/catalog and `spawn` below): its own entry, or out of
 * the room — a piece of layout.ts can always fall back on its base, while an added one stands only
 * where the file says, so a floor whose file hasn't got it never had it.
 */
export function placeAdded(id: string, base: Base): Placed {
  if (!saved[id]?.kind) return { x: base.x, z: base.z, rotY: base.rotY ?? 0, hidden: true };
  return place(id, base);
}

/** One thing in the room the file itself put there (see shared/catalog): where it stands, and what it is. */
export interface SpawnedPiece {
  id: string;
  kind: CatalogKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Taken away again: the room builds nothing, and the file keeps the note that it was. */
  deleted: boolean;
}

/** Every piece the file itself adds, in the order the ids were written: what the room builds on its way
 *  in (see features/layout-editor), read as carefully as the rest of the file. */
export function spawned(): SpawnedPiece[] {
  const out: SpawnedPiece[] = [];
  for (const [id, p] of Object.entries(saved)) {
    const kind = p.kind;
    const x = num(p.x);
    const z = num(p.z);
    if (!kind || !isCatalogKind(kind) || x === undefined || z === undefined) continue;
    out.push({ id, kind, x, y: num(p.y) ?? 0, z, rotY: num(p.rotY) ?? 0, deleted: p.deleted === true });
  }
  return out;
}

/** The names the editor gives what it adds, as `add-1`, `add-2`… */
const SPAWN_ID = /^add-(\d+)$/;

/** A name for the next piece the editor adds, counting the ones this floor's file already names, so
 *  two additions never take the same id. */
export function nextSpawnId(): string {
  let top = 0;
  for (const id of Object.keys(saved)) {
    const n = SPAWN_ID.exec(id);
    if (n) top = Math.max(top, Number(n[1]));
  }
  return `add-${top + 1}`;
}

/** Writes down a piece the editor added: what the panel does when you pick something off the catalog.
 *  Its place is its own — there is no base in layout.ts for it to differ from. */
export function spawn(id: string, kind: CatalogKind, at: { x: number; y: number; z: number; rotY: number }): Placements {
  const one: Placement = { kind, x: round(at.x), z: round(at.z), rotY: round(at.rotY) };
  // Only where the floor it stands on needs saying: on the ground floor it is nothing.
  if (Math.abs(at.y) > 0.005) one.y = round(at.y);
  saved = { ...saved, [id]: one };
  return saved;
}

/** What to save for a piece the editor moved: the fields that differ from its base, and nothing else.
 *  A piece back on its base (and not deleted) leaves the file — but not one the editor added, whose
 *  entry says what it is and where it stands and so never leaves it. */
export function change(id: string, base: Base, at: Placed): Placements {
  const was = saved[id];
  const added = was?.kind;
  const p: Placement = {};
  if (added) {
    p.kind = added;
    if (num(was?.y) !== undefined) p.y = was!.y;
  }
  if (added || Math.abs(at.x - base.x) > 0.005) p.x = round(at.x);
  if (added || Math.abs(at.z - base.z) > 0.005) p.z = round(at.z);
  if (added || Math.abs(at.rotY - (base.rotY ?? 0)) > 0.005) p.rotY = round(at.rotY);
  if (at.hidden) p.deleted = true;
  const next = { ...saved };
  if (Object.keys(p).length) next[id] = p;
  else delete next[id];
  saved = next;
  applyToSeats();
  return next;
}

/** A quarter of a centimeter is a fine enough place for anything in this room. */
function round(n: number): number {
  return Math.round(n * 400) / 400;
}

/**
 * Reads a saved file off the disk or off the wire: anything that isn't a number where a number goes is
 * dropped rather than trusted, so a file written by hand can't put a jukebox in the sky. An addition is
 * read whole or not at all: a kind nobody can build, or one with no place to stand, is no piece.
 */
export function sanitize(file: unknown): Placements {
  if (!file || typeof file !== 'object') return {};
  const out: Placements = {};
  for (const [id, raw] of Object.entries(file as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || id.length > 60) continue;
    const p = raw as Record<string, unknown>;
    const x = num(p.x);
    const z = num(p.z);
    const rotY = num(p.rotY);
    if (p.kind !== undefined) {
      if (!isCatalogKind(p.kind) || x === undefined || z === undefined) continue;
      if (Math.abs(x) >= 1000 || Math.abs(z) >= 1000) continue;
      const added: Placement = { kind: p.kind, x, z, rotY: rotY !== undefined && Math.abs(rotY) < 100 ? rotY : 0 };
      const y = num(p.y);
      if (y !== undefined && Math.abs(y) < 100) added.y = y;
      if (p.deleted === true) added.deleted = true;
      out[id] = added;
      continue;
    }
    const one: Placement = {};
    if (x !== undefined && Math.abs(x) < 1000) one.x = x;
    if (z !== undefined && Math.abs(z) < 1000) one.z = z;
    if (rotY !== undefined && Math.abs(rotY) < 100) one.rotY = rotY;
    if (p.deleted === true) one.deleted = true;
    if (Object.keys(one).length) out[id] = one;
  }
  return out;
}
