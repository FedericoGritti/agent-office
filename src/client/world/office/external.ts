// A model fetched from an online catalog, as a piece of furniture: the browser loads it through the
// office (out of the folder the floor downloaded it into), and what the model measures becomes its
// footprint — so a chair stands on the width of its own legs rather than on a box someone guessed.
//
// The materials are the model's own: this is somebody else's thing, and it comes as it is — whatever the
// room's flat colors do to it. It isn't animated (a rigged model stands in the pose it was built in).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { modelFolderPath, parseExternal, type ModelSource } from '../../../shared/model-sources';
import { footprint, type Built, type Spot } from './placed';

/** The models already loaded, by source and id: two copies of the same crate are one download and one
 *  load, and each piece gets a clone of it (Object3D.clone() would leave a skinned copy bound to the
 *  original's bones, so SkeletonUtils does it). */
const loaded = new Map<string, Promise<THREE.Object3D | null>>();

/** How big a model may be before the office says no: a scanned rock can measure hundreds of metres, and
 *  standing one in a room of sixteen by twenty-six metres is not a piece of furniture. */
const MAX_SIDE = 40;

function loadModel(source: ModelSource, id: string): Promise<THREE.Object3D | null> {
  const key = `${source}:${id}`;
  let p = loaded.get(key);
  if (!p) {
    // The folder's own URL answers with the model's first file, and everything that file names resolves
    // beside it (see modelFolderPath): asking for the folder is what makes the relative names work.
    p = new GLTFLoader()
      .loadAsync(modelFolderPath(source, id))
      .then((gltf) => gltf.scene)
      .catch((err: unknown) => {
        console.warn(`${key} didn't load:`, err);
        return null;
      });
    loaded.set(key, p);
  }
  return p;
}

/** Whether a model is an object the room can hold: it comes back as a mesh of a sane size, not empty. */
function usable(model: THREE.Object3D): boolean {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return false;
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z) <= MAX_SIDE;
}

/**
 * Builds one addition out of a model fetched from an online catalog, at the spot it is being put down:
 * its own middle on the spot, its lowest point on the floor it stands on, and a footprint of what it
 * measures. Null when it can't be had — not downloaded, gone, or not a model the room can hold.
 */
export async function buildExternal(kind: string, at: Spot): Promise<Built | null> {
  const external = parseExternal(kind);
  if (!external) return null;
  const model = await loadModel(external.source, external.id);
  if (!model || !usable(model)) return null;
  const object = clone(model);
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  // Where the model's own origin is has nothing to do with where it should stand: measure it, and stand
  // it by what it measures.
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const middle = box.getCenter(new THREE.Vector3());
  const group = new THREE.Group();
  object.position.set(-middle.x, -box.min.y, -middle.z);
  group.add(object);
  group.position.set(at.x, at.y, at.z);
  group.rotation.y = at.rotY;

  return {
    group,
    colliders: [footprint(at.x, at.z, size.x, size.z, at.rotY, at.y, Math.max(size.y, 0.2))],
  };
}
