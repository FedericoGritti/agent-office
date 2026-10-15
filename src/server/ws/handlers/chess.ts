// Playing chess on a floor: a move, or a fresh game, and then the floor told what the position is. The
// rules are not here — nothing in this file decides whether a move is a move (see server/chess.ts).

import type { ChessClientMsg } from '../../../shared/protocol.js';
import { isSquare } from '../../../shared/chess.js';
import { here } from './common.js';
import type { HandlerMap, ViewPieces } from './types.js';

/** A board is a piece of the room's furniture, so its id is a piece id: nothing else is one. */
const BOARD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/;

export const chessView: ViewPieces['chess'] = (_ctx, floor) => floor?.chess.boards() ?? {};

export const chessHandlers = {
  'chess.move'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (!floor || !BOARD_ID.test(msg.board) || !isSquare(msg.from) || !isSquare(msg.to)) return;
    // Even a move refused against a newer position sends the authoritative board back: two people can
    // act at once, and the stale browser must see what actually happened.
    floor.chess.move(msg.board, msg.from, msg.to, msg.promotion);
    ctx.toFloor(floor, { t: 'chess', boards: floor.chess.boards() });
  },
  'chess.new'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (!floor || !BOARD_ID.test(msg.board)) return;
    floor.chess.newGame(msg.board);
    ctx.toFloor(floor, { t: 'chess', boards: floor.chess.boards() });
  },
} satisfies HandlerMap<ChessClientMsg>;
