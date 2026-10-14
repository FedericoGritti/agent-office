// What the Graphics settings do to the renderer (see state/persist.ts for the values and ui/settings.ts
// for the rows). The outlines are a choice made where the frame is drawn, and cost nothing to read there.
// These two are not: the drawing buffer and every shader that takes shadows have to be made again, so they
// are applied when they change — and this call is free on every other frame.
//
// Why they exist at all: a frame in this office is the room drawn twice (the outline pass) at up to four
// device pixels per screen pixel, into a 2048² shadow map. That is a cost of the passes and the pixels,
// not of how much furniture there is — which is why a room with less in it can still be slow.

import type * as THREE from 'three';
import type { Settings } from '../state';

/** What the renderer was last set up as; null until the first call has set it up. */
let applied: { resolution: number; shadows: boolean } | null = null;

/**
 * Fits the drawing buffer and the shadows to the settings. `scenes` are what a shader change has to reach
 * (the room and your hands are separate scenes).
 */
export function applyGraphics(renderer: THREE.WebGLRenderer, scenes: readonly THREE.Scene[], sun: THREE.DirectionalLight, settings: Settings): void {
  if (applied && applied.resolution === settings.resolution && applied.shadows === settings.shadows) return;
  const before = applied;
  applied = { resolution: settings.resolution, shadows: settings.shadows };

  if (!before || before.resolution !== applied.resolution) {
    // The device's own density, up to what the setting allows: never more than the screen has.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, applied.resolution));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  // The renderer starts with shadows on, so this is only work when they go off — at startup or later.
  if (applied.shadows !== (before?.shadows ?? true)) {
    renderer.shadowMap.enabled = applied.shadows;
    sun.castShadow = applied.shadows;
    // Whether a material takes shadows at all is baked into its shader (three's own note on
    // shadowMap.enabled): without this it stays shaded as if they were still on.
    for (const scene of scenes) {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.needsUpdate = true;
      });
    }
  }
}
