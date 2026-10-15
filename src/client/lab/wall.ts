// The walls lab, for looking at the office's outside walls and the windows in them by eye (Vite dev only,
// it isn't built: http://localhost:5173/lab/wall.html). The walls and the windows are built by the
// office's own code, so what it shows is what the office shows. Query params:
//   side=<wall>      which outside wall to look at: south (the default), west or east
//   u=<m>            where along the wall to look (default its middle)
//   dist=<m>         how far back from it the camera stands (default 18)
//   move=<id>:<u>,…  move windows along their walls, as the editor saves them
//   add=<side>:<u>:<y>,…  put a new window in, the size of the one nearest it at that height
//   del=<id>,…       take windows out of the walls
// Once it has drawn, window.__ready holds every window in the walls, as it stands.

import * as THREE from 'three';
import { BALCONY_DOOR, EXIT_DOOR, FLOOR, type Opening, type Side } from '../../shared/layout';
import { baseWindow, changeWindow, newWindowId, removeWindow, setWindows, sizeOn, windowFits, windows } from '../../shared/windows';
import { onWall, type Looks } from '../world/office/materials';
import { buildWalls, windowIn } from '../world/office/shell';
import { mergeByMaterial, toonUnique } from '../world/toon';
import { ready, stage } from './stage';

const q = new URLSearchParams(location.search);
const side = (q.get('side') ?? 'south') as Side;
const spreads = (key: string) => (q.get(key) ?? '').split(',').filter(Boolean).map((s) => s.split(':'));

setWindows(null);
for (const [id, u] of spreads('move')) {
  const from = baseWindow(id!)!;
  changeWindow(id!, from, { ...from, u: Number(u) });
}
for (const [wall, u, y] of spreads('add')) {
  const at = { wall: wall as Side, u: Number(u) };
  const size = sizeOn(at.wall, at.u, Number(y));
  const candidate = { ...at, ...size };
  if (!windowFits(at.wall, candidate)) changeWindow(newWindowId(), undefined, candidate);
}
for (const [id] of spreads('del')) removeWindow(id!);

const list = windows();
const looks: Looks = { wall: toonUnique('#fffaf3'), trim: toonUnique('#e8e8e8'), planks: [] };
const group = new THREE.Group();
buildWalls(group, [], [...list, EXIT_DOOR, BALCONY_DOOR], looks);
const glazing = new THREE.Group();
for (const o of list) glazing.add(windowIn(o));
group.add(mergeByMaterial(glazing));

const { scene, camera, render } = stage(document.getElementById('c') as HTMLCanvasElement, false);
scene.add(group);

// Inside the room, looking at the chosen wall from `dist` back: where along it, and two metres up.
const along = side === 'south' ? FLOOR.minX + FLOOR.maxX : FLOOR.minZ + FLOOR.maxZ;
const middle = Number(q.get('u') ?? along / 2);
const dist = Number(q.get('dist') ?? 18);
const eye = onWall(side, middle);
// The wall's own turn says which way is out of the room: the camera stands the other way from it.
camera.position.set(eye.x - Math.sin(eye.rotY) * dist, 3.2, eye.z - Math.cos(eye.rotY) * dist);
camera.lookAt(eye.x, 2.2, eye.z);
camera.updateProjectionMatrix();

render();
ready({ side, at: middle, from: { ...camera.position }, windows: list.map((w) => ({ ...w })) as Opening[] });
