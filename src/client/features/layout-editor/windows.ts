// Carrying a window about the office's outside walls: what you look at is outlined on the wall, E takes it
// out of the wall, and while you have it, it slides along the wall you're looking at — or on to another
// one — with E putting it back in (and saving it), Canc taking it away, Esc giving it back. N puts a new
// window in the wall you're looking at and hands it to you. Nothing here draws a wall: the walls are built
// again round the list as it stands (see world/office/shell.ts).

import * as THREE from 'three';
import { FLOOR, WALL_HEIGHT, WALL_T, type Opening, type Side } from '../../../shared/layout';
import {
  baseWindow,
  changeWindow,
  newWindowId,
  removeWindow,
  sizeOn,
  wallSpan,
  WINDOW_SIDES,
  windowFits,
  windowPlacements,
  windows,
  type WindowDef,
  type WindowPlacements,
} from '../../../shared/windows';
import { onWall } from '../../world/office/materials';

/** The outline where a window can go, and where it can't: what the wall says about the spot you're aiming at. */
const FIT = '#ffd166';
const REFUSED = '#ef476f';
/** A quarter of a metre: the grid the furniture moves on, and the one a window slides along the wall on. */
const SNAP = 0.25;
/** The middle of the screen: what you're looking at, in first person or in third. */
const CENTRE = new THREE.Vector2(0, 0);
/** The wall's inner face, which is the plane a window is in as far as you can see it. */
const FACE: Record<Side, { axis: 'x' | 'z'; at: number }> = {
  north: { axis: 'z', at: FLOOR.minZ },
  south: { axis: 'z', at: FLOOR.maxZ },
  west: { axis: 'x', at: FLOOR.minX },
  east: { axis: 'x', at: FLOOR.maxX },
};
/** Which way the room is from each wall: where the outline of a window is drawn, just inside it. */
const INWARD: Record<Side, THREE.Vector3> = {
  north: new THREE.Vector3(0, 0, 1),
  south: new THREE.Vector3(0, 0, -1),
  west: new THREE.Vector3(1, 0, 0),
  east: new THREE.Vector3(-1, 0, 0),
};

export interface WindowDeps {
  /** Tells the office where the windows go now (see windows.set). */
  save(file: WindowPlacements): void;
  /** The office builds its walls again round the list as it stands (see Office.windowsChanged). */
  rebuild(): void;
  /** The banner and the hint bar redraw: what you're carrying, and what the keys do now. */
  changed(): void;
}

/** A place in a wall: which one, how far along it, how high up, and how far off it is from your eye. */
interface Spot {
  wall: Side;
  u: number;
  y: number;
  distance: number;
}

export class Windows {
  private raycaster = new THREE.Raycaster();
  /** The outline of the window you're looking at, or of the one in your hands, drawn on its wall. */
  private marker: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private moving = false;
  /** The window in your hands, and where it was when you took it (for Esc). */
  private held: WindowDef | null = null;
  private from: WindowDef | null = null;
  /** What the look is on: the window you could take out of the wall, and how far off it is. */
  private aimed: WindowDef | null = null;
  private aimedDistance = Infinity;
  /** Why the window in your hands can't go where you're looking, if it can't: what the banner says. */
  private note: string | undefined;

  constructor(
    room: { group: THREE.Object3D },
    private camera: THREE.PerspectiveCamera,
    private deps: WindowDeps,
  ) {
    this.marker = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: FIT, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.marker.visible = false;
    room.group.parent?.add(this.marker);
  }

  /** Whether you're arranging the room at all, as far as the windows go. */
  get on(): boolean {
    return this.moving || !!this.held;
  }

  /** The window in your hands, if any. */
  get carrying(): WindowDef | null {
    return this.held;
  }

  /** The window the look is on, if any: what E would take out of the wall. */
  get looking(): WindowDef | null {
    return this.aimed;
  }

  /** How far off that window is, for whoever has to choose between it and something else under the same look. */
  get aimDistance(): number {
    return this.aimedDistance;
  }

  /** Why the last move was refused, if it was: what the banner says under what you're carrying. */
  get refused(): string | undefined {
    return this.note;
  }

  /** Into the walls, and out again. */
  toggle(): void {
    if (this.moving) this.stop();
    else {
      this.moving = true;
      this.deps.changed();
    }
  }

  /** Out of it: anything in your hands goes back into the wall. */
  stop(): void {
    if (this.held) this.putBack();
    this.moving = false;
    this.aimed = null;
    this.note = undefined;
    this.show(null);
    this.deps.changed();
  }

  /** Every frame: what you're looking at, or where the window in your hands is going. */
  update(): void {
    if (!this.on) return;
    const wall = this.wallUnderLook();
    if (this.held) {
      // Aimed at the floor or the ceiling, there's no wall to put it in: it stays where it is.
      if (wall) this.moveTo(wall);
      else this.show(this.held);
      return;
    }
    // The window the look is inside of, if any: its hole in the wall is what the outline is drawn round.
    const under = wall
      ? windows().find(
          (o) => o.wall === wall.wall && wall.u >= o.u - o.width / 2 && wall.u <= o.u + o.width / 2 && wall.y >= o.y0 && wall.y <= o.y1,
        )
      : undefined;
    const changed = (under?.id ?? null) !== (this.aimed?.id ?? null);
    this.aimed = under ?? null;
    this.aimedDistance = wall?.distance ?? Infinity;
    this.show(under ?? null);
    if (changed) this.deps.changed();
  }

