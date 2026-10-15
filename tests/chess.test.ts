import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, isSquare, parsePiece, squareAt, squareCentre, startSquare, statusOf } from '../src/shared/chess.js';
import { ChessGames } from '../src/server/chess.js';

/** The downloaded set's board, in metres: 6.92 cm to a square (see the note in shared/chess.ts). */
const SIDE = 0.5532;

test('a square is a place on the board, and the arithmetic knows which', () => {
  // The model's own convention: the a-file towards +x, the first rank towards -z.
  const a1 = squareCentre('a1', SIDE);
  assert.ok(a1.x > 0 && a1.z < 0, `${JSON.stringify(a1)} should be the +x/-z corner`);
  const h8 = squareCentre('h8', SIDE);
  assert.ok(h8.x < 0 && h8.z > 0, `${JSON.stringify(h8)} should be the -x/+z corner`);
  // A cell apart, and every square's middle is over that square again.
  assert.ok(Math.abs(Math.abs(a1.z) - Math.abs(squareCentre('a2', SIDE).z) - SIDE / 8) < 1e-9);
  for (const square of ['a1', 'e4', 'h8', 'b7']) {
    const at = squareCentre(square, SIDE);
    assert.equal(squareAt(at.x, at.z, SIDE), square);
  }
  // Off the board there is no square at all.
  assert.equal(squareAt(SIDE, 0, SIDE), null);
  assert.equal(squareAt(0, -SIDE / 2 - 0.01, SIDE), null);
  assert.ok(isSquare('e4') && !isSquare('i4') && !isSquare(''));
});

test('the set names its pieces by what they are, and says which square each one begins on', () => {
  assert.deepEqual(parsePiece('piece_knight_white_02'), { colour: 'w', kind: 'knight', index: 2 });
  assert.deepEqual(parsePiece('piece_queen_black'), { colour: 'b', kind: 'queen', index: 1 });
  assert.equal(parsePiece('board'), null);
  // The numbering runs from the a-file, which is what makes the start a lookup: eight pawns on the eight
  // files, the two rooks on the two corners.
  assert.equal(startSquare(parsePiece('piece_pawn_white_01')!), 'a2');
  assert.equal(startSquare(parsePiece('piece_pawn_white_08')!), 'h2');
  assert.equal(startSquare(parsePiece('piece_pawn_black_03')!), 'c7');
  assert.equal(startSquare(parsePiece('piece_rook_white_01')!), 'a1');
  assert.equal(startSquare(parsePiece('piece_rook_white_02')!), 'h1');
  assert.equal(startSquare(parsePiece('piece_knight_black_02')!), 'g8');
  assert.equal(startSquare(parsePiece('piece_bishop_white_02')!), 'f1');
  assert.equal(startSquare(parsePiece('piece_queen_black')!), 'd8');
  assert.equal(startSquare(parsePiece('piece_king_white')!), 'e1');
});

test('the whole set, put where each piece begins, spells out the first position of a game', () => {
  const names: string[] = [];
  for (const colour of ['white', 'black']) {
    for (const [kind, count] of [
      ['rook', 2],
      ['knight', 2],
      ['bishop', 2],
      ['queen', 1],
      ['king', 1],
    ] as const) {
      for (let i = 1; i <= count; i++) names.push(count === 1 ? `piece_${kind}_${colour}` : `piece_${kind}_${colour}_0${i}`);
    }
    for (let i = 1; i <= 8; i++) names.push(`piece_pawn_${colour}_0${i}`);
  }
  const grid = new Map<string, string>();
  for (const name of names) {
    const piece = parsePiece(name);
    // The whole kind, because `k` is a king and a knight both: the FEN letter for a knight is `n`.
    if (piece) grid.set(startSquare(piece), `${piece.colour}${piece.kind}`);
  }
  assert.equal(grid.size, 32, 'a set of 32 pieces, no two on one square');
  // And compared against the FEN of the first position: if the mapping were wrong anywhere — a rook on
  // the wrong corner, the queen and king swapped — this is where it would show.
  const KIND_OF = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' } as const;
  for (const [rank, row] of START_FEN.split(' ')[0].split('/').entries()) {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const square = `${'abcdefgh'[file]}${8 - rank}`;
      const kind = KIND_OF[ch.toLowerCase() as keyof typeof KIND_OF];
      assert.equal(grid.get(square), `${ch === ch.toUpperCase() ? 'w' : 'b'}${kind}`, `${square} should hold ${ch}`);
      file++;
    }
  }
});

test('a game says how it stands in words a player reads', () => {
  const game = { fen: START_FEN, moves: [], turn: 'w' as const, over: null, check: false };
  assert.equal(statusOf(game), 'White to play');
  assert.equal(statusOf({ ...game, turn: 'b', check: true }), 'Black to play — check');
  assert.equal(statusOf({ ...game, over: { how: 'checkmate', winner: 'b' } }), 'Checkmate — Black wins');
  assert.equal(statusOf({ ...game, over: { how: 'stalemate' } }), 'Stalemate — a draw');
});

test('the server keeps a legal game and its history through a restart', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-office-chess-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const first = new ChessGames(dir);
  assert.equal(first.move('board-1', 'e2', 'e4'), true);
  assert.equal(first.move('board-1', 'e7', 'e4'), false);
  assert.deepEqual(first.state('board-1').moves, ['e4']);

  const restored = new ChessGames(dir);
  assert.deepEqual(restored.state('board-1').moves, ['e4']);
  assert.equal(restored.move('board-1', 'e7', 'e5'), true);
  assert.deepEqual(restored.state('board-1').moves, ['e4', 'e5']);
});
