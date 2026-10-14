// The chess boards on a floor: the game being played on one, and the two things a browser asks of it.
//
// `board` is the id of the piece the board is (see shared/catalog: an addition of the editor's), so a
// floor can hold more than one and each keeps its own game. The rules are the server's (see
// server/chess.ts); the browser calculates the same legality to highlight moves, but a move it gets wrong
// is simply refused.

import type { ChessBoards } from '../chess.js';

export type ChessClientMsg =
  /** A move on that board. `promotion` is one of `q`, `r`, `b`, `n`, defaulting to a queen. */
  | { t: 'chess.move'; board: string; from: string; to: string; promotion?: string }
  /** A fresh game on that board, from the first position. */
  | { t: 'chess.new'; board: string };

/** Every game on the floor, by board: sent to everyone on it whenever one of them changes. */
export type ChessServerMsg = { t: 'chess'; boards: ChessBoards };