  /** Takes the window you're looking at out of the wall, and into your hands. Says whether you took one. */
  pickUp(): boolean {
    const window = this.aimed;
    if (!window) return false;
    this.held = { ...window };
    this.from = { ...window };
    this.aimed = null;
    this.aimedDistance = Infinity;
    this.note = undefined;
    this.show(this.held);
    this.deps.changed();
    return true;
  }

  /** Puts down what you're carrying, where it stands, and writes it down. */
  putDown(): boolean {
    if (!this.held) return false;
    this.held = null;
    this.from = null;
    this.note = undefined;
    this.deps.save(windowPlacements());
    this.deps.changed();
    return true;
  }

  /** Esc, or anything that stops the mode: the window goes back where it was — a new one, away again. */
  putBack(): void {
    const held = this.held;
    const from = this.from;
    if (!held || !from) return;
    const built = baseWindow(held.id);
    if (built) changeWindow(held.id, built, from);
    else removeWindow(held.id);
    this.held = null;
    this.from = null;
    this.note = undefined;
    this.deps.rebuild();
    this.deps.changed();
  }

  /** Out of the wall for good: no window there at all, and it's saved that way. */
  takeAway(): boolean {
    if (!this.held) return false;
    removeWindow(this.held.id);
    this.held = null;
    this.from = null;
    this.note = undefined;
    this.deps.rebuild();
    this.deps.save(windowPlacements());
    this.deps.changed();
    return true;
  }

  /**
   * N: a window the room wasn't built with, in the wall you're looking at, the size of the one nearest it
   * on that wall — and it comes into your hands, so you can slide it where you want it before E saves it.
   * Says whether it went in (the banner says why not, when it doesn't).
   */
  add(): boolean {
    const at = this.wallUnderLook();
    const span = at && wallSpan(at.wall);
    if (!at || !span) {
      this.note = 'that is not an outside wall';
      this.deps.changed();
      return false;
    }
    const size = sizeOn(at.wall, at.u, at.y);
    const candidate: Opening = {
      wall: at.wall,
      u: snap(at.u, span.lo + size.width / 2, span.hi - size.width / 2),
      ...size,
    };
    const why = windowFits(candidate.wall, candidate);
    if (why) {
      this.note = why;
      this.deps.changed();
      return false;
    }
    const held: WindowDef = { id: newWindowId(), ...candidate };
    changeWindow(held.id, undefined, held);
    this.held = held;
    this.from = held;
    this.note = undefined;
    this.aimed = null;
    this.deps.rebuild();
    this.show(held);
    this.deps.changed();
    return true;
  }

  /** Where the window in your hands is going: snapped along the wall, if it fits there. */
  private moveTo(at: Spot): void {
    const held = this.held;
    if (!held) return;
    const span = wallSpan(at.wall);
    if (!span) return;
    const candidate: Opening = {
      wall: at.wall,
      u: snap(at.u, span.lo + held.width / 2, span.hi - held.width / 2),
      width: held.width,
      y0: held.y0,
      y1: held.y1,
    };
    const why = windowFits(candidate.wall, candidate, windows(), held.id);
    this.note = why;
    // The outline shows where it would go, in red where it can't (the banner and the hint bar say why).
    this.show(candidate, !!why);
    if (why) {
      // It stays where it was: nothing moves to a place a window can't be.
      this.deps.changed();
      return;
    }
    const moved: WindowDef = { ...held, ...candidate };
    this.held = moved;
    changeWindow(moved.id, baseWindow(moved.id), moved);
    this.deps.rebuild();
    this.deps.changed();
  }

  /** Where the look meets a wall: the nearest of the room's outside ones, and where along it and how high. */
  private wallUnderLook(): Spot | undefined {
    this.raycaster.setFromCamera(CENTRE, this.camera);
    const { origin, direction } = this.raycaster.ray;
    let best: Spot | undefined;
    for (const wall of WINDOW_SIDES) {
      const face = FACE[wall];
      const d = face.axis === 'x' ? direction.x : direction.z;
      if (Math.abs(d) < 1e-6) continue;
      const t = (face.at - (face.axis === 'x' ? origin.x : origin.z)) / d;
      if (t <= 0.05 || (best && t >= best.distance)) continue;
      const y = origin.y + t * direction.y;
      const along = face.axis === 'x' ? origin.z + t * direction.z : origin.x + t * direction.x;
      const span = wallSpan(wall)!;
      if (y < 0 || y > WALL_HEIGHT || along < span.lo || along > span.hi) continue;
      best = { wall, u: along, y, distance: t };
    }
    return best;
  }

  /** Draws the outline on the wall: the window you're looking at, or the one in your hands. */
  private show(rect: Opening | null, refused = false): void {
    this.marker.visible = !!rect;
    this.marker.material.color.set(refused ? REFUSED : FIT);
    if (!rect) return;
    const at = onWall(rect.wall, rect.u);
    const inward = INWARD[rect.wall];
    this.marker.position.set(at.x + inward.x * (WALL_T / 2 + 0.03), (rect.y0 + rect.y1) / 2, at.z + inward.z * (WALL_T / 2 + 0.03));
    this.marker.rotation.set(0, at.rotY, 0);
    this.marker.scale.set(rect.width + 0.24, rect.y1 - rect.y0 + 0.2, 1);
  }
}

/** On the grid, and inside what the wall lets a window of this size do. */
function snap(n: number, lo: number, hi: number): number {
  const v = Math.round(n / SNAP) * SNAP;
  return Math.min(hi, Math.max(lo, Math.round(v * 100) / 100));
}
