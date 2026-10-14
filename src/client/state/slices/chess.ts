import type { ChessBoards } from '../../../shared/chess';
import type { Slice } from '../store';

declare module '../store' {
  interface Store {
    /** The chess games being played on this floor, by the id of the board piece (see features/chess). */
    chess: ChessBoards;
  }
  interface Topics {
    chess: true;
  }
}

export const chess: Slice = {
  init(s) {
    s.chess = {};
  },
  on: {
    welcome(s, m) {
      s.chess = m.chess ?? {};
      return ['chess'];
    },
    chess(s, m) {
      s.chess = m.boards;
      return ['chess'];
    },
  },
};
