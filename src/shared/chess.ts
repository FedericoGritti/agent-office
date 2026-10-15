// The chess board itself: how a square is named, where it sits on the board, and how a game stands.
//
// The rules are not here. They are chess.js, on the server, which is the authority on what is legal (see
// server/chess.ts); this is the little that the room, the wire and the rules all have to agree on.
//
// The pieces are the downloaded set (see features/chess). Its marble slab is 0.5532 m across, while the
// playable grid inside it is 0.4631 m across — 5.79 cm to a square. The set's own axes are the convention
// the arithmetic below follows: the a-file towards +x, the first rank towards -z. The client reads the
// exact playable width and middle from the model's starting pieces instead of mistaking its border for
// more board.

export type Square = string;
/** Which side a piece belongs to, as chess.js writes it. */
export type Colour = 'w' | 'b';

/** How a game stands, as everyone on the floor is told it. */
export interface ChessGame {
  /** The position in FEN: the whole game, in one line. */
  fen: string;
  /** The moves so far, in the short notation players read (`e4`, `Nf3`). */
  moves: string[];
  /** Whose turn it is. */
  turn: Colour;
  /** Set once the game is over, and how. */
  over: null | { how: 'checkmate' | 'stalemate' | 'draw' | 'threefold'; winner?: Colour };
  /** Whether the side to move is in check. */
  check: boolean;
}

/** The games on a floor, by the id of the board piece they're played on. */
export type ChessBoards = Record<string, ChessGame>;

/** Where a game nobody has touched begins. */
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FILES = 'abcdefgh';

/** Which file a square is on, 0 for the a-file. */
export function fileOf(square: Square): number {
  return FILES.indexOf(square[0] ?? '');
}

/** Which rank a square is on, 0 for the first. */
export function rankOf(square: Square): number {
  return Number(square[1] ?? '0') - 1;
}

export function isSquare(value: string): boolean {
  return /^[a-h][1-8]$/.test(value);
}

/** `a1` from 0 and 0. */
export function squareName(file: number, rank: number): Square {
  return `${FILES[file]}${rank + 1}`;
}

/**
 * Where the middle of a square is, on a board `side` metres across: the board's own middle is the origin,
 * files go towards +x, ranks towards -z (see the model, and the note at the top of this file).
 */
export function squareCentre(square: Square, side: number): { x: number; z: number } {
  const cell = side / 8;
  const half = side / 2;
  return { x: half - cell * (fileOf(square) + 0.5), z: -half + cell * (rankOf(square) + 0.5) };
}

/** The square a point on the board's top face is over — the other way round from squareCentre — or null
 *  when the point is off the board. */
export function squareAt(x: number, z: number, side: number): Square | null {
  const cell = side / 8;
  const half = side / 2;
  const file = Math.floor((half - x) / cell);
  const rank = Math.floor((z + half) / cell);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return squareName(file, rank);
}

/** Which piece of the set a node is, off its name: `piece_knight_white_02` and the like. */
export interface SetPiece {
  colour: Colour;
  kind: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
  /** Which of a pair, or which of the eight, counting from that colour's left as 1 (see startSquare). */
  index: number;
}

export function parsePiece(name: string): SetPiece | null {
  const parts = /^piece_(pawn|knight|bishop|rook|queen|king)_(white|black)(?:_(\d+))?$/.exec(name);
  if (!parts) return null;
  return { colour: parts[2] === 'white' ? 'w' : 'b', kind: parts[1] as SetPiece['kind'], index: Number(parts[3] ?? '1') };
}

/** Where the pieces of a back rank stand before black's numbered pairs are mirrored. */
const BACK_FILES: Record<'rook' | 'knight' | 'bishop' | 'queen' | 'king', number[]> = { rook: [0, 7], knight: [1, 6], bishop: [2, 5], queen: [3], king: [4] };

/**
 * The square a piece of the set stands on when a game begins. Each side numbers a pair or a row from its
 * own left: white 01 is on the a-file and black 01 on the h-file. The king and queen have no number and
 * are put on their standard chess squares rather than where this model happened to leave them.
 */
export function startSquare(piece: SetPiece): Square {
  const white = piece.colour === 'w';
  if (piece.kind === 'pawn') return squareName(white ? piece.index - 1 : 8 - piece.index, white ? 1 : 6);
  const file = BACK_FILES[piece.kind][piece.index - 1] ?? 0;
  const paired = BACK_FILES[piece.kind].length > 1;
  return squareName(!white && paired ? 7 - file : file, white ? 0 : 7);
}

/** What to say about a game on the board itself and in the hint bar. */
export function statusOf(game: ChessGame): string {
  if (game.over) {
    const winner = game.over.winner === 'w' ? 'White' : 'Black';
    if (game.over.how === 'checkmate') return `Checkmate — ${winner} wins`;
    if (game.over.how === 'stalemate') return 'Stalemate — a draw';
    if (game.over.how === 'threefold') return 'Drawn — the same position three times';
    return 'A draw';
  }
  return `${game.turn === 'w' ? 'White' : 'Black'} to play${game.check ? ' — check' : ''}`;
}
