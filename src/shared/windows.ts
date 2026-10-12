// The windows in the office's outside walls: the ones the room is built with (WINDOW_DEFS) and what the
// editor has moved, added or taken out of them (the file the office keeps, one for the whole building —
// the room is one room, shared by every floor). A window is a hole in a wall: which wall, where along it,
// how wide, and its sill and head above the floor. Every builder that cuts a hole, hangs something on a
// sill or lights a pane reads `windows()` instead of a constant, so a window moved in the room is moved
// in the building's outside too (see features/layout-editor and docs/room.md).

import { BALCONY_DOOR, EXIT_DOOR, FLOOR, LOFT, SLAB, WALL_HEIGHT, type Opening, type Side } from './layout.js';

/** A window: a hole in an outside wall, with a name so the editor can move it and the file remember it. */
export interface WindowDef extends Opening {
  id: string;
}

/**
 * The windows the room is built with, before anything is moved: the room's own six — three in the south
 * wall, three in the west one — the boss's office's four, the lounge's two and the meeting room's two.
 */
export const WINDOW_DEFS: readonly WindowDef[] = [
  ...[-14, -9, 1].map((u, i) => ({ id: `window-south-${i + 1}`, wall: 'south' as const, u, width: 3, y0: 1.1, y1: 3.3 })),
  ...[-9, -3, 3].map((u, i) => ({ id: `window-west-${i + 1}`, wall: 'west' as const, u, width: 3, y0: 1.1, y1: 3.3 })),
  // The boss's office: a pair in the south wall either side of its nameplate, a pair in the east one.
  ...[LOFT.minX + 1.6, LOFT.minX + 7.4].map((u, i) => ({ id: `loft-south-${i + 1}`, wall: 'south' as const, u, width: 2.4, y0: LOFT.y + 0.9, y1: LOFT.y + 2.5 })),
  ...[LOFT.minZ + 1.4, LOFT.minZ + 3.6].map((u, i) => ({ id: `loft-east-${i + 1}`, wall: 'east' as const, u, width: 1.8, y0: LOFT.y + 0.9, y1: LOFT.y + 2.5 })),
  // The stretches of wall that had none: the lounge's own two — past the exit door on the west, between
  // the token board and the meeting room on the east — and the meeting room under the boss's office, whose
  // east wall takes a pair below the two it has above it.
  { id: 'window-west-4', wall: 'west', u: 10, width: 3, y0: 1.1, y1: 3.3 },
  { id: 'window-east-1', wall: 'east', u: 5.7, width: 3, y0: 1.1, y1: 3.3 },
  { id: 'meeting-east-1', wall: 'east', u: 9.5, width: 1.8, y0: 0.9, y1: 2.5 },
  { id: 'meeting-east-2', wall: 'east', u: 11.7, width: 1.8, y0: 0.9, y1: 2.5 },
  // A second row, high up on the three walls of the room itself: over the windows below on the west and
  // south walls, and over the boards and the TV on the east one, where the wall below is taken. Up here
  // nothing is in the way but the ladder, which climbs the pier between two of them.
  ...[-14, -9, 1].map((u, i) => ({ id: `window-south-${i + 4}`, wall: 'south' as const, u, width: 3, y0: 4.4, y1: 6.2 })),
  ...[-9, -3, 3].map((u, i) => ({ id: `window-west-${i + 5}`, wall: 'west' as const, u, width: 3, y0: 4.4, y1: 6.2 })),
  ...[-9, -3, 3].map((u, i) => ({ id: `window-east-${i + 2}`, wall: 'east' as const, u, width: 3, y0: 4.4, y1: 6.2 })),
];

/**
 * The walls a window can be in: the room's outside ones, but not the north wall. The back office opens
 * there and its bay carries windows of its own (see WING, and wingWindows in the tower), and the walls
 * inside have nothing to look out at.
 */
const OUTSIDE: Partial<Record<Side, { lo: number; hi: number }>> = {
  south: { lo: FLOOR.minX, hi: FLOOR.maxX },
  west: { lo: FLOOR.minZ, hi: FLOOR.maxZ },
  east: { lo: FLOOR.minZ, hi: FLOOR.maxZ },
};

/** The sides a window can be in at all, in the order the room lists them. */
export const WINDOW_SIDES: readonly Side[] = ['south', 'west', 'east'];

/**
 * How high the windows in one wall reach: where the sign over the ladder hangs, above the windows either
 * side of it. With every window of that wall taken out, where the room built them, so the sign stays put.
 */
export function windowHead(side: Side, list: readonly WindowDef[] = windows()): number {
  const on = list.filter((w) => w.wall === side);
  const from = on.length ? on : WINDOW_DEFS.filter((w) => w.wall === side);
  return Math.max(...from.map((w) => w.y1));
}

/** How far along an outside wall a window can be, by the meter: undefined for a wall that takes none. */
export function wallSpan(wall: Side): { lo: number; hi: number } | undefined {
  return OUTSIDE[wall];
}

/**
 * How far a window keeps from the end of its wall and from the next window or doorway along it: the
 * least the room already leaves between two windows or at a corner (the boss's office's east pair, and
 * the four in its south wall), so a window put in by hand is framed like the ones built with the room.
 */
