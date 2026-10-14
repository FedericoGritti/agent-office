// The things the editor can add to the room (see shared/catalog for the list, and
// features/layout-editor for the panel that picks them). Every kind is one builder here, and the map is
// typed with every kind of the catalog in it, so a kind nobody builds doesn't compile.
//
// An addition is a piece of furniture like any other: `placed(…, added)` declares it with the room, so
// it has its own footprint, the editor can carry it and turn it, and Canc takes it away. What is
// different is that it has no position in layout.ts to fall back on: it stands exactly where the file
// says, and nowhere when this floor's file hasn't got it (see applyCatalog below).

import * as THREE from 'three';
import { type CatalogKind } from '../../../shared/catalog';
import { spawned } from '../../../shared/placement';
import { noOutline } from '../../core/outline';
import { mesh, roundedBox, toon } from '../toon';
import type { Collider } from '../types';
import { PALETTE } from './materials';
import { applyPiece, placed, type Piece, type Room } from './placed';
import { coffeeTable, plant, type PlantSpecies } from './props';

/** Where an addition is being put down: its middle on the floor, and the way it faces. */
export interface Spot {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

/** What a builder hands back: what the piece is made of, what the room walks into, and what it does
 *  each frame (the fountain's water), if anything. */
interface Built {
  group: THREE.Object3D;
  colliders: Collider[];
  update?: (t: number) => void;
}

/** The room an addition is put in: the lists its colliders go in, and the group it is drawn in. */
export type AdditionRoom = Room & { group: THREE.Object3D };

/** Every addition standing in the room, by id, so a file arriving twice builds each one once. */
const standing = new Map<string, Piece>();
const animated: { piece: Piece; update: (t: number) => void }[] = [];

/** The number in an addition's id (`add-3`): what a builder varies on, so two rugs don't come out the
 *  same colour. */
function idNumber(id: string): number {
  return Number(/^add-(\d+)$/.exec(id)?.[1] ?? 0);
}

/**
 * A box round a footprint `w` by `d` at (x, z), turned `rotY` and standing `y` up: the same box
 * world/office/placed.ts would write if it turned one, exact at the quarter turns things are put down at.
 */
function footprint(x: number, z: number, w: number, d: number, rotY: number, y: number, height: number): Collider {
  const c = Math.abs(Math.cos(rotY));
  const s = Math.abs(Math.sin(rotY));
  const hx = (w * c + d * s) / 2;
  const hz = (w * s + d * c) / 2;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, bottom: y, top: y + height };
}

/** A pot plant of `species`, `scale` times the modelled size (see props.ts): the same pot the room's
 *  own six stand in, and the same footprint, so a pot is a pot wherever it came from. */
function potted(species: PlantSpecies, scale: number): (id: string, at: Spot) => Built {
  return (_id, at) => {
    const group = plant(species, scale);
    group.position.set(at.x, at.y, at.z);
    group.rotation.y = at.rotY;
    const foot = 0.6 * scale;
    return { group, colliders: [footprint(at.x, at.z, foot, foot, at.rotY, at.y, 0.5 * scale)] };
  };
}

/** A rug: a soft, flat box to lay on a bare stretch of floor, with no footprint — you walk over it. */
function rugOf(w: number, d: number, r: number): (id: string, at: Spot) => Built {
  return (id, at) => {
    const cloth = toon(PALETTE.rugs[idNumber(id) % PALETTE.rugs.length]);
    const group = mesh(roundedBox(w, 0.02, d, r), cloth, at.x, at.y + 0.011, at.z, false);
    group.rotation.y = at.rotY;
    return { group, colliders: [] };
  };
}

/** The round rug: a disc the same cloth, laid the same way (see rugOf). */
function roundRug(radius: number): (id: string, at: Spot) => Built {
  return (id, at) => {
    const cloth = toon(PALETTE.rugs[(idNumber(id) + 1) % PALETTE.rugs.length]);
    const disc = new THREE.CircleGeometry(radius, 28).rotateX(-Math.PI / 2);
    const group = mesh(disc, cloth, at.x, at.y + 0.011, at.z, false);
    return { group, colliders: [] };
  };
}

/** The lounge's own round table, stood wherever you want another one (see props.ts). */
function table(_id: string, at: Spot): Built {
  const group = coffeeTable();
  group.position.set(at.x, at.y, at.z);
  group.rotation.y = at.rotY;
  return { group, colliders: [footprint(at.x, at.z, 1.6, 1.6, at.rotY, at.y, 0.46)] };
}

/**
 * A fountain: a stone basin with water in it, a bowl on a column above it, and the water of that bowl
 * falling round the column back into the basin. Built out of cylinders and boxes rather than modelled,
 * like the kitchen's counters: it costs the room nothing to have one, and the jet is the one thing that
 * moves (the frame's own clock, no state of its own).
 */
