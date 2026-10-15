// ⚙️ Settings' Graphics page, the drawing half: how the light lands on everything (see world/toon.ts
// for the ramp and core/appearance.ts for when it is applied). What the room is painted with is the
// Palette page instead (settings-palette.ts).

import type { Settings, Shading } from '../state';
import { h } from './dom';
import { choiceRow, setting } from './settings-rows';

/** The Shading setting: the office's flat cartoon bands, or a smooth run like any lit room. */
export function shadingRows(settings: Settings, change: (some: Partial<Settings>) => void): Node[] {
  const row = choiceRow<Shading>('Shading', [['toon', '🎨 Toon'], ['smooth', '✨ Smooth']], () => settings.shading, (shading) => change({ shading }));
  return [
    setting(
      'Shading',
      'you',
      row,
      h('p.setting-note', {}, 'Toon is the office as it was drawn: the light landing on everything in flat bands. Smooth runs those bands into one another, so a wall, a desk and a character are shaded like an ordinary lit room — the strongest single step away from the cartoon, and with Outlines off above all. Neither costs a frame anything.'),
    ),
  ];
}
