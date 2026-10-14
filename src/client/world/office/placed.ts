// The furniture the editor can pick up, and what "picking it up" means: a piece says who it is (its id,
// where layout.ts puts it, what belongs to it), and everything else about moving or deleting it is here,
// so no builder has to know how a piece is dragged. Moving is exact: the parts, the colliders and the
// use-point all turn together about the piece's own middle, and a piece put out of the room takes its
// colliders and its use-point with it (see features/layout-editor for the hands that do this).

import * as THREE from 'three';
import { place, placeAdded, scaleOf, type Base, type Placed } from '../../../shared/placement';
import type { Collider, Interactable } from '../types';

/** The room a piece joins: the lists its colliders and its use-point go in (see Site in fixture.ts). */
export interface Room {
  colliders: Collider[];
  interactables: Interactable[];
}

/** The room something new is being put in: the lists its colliders go in, and the group it's drawn in. */
export type AdditionRoom = Room & { group: THREE.Object3D };

/** Where something the editor adds is being put down: its middle on the floor, and the way it faces. */
export interface Spot {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

/** What building one thing made: what it's made of, what the room walks into, and what it does each
 *  frame (the fountain's water), if anything. */
export interface Built {
  group: THREE.Object3D;
  colliders: Collider[];
  update?: (t: number) => void;
}

/**
 * A box round a footprint `w` by `d` at (x, z), turned `rotY` and standing `y` up: the same box this
 * file would write if it turned one, exact at the quarter turns things are put down at.
 */
export function footprint(x: number, z: number, w: number, d: number, rotY: number, y: number, height: number): Collider {
  const c = Math.abs(Math.cos(rotY));
  const s = Math.abs(Math.sin(rotY));
  const hx = (w * c + d * s) / 2;
  const hz = (w * s + d * c) / 2;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, bottom: y, top: y + height };
}

/** One piece of furniture, as its builder declared it: what to move, and what moves with it. */
export interface Piece {
  id: string;
  /** Where the room built it — how high included, which is what the editor's own height is measured
   *  from. An addition has no base in layout.ts at all: the file's entry is its whole self (see
   *  placeAdded). */
  base: { x: number; z: number; rotY: number; y: number };
  /** Every object that makes the piece up, moved together: its group, and anything the builder left beside it. */
  parts: THREE.Object3D[];
  /** Its footprint, in world coordinates, as built at the base. */
  colliders: Collider[];
  /** Its use-point, if it has one. */
  interact: Interactable | null;
  /** Where it stands now: the base, or what the editor saved. */
  at: Placed;
  /**
   * A piece the editor added off the catalog (see shared/catalog): it has no base in layout.ts, so it
   * stands only where the file says (see placeAdded and applyPlacements).
   */
  added: boolean;
}

/** Every piece the room has declared, in the order they were built. */
const pieces: Piece[] = [];
const byPart = new WeakMap<THREE.Object3D, Piece>();
/** What each part measured when it was built: what a piece grows *from*, so turning the wheel up and
 *  down again comes back to exactly the size it started at. (A part nobody built is its own base.)
 */
const baseScale = new WeakMap<THREE.Object3D, THREE.Vector3>();

/** Forgets the room that was built before: a floor's pieces are declared as it is built. */
export function clearPieces(): void {
  pieces.length = 0;
}

/** What the room has that can be picked up. */
export function placedPieces(): readonly Piece[] {
  return pieces;
}

/** The piece an object belongs to, if it is part of one: the editor picks by walking up to here. */
export function pieceOf(object: THREE.Object3D | null): Piece | undefined {
  for (let o = object; o; o = o.parent) {
    const piece = byPart.get(o);
    if (piece) return piece;
  }
  return undefined;
}

/** Adds something built beside a piece to the piece itself: the sign over a desk is made with the
 *  signs, and belongs to the desk, so a desk that moves takes its sign with it (see world/desksigns.ts). */
export function addToPiece(id: string, part: THREE.Object3D): void {
  const piece = pieces.find((p) => p.id === id);
  if (!piece) return;
  piece.parts.push(part);
  byPart.set(part, piece);
  baseScale.set(part, part.scale.clone());
}

/** Takes it off again, for one being built anew: a piece keeps no part nobody owns. */
export function removeFromPiece(part: THREE.Object3D): void {
  const piece = byPart.get(part);
  if (!piece) return;
  piece.parts.splice(piece.parts.indexOf(part), 1);
  byPart.delete(part);
}

/**
 * Declares a piece of furniture (see features/jukebox/world.ts and the others): `parts` are moved
 * together — its group, plus anything the builder added to the room beside it (a sign, a plaque) — and
 * `colliders` are what the room walks into, so they travel with it. `added` is for a piece the editor
 * itself put there, off the catalog: the file is its only base (see placeAdded). Returns the piece, for
 * the builder that wants to keep hold of it (the catalog hands one straight to the editor's hands).
 */
