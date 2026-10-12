// The furniture the editor can pick up, and what "picking it up" means: a piece says who it is (its id,
// where layout.ts puts it, what belongs to it), and everything else about moving or deleting it is here,
// so no builder has to know how a piece is dragged. Moving is exact: the parts, the colliders and the
// use-point all turn together about the piece's own middle, and a piece put out of the room takes its
// colliders and its use-point with it (see features/layout-editor for the hands that do this).

import * as THREE from 'three';
import { place, type Base, type Placed } from '../../../shared/placement';
import type { Collider, Interactable } from '../types';

/** The room a piece joins: the lists its colliders and its use-point go in (see Site in fixture.ts). */
export interface Room {
  colliders: Collider[];
  interactables: Interactable[];
}

/** One piece of furniture, as its builder declared it: what to move, and what moves with it. */
export interface Piece {
  id: string;
  base: Required<Base>;
  /** Every object that makes the piece up, moved together: its group, and anything the builder left beside it. */
  parts: THREE.Object3D[];
  /** Its footprint, in world coordinates, as built at the base. */
  colliders: Collider[];
  /** Its use-point, if it has one. */
  interact: Interactable | null;
  /** Where it stands now: the base, or what the editor saved. */
  at: Placed;
}

/** Every piece the room has declared, in the order they were built. */
const pieces: Piece[] = [];
const byPart = new WeakMap<THREE.Object3D, Piece>();

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

/**
 * Declares a piece of furniture (see features/jukebox/world.ts and the others): `parts` are moved
 * together — its group, plus anything the builder added to the room beside it (a sign, a plaque) — and
 * `colliders` are what the room walks into, so they travel with it.
 */
export function placed(
  parts: THREE.Object3D | THREE.Object3D[],
  id: string,
  base: Base,
  colliders: Collider[] = [],
  room?: Room,
): void {
  const list = Array.isArray(parts) ? parts : [parts];
  const first = list[0];
  const interact = (first.userData.interact as Interactable | undefined) ?? null;
  const piece: Piece = {
    id,
    base: { x: base.x, z: base.z, rotY: base.rotY ?? 0 },
    parts: list,
    colliders,
    interact,
    at: place(id, base),
  };
  pieces.push(piece);
  for (const part of list) byPart.set(part, piece);
  // Straight away, so a piece the file took out never joins the room's colliders or what you can use.
  if (room) applyPiece(piece, piece.at, room);
}

/** Where a piece's middle is, and how far round it is turned, from a placement. */
function turn(part: THREE.Object3D, piece: Piece, dx: number, dz: number, drot: number): void {
  const px = part.position.x - piece.base.x;
  const pz = part.position.z - piece.base.z;
  if (drot) {
    const c = Math.cos(drot);
    const s = Math.sin(drot);
    part.position.set(piece.base.x + px * c + pz * s, part.position.y, piece.base.z + -px * s + pz * c);
    part.rotation.y += drot;
  }
  part.position.x += dx;
  part.position.z += dz;
}

/** A collider's box, turned about a piece's middle (an axis-aligned box round the turned one, which is
 *  exact at the quarter turns the editor works in and safe at any other). */
function turnBox(box: Collider, piece: Piece, x: number, z: number, drot: number): Collider {
  const cx = (box.minX + box.maxX) / 2 - piece.base.x;
  const cz = (box.minZ + box.maxZ) / 2 - piece.base.z;
  const hx = (box.maxX - box.minX) / 2;
  const hz = (box.maxZ - box.minZ) / 2;
  const c = Math.abs(Math.cos(drot));
  const s = Math.abs(Math.sin(drot));
  const ncx = piece.base.x + cx * Math.cos(drot) + cz * Math.sin(drot);
  const ncz = piece.base.z + -cx * Math.sin(drot) + cz * Math.cos(drot);
  const nhx = hx * c + hz * s;
  const nhz = hx * s + hz * c;
  return { ...box, minX: ncx - nhx + x, maxX: ncx + nhx + x, minZ: ncz - nhz + z, maxZ: ncz + nhz + z };
}

/**
 * Puts a piece where its placement says: the parts and their colliders turn and move as one, and a piece
 * that was deleted leaves the room — hidden, out of the room's colliders, and out of what you can use.
 * Called as the room is built (see buildOffice) and again by the editor while you drag.
 */
export function applyPiece(piece: Piece, at: Placed, room?: Room): void {
  const dx = at.x - piece.at.x;
  const dz = at.z - piece.at.z;
  const drot = at.rotY - piece.at.rotY;
  const hiding = at.hidden !== piece.at.hidden;
  for (const part of piece.parts) {
    turn(part, piece, dx, dz, drot);
    if (hiding) part.visible = !at.hidden;
  }
  if (dx || dz || drot) {
    for (let i = 0; i < piece.colliders.length; i++) {
      piece.colliders[i] = turnBox(piece.colliders[i], piece, dx, dz, drot);
    }
    if (piece.interact) {
      const x = piece.interact.x - piece.at.x;
      const z = (piece.interact.z ?? 0) - piece.at.z;
      piece.interact.x = piece.at.x + x * Math.cos(drot) + z * Math.sin(drot) + dx;
      piece.interact.z = piece.at.z + -x * Math.sin(drot) + z * Math.cos(drot) + dz;
    }
  }
  if (hiding && room) {
    setIn(room.colliders, piece.colliders, !at.hidden);
    if (piece.interact) setIn(room.interactables, [piece.interact], !at.hidden);
  }
  piece.at = at;
}

/** Whether the room's own list still holds these: taken out for a deleted piece, put back for one that
 *  returns. */
function setIn<T>(list: T[], items: readonly T[], inside: boolean): void {
  for (const item of items) {
    const at = list.indexOf(item);
    if (inside && at < 0) list.push(item);
    else if (!inside && at >= 0) list.splice(at, 1);
  }
}

/** Puts every piece the room declared where the saved file says. */
export function applyPlacements(room: Room): void {
  for (const piece of pieces) applyPiece(piece, place(piece.id, piece.base), room);
}

/** A quarter turn, the step the editor works in: the colliders stay square, and furniture sits square
 *  against a wall the way the room was built. */
export const QUARTER = Math.PI / 2;
