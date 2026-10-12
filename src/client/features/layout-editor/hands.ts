// The hand that moves the room's furniture: what the pointer is over, what is picked up, where a drag
// puts it, and what is saved. It works on the pieces the room declared as it was built (see
// world/office/placed), so it knows nothing about a jukebox or a board — only about pieces.

import * as THREE from 'three';
import { FLOOR } from '../../../shared/layout';
import { change, placements, setPlacements, type Placed, type Placements } from '../../../shared/placement';
import { store } from '../../state';
import { toast } from '../../ui/dom';
import { applyPiece, applyPlacements, pieceOf, placedPieces, type Piece, type Room } from '../../world/office/placed';
import { textSprite } from '../../world/toon';

/** A quarter of a metre: fine enough to line a shelf up with a board, coarse enough to stay on the grid. */
const SNAP = 0.25;
/** How far past the floor's edge a piece may still stand. */
const MARGIN = 0.4;

export interface HandsDeps {
  /** Tells the office where the furniture goes now (see layout.set). */
  send(file: Placements): void;
}

export class Hands {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private at = new THREE.Vector3();
  private selected: Piece | null = null;
  private grab: { piece: Piece; offX: number; offZ: number } | null = null;
  private undoStack: Placements[] = [];
  private marker = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.45, depthWrite: false }),
  );
  private tag = textSprite('', { bg: '#ffd166', color: '#2b2d42', size: 34 });
  /** The open panel redraws itself: nobody's listening while it is shut. */
  onChanged: () => void = () => {};

  constructor(
    private room: Room & { group: THREE.Object3D },
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLElement,
    private deps: HandsDeps,
  ) {
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.tag.visible = false;
    room.group.parent?.add(this.marker);
    room.group.parent?.add(this.tag);
  }

  /** Puts the marker and the name where the picked piece stands. */
  private mark(piece: Piece | null): void {
    this.selected = piece;
    const on = !!piece && !piece.at.hidden;
    this.marker.visible = on;
    this.tag.visible = on;
    this.canvas.style.cursor = piece ? 'grab' : '';
    if (!piece) return;
    this.marker.position.set(piece.at.x, 0.03, piece.at.z);
    this.tag.position.set(piece.at.x, 1.9, piece.at.z);
  }

  selectedPiece(): Piece | null {
    return this.selected;
  }

  /** What the panel lists: every piece the room can move, deleted ones included (they come back). */
  pieces(): readonly Piece[] {
    return placedPieces();
  }

  /** Reads the pointer into the camera: the ray and, where it meets the floor, the point. */
  private pointTo(e: PointerEvent): { x: number; z: number; ndc: THREE.Vector2 } {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return { x: this.at.x, z: this.at.z, ndc: this.mouse };
  }

  /** The piece under the pointer, if there is one. */
  pickAt(e: PointerEvent): Piece | null {
    this.pointTo(e);
    const hits = this.raycaster.intersectObject(this.room.group, true);
    for (const hit of hits) {
      const piece = pieceOf(hit.object);
      if (piece && !piece.at.hidden) return piece;
    }
    return null;
  }

  /** What the pointer is over, for the highlight: called as the mouse moves with the mode on. */
  hover(e: PointerEvent): void {
    if (this.grab) return;
    const piece = this.pickAt(e);
    if (piece !== this.selected) this.mark(piece);
  }

  private snap(n: number, lo: number, hi: number): number {
    const v = Math.round(n / SNAP) * SNAP;
    return Math.min(hi, Math.max(lo, Math.round(v * 100) / 100));
  }

  /** Where the pointer is on the floor, if the ray meets it in front of the camera. */
  private floorPoint(): { x: number; z: number } | null {
    return this.raycaster.ray.intersectPlane(this.floor, this.at) ? { x: this.at.x, z: this.at.z } : null;
  }

  /** Picks up whatever is under the pointer. Says whether anything was. */
  down(e: PointerEvent): boolean {
    const piece = this.pickAt(e);
    if (!piece) return false;
    this.mark(piece);
    const pt = this.floorPoint();
    if (!pt) return false;
    this.undoStack.push({ ...placements() });
    this.grab = { piece, offX: piece.at.x - pt.x, offZ: piece.at.z - pt.z };
    this.canvas.style.cursor = 'grabbing';
    return true;
  }

  /** Follows the pointer: the piece stays where it was grabbed and moves on the grid. */
  move(): void {
    const grab = this.grab;
    const pt = grab && this.floorPoint();
    if (!grab || !pt) return;
    const piece = grab.piece;
    const x = this.snap(pt.x + grab.offX, FLOOR.minX + MARGIN, FLOOR.maxX - MARGIN);
    const z = this.snap(pt.z + grab.offZ, FLOOR.minZ + MARGIN, FLOOR.maxZ - MARGIN);
    this.place(piece, { ...piece.at, x, z, hidden: false });
    this.onChanged();
  }

  /** Lets go: what was dragged stays, anything else is nothing. */
  up(): void {
    if (!this.grab) return;
    this.grab = null;
    this.canvas.style.cursor = 'grab';
  }

  /** What the pointer has, for the keys: the editor turns and takes away what is picked. */
  select(piece: Piece | null): void {
    this.mark(piece);
  }

  /** A quarter turn to the right (`back` for the other way, which is three of them). */
  turn(piece: Piece | null, back = false): void {
    if (!piece) return;
    this.undoStack.push({ ...placements() });
    this.place(piece, { ...piece.at, rotY: piece.at.rotY + (back ? -1 : 1) * (Math.PI / 2) });
    this.onChanged();
  }

  /** Out of the room, or back into it. */
  toggleGone(piece: Piece): void {
    this.undoStack.push({ ...placements() });
    this.place(piece, { ...piece.at, hidden: !piece.at.hidden });
    this.mark(piece.at.hidden ? null : piece);
    this.onChanged();
  }

  /** Moves a piece from the panel's fields. */
  setField(piece: Piece, field: 'x' | 'z' | 'rotY', value: number): void {
    if (!Number.isFinite(value)) return;
    this.undoStack.push({ ...placements() });
    const at: Placed = { ...piece.at, x: piece.at.x, z: piece.at.z };
    if (field === 'rotY') at.rotY = value;
    else at[field] = value;
    this.place(piece, at);
    this.onChanged();
  }

  /** Back to how the room was built: every piece on its base, and every piece back in the room. */
  reset(piece?: Piece): void {
    this.undoStack.push({ ...placements() });
    if (piece) {
      change(piece.id, piece.base, { ...piece.base, hidden: false });
      applyPiece(piece, { ...piece.base, hidden: false }, this.room);
    } else {
      setPlacements({});
      applyPlacements(this.room);
      this.mark(null);
    }
    this.onChanged();
  }

  undo(): void {
    const before = this.undoStack.pop();
    if (!before) {
      toast('Nothing left to undo');
      return;
    }
    setPlacements(before);
    applyPlacements(this.room);
    this.mark(null);
    this.onChanged();
  }

  /** Says whether anything has been touched at all. */
  dirty(): boolean {
    return JSON.stringify(placements()) !== JSON.stringify(store.layout);
  }

  save(): void {
    this.deps.send(placements());
    this.undoStack = [];
    toast('The room is saved');
  }

  /** Throws the working copy away and puts the room back the way the office last saved it. */
  revert(): void {
    setPlacements(store.layout);
    applyPlacements(this.room);
    this.undoStack = [];
    this.mark(null);
    this.onChanged();
  }

  /** One move, applied to the room and remembered in the working copy. */
  private place(piece: Piece, at: Placed): void {
    change(piece.id, piece.base, at);
    applyPiece(piece, at, this.room);
    if (this.selected === piece) this.mark(piece);
    else if (!piece.at.hidden) this.mark(piece);
  }
}