export function placed(
  parts: THREE.Object3D | THREE.Object3D[],
  id: string,
  base: Base,
  colliders: Collider[] = [],
  room?: Room,
  added = false,
): Piece {
  const list = Array.isArray(parts) ? parts : [parts];
  const first = list[0];
  const interact = (first.userData.interact as Interactable | undefined) ?? null;
  const piece: Piece = {
    id,
    base: { x: base.x, z: base.z, rotY: base.rotY ?? 0, y: base.y ?? first.position.y },
    parts: list,
    colliders,
    interact,
    added,
    // Where the piece stands *now*: as the room built it, which for every piece includes how high that
    // was (see the carry: a board two metres up is lifted from two metres, and a desk on the floor from
    // the floor). What the file says is a target, applied by the caller (and by the office, when the
    // floor's file arrives): a move needs a real starting point, or a piece with a saved place would be
    // "moved" from where it is to where it is.
    at: { x: base.x, z: base.z, rotY: base.rotY ?? 0, y: base.y ?? first.position.y, hidden: false },
  };
  pieces.push(piece);
  for (const part of list) {
    byPart.set(part, piece);
    baseScale.set(part, part.scale.clone());
  }
  // Straight away, so a piece the file took out never joins the room's colliders or what you can use.
  if (room) applyPiece(piece, added ? placeAdded(id, base) : place(id, base), room);
  return piece;
}

/** Turns a part about the piece's middle — where it stands now, not where it was built, so a quarter
 *  turn turns it on the spot and the piece's own middle doesn't travel. */
function turn(part: THREE.Object3D, piece: Piece, dx: number, dz: number, drot: number): void {
  const px = part.position.x - piece.at.x;
  const pz = part.position.z - piece.at.z;
  if (drot) {
    const c = Math.cos(drot);
    const s = Math.sin(drot);
    part.position.set(piece.at.x + px * c + pz * s, part.position.y, piece.at.z + -px * s + pz * c);
    part.rotation.y += drot;
  }
  part.position.x += dx;
  part.position.z += dz;
}

/** A collider's box, turned about a piece's middle (an axis-aligned box round the turned one, which is
 *  exact at the quarter turns the editor works in and safe at any other). */
function turnBox(box: Collider, piece: Piece, x: number, z: number, drot: number): void {
  const cx = (box.minX + box.maxX) / 2 - piece.at.x;
  const cz = (box.minZ + box.maxZ) / 2 - piece.at.z;
  const hx = (box.maxX - box.minX) / 2;
  const hz = (box.maxZ - box.minZ) / 2;
  const c = Math.abs(Math.cos(drot));
  const s = Math.abs(Math.sin(drot));
  const ncx = piece.at.x + cx * Math.cos(drot) + cz * Math.sin(drot);
  const ncz = piece.at.z + -cx * Math.sin(drot) + cz * Math.cos(drot);
  const nhx = hx * c + hz * s;
  const nhz = hx * s + hz * c;
  // Written into the box itself, never a new one: the room's list of what's in the way holds this very
  // object, so replacing it would leave the old shape standing where the piece used to be.
  box.minX = ncx - nhx + x;
  box.maxX = ncx + nhx + x;
  box.minZ = ncz - nhz + z;
  box.maxZ = ncz + nhz + z;
}

/**
 * Puts a piece where its placement says: the parts and their colliders turn and move as one, and a piece
 * that was deleted leaves the room — hidden, out of the room's colliders, and out of what you can use.
 * Called as the room is built (see buildOffice) and again by the editor while you drag.
 *
 * A piece may also come back a different size (see features/layout-editor): the parts grow about the
 * piece's own middle — so a bigger pot sits on the same spot and still stands on the floor — and its
 * colliders grow with them, since a fountain twice the size is also twice as much to walk into. And it
 * may come back higher than it was: a thing the editor lifted stays where it was left, in the air, with
 * what you walk into following it up there.
 */
