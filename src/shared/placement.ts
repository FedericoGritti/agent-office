// Where the office's furniture stands, and whether it stands at all: layout.ts has the base every piece
// is built at, and this has what the editor saved over it (see features/layout-editor). The office is
// built through here, so a moved jukebox puts its colliders and its use-point at the new spot, and a
// deleted one isn't in the room at all. Nothing here touches the DOM or the scene: it's the file and
// the arithmetic, and the tests in tests/placement.test.ts pin it.
//
// A piece the editor *added* (see shared/catalog and spawn below) is the one kind of entry with no base
// in layout.ts to fall back on: the entry is the whole of it, which is why it carries a kind and its
// own height, and why change() below never lets one leave the file.

import { isAdditionKind, kindLabel, type AdditionKind } from './model-sources.js';
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
   * How high it stands: how far the editor has lifted it from where its builder built it, or — for a
   * thing the catalog added, which has no base in layout.ts — its own height, the room's floor being 0.
   * Nothing here falls, so a piece held up in the air stays up.
   */
  y?: number;
  /**
   * What the editor added here: a kind of the office's own, or the source and id of a model fetched
   * from an online catalog (see shared/catalog and shared/model-sources). The piece is built from this, not
   * from layout.ts, so this entry is the piece's whole self rather than a change to a base.
   */
  kind?: AdditionKind;
  /**
   * How big the piece is, as a multiple of the size it was built at — 1, or nothing at all, when it's as
   * it came. Any piece may carry one except a seat's own furniture: a desk a worker sits at is a place
   * the office hires into and walks around, so it stays the size layout.ts built it (see hasSeat).
   */
  scale?: number;
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
  /** How big it is: nothing said means 1 (see scaleOf). Only an addition is ever anything else. */
  scale?: number;
  /**
   * How high it is, for a piece the editor may lift (see hasSeat): nothing said means it stands where
   * its builder built it, which is what a piece of the room's own that nobody has touched says.
   */
  y?: number;
  /** Gone: the builder leaves it out of the room entirely. */
  hidden: boolean;
}

/** What a builder passes: the base from layout.ts, and the facing that piece stands at. `y` is the
 *  floor a piece is built on, for the builders that take one (every addition does: see Spot). */
export interface Base {
  x: number;
  z: number;
  rotY?: number;
  y?: number;
}

/** The smallest and largest a piece may be made: a hundredth of what it came as is a speck, and a
 *  hundred times it is a monument — four decades of room to build in, bounded so a piece is still a
 *  piece (and so the walk map round it still means something). */
export const SCALE_MIN = 0.01;
export const SCALE_MAX = 100;

/**
 * The sizes a piece may be made, as multiples of the size it was built at: the rungs of one ladder for
 * the whole room, so two pieces at 150% are the same size and one at 300% is exactly twice the one at
 * 150%. Halves and quarters, and the decade again at every power of ten (…, 0.5, 0.75, 1, 1.25, 1.5, 2,
 * 2.5, 3, 4, 5, 7.5, 10, 12.5, …, 75, 100).
 *
 * Multiplicative steps — a tenth of whatever a piece happens to be — are what this replaced: they leave
 * every piece at a size of its own (1.21, 1.331, …), and then no two of them can be compared at all.
 */
const DECADES = [0.01, 0.1, 1, 10];
const RUNGS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5];
/** A rung, at the precision a hundredth of a percent needs: 0.1 × 1.5 is 0.15000000000000002. */
const rung = (n: number) => Math.round(n * 10000) / 10000;
// The largest size a piece may be is a rung of it too, so a size written by hand at the limit lands on
// the limit rather than on the rung below it.
export const SCALE_STEPS: readonly number[] = [...new Set([...DECADES, SCALE_MAX, ...DECADES.flatMap((d) => RUNGS.map((r) => rung(d * r)))])]
  .filter((s) => s >= SCALE_MIN && s <= SCALE_MAX)
  .sort((a, b) => a - b);

