/**
 * Pointing at things without testing every triangle in the room.
 *
 * three walks a mesh's triangles one by one when a ray meets it, with no acceleration of any kind, and it
 * does that for whatever is in front of you, every frame, because the aim casts a ray through the room to
 * see what you're facing and whether it's blocked (see input/pointer.ts). Measured, on this machine:
 *
 *     200 objects, no heavy model          1.3 ms per ray
 *     200 objects + a 57k-triangle model  46.6 ms per ray
 *     300 objects + a 300k model         307.0 ms per ray
 *
 * The number of objects barely matters — the triangles are everything. A downloaded model of a rat, a
 * houseplant or a lamp is exactly the shape of thing that has tens of thousands of them, and it is also
 * the shape of thing nobody needs picked triangle by triangle: what the aim needs from it is only that it
 * *blocks the view*, the way a wall does.
 *
 * So above a budget, a mesh answers the ray with the box it fits in instead of its triangles. It still
 * blocks; it costs nothing; the model doesn't change at all.
 */
import * as THREE from 'three';

/** Nothing above this many triangles is worth testing triangle by triangle (see docs/how-it-works.md). */
export const RAY_TRIANGLE_BUDGET = 4000;

/** What has already been made coarse, so a sweep over a big scene is cheap and repeatable. */
const coarsened = new WeakSet<THREE.Mesh>();

const box = new THREE.Box3();
const point = new THREE.Vector3();

/**
 * A raycast that stops at the mesh's own box. The box is worked out from the mesh's world matrix each
 * time, because a piece of furniture can be moved, lifted and resized after it's built.
 */
function boxRaycast(this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void {
  const geometry = this.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const local = geometry.boundingBox;
  if (!local) return;
  box.copy(local).applyMatrix4(this.matrixWorld);
  if (!raycaster.ray.intersectBox(box, point)) return;
  const distance = raycaster.ray.origin.distanceTo(point);
  if (distance < raycaster.near || distance > raycaster.far) return;
  // Only what the aim reads off a hit: which object it is, and how far away the near side of it is.
  intersects.push({ distance, point: point.clone(), object: this });
}

/** How many triangles a mesh asks the renderer for, indexed or not. */
function triangles(mesh: THREE.Mesh): number {
  const position = mesh.geometry.getAttribute('position');
  if (!position) return 0;
  const index = mesh.geometry.getIndex();
  return (index ? index.count : position.count) / 3;
}

/**
 * Makes every mesh under `roots` heavier than `budget` triangles answer the ray with its box, and says how
 * many it changed. Sweep the same roots again as often as you like: each mesh is only ever done once.
 */
export function coarseMeshes(roots: readonly THREE.Object3D[], budget = RAY_TRIANGLE_BUDGET): number {
  let done = 0;
  for (const root of roots) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || coarsened.has(mesh) || triangles(mesh) <= budget) return;
      mesh.raycast = boxRaycast;
      coarsened.add(mesh);
      done++;
    });
  }
  return done;
}
