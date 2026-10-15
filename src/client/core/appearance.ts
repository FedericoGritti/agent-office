// What the look settings do to the office: the ramp every toon material shades through (see
// world/toon.ts) and the palette the room and everything in it is painted from (see palette.ts for the
// schemes and world/office/paint.ts for how the things in it answer to one). Neither needs the renderer
// made again, but repainting the planks is real work, so they are applied when they change and this
// call is one comparison on every other frame (see core/graphics.ts, which the two settings that do
// rebuild the renderer go through, and ui/settings-palette.ts for the rows).

import type { Palette } from '../palette';
import type { Settings } from '../state';
import { paintPalette } from '../world/office/paint';
import { setShading } from '../world/toon';
import type { Office } from '../world/types';

/** The look that was last applied; null until the first call has applied it. */
let applied: { shading: Settings['shading']; palette: Palette | null } | null = null;

/** Shades the office and paints it the way the settings say, unless nothing about the look has changed. */
export function applyAppearance(office: Office, settings: Settings): void {
  const next = { shading: settings.shading, palette: settings.palette };
  const before = applied;
  if (before && before.shading === next.shading && before.palette === next.palette) return;
  applied = next;
  setShading(next.shading === 'smooth');
  const p = next.palette;
  office.setColors({ wall: p?.wall ?? null, trim: p?.trim ?? null, floor: p?.floor ?? null, ceiling: p?.ceiling ?? null });
  paintPalette(p);
}
