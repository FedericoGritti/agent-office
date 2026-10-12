// The furniture on a floor: where the editor has moved it, and what it has deleted (see
// shared/placement for the file itself, and features/layout-editor for the hands that change it).

import type { Placements } from '../placement.js';

/** What the editor saves: the pieces that differ from how the room was built. */
export type LayoutClientMsg = { t: 'layout.set'; placements: Placements };

/** The furniture as it stands, to everyone on the floor: what a browser paints its room from. */
export type LayoutServerMsg = { t: 'layout'; placements: Placements };
