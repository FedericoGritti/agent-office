// Carrying a piece of furniture about the room: what you look at is outlined with its name, E picks it
// up, and while you have it the piece follows your aim along the floor. Put it down and it's saved;
// Esc puts it back where you found it. Nothing here draws a window: you look, you pick up, you walk.

import * as THREE from 'three';
import { FLOOR, LOFT, WALL_HEIGHT } from '../../../shared/layout';
import { change, liftBy, placements, resizeBy, scaleOf, type Placed, type Placements } from '../../../shared/placement';
import { applyPiece, pieceOf, placedPieces, QUARTER, type Piece, type Room } from '../../world/office/placed';
import { textSprite } from '../../world/toon';

/** A quarter of a metre: fine enough to line a shelf up with a board, coarse enough to stay on the grid. */
const SNAP = 0.25;
/** How far past the floor's edge a piece may still stand. */
const MARGIN = 0.4;
/** How far in front of you a thing picked off the catalog lands. */
const AHEAD = 2.2;
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
  private aimed: Piece | null = null;
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
    return this.aimed !== null || this.held !== null || this.moving;
  }

  private moving = false;

  /** What you're carrying, if anything. */
  get carrying(): Piece | null {
    return this.held;
  }

  /**
   * Where a thing picked off the catalog lands (see ui.ts and world/office/catalog.ts): a couple of
   * metres in front of you, on the room's grid and inside the floor's edge, at the height of the floor
   * you're standing on (up on the loft, on the loft's own floor), turned a quarter turn to face you.
   */
  spotAhead(pos: THREE.Vector3, facing: number): { x: number; y: number; z: number; rotY: number } {
    const x = this.snap(pos.x + Math.sin(facing) * AHEAD, FLOOR.minX + MARGIN, FLOOR.maxX - MARGIN);
    const z = this.snap(pos.z + Math.cos(facing) * AHEAD, FLOOR.minZ + MARGIN, FLOOR.maxZ - MARGIN);
    const turn = (((facing + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return { x, y: pos.y > LOFT.y / 2 ? LOFT.y : 0, z, rotY: Math.round(turn / QUARTER) * QUARTER };
  }

  /** Takes a piece the catalog just added in hand, so it can be put where it goes straight away. */
  hold(piece: Piece): void {
    this.held = piece;
    this.from = { ...piece.at };
    this.deps.changed();
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
    this.aimed = null;
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
      const to = this.destination(this.held);
      if (to) this.place(this.held, { ...this.held.at, ...to, hidden: false }, false);
      return;
    }
    const piece = this.lookingAt();
    const changed = piece !== this.aimed;
    this.aimed = piece;
    this.mark(piece, piece ? 'E to pick it up' : '');
    if (changed) this.deps.changed();
  }

  /**
   * Where the piece in your hands goes: its place on the room's 25 cm grid, keeping the height it has.
   * Across the room it follows the aim on that height: looking down, it is the floor it stands on (a
   * couch in the loft follows the loft's floor); looking up, the height it hangs at (a board two metres
   * up, with your eye below it). The height itself is not the aim's to change but the editor's (see
   * `raise`), and a piece of the room's own has none to change at all.
   */
  private destination(piece: Piece): { x: number; z: number } | null {
    const height = piece.at.y ?? (this.raycaster.ray.direction.y < 0 ? this.standingAt(piece) : piece.parts[0]!.position.y);
    const at = this.across(piece, height);
    if (!at) return null;
    return {
      x: this.snap(at.x, FLOOR.minX + MARGIN, FLOOR.maxX - MARGIN),
      z: this.snap(at.z, FLOOR.minZ + MARGIN, FLOOR.maxZ - MARGIN),
    };
  }

  /**
   * Where your look puts the piece across the room: the point where the ray crosses the height it is at,
   * or — a height your eye never crosses, like looking up at something standing on the floor — the point
   * on the line of sight at the distance the piece already had. The plane is what lets it be put down
   * exactly where you are looking, at any distance; the line of sight is what keeps it moving when that
   * plane isn't there to be crossed.
   */
  private across(piece: Piece, height: number): THREE.Vector3 | null {
    const { origin, direction } = this.raycaster.ray;
    if ((height - origin.y) * direction.y > 0) {
      this.floor.constant = -height;
      return this.raycaster.ray.intersectPlane(this.floor, this.at);
    }
    const middle = piece.parts[0]!.position;
    const along = (middle.x - origin.x) * direction.x + (middle.y - origin.y) * direction.y + (middle.z - origin.z) * direction.z;
    return this.at.copy(origin).addScaledVector(direction, Math.max(along, AHEAD));
  }

  /** The height a piece of the room's own stands at: the bottom of what it fills, which is the floor it
   *  was built on. */
  private standingAt(piece: Piece): number {
    return piece.colliders.reduce((y, box) => Math.max(y, box.bottom ?? 0), 0);
  }

  /** The highest a thing may be left standing: the room's ceiling less its own height, so a tall model
   *  held up over the loft doesn't end up standing through the roof. */
  private ceilingFor(piece: Piece): number {
    const tall = piece.colliders.reduce((h, box) => Math.max(h, (box.top ?? 0) - (box.bottom ?? 0)), 0);
    return Math.max(0, WALL_HEIGHT - tall);
  }

  /** The piece under what you're looking at, if there is one. */
  private lookingAt(): Piece | null {
    for (const hit of this.raycaster.intersectObject(this.room.group, true)) {
      const piece = pieceOf(hit.object);
      if (piece && !piece.at.hidden) return piece;
    }
    return null;
  }

  /** Picks up what you're looking at. Says whether you took anything. */
  pickUp(): boolean {
    const piece = this.aimed;
    if (!piece) return false;
    this.held = piece;
    this.from = { ...piece.at };
    this.deps.changed();
    return true;
  }

  /** Writes the room down as it stands (see layout.set): what putting a piece down does, and what
   *  adding one off the catalog does, so a new piece is saved even if nobody touches it. */
  save(): void {
    this.deps.save(placements());
  }

  /** Puts down what you're carrying, where you're looking, and writes it down. */
  putDown(): boolean {
    const piece = this.held;
    if (!piece) return false;
    this.held = null;
    this.from = null;
    this.save();
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

  /**
   * Whether what you're carrying is yours to adjust — its size, and the height it stands at: only a
   * thing the catalog added, whose file is the whole of it. The room's own furniture is where its seats,
   * its use-points and the walk map round them are measured, so neither the wheel nor the keys touch it
   * (see docs/room.md).
   */
  get adjustable(): boolean {
    return !!this.held?.added;
  }

  /** A press of the size keys goes up (`dir` > 0) or down, while you carry it: it grows about its own
   *  middle, so it stays where you're putting it and keeps standing on the height it is at. */
  resize(dir: number): boolean {
    const piece = this.held;
    if (!piece || !piece.added) return false;
    this.place(piece, { ...piece.at, scale: resizeBy(scaleOf(piece.at), dir) }, false);
    this.deps.changed();
    return true;
  }

  /**
   * A step up (`dir` > 0) or down — a press of PgUp/PgDn, or a turn of the wheel, while you carry it: a
   * quarter of a metre a step, never under the floor or through the ceiling above it (see ceilingFor).
   * It keeps its place across the room, and where you leave it is where it stays — nothing in this room
   * falls.
   */
  raise(dir: number): boolean {
    const piece = this.held;
    if (!piece || !piece.added) return false;
    this.place(piece, { ...piece.at, y: liftBy(piece.at.y ?? 0, dir, this.ceilingFor(piece)) }, false);
    this.deps.changed();
    return true;
  }

  /** How big what you're carrying is, for the hint bar to say (1 when it's as it came). */
  get size(): number {
    return this.held ? scaleOf(this.held.at) : 1;
  }

  /** How high it is, for the hint bar to say (0 when it stands on the floor). */
  get height(): number {
    return this.held?.at.y ?? 0;
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
