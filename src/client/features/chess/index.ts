// Chess, played on the downloaded set in the room.
//
// The position and the rules are the server's (see server/chess.ts, and shared/chess for the board's own
// arithmetic): this is the furniture. It finds the boards standing in the room — the set is a catalog
// model like any other, so anyone can put one down and size it as they like — lays the pieces out where
// the position says, works out which square you're looking at, and takes E.
//
// The set is made of 32 named pieces and a board (see shared/chess's parsePiece), each piece with its own
// origin, so nothing has to be cut up: a piece is moved to the middle of its square, and its size follows
// the board's, because both are inside the piece the editor scaled.
//
// Two people on a floor play the same game because there is only one (see the server). Whose turn it is,
// is the position's business: the board refuses your move if it isn't your turn, which is what two people
// sitting at one board want and what one person moving both sides might not.

import * as THREE from 'three';
import { Chess, type Square as Sq } from 'chess.js';
import { parsePiece, squareAt, squareCentre, statusOf, type ChessGame, type Square } from '../../../shared/chess';
import { spawned } from '../../../shared/placement';
import { aside, hintTitle, key, onE } from '../../core/hint';
import { store } from '../../state';
import { EYE_HEIGHT } from '../../player';
import { toast } from '../../ui/dom';
import { placedPieces, type Piece } from '../../world/office/placed';
import { boundsIn, placeBaseAt } from './placement';
import type { Ctx } from '../../core/context';
import type { Interactable } from '../../world/types';

declare module '../../world/types' {
  interface InteractKinds {
    chess: true;
  }
}

/** The set's model, as the catalog names it: the board and the pieces are this one piece of furniture. */
const BOARD_KIND = 'polyhaven:chess_set';
/** How close you have to be to a square to play on it. */
const REACH = 4;
/** How often to look for a board put down while you watch: a model arrives over the network when it likes. */
const LOOK_MS = 500;
/** A disc for each mark: the square you're on, the piece you hold, and where it may go. */
const MARKS = 30;

/** One square's worth of the board, as the room moves it about: where its middle is and what it is. */
interface SetPiece {
  object: THREE.Object3D;
  /** `wpawn`, `bknight`…: which of the set's pieces this is. */
  key: string;
}

/** A board standing in the room, with what the room has worked out about it. */
interface Board {
  piece: Piece;
  /** The room interaction attached to the model and kept at the furniture's current position. */
  spot: Interactable;
  /** The board's own mesh, the model's root (the pieces' frame), how wide a square is and how high the
   *  surface is — all in that root's own metres. */
  board: THREE.Mesh;
  frame: THREE.Object3D;
  side: number;
  top: number;
  /** Where the board's middle is in the frame, so the squares are worked out from where it actually sits. */
  middle: THREE.Vector3;
  set: SetPiece[];
  /** The marks drawn on the board, and what the position looked like when the pieces were last laid out. */
  marks: THREE.Mesh[];
  laid: string;
  /** The square you're looking at, and the piece you've picked up (if any). */
  aimed: Square | null;
  held: Square | null;
}

/** What the set is called, by the letter a FEN uses for that piece. */
const KIND_OF = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' } as const;

/**
 * The part of the model that holds both the board and every piece of the set: the space the squares are
 * measured in. Not the board mesh's own parent — a glTF puts a node around every mesh, so that is a node
 * of its own, and the pieces are its siblings rather than its children.
 */
function frameFor(boardMesh: THREE.Mesh, nodes: readonly THREE.Object3D[]): THREE.Object3D | null {
  const holds = (at: THREE.Object3D, node: THREE.Object3D) => {
    for (let up: THREE.Object3D | null = node; up; up = up.parent) if (up === at) return true;
    return false;
  };
  for (let at: THREE.Object3D | null = boardMesh; at; at = at.parent) if (nodes.every((node) => holds(at, node))) return at;
  return null;
}

/** Says, on screen, why a set can't be played: a board that silently refuses to move is a mystery. */
function warn(why: string): void {
  console.warn(`chess: ${why}`);
  toast(`♟️ This chess set can't be played: ${why}`);
}