const EDGE = 0.4;

/** What the editor saves for one window: what differs from how the room builds it, or a whole new one. */
export interface WindowPlacement {
  wall?: Side;
  u?: number;
  width?: number;
  y0?: number;
  y1?: number;
  /** Out of the wall: a plain run of wall stands where it was. */
  deleted?: boolean;
}

/** The building's windows as the editor left them: an entry per window that isn't where the room builds it. */
export type WindowPlacements = Record<string, WindowPlacement>;

const BASE_BY_ID = new Map(WINDOW_DEFS.map((w) => [w.id, w]));
let saved: WindowPlacements = {};

/** A window as the room builds it, by id, if it is one of those. */
export function baseWindow(id: string): WindowDef | undefined {
  return BASE_BY_ID.get(id);
}

/** The office's file, before the walls are built: what the editor wrote, or nothing at all. */
export function setWindows(file: WindowPlacements | null | undefined): void {
  saved = file ?? {};
}

/** The file as it stands: what saving a move sends, and what the walls are built from. */
export function windowPlacements(): WindowPlacements {
  return saved;
}

/** Every window in the walls as they stand: the built ones where the file leaves them, then the new ones. */
export function windows(): WindowDef[] {
  const out: WindowDef[] = [];
  for (const base of WINDOW_DEFS) {
    const entry = saved[base.id];
    if (entry?.deleted) continue;
    out.push(
      entry
        ? {
            id: base.id,
            wall: entry.wall ?? base.wall,
            u: entry.u ?? base.u,
            width: entry.width ?? base.width,
            y0: entry.y0 ?? base.y0,
            y1: entry.y1 ?? base.y1,
          }
        : base,
    );
  }
  for (const [id, entry] of Object.entries(saved)) {
    if (BASE_BY_ID.has(id) || entry.deleted) continue;
    const added = whole(id, entry);
    if (added) out.push(added);
  }
  return out;
}

/** A window the file adds: nothing was built for it, so nothing short of a whole one is a window. */
function whole(id: string, entry: WindowPlacement): WindowDef | undefined {
  const { wall, u, width, y0, y1 } = entry;
  if (wall === undefined || u === undefined || width === undefined || y0 === undefined || y1 === undefined) return undefined;
  return { id, wall, u, width, y0, y1 };
}

/** What a window is called on the banner: `window-south-2` reads "South window 2". */
export function windowLabel(id: string): string {
  const built = /^([a-z]+)-([a-z]+)-(\d+)$/.exec(id);
  if (built) {
    const where = built[1] === 'loft' ? "Boss's" : built[1] === 'meeting' ? 'Meeting room' : SIDE_NAME[built[2] as Side] ?? built[2];
    return `${where} window ${built[3]}`;
  }
  const added = /^window-(\d+)$/.exec(id);
  return added ? `Window ${added[1]}` : id;
}

const SIDE_NAME: Partial<Record<Side, string>> = { north: 'North', south: 'South', east: 'East', west: 'West' };

/** A name for a window the editor puts in that the room doesn't build: the lowest number nobody has. */
export function newWindowId(): string {
  for (let n = 1; ; n++) if (!BASE_BY_ID.has(`window-${n}`) && !(`window-${n}` in saved)) return `window-${n}`;
}

/**
 * The size a new window takes where it's put: the window nearest it on that wall **at that height**, so a
 * wall carrying two rows of windows (the boss's office over the meeting room) gives the new one the row
 * you're looking at. With nothing at that height, the nearest window on the wall; with no window at all,
 * the room's first one.
 */
export function sizeOn(wall: Side, u: number, y: number, list: readonly WindowDef[] = windows()): Pick<WindowDef, 'width' | 'y0' | 'y1'> {
  let inTheRow: WindowDef | undefined;
  let nearest: WindowDef | undefined;
  for (const o of list) {
    if (o.wall !== wall) continue;
    if (!nearest || Math.abs(o.u - u) < Math.abs(nearest.u - u)) nearest = o;
    if (y >= o.y0 && y <= o.y1 && (!inTheRow || Math.abs(o.u - u) < Math.abs(inTheRow.u - u))) inTheRow = o;
  }
  const from = inTheRow ?? nearest ?? list[0] ?? WINDOW_DEFS[0]!;
  return { width: from.width, y0: from.y0, y1: from.y1 };
}

/**
 * Whether a window fits where it is, and if not, why (what the banner says while you carry it). A hole
 * can't run past the end of its wall, into the ceiling, over another window or a doorway, or across the
 * slab the boss's office stands on.
 */
