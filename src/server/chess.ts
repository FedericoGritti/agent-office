// The games being played on a floor's chess boards.
//
// chess.js is the authority on what is legal. The browser works out the same thing to highlight where a
// piece may go, and may be wrong or out of date without any of this caring: a move that isn't legal is
// refused here, and the floor is then told the position it actually has.
//
// One game per board piece, kept in .agent-office/chess.json beside the furniture's own file, so a game
// in progress survives a restart and two people on a floor always see the same board.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Chess } from 'chess.js';
import type { ChessBoards, ChessGame } from '../shared/chess.js';

interface Saved {
  [board: string]: { fen: string; moves: string[] };
}

export class ChessGames {
  private saved: Saved = {};
  private path: string;
  /** The games as they're being played: the same objects the file is written from. */
  private playing = new Map<string, Chess>();

  constructor(dataDir: string) {
    this.path = path.join(dataDir, 'chess.json');
    this.restore();
  }

  /** Every game on the floor, by board. */
  boards(): ChessBoards {
    const out: ChessBoards = {};
    for (const board of Object.keys(this.saved)) out[board] = this.state(board);
    return out;
  }

  /** The game on one board: a fresh one until somebody plays on it. */
  game(board: string): Chess {
    const known = this.playing.get(board);
    if (known) return known;
    const game = new Chess();
    const saved = this.saved[board];
    // A file nobody could have written, or a position chess.js refuses, is not a game: it starts again
    // rather than taking the floor's board with it.
    if (saved?.fen) {
      try {
        game.load(saved.fen);
      } catch {
        game.reset();
      }
    }
    this.playing.set(board, game);
    return game;
  }

  /** How one game stands, as a browser is told it. */
  state(board: string): ChessGame {
    const game = this.game(board);
    const turn = game.turn();
    return {
      fen: game.fen(),
      moves: game.history(),
      turn,
      check: game.isCheck(),
      over: game.isCheckmate()
        ? { how: 'checkmate', winner: turn === 'w' ? 'b' : 'w' }
        : game.isStalemate()
          ? { how: 'stalemate' }
          : game.isThreefoldRepetition()
            ? { how: 'threefold' }
            : game.isDraw()
              ? { how: 'draw' }
              : null,
    };
  }

  /** Plays a move, if it is one. Says whether it happened: nothing else changes the position. */
  move(board: string, from: string, to: string, promotion?: string): boolean {
    const game = this.game(board);
    try {
      // A promotion the wire names as something else is a queen: chess.js throws on anything unknown.
      game.move({ from, to, promotion: promotion && 'qrbn'.includes(promotion) ? promotion : 'q' });
    } catch {
      return false;
    }
    this.keep(board, game);
    return true;
  }

  /** Throws the game on that board away and starts it again from the first position. */
  newGame(board: string): void {
    const game = new Chess();
    this.playing.set(board, game);
    this.keep(board, game);
  }

  private keep(board: string, game: Chess): void {
    this.saved[board] = { fen: game.fen(), moves: game.history() };
    try {
      writeFileSync(this.path, `${JSON.stringify(this.saved, null, 2)}\n`);
    } catch {
      // A game nobody could write down is still a game: it plays on until the office stops.
    }
  }

  private restore(): void {
    try {
      const saved = JSON.parse(readFileSync(this.path, 'utf8')) as Saved;
      if (saved && typeof saved === 'object') this.saved = saved;
    } catch {
      this.saved = {};
    }
  }
}
