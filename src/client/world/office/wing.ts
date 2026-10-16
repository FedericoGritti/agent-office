import * as THREE from 'three';
import { DESKS, DESK_SIZE, FLOOR, SLAB, WALL_HEIGHT, WALL_T, WING, WING_DESKS, deskSeat, wingMinZ, wingRowZ } from '../../../shared/layout';
import type { NightParts } from '../outside';
import { mesh, roundedBox, toon } from '../toon';
import { wingWindows } from '../tower';
import type { Collider, DeskView, Interactable } from '../types';
import type { Fixture } from './fixture';
import { PALETTE, box, type Looks } from './materials';
import { accent } from './paint';
import { buildDesk } from './seats';
import { wallRun, wetPane, windowIn } from './shell';

// The back office through the north wall, built out a row of desks at a time as the floor fills up.

/** The back office, as far as it's built out (see WING). */
export interface WingView {
  /** How many rows it's built out. */
  level: number;
  /** Builds it out `level` rows (or walls it up): walls, floor, ceiling, desks and all. */
  set(level: number): void;
}

/**
 * The back office: the bit of north wall between the gong and the east wall, which comes down when
 * the floor's built out, and behind it the bay, a row deeper each time, with a pair of desks down the
 * middle of each row, a rug beneath them and a window in the east wall. No sign says so: the wall
 * itself is what you use (see the expand interaction in features/workers/views.ts), and the hint bar
 * says what pressing E there does. Whichever wall is at the back is the one it acts on.
 */