export function installChess(ctx: Ctx) {
  const { player, camera, office, net } = ctx;
  const boards = new Map<string, Board>();
  /** Which board each spot you can aim at belongs to: an interactable has no id of its own to carry. */
  const where = new Map<Interactable, Board>();
  /** Boards whose set the room can't move: looked at once, never again (see lookForBoards). */
  const refused = new Set<string>();
  const rays = new THREE.Raycaster();
  rays.far = REACH + 6;
  const centre = new THREE.Vector2(0, 0);
  /** Where the mouse is over the office: in third person that is what you point at, not the middle of the
   *  screen — the middle of a screen is aimed at the far wall when the board is at your feet. */
  let pointer: THREE.Vector2 | null = null;
  const canvas = ctx.canvas;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    (pointer ??= new THREE.Vector2()).set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  canvas.addEventListener('pointerleave', () => (pointer = null));
  const eye = new THREE.Vector3();
  const markGeometry = new THREE.CircleGeometry(0.32, 20);
  let lookedAt = 0;

  /** Every board the room has, built from the model the first time it is seen and dropped when it goes. */
  function lookForBoards(): void {
    const now = performance.now();
    if (now - lookedAt < LOOK_MS) return;
    lookedAt = now;
    const wanted = new Set(spawned().filter((it) => it.kind === BOARD_KIND && !it.deleted).map((it) => it.id));
    for (const [id, board] of boards) {
      if (wanted.has(id) && placedPieces().includes(board.piece)) continue;
      for (const mark of board.marks) mark.removeFromParent();
      drop(id);
      boards.delete(id);
    }
    for (const id of wanted) {
      if (boards.has(id) || refused.has(id)) continue;
      const piece = placedPieces().find((p) => p.id === id);
      if (!piece) continue;
      const spot = interactableOf(piece);
      const built = build(piece, spot);
      if (!built) {
        // A set the room can't move is left standing as it came rather than half-played: nothing is asked
        // of this one again, and the piece itself is the room's furniture like any other.
        refused.add(id);
        continue;
      }
      built.frame.userData.interact = spot;
      office.interactables.push(spot);
      where.set(spot, built);
      boards.set(id, built);
    }
  }

  /** The spot on a board the aim can land on and E can use. */
  function interactableOf(piece: Piece): Interactable {
    return { kind: 'chess', x: piece.at.x, y: piece.at.y, z: piece.at.z, radius: 3 };
  }

  /** Lets go of a board: the spot the aim could land on goes with it. */
  function drop(id: string): void {
    for (const [spot, board] of where) {
      if (board.piece.id !== id) continue;
      if (board.frame.userData.interact === spot) delete board.frame.userData.interact;
      where.delete(spot);
      const at = office.interactables.indexOf(spot);
      if (at >= 0) office.interactables.splice(at, 1);
    }
  }

  /** Reads a board piece's model: the board mesh, the pieces of the set, and the metres they're in. */
  function build(piece: Piece, spot: Interactable): Board | null {
    let boardMesh: THREE.Mesh | null = null;
    const nodes: THREE.Object3D[] = [];
    for (const part of piece.parts) {
      part.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.name === 'board') boardMesh ??= o as THREE.Mesh;
        // The name may be on a piece's node, on its mesh, or on both: the outer one is the one to move, or
        // it would be moved twice over.
        if (parsePiece(o.name) && !(o.parent && parsePiece(o.parent.name))) nodes.push(o);
      });
    }
    if (!boardMesh || nodes.length !== 32) {
      warn(`the room found ${nodes.length} chess pieces where it expects 32`);
      return null;
    }
    const frame = frameFor(boardMesh, nodes);
    if (!frame) {
      warn('this chess set is not laid out the way the room can move it');
      return null;
    }
    const box = boundsIn(boardMesh, frame);
    if (box.isEmpty()) {
      warn('the chess board has no measurable surface');
      return null;
    }
    const middle = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const side = Math.max(size.x, size.z);
    const set = nodes.map((node) => {
      const piece = parsePiece(node.name)!;
      return { object: node, key: `${piece.colour}${piece.kind}` };
    });
    const marks = Array.from({ length: MARKS }, () => {
      // Each its own material: a mark says a different thing from the one beside it (where you are, where
      // you may go), and one material between them would have them all say the last thing set.
      const mark = new THREE.Mesh(markGeometry, new THREE.MeshBasicMaterial({ color: '#2ee6a8', transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false }));
      mark.rotation.x = -Math.PI / 2;
      mark.visible = false;
      frame.add(mark);
      return mark;
    });
    // The board's middle is the frame's origin only if the model was built that way: this one is (see the
    // note in shared/chess), and a board that isn't has its squares worked out from where it actually is.
    return { piece, spot, board: boardMesh, frame, side, top: box.max.y, middle, set, marks, laid: '', aimed: null, held: null };
  }

  /** A game nobody has touched: the board is there, and nobody has played on it yet. */
  function gameOf(id: string): ChessGame {
    return store.chess[id] ?? { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [], turn: 'w', over: null, check: false };
  }

  /** Lays the pieces out where the position says, and hides the ones that have been taken. */
  function layout(board: Board, game: ChessGame): void {
    const wanted = new Map<string, Square[]>();
    const onBoard = new Chess(game.fen).board();
    for (const row of onBoard) {
      for (const cell of row) {
        if (!cell) continue;
        const key = `${cell.color}${KIND_OF[cell.type]}`;
        wanted.set(key, [...(wanted.get(key) ?? []), cell.square]);
      }
    }
    for (const [key, squares] of wanted) squares.sort();
    const taken = new Map<string, SetPiece[]>();
    for (const one of board.set) taken.set(one.key, [...(taken.get(one.key) ?? []), one]);
    for (const [key, ones] of taken) {
      const squares = wanted.get(key) ?? [];
      ones.forEach((one, at) => {
        const square = squares[at];
        one.object.visible = square !== undefined;
        if (!square) return;
        const { x, z } = squareCentre(square, board.side);
        placeBaseAt(one.object, board.frame, new THREE.Vector3(board.middle.x + x, board.top, board.middle.z + z));
      });
    }
  }

  /** Draws what you're looking at, what you hold, and where it may go. */
  function drawMarks(board: Board, game: ChessGame): void {
    const marks = board.marks;
    let used = 0;
    const put = (square: Square, colour: string) => {
      const mark = marks[used++];
      if (!mark) return;
      const { x, z } = squareCentre(square, board.side);
      mark.position.set(board.middle.x + x, board.top + 0.002, board.middle.z + z);
      mark.scale.setScalar(board.side / 8 / 0.64);
      (mark.material as THREE.MeshBasicMaterial).color.set(colour);
      mark.visible = true;
    };
    if (board.aimed) put(board.aimed, board.held ? '#ffd166' : '#2ee6a8');
    if (board.held) {
      const piece = new Chess(game.fen);
      for (const move of piece.moves({ square: board.held as Sq, verbose: true })) put(move.to, '#8ecae6');
    }
    for (let at = used; at < marks.length; at++) marks[at].visible = false;
  }

  /** Which square of a board you're looking at, and how far away it is. */
  function aim(board: Board): number | null {
    eye.set(player.pos.x, player.pos.y + EYE_HEIGHT, player.pos.z);
    // The crosshair in first person; the mouse in third (see the pointer above).
    rays.setFromCamera(player.view === 'first' ? centre : (pointer ?? centre), camera);
    const hits = rays.intersectObject(board.board, false);
    if (!hits.length) return null;
    const local = board.frame.worldToLocal(hits[0].point.clone());
    board.aimed = squareAt(local.x - board.middle.x, local.z - board.middle.z, board.side);
    return board.aimed ? hits[0].point.distanceTo(eye) : null;
  }

  ctx.interactions.define('chess', {
    reach: REACH,
    hint: (it) => {
      const board = where.get(it);
      const parts = [hintTitle('♟️ Chess')];
      if (board) {
        const game = gameOf(board.piece.id);
        const standing = board.aimed ? new Chess(game.fen).get(board.aimed as Sq) : null;
        // Whose turn it is, and how the game stands: what everyone at the board needs to know.
        parts.push(aside(statusOf(game)));
        parts.push(key('E', board.held ? `Put it on ${board.aimed ?? 'a square'}` : standing ? 'Pick the piece up' : 'Nothing on that square'));
        parts.push(key('Y', 'Start again'));
      }
      return { k: `${board?.piece.id ?? ''}|${board?.held ?? ''}|${board?.aimed ?? ''}`, parts };
    },
    use: onE((it) => {
      const board = where.get(it);
      if (!board?.aimed) return;
      const id = board.piece.id;
      // Nothing in hand: pick up what stands on that square, if it is that side's turn.
      if (!board.held) {
        const game = new Chess(gameOf(id).fen);
        const standing = game.get(board.aimed as Sq);
        if (!standing || standing.color !== game.turn()) {
          toast(standing ? 'Not your turn' : 'Nothing on that square');
          return;
        }
        board.held = board.aimed;
        return;
      }
      // Refuse locally too, so an impossible destination leaves the piece selected instead of appearing
      // to do nothing. The server still decides finally, because another player may have moved first.
      const game = new Chess(gameOf(id).fen);
      const legal = game.moves({ square: board.held as Sq, verbose: true }).some((move) => move.to === board.aimed);
      if (!legal) {
        toast('That piece cannot move there');
        return;
      }
      net.send({ t: 'chess.move', board: id, from: board.held, to: board.aimed });
      board.held = null;
    }),
  });

  ctx.keys.bind({
    code: 'KeyY',
    run: () => {
      for (const board of where.values()) {
        if (!board.aimed) continue;
        board.held = null;
        net.send({ t: 'chess.new', board: board.piece.id });
        toast('♟️ A new game');
        return true;
      }
      return false;
    },
  });

  ctx.ticks.add('play', () => {
    lookForBoards();
    for (const board of boards.values()) {
      // The catalog editor can move the whole set after it was discovered; the interaction follows it.
      board.spot.x = board.piece.at.x;
      board.spot.y = board.piece.at.y;
      board.spot.z = board.piece.at.z;
      const game = gameOf(board.piece.id);
      // The pieces follow the position rather than the other way round: a move that arrived from the
      // server, or from the other browser, is the same thing here as your own.
      if (board.laid !== game.fen) {
        layout(board, game);
        board.laid = game.fen;
        // A move from the other player makes a square selected against the old position meaningless.
        board.held = null;
      }
      const near = aim(board);
      if (near === null || near > REACH) board.aimed = null;
      drawMarks(board, game);
    }
  });

  /** How a game stands, for anything that wants to say it (the hint bar's own line is above). */
  return { status: (id: string) => statusOf(gameOf(id)) };
}
