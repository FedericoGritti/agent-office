// What the Graphics page's look settings do to the office: the ramp every toon material shades
// through (see world/toon.ts) and your own colours over the floor's palette (see world/office/build.ts).
// Neither needs the renderer made again, but repainting the floor's planks is real work, so they are
// applied when they change and this call is one comparison on every other frame (see core/graphics.ts,
// which the two settings that do rebuild the renderer go through, and ui/settings-look.ts for the rows).

import type { Settings } from '../state';
import type { Office } from '../world/types';
import { setShading } from '../world/toon';

/** The look that was last applied; null until the first call has applied it. */
let applied: { shading: Settings['shading']; wallColor: string | null; floorColor: string | null; ceilingColor: string | null } | null = null;

/** Shades and paints the office the way the settings say, unless nothing about the look has changed. */
export function applyAppearance(office: Office, settings: Settings): void {
  const next = { shading: settings.shading, wallColor: settings.wallColor, floorColor: settings.floorColor, ceilingColor: settings.ceilingColor };
  const before = applied;
  if (before && before.shading === next.shading && before.wallColor === next.wallColor && before.floorColor === next.floorColor && before.ceilingColor === next.ceilingColor) return;
  applied = next;
  setShading(next.shading === 'smooth');
  office.setColors({ wall: next.wallColor, floor: next.floorColor, ceiling: next.ceilingColor });
}
