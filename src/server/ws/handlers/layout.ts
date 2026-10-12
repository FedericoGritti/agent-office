// What the editor does: saves where the furniture stands on the floor the caller is on.

import type { LayoutClientMsg } from '../../../shared/protocol.js';
import { sanitize } from '../../../shared/placement.js';
import { here } from './common.js';
import type { HandlerMap, ViewPieces } from './types.js';

export const layoutView: ViewPieces['layout'] = (_ctx, floor) => floor?.layout.placements() ?? {};

export const layoutHandlers = {
  'layout.set'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (!floor) return;
    // Whatever arrives is read the way a file off the disk is: numbers where numbers go, nothing else.
    if (!floor.layout.set(sanitize(msg.placements))) return;
    ctx.toFloor(floor, { t: 'layout', placements: floor.layout.placements() });
  },
} satisfies HandlerMap<LayoutClientMsg>;