export function buildWing(group: THREE.Group, colliders: Collider[], interactables: Interactable[], desks: Map<string, DeskView>, looks: Looks, trimMat: THREE.Material, planks: THREE.Material, ceiling: THREE.Material, night: NightParts): WingView {
  const T = WALL_T;
  const midX = (WING.minX + WING.maxX) / 2;

  // What knocks the back office out a row, or walls its last one back up: the wall at the back of it.
  // There is no sign on that wall any more — looking at the wall itself is what puts this in reach,
  // and the hint bar (features/workers/views.ts) says what pressing E there does.
  const it: Interactable = { kind: 'expand', x: midX, z: FLOOR.minZ + 0.3, radius: 2.2 };
  interactables.push(it);
  /** Marks a run of wall as the one to knock through. */
  const knockable = (wall: THREE.Object3D) =>
    wall.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.userData.interact = it;
    });

  // The wall where it goes through, standing while there's none.
  const plug = new THREE.Group();
  const plugCols: Collider[] = [];
  wallRun(plug, plugCols, 'x', FLOOR.minZ - T / 2, WING.minX, FLOOR.maxX + T, -1, [], looks, [false, true]);
  knockable(plug);
  group.add(plug);

  // Each row's desks and rug.
  const rows = Array.from({ length: WING.rows }, (_, i) => {
    const row = i + 1;
    const z = wingRowZ(row);
    const extras = new THREE.Group();
    const slot = (row + 1) % PALETTE.rugs.length;
    extras.add(mesh(roundedBox(3.4, 0.02, WING.row - 1, 0.5), accent(slot, PALETTE.rugs[slot]), midX, 0.011, z, false));
    extras.visible = false;
    group.add(extras);
    const seats = WING_DESKS.filter((d) => d.wing === row).map((def) => {
      const view = buildDesk(def, DESKS.length + WING_DESKS.indexOf(def), trimMat);
      view.group.visible = false;
      group.add(view.group);
      desks.set(def.id, view);
      const hw = DESK_SIZE.width / 2 - 0.05;
      const hd = DESK_SIZE.depth / 2 - 0.02;
      const collider: Collider = { minX: def.x - hw, maxX: def.x + hw, minZ: def.z - hd, maxZ: def.z + hd, top: DESK_SIZE.height };
      const at = deskSeat(def, 1.25);
      const it: Interactable = { kind: 'desk', deskId: def.id, x: at.x, z: at.z, radius: 1.3, off: true };
      interactables.push(it);
      view.group.userData.interact = it;
      return { view, collider, it };
    });
    return { extras, seats };
  });

  let built: THREE.Object3D[] = [];
  let mine: Collider[] = [];
  const view: WingView = {
    level: -1,
    set(level) {
      level = Math.max(0, Math.min(WING.rows, level));
      if (level === view.level) return;
      view.level = level;
      for (const o of built) {
        o.removeFromParent();
        o.traverse((m) => {
          if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).geometry.dispose();
        });
      }
      built = [];
      for (const c of mine) {
        const i = colliders.indexOf(c);
        if (i >= 0) colliders.splice(i, 1);
      }
      mine = [];
      const take = (o: THREE.Object3D) => {
        group.add(o);
        built.push(o);
        return o;
      };

      plug.visible = level === 0;
      if (level === 0) mine.push(...plugCols);
      rows.forEach(({ extras, seats }, i) => {
        const on = i < level;
        extras.visible = on;
        for (const s of seats) {
          s.view.group.visible = on;
          s.it.off = !on;
          if (on) mine.push(s.collider);
        }
      });

      const back = wingMinZ(level);
      if (level > 0) {
        const shell = new THREE.Group();
        wallRun(shell, mine, 'z', WING.minX - T / 2, back, FLOOR.minZ - T, -1, [], looks, [false, false]);
        const windows = wingWindows(level);
        wallRun(shell, mine, 'z', FLOOR.maxX + T / 2, back, FLOOR.minZ, 1, windows, looks, [false, false]);
        // The wall at the back, which is the one E knocks through from here on.
        const backWall = new THREE.Group();
        wallRun(backWall, mine, 'x', back - T / 2, WING.minX - T, FLOOR.maxX + T, -1, [], looks, [true, true]);
        knockable(backWall);
        shell.add(backWall);
        for (const o of windows) {
          shell.add(windowIn(o));
          shell.add(wetPane(o, night.wetGlass));
        }
        take(shell);

        // The floor: the room's planks carried on through (the same texture, lined up with it), on a
        // slab like the room's. No ceiling tiles and no roof over them: the room it opens off has
        // none either (see stack.ts), and looking up from the back office you see the sky.
        const w = WING.maxX - WING.minX;
        const d = FLOOR.minZ - back;
        const floorGeo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(midX, 0, (back + FLOOR.minZ) / 2);
        const uv = floorGeo.getAttribute('uv');
        const pos = floorGeo.getAttribute('position');
        for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) - FLOOR.minX) / (FLOOR.maxX - FLOOR.minX), (FLOOR.maxZ - pos.getZ(k)) / (FLOOR.maxZ - FLOOR.minZ));
        const floor = take(new THREE.Mesh(floorGeo, planks)) as THREE.Mesh;
        floor.receiveShadow = true;
        // Its edges are the band between the floors outside, its underside concrete.
        const band = toon('#e8a87c');
        const concrete = toon('#d3d6dd');
        const slab = new THREE.Mesh(box(w + 2 * T, SLAB - 0.01, d), [band, band, concrete, concrete, band, band]);
        slab.position.set(midX, -SLAB / 2 - 0.005, (back - T + FLOOR.minZ - T) / 2);
        slab.receiveShadow = true;
        take(slab);
        mine.push({ minX: WING.minX - T, maxX: FLOOR.maxX + T, minZ: back - T, maxZ: FLOOR.minZ - T, bottom: -SLAB, top: 0 });
      }
      colliders.push(...mine);

      // What E acts on moves with the wall: the one at the back of the back office as it stands.
      it.z = back + 0.3;
    },
  };
  view.set(0);
  return view;
}

declare module '../types' {
  interface OfficeHandles {
    /** The back office through the north wall, as far as this floor's built out (see WING). */
    wing: WingView;
    /** Builds the back office out `level` rows, or walls it up: the plants in the way go too. */
    setWing(level: number): void;
  }
}

/** The back office through the north wall past the gong, walled up until the floor's built out. */
export const wing: Fixture<'wing' | 'setWing'> = (site) => {
  const built = buildWing(site.group, site.colliders, site.interactables, site.desks, site.looks, site.looks.trim, site.planks, site.get('stack').ceiling, site.get('night'));
  site.wall('north', (WING.minX + FLOOR.maxX) / 2, WALL_HEIGHT / 2, FLOOR.maxX - WING.minX, WALL_HEIGHT);
  const setWing = (level: number) => {
    built.set(level);
    for (const p of site.inTheWay) {
      const out = built.level === 0;
      if (p.group.visible === out) continue;
      p.group.visible = out;
      const i = site.colliders.indexOf(p.collider);
      if (out && i < 0) site.colliders.push(p.collider);
      else if (!out && i >= 0) site.colliders.splice(i, 1);
    }
  };
  return { handle: { wing: built, setWing } };
};