export function applyPiece(piece: Piece, at: Placed, room?: Room): void {
  // A placement that says nothing about a height isn't asking for the floor: it is one of the room's own
  // pieces whose file states no height (see Placed.y), or a caller that is only moving the piece across
  // the room. The piece keeps the height it has — a thing left up in the air needs that, since the
  // floor's file comes round on every save — and keeps it for good, since the next lift is measured from
  // where it stands.
  const height = at.y ?? piece.at.y ?? 0;
  if (at.y === undefined) at = { ...at, y: height };
  const dx = at.x - piece.at.x;
  const dz = at.z - piece.at.z;
  const dy = height - (piece.at.y ?? 0);
  const drot = at.rotY - piece.at.rotY;
  const s = scaleOf(at);
  const grow = s / scaleOf(piece.at);
  const hiding = at.hidden !== piece.at.hidden;
  for (const part of piece.parts) {
    turn(part, piece, dx, dz, drot);
    if (dy) part.position.y += dy;
    if (grow !== 1) rescale(part, s);
    if (hiding) part.visible = !at.hidden;
  }
  if (dx || dz || dy || drot || grow !== 1) {
    for (const box of piece.colliders) {
      if (dx || dz || drot) turnBox(box, piece, dx, dz, drot);
      if (dy) liftBox(box, dy);
      if (grow !== 1) growBox(box, at.x, at.z, grow);
    }
    // A use-point goes wherever its piece goes, up included: a board lifted two metres is still the
    // board you press E at, and the place you reach it from is up there with it.
    if (piece.interact) {
      if (dy && piece.interact.y !== undefined) piece.interact.y += dy;
      if (dx || dz || drot) {
        const x = piece.interact.x - piece.at.x;
        const z = (piece.interact.z ?? 0) - piece.at.z;
        piece.interact.x = piece.at.x + x * Math.cos(drot) + z * Math.sin(drot) + dx;
        piece.interact.z = piece.at.z + -x * Math.sin(drot) + z * Math.cos(drot) + dz;
      }
    }
  }
  if (hiding && room) {
    setIn(room.colliders, piece.colliders, !at.hidden);
    if (piece.interact) setIn(room.interactables, [piece.interact], !at.hidden);
  }
  piece.at = at;
}

/** A part, set to `s` times the size it was built at — always from that size, never from wherever it
 *  last ended up, so a piece turned up and back down again is exactly the size it came. */
function rescale(part: THREE.Object3D, s: number): void {
  let base = baseScale.get(part);
  if (!base) baseScale.set(part, (base = part.scale.clone()));
  part.scale.copy(base).multiplyScalar(s);
}

/** A collider's box, moved up or down with the piece: it is what stands where the piece stands, so it
 *  goes into the air with it and comes back down with it. */
function liftBox(box: Collider, dy: number): void {
  if (box.bottom !== undefined) box.bottom += dy;
  if (box.top !== undefined) box.top += dy;
}

/** A collider's box, grown about the middle of the piece and the floor it stands on: wider, but no
 *  taller off the ground, which is what standing on the same spot means. */
function growBox(box: Collider, cx: number, cz: number, by: number): void {
  box.minX = cx + (box.minX - cx) * by;
  box.maxX = cx + (box.maxX - cx) * by;
  box.minZ = cz + (box.minZ - cz) * by;
  box.maxZ = cz + (box.maxZ - cz) * by;
  const bottom = box.bottom ?? 0;
  if (box.top !== undefined) box.top = bottom + (box.top - bottom) * by;
}

/** Whether the room's own list still holds these: taken out for a deleted piece, put back for one that
 *  returns. */
function setIn<T>(list: T[], items: readonly T[], inside: boolean): void {
  for (const item of items) {
    if (inside) {
      if (list.indexOf(item) < 0) list.push(item);
      continue;
    }
    // Every copy: a collider left behind is an invisible wall.
    for (let at = list.indexOf(item); at >= 0; at = list.indexOf(item)) list.splice(at, 1);
  }
}

/**
 * Takes a piece out of the room for good: out of the scene, out of what's in the way, out of what you can
 * use, and out of the room's own list of pieces — so what is saved next no longer names it.
 *
 * Cancelling is not this: a cancelled piece stays where it is, hidden, and can be put back. What is
 * discarded cannot (see forget in shared/placement, which takes its line out of the file).
 */
export function discardPiece(piece: Piece, room: Room): void {
  setIn(room.colliders, piece.colliders, false);
  if (piece.interact) setIn(room.interactables, [piece.interact], false);
  for (const part of piece.parts) part.parent?.remove(part);
  const at = pieces.indexOf(piece);
  if (at >= 0) pieces.splice(at, 1);
}

/** Puts every piece the room declared where the saved file says: an addition of the editor's only
 *  where *this* floor's file has it (see placeAdded), the rest wherever layout.ts put them. */
export function applyPlacements(room: Room): void {
  for (const piece of pieces) {
    applyPiece(piece, piece.added ? placeAdded(piece.id, piece.base) : place(piece.id, piece.base), room);
  }
}

/** A quarter turn, the step the editor works in: the colliders stay square, and furniture sits square
 *  against a wall the way the room was built. */
export const QUARTER = Math.PI / 2;