function fountain(_id: string, at: Spot): Built {
  const group = new THREE.Group();
  group.position.set(at.x, at.y, at.z);
  group.rotation.y = at.rotY;
  const stone = toon('#cfc9c0');
  const stoneDark = toon('#b6b0a6');
  const water = toon('#8fd8f2', { transparent: true, opacity: 0.8 });

  /** A cylinder of `r` (top and bottom), `h` tall, standing `mid` up. */
  const pillar = (rTop: number, rBottom: number, h: number, mid: number, mat = stone, sides = 14) =>
    mesh(new THREE.CylinderGeometry(rTop, rBottom, h, sides), mat, 0, mid, 0);
  /** A disc of water `r` across, laid flat `y` up. */
  const surface = (r: number, y: number) =>
    mesh(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2), water, 0, y, 0, false);

  group.add(pillar(1.45, 1.5, 0.16, 0.08, stoneDark, 16)); // the plinth
  group.add(pillar(1.25, 1.35, 0.55, 0.43)); // the basin
  const rim = mesh(new THREE.TorusGeometry(1.25, 0.07, 8, 20), stoneDark, 0, 0.7, 0); // its lip
  rim.rotation.x = -Math.PI / 2;
  group.add(rim, surface(1.18, 0.72));

  group.add(pillar(0.18, 0.3, 0.62, 1.01, stone, 10)); // the column
  group.add(pillar(0.55, 0.26, 0.22, 1.42, stone, 14)); // the bowl
  group.add(surface(0.5, 1.54));
  const jet = mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.5, 6), water, 0, 1.78, 0, false); // what the bowl throws up
  group.add(jet);

  // The water of the bowl, falling round the column into the basin: a ring of drops, each at its own
  // place in the fall, off the frame's clock so nothing has to be remembered between frames.
  const DROPS = 8;
  const TOP = 1.44;
  const FALL = 0.74;
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < DROPS; i++) {
    const a = (i / DROPS) * Math.PI * 2;
    const drop = mesh(new THREE.SphereGeometry(0.05, 6, 5), water, Math.sin(a) * 0.52, TOP, Math.cos(a) * 0.52, false);
    drops.push(drop);
    group.add(drop);
  }
  const update = (t: number) => {
    jet.scale.y = 1 + Math.sin(t * 3) * 0.08;
    for (const [i, drop] of drops.entries()) drop.position.y = TOP - ((t * 0.8 + i / DROPS) % 1) * FALL;
  };

  return { group, colliders: [footprint(at.x, at.z, 2.8, 2.8, at.rotY, at.y, 0.7)], update };
}

/** How each kind of the catalog is built. One line per kind, so a kind with no builder doesn't compile. */
const BUILDERS: Record<CatalogKind, (id: string, at: Spot) => Built> = {
  monstera: potted('monstera', 1.5),
  'snake-plant': potted('snake_plant', 1.25),
  ficus: potted('ficus', 1.3),
  succulent: potted('succulent', 0.9),
  rug: rugOf(3.2, 2.4, 0.5),
  'round-rug': roundRug(1.5),
  'coffee-table': table,
  fountain,
};

/**
 * Builds a thing of `kind` at `at`, puts it in the room and declares it as a piece of the editor's own
 * doing. The file has to have been written first (see `spawn` in shared/placement): a piece with no
 * entry of its own is one the room puts away again.
 */
export function addPiece(kind: CatalogKind, id: string, at: Spot, room: AdditionRoom): Piece {
  const built = BUILDERS[kind](id, at);
  noOutline(built.group);
  room.group.add(built.group);
  // Into the room's own list, the way a builder does it: `placed` keeps that list and the piece in step
  // (a piece the file took away leaves it), but it never adds one nobody put there.
  room.colliders.push(...built.colliders);
  const piece = placed(built.group, id, { x: at.x, z: at.z, rotY: at.rotY }, built.colliders, room, true);
  standing.set(id, piece);
  if (built.update) animated.push({ piece, update: built.update });
  return piece;
}

/**
 * Brings the room in line with this floor's file: builds the additions it names that aren't up yet (the
 * way in, or another browser putting one down), puts the ones that are where it says, and puts away the
 * ones it hasn't got — an addition on another floor, or one taken out of the file.
 */
export function applyCatalog(room: AdditionRoom): void {
  const wanted = new Set<string>();
  for (const it of spawned()) {
    wanted.add(it.id);
    const have = standing.get(it.id);
    if (have) applyPiece(have, { x: it.x, z: it.z, rotY: it.rotY, hidden: it.deleted }, room);
    else addPiece(it.kind, it.id, { x: it.x, y: it.y, z: it.z, rotY: it.rotY }, room);
  }
  for (const [id, piece] of standing) {
    if (!wanted.has(id)) applyPiece(piece, { ...piece.at, hidden: true }, room);
  }
}

/** Runs whatever the additions do each frame (the fountain's jet): a piece taken out of the room does
 *  nothing at all. */
export function updateCatalog(t: number): void {
  for (const a of animated) if (!a.piece.at.hidden) a.update(t);
}
