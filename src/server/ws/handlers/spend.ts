// The floor's spend board: what the project has spent in OMP, off OMP's own session records, for
// whoever arrives on the floor, and a way to read them again when the board's button is pressed.
import { EMPTY_SPEND } from '../../../shared/protocol.js';
import type { SpendClientMsg } from '../../../shared/protocol.js';
import type { HandlerMap, ViewPieces } from './types.js';

export const spendView: ViewPieces['spend'] = (_ctx, floor) => floor?.spend.state() ?? EMPTY_SPEND;

export const spendHandlers = {
  'spend.refresh'(ctx, c) {
    const floor = ctx.floorOf(c);
    if (!floor) return;
    ctx.toFloor(floor, { t: 'spend', state: floor.spend.refresh() });
  },
} satisfies HandlerMap<SpendClientMsg>;