export function windowFits(wall: Side, at: Opening, list: readonly WindowDef[] = windows(), ignore?: string): string | undefined {
  const span = OUTSIDE[wall];
  if (!span) return 'nothing looks out of that wall';
  if (at.width < EDGE || at.y1 - at.y0 < EDGE) return 'a hole that small is not a window';
  if (at.u - at.width / 2 < span.lo + EDGE - HAIR || at.u + at.width / 2 > span.hi - EDGE + HAIR) return 'the wall ends there';
  if (at.y0 < 0) return 'it starts under the floor';
  if (at.y1 > WALL_HEIGHT) return 'it runs out of the wall at the ceiling';
  for (const o of list) {
    if (o.wall !== wall || o.id === ignore) continue;
    if (clash(at, o)) return `${windowLabel(o.id)} is there`;
  }
  for (const door of [EXIT_DOOR, BALCONY_DOOR]) if (door.wall === wall && clash(at, door)) return 'the doorway is there';
  // The boss's office stands on a slab through the south and east walls of its corner: a hole there can
  // go under the slab or over it, but not across it. The west wall is nowhere near it.
  const overLoft = wall === 'south' ? at.u > LOFT.minX : wall === 'east' ? at.u > LOFT.minZ : false;
  if (overLoft && at.y0 < LOFT.y && at.y1 > LOFT.y - SLAB) return "the boss's office floor is there";
  return undefined;
}

/**
 * A micron: the width of nothing in a room built to the centimeter. Two holes exactly `EDGE` apart are
 * framed (the boss's office's own east pair is), so the comparison minds the last hair of floating point
 * rather than reading 0.4 as a fraction under it.
 */
const HAIR = 1e-6;

/** Two holes in one wall within `EDGE` of each other both ways: across, or below and above. */
function clash(a: Opening, b: Opening, gap = EDGE): boolean {
  const u = Math.max(0, Math.max(a.u - a.width / 2, b.u - b.width / 2) - Math.min(a.u + a.width / 2, b.u + b.width / 2));
  const y = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
  return u < gap - HAIR && y < gap - HAIR;
}

/** What to save for a window the editor moved: the fields that differ from the built one, and nothing else.
 *  A window back where the room builds it (and not deleted) leaves the file. */
export function changeWindow(id: string, base: WindowDef | undefined, at: Opening): WindowPlacements {
  const next: WindowPlacement = {};
  if (!base || at.wall !== base.wall) next.wall = at.wall;
  if (!base || round(at.u) !== round(base.u)) next.u = round(at.u);
  if (!base || round(at.width) !== round(base.width)) next.width = round(at.width);
  if (!base || round(at.y0) !== round(base.y0)) next.y0 = round(at.y0);
  if (!base || round(at.y1) !== round(base.y1)) next.y1 = round(at.y1);
  return write(id, next);
}

/** Out of the wall for good: the room's own is remembered as gone, a new one just leaves the file. */
export function removeWindow(id: string): WindowPlacements {
  return write(id, baseWindow(id) ? { deleted: true } : {});
}

/** Puts an entry in the file, or takes it out when there is nothing left to remember. */
function write(id: string, entry: WindowPlacement): WindowPlacements {
  const next = { ...saved };
  if (Object.keys(entry).length) next[id] = entry;
  else delete next[id];
  saved = next;
  return next;
}

/** A quarter of a centimetre is a fine enough place for a window in a wall: the grid the editor moves on. */
function round(n: number): number {
  return Math.round(n * 400) / 400;
}

/**
 * Reads a saved file off the disk or off the wire: an entry that isn't numbers where numbers go, or that
 * puts a window where no window can go, is dropped rather than trusted, so a file written by hand can't
 * hang a window over the doorway or cut through the floor the boss's office stands on.
 */
export function sanitizeWindows(file: unknown): WindowPlacements {
  if (!file || typeof file !== 'object' || Array.isArray(file)) return {};
  const raw = file as Record<string, unknown>;
  const out: WindowPlacements = {};
  const standing: WindowDef[] = [];
  // The ones the room builds, in the order it builds them: an entry that doesn't fit leaves the window as built.
  for (const base of WINDOW_DEFS) {
    const entry = readEntry(raw[base.id]);
    if (entry?.deleted) {
      out[base.id] = { deleted: true };
      continue;
    }
    const at: WindowDef = entry
      ? { id: base.id, wall: entry.wall ?? base.wall, u: entry.u ?? base.u, width: entry.width ?? base.width, y0: entry.y0 ?? base.y0, y1: entry.y1 ?? base.y1 }
      : base;
    if (entry && windowFits(at.wall, at, standing)) {
      standing.push(base);
      continue;
    }
    if (entry) out[base.id] = entry;
    standing.push(at);
  }
  // And the ones it adds, which are whole windows or nothing.
  for (const [id, value] of Object.entries(raw)) {
    if (BASE_BY_ID.has(id)) continue;
    const entry = readEntry(value);
    const at = entry && whole(id, entry);
    if (!at || !entry || windowFits(at.wall, at, standing)) continue;
    out[id] = entry;
    standing.push(at);
  }
  return out;
}

/** One entry off the wire, with everything that isn't what it says it is left out. */
function readEntry(raw: unknown): WindowPlacement | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  if (src.deleted === true) return { deleted: true };
  const out: WindowPlacement = {};
  if (isSide(src.wall)) out.wall = src.wall;
  for (const k of ['u', 'width', 'y0', 'y1'] as const) {
    const v = num(src[k]);
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function isSide(v: unknown): v is Side {
  return v === 'north' || v === 'south' || v === 'east' || v === 'west';
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
