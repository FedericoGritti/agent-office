// What the room's editor can put in the office: one entry per thing you can add (see
// world/office/catalog.ts for how each one is built, and features/layout-editor for the panel that
// picks them). Data only, and both sides read it: the client builds the piece a kind names, and a saved
// file keeps only the kinds listed here — anything else is dropped like a number written badly.

export interface CatalogEntry {
  /** What the panel shows first: an emoji, and the name of the thing. */
  readonly label: string;
  /** A line of its own under the name: how big it is, and where it sits well. */
  readonly blurb: string;
  /** The heading the panel lists it under, so a dozen things are a few shelves rather than a heap. */
  readonly group: string;
}

/**
 * The catalog, in the order the panel lists it. The keys are what a saved addition remembers, so
 * renaming one loses the pieces already added, and taking one out of here means they stop being built.
 *
 * What is here is furniture the room can build a copy of, anywhere, as many times as you like. What
 * isn't here needs the feature that owns it to be able to paint more than one screen — the television,
 * the whiteboard, the four boards, the machine monitor and the figures boards are one of a kind for that
 * reason — and nor is anything with a seat: a desk or a couch the office's own list hasn't got is a place
 * nobody can be hired into (see docs/room.md).
 */
export const CATALOG = {
  monstera: { label: '🌿 Monstera', blurb: 'A pot plant, a metre and a half of it: an empty corner, or beside a board', group: '🪴 Plants' },
  'snake-plant': { label: '🪴 Snake plant', blurb: 'A tall, narrow pot plant: a gap between two desks, against a wall', group: '🪴 Plants' },
  ficus: { label: '🌳 Ficus', blurb: 'A little indoor tree, a bit over a metre: the middle of a bare stretch of floor', group: '🪴 Plants' },
  succulent: { label: '🌵 Succulent', blurb: 'A small pot plant, knee high: a sill, a corner by the elevator', group: '🪴 Plants' },
  rug: { label: '🧶 Rug', blurb: 'A soft rug, 3.2 by 2.4 metres, to give a bare stretch of floor a room of its own', group: '🪡 Floor and tables' },
  'round-rug': { label: '🟪 Round rug', blurb: 'A round rug three metres across: under a table, or under nothing at all', group: '🪡 Floor and tables' },
  'coffee-table': { label: '🛋️ Coffee table', blurb: 'The lounge’s round table, 0.9 across: beside a couch, or on its own', group: '🪡 Floor and tables' },
  'cushion-mint': { label: '🪀 Cushion, mint', blurb: 'A floor cushion a metre across, knee high: a corner to throw yourself into', group: '🪀 Cushions' },
  'cushion-sun': { label: '🪀 Cushion, sun', blurb: 'A floor cushion a metre across, knee high: by a window, or on a rug', group: '🪀 Cushions' },
  'cushion-blush': { label: '🪀 Cushion, blush', blurb: 'A floor cushion a metre across, knee high: one of a ring of them round a table', group: '🪀 Cushions' },
  fountain: { label: '⛲ Fountain', blurb: 'A stone basin with water in it, two and a half metres across: a big empty space', group: '⛲ Water' },
} as const satisfies Record<string, CatalogEntry>;

/** What a saved addition calls the thing it is: a key of the catalog. */
export type CatalogKind = keyof typeof CATALOG;

/** Every kind there is, in the panel's order. */
export const CATALOG_KINDS = Object.keys(CATALOG) as readonly CatalogKind[];

/** Whether a name off a file or off the wire is a thing that can be built. */
export function isCatalogKind(kind: unknown): kind is CatalogKind {
  return typeof kind === 'string' && Object.hasOwn(CATALOG, kind);
}

/** What a kind is called. Throws on a kind nobody has: callers have one off a file they were handed. */
export function catalogEntry(kind: CatalogKind): CatalogEntry {
  return CATALOG[kind];
}