/** A size brought inside the limits: the only thing written to a file, or applied to a piece. One that
 *  isn't a number at all is the size it came — never a NaN in a transform, which would take the whole
 *  piece's matrix with it. */
export function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, n));
}

/** How big a piece is as it stands: what its placement says, or 1 when it says nothing. */
export function scaleOf(at: { scale?: number }): number {
  return clampScale(at.scale ?? 1);
}

/** A hair, so a rung that is a float's near miss still counts as the rung. */
const EPS = 1e-9;

/** One turn of the wheel: the next size up (`dir` > 0) or down, out of the room's one ladder. */
export function resizeBy(scale: number, dir: number): number {
  const at = scaleOf({ scale });
  if (dir > 0) {
    for (const step of SCALE_STEPS) if (step > at + EPS) return step;
    return SCALE_MAX;
  }
  let below = SCALE_MIN;
  for (const step of SCALE_STEPS) if (step < at - EPS) below = step;
  return below;
}

/** How far one press moves a piece up or down, in metres: a step, on the room's own grid. */
export const LIFT_STEP = 0.25;

/** The height one press up (`dir` > 0) or down from `y` leaves a piece at, never under the floor or past
 *  the ceiling it is given. A height that isn't a number at all is the floor, like a size that isn't a
 *  number is the size it came. */
export function liftBy(y: number, dir: number, ceiling: number): number {
  const next = (Number.isFinite(y) ? y : 0) + (dir > 0 ? LIFT_STEP : -LIFT_STEP);
  return Math.min(Math.max(0, ceiling), Math.max(0, next));
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

/** What an id is called: a piece the editor added goes by what it is (see kindLabel), a plant by its
 *  number (`plant-3` reading "Plant 3"). */
export function labelFor(id: string): string {
  const added = saved[id]?.kind;
  if (added) return kindLabel(added);
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

/**
 * Whether a piece is a seat's furniture: a desk a worker sits at, a station, a cushion, a couch. Moving
 * one writes the seat as well as the piece (see applyToSeats), because the office hires into that place
 * and walks around it — so a seat is the one thing the editor won't lift or resize: a desk half its size
 * would be a seat nobody could sit at, and one up in the air a place nobody could reach.
 */
export function hasSeat(id: string): boolean {
  return SEAT_BASE.has(id);
}

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
  const y = num(p?.y);
  return {
    x: num(p?.x) ?? base.x,
    z: num(p?.z) ?? base.z,
    rotY: num(p?.rotY) ?? base.rotY ?? 0,
    scale: scaleOf({ scale: num(p?.scale) }),
    // How high the editor left it: nothing said means it stands where its builder built it (see Placed.y).
    ...(y !== undefined ? { y } : {}),
    hidden: p?.deleted === true,
  };
}

/**
 * Where a piece the editor added goes (see shared/catalog and `spawn` below): its own entry, or out of
 * the room — a piece of layout.ts can always fall back on its base, while an added one stands only
 * where the file says, so a floor whose file hasn't got it never had it.
 */
export function placeAdded(id: string, base: Base): Placed {
  if (!saved[id]?.kind) return { x: base.x, z: base.z, rotY: base.rotY ?? 0, scale: 1, y: base.y ?? 0, hidden: true };
  // A thing the catalog added has a height of its own wherever it stands: the file's, or the floor.
  const at = place(id, base);
  return { ...at, y: at.y ?? 0 };
}

/** One thing in the room the file itself put there (see shared/catalog and shared/model-sources): where it
 *  stands, and what it is. */
export interface SpawnedPiece {
  id: string;
  kind: AdditionKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** How big it is (see Placement.scale): 1 when the file doesn't say. */
  scale: number;
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
    if (!kind || !isAdditionKind(kind) || x === undefined || z === undefined) continue;
    out.push({ id, kind, x, y: num(p.y) ?? 0, z, rotY: num(p.rotY) ?? 0, scale: scaleOf(p), deleted: p.deleted === true });
  }
  return out;
}

/** Whether this id is something the editor added — its entry in the file names a kind — rather than a
 *  piece the room declares for itself. */
