// Where the office's furniture stands, and whether it stands at all: layout.ts has the base every piece
// is built at, and this has what the editor saved over it (see features/layout-editor). The office is
// built through here, so a moved jukebox puts its colliders and its use-point at the new spot, and a
// deleted one isn't in the room at all. Nothing here touches the DOM or the scene: it's the file and
// the arithmetic, and the tests in tests/placement.test.ts pin it.

/** What the editor saves for one piece: only what differs from the base in layout.ts. */
export interface Placement {
  x?: number;
  z?: number;
  /** Its facing, in radians, as the builder would have set it. */
  rotY?: number;
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
  'figures-2': '🖼️ Figures (east)',
  'board-issues': '📋 Checklist board',
  'board-queue': '🕓 Timeline board',
  'board-pulls': '🎯 Phase board',
  'board-services': '🪙 Token board',
  gong: '🎉 Merge gong',
  cabinet: '🕹️ Arcade cabinet',
  tv: '📺 Lounge TV',
  'machine-monitor': '🖥️ Machine monitor',
};

/** What an id is called: a plant goes by its number, `plant-3` reading "Plant 3". */
export function labelFor(id: string): string {
  const named = PLACEABLE_LABELS[id];
  if (named) return named;
  const plant = /^plant-(\d+)$/.exec(id);
  if (plant) return `🌿 Plant ${plant[1]}`;
  const rug = /^rug-(\d+)$/.exec(id);
  return rug ? `🧶 Rug ${rug[1]}` : id;
}

let saved: Placements = {};

/** The floor's saved file, before the room is built: what the editor wrote, or nothing at all. */
export function setPlacements(file: Placements | null | undefined): void {
  saved = file ?? {};
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

/** What to save for a piece the editor moved: the fields that differ from its base, and nothing else.
 *  A piece back on its base (and not deleted) leaves the file. */
export function change(id: string, base: Base, at: Placed): Placements {
  const p: Placement = {};
  if (Math.abs(at.x - base.x) > 0.005) p.x = round(at.x);
  if (Math.abs(at.z - base.z) > 0.005) p.z = round(at.z);
  if (Math.abs(at.rotY - (base.rotY ?? 0)) > 0.005) p.rotY = round(at.rotY);
  if (at.hidden) p.deleted = true;
  const next = { ...saved };
  if (Object.keys(p).length) next[id] = p;
  else delete next[id];
  saved = next;
  return next;
}

/** A quarter of a centimeter is a fine enough place for anything in this room. */
function round(n: number): number {
  return Math.round(n * 400) / 400;
}

/**
 * Reads a saved file off the disk or off the wire: anything that isn't a number where a number goes is
 * dropped rather than trusted, so a file written by hand can't put a jukebox in the sky.
 */
export function sanitize(file: unknown): Placements {
  if (!file || typeof file !== 'object') return {};
  const out: Placements = {};
  for (const [id, raw] of Object.entries(file as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || id.length > 60) continue;
    const p = raw as Record<string, unknown>;
    const one: Placement = {};
    const x = num(p.x);
    const z = num(p.z);
    const rotY = num(p.rotY);
    if (x !== undefined && Math.abs(x) < 1000) one.x = x;
    if (z !== undefined && Math.abs(z) < 1000) one.z = z;
    if (rotY !== undefined && Math.abs(rotY) < 100) one.rotY = rotY;
    if (p.deleted === true) one.deleted = true;
    if (Object.keys(one).length) out[id] = one;
  }
  return out;
}
