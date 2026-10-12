// Carrying a piece of furniture about the room: what you look at is outlined with its name, E picks it
// up, and while you have it the piece follows your aim along the floor. Put it down and it's saved;
// Esc puts it back where you found it. Nothing here draws a window: you look, you pick up, you walk.

import * as THREE from 'three';
import { FLOOR } from '../../../shared/layout';
import { change, placements, type Placed, type Placements } from '../../../shared/placement';
import { applyPiece, pieceOf, placedPieces, type Piece, type Room } from '../../world/office/placed';
import { textSprite } from '../../world/toon';

/** A quarter of a metre: fine enough to line a shelf up with a board, coarse enough to stay on the grid. */
const SNAP = 0.25;
/** How far past the floor's edge a piece may still stand. */
const MARGIN = 0.4;
/** The middle of the screen: what you're looking at, in first person or in third. */
const CENTRE = new THREE.Vector2(0, 0);

export interface CarryDeps {
  /** Tells the office where the furniture goes now (see layout.set). */
  save(file: Placements): void;
  /** The hint bar redraws: what you're carrying, and what the keys do now. */
  changed(): void;
}

export class Carrying {
  private raycaster = new THREE.Raycaster();
  private floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private at = new THREE.Vector3();
  /** What the look is on, and how far off it is: a window and a piece can stand behind each other. */
  private aimedAt: { piece: Piece; distance: number } | null = null;
  private held: Piece | null = null;
  /** Where the piece you're carrying was when you picked it up, for Esc. */
  private from: Placed | null = null;
  private marker = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.45, depthWrite: false }),
  );
  private tag = textSprite('', { bg: '#ffd166', color: '#2b2d42', size: 34 });

  constructor(
    private room: Room & { group: THREE.Object3D },
    private camera: THREE.PerspectiveCamera,
    private deps: CarryDeps,
  ) {
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.tag.visible = false;
    room.group.parent?.add(this.marker);
    room.group.parent?.add(this.tag);
  }

  /** Whether you're arranging the room at all. */
  get on(): boolean {
    return this.aimedAt !== null || this.held !== null || this.moving;
  }

  private moving = false;

  /** What you're carrying, if anything. */
  get carrying(): Piece | null {
    return this.held;
  }

  /** The piece of furniture the look is on, if any (see aimDistance). */
  get aimed(): Piece | null {
    return this.aimedAt?.piece ?? null;
  }

  /** How far off that piece is, for whoever has to choose between it and something else under the same look. */
  get aimDistance(): number {
    return this.aimedAt?.distance ?? Infinity;
  }

  /** Into the room's furniture, and out again. */
  toggle(): void {
    if (this.moving) this.stop();
    else {
      this.moving = true;
      this.deps.changed();
    }
  }

  /** Out of it: anything in your hands goes back where you picked it up. */
  stop(): void {
    if (this.held) this.putBack();
    this.moving = false;
    this.aimedAt = null;
    this.mark(null, '');
    this.deps.changed();
  }

  /** Esc, or anything that stops the mode: the piece goes back untouched. */
  putBack(): void {
    const piece = this.held;
    if (!piece || !this.from) return;
    this.place(piece, this.from, false);
    this.held = null;
    this.from = null;
  }

  /** Every frame: what you're looking at, or where the piece in your hands is going. */
  update(): void {
    if (!this.moving) return;
    this.raycaster.setFromCamera(CENTRE, this.camera);
    if (this.held) {
      // Carry it over a plane the look-ray actually meets: looking down, the floor it stands on (a couch
      // in the loft follows the loft's floor); looking up, the height it hangs at (a board two metres up,
      // with your eye below it). The other plane is never reached from your eye, and the piece would sit
      // there and not move at all.
      const floorY = this.held.colliders.reduce((y, box) => Math.max(y, box.bottom ?? 0), 0);
      const hangY = this.held.parts[0]!.position.y;
      this.floor.constant = -(this.raycaster.ray.direction.y < 0 ? floorY : hangY);
      const at = this.raycaster.ray.intersectPlane(this.floor, this.at);
      if (!at) return;
      const x = this.snap(at.x, FLOOR.minX + MARGIN, FLOOR.maxX - MARGIN);
      const z = this.snap(at.z, FLOOR.minZ + MARGIN, FLOOR.maxZ - MARGIN);
      this.place(this.held, { ...this.held.at, x, z, hidden: false }, false);
      return;
    }
    const at = this.lookingAt();
    const changed = (at?.piece ?? null) !== (this.aimedAt?.piece ?? null);
    this.aimedAt = at;
    this.mark(at?.piece ?? null, at ? 'E to pick it up' : '');
    if (changed) this.deps.changed();
  }

  /** The piece under what you're looking at, if there is one, and how far off it is. */
  private lookingAt(): { piece: Piece; distance: number } | null {
    for (const hit of this.raycaster.intersectObject(this.room.group, true)) {
      const piece = pieceOf(hit.object);
      if (piece && !piece.at.hidden) return { piece, distance: hit.distance };
    }
    return null;
  }

  /** Picks up what you're looking at. Says whether you took anything. */
  pickUp(): boolean {
    const piece = this.aimedAt?.piece;
    if (!piece) return false;
    this.held = piece;
    this.from = { ...piece.at };
    this.deps.changed();
    return true;
  }

  /** Puts down what you're carrying, where you're looking, and writes it down. */
  putDown(): boolean {
    const piece = this.held;
    if (!piece) return false;
    this.held = null;
    this.from = null;
    this.deps.save(placements());
    this.deps.changed();
    return true;
  }

  /** A quarter turn to the right (`back` for the other way), while you carry it. */
  turn(back = false): boolean {
    const piece = this.held;
    if (!piece) return false;
    this.place(piece, { ...piece.at, rotY: piece.at.rotY + (back ? -1 : 1) * (Math.PI / 2) }, false);
    return true;
  }

  /** Out of the room for good: it's saved as gone, and the colliders and its use-point go with it. */
  takeAway(): boolean {
    const piece = this.held;
    if (!piece) return false;
    this.place(piece, { ...piece.at, hidden: true }, true);
    this.held = null;
    this.from = null;
    this.deps.save(placements());
    this.deps.changed();
    return true;
  }

  /** A piece standing in the room again, from the panel's ✕ or from a saved file that said so. */
  bringBack(piece: Piece): void {
    this.place(piece, { ...piece.at, hidden: false }, true);
    this.deps.save(placements());
    this.deps.changed();
  }

  /** Every piece the room can move, in the order it was built. */
  pieces(): readonly Piece[] {
    return this.roomPieces;
  }

  private get roomPieces(): readonly Piece[] {
    return placedPieces();
  }

  private snap(n: number, lo: number, hi: number): number {
    const v = Math.round(n / SNAP) * SNAP;
    return Math.min(hi, Math.max(lo, Math.round(v * 100) / 100));
  }

  /** Shows which piece the marker is under, and what it's called. */
  private mark(piece: Piece | null, hint: string): void {
    this.marker.visible = !!piece;
    this.tag.visible = !!piece;
    if (piece) {
      this.marker.position.set(piece.at.x, 0.03, piece.at.z);
      this.tag.position.set(piece.at.x, 1.9, piece.at.z);
    }
    void hint;
  }

  /** One move: the room does it, and the working file remembers it. */
  private place(piece: Piece, at: Placed, remember: boolean): void {
    change(piece.id, piece.base, at);
    applyPiece(piece, at, this.room);
    if (this.held === piece) this.mark(piece, '');
    if (remember) this.deps.changed();
  }
}