export function isAddition(id: string): boolean {
  return !!saved[id]?.kind;
}

/**
 * Forgets a piece the room has taken out, for good: its line leaves the file, so nothing puts it back and
 * the list behind "put back something cancelled" stops naming it.
 *
 * Only for what the editor added. A piece of the room's own is kept out of the room by being cancelled:
 * forget that one and its own builder puts it back where it has always stood, which is the opposite of
 * what was asked (see change and place).
 */
export function forget(id: string): boolean {
  if (!isAddition(id)) return false;
  delete saved[id];
  return true;
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
export function spawn(id: string, kind: AdditionKind, at: { x: number; y: number; z: number; rotY: number }): Placements {
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
    // Where the editor left it: the room's floor is 0 and needs no saying, which is also what a piece
    // brought back down to the floor comes to.
    const y = round(at.y ?? 0);
    if (y !== 0) p.y = y;
    // Only what differs is written: back at the size it came, the field goes. Compared as it would be
    // written, so the wheel's own rounding (up three notches and down three again is 1.0000000000000002)
    // leaves no trace.
    const scale = roundScale(scaleOf(at));
    if (scale !== 1) p.scale = scale;
  } else if (!hasSeat(id)) {
    // A piece of the room's own: how far it has been lifted from where layout.ts builds it, and how big
    // it has been made. Put back at its own height, and at its own size, there is nothing to remember.
    // A seat's furniture is the exception and writes neither (see hasSeat).
    const y = round(at.y ?? base.y ?? 0);
    if (Math.abs(y - (base.y ?? 0)) > 0.005) p.y = y;
    const scale = roundScale(scaleOf(at));
    if (scale !== 1) p.scale = scale;
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

/** The rung nearest `n`: what a size is written out as, and what a size read off a file becomes, so
 *  every size in the room is one of the ladder's (see SCALE_STEPS) rather than beside it — a layout
 *  written before the ladder was, at 1.21, lands on 1.25 the next time it is read. */
function roundScale(n: number): number {
  let best = SCALE_STEPS[0]!;
  for (const step of SCALE_STEPS) if (Math.abs(step - n) < Math.abs(best - n)) best = step;
  return best;
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
      if (!isAdditionKind(p.kind) || x === undefined || z === undefined) continue;
      if (Math.abs(x) >= 1000 || Math.abs(z) >= 1000) continue;
      const added: Placement = { kind: p.kind, x, z, rotY: rotY !== undefined && Math.abs(rotY) < 100 ? rotY : 0 };
      const y = num(p.y);
      if (y !== undefined && Math.abs(y) < 100) added.y = y;
      // A size is a number like the others: one out of the limits is brought to the nearest end, rather
      // than dropping the whole piece.
      const scale = num(p.scale);
      if (scale !== undefined) {
        const s = roundScale(clampScale(scale));
        if (s !== 1) added.scale = s;
      }
      if (p.deleted === true) added.deleted = true;
      out[id] = added;
      continue;
    }
    const one: Placement = {};
    if (x !== undefined && Math.abs(x) < 1000) one.x = x;
    if (z !== undefined && Math.abs(z) < 1000) one.z = z;
    if (rotY !== undefined && Math.abs(rotY) < 100) one.rotY = rotY;
    // A piece of the room's own is lifted and sized like anything the catalog adds (see Placement.y and
    // .scale): its `y` is how far from where layout.ts builds it, and nothing said means it stands there.
    // A seat's furniture is the exception — the office hires into that place — so a height or a size
    // written for one by hand is not read at all.
    if (!hasSeat(id)) {
      const y = num(p.y);
      if (y !== undefined && Math.abs(y) < 100) one.y = y;
      const scale = num(p.scale);
      if (scale !== undefined) {
        const s = roundScale(clampScale(scale));
        if (s !== 1) one.scale = s;
      }
    }
    if (p.deleted === true) one.deleted = true;
    if (Object.keys(one).length) out[id] = one;
  }
  return out;
}
