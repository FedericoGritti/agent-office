// ⚙️ Settings' Graphics page, the look half: how the light on everything is shaded, and what colour
// the room is painted. core/appearance.ts applies both (the ramp is one texture every toon material
// samples, the colours are painted over the floor's own palette — see world/toon.ts and
// world/office/build.ts); these are the rows, and they are yours alone.

import { floorPalette } from '../../shared/floors';
import { store, type Settings, type Shading } from '../state';
import { h } from './dom';
import { choiceRow, setting } from './settings-rows';

/** The colour the floor paints a surface, so a well nobody has set shows what is in the room now. */
function floorOwn(which: 'wall' | 'floor'): string {
  return floorPalette(store.currentFloor()?.palette ?? 0)[which];
}

/**
 * A colour well for one surface, and the button back to what the floor paints. The well holds your
 * colour, or the floor's own until you pick one; the button is only there while you have a colour of
 * your own.
 */
function colorRow(label: string, own: string, back: string, get: () => string | null, set: (c: string | null) => void): HTMLElement {
  const well = h('input', { type: 'color', value: get() ?? own, 'aria-label': label }) as HTMLInputElement;
  const reset = h('button.btn', { type: 'button', onclick: () => goBack() }, back);
  const paint = () => {
    well.value = get() ?? own;
    reset.classList.toggle('hidden', get() === null);
  };
  function goBack() {
    set(null);
    paint();
  }
  well.addEventListener('input', () => set(well.value));
  paint();
  return h('div.look-row', {}, h('span.look-name', {}, label), well, reset);
}

/** Shading and your own colours: the two settings that change how the office looks rather than what it costs. */
export function lookRows(settings: Settings, change: (some: Partial<Settings>) => void): Node[] {
  const shadingRow = choiceRow<Shading>('Shading', [['toon', '🎨 Toon'], ['smooth', '✨ Smooth']], () => settings.shading, (shading) => change({ shading }));
  const colors = h(
    'div',
    {},
    colorRow('Walls', floorOwn('wall'), '↺ The floor’s', () => settings.wallColor, (wallColor) => change({ wallColor })),
    colorRow('Floor', floorOwn('floor'), '↺ The floor’s', () => settings.floorColor, (floorColor) => change({ floorColor })),
    colorRow('Ceiling', '#ffffff', '↺ White', () => settings.ceilingColor, (ceilingColor) => change({ ceilingColor })),
  );

  return [
    setting(
      'Shading',
      'you',
      shadingRow,
      h('p.setting-note', {}, 'Toon is the office as it was drawn: the light landing on everything in flat bands. Smooth runs those bands into one another, so a wall, a desk and a character are shaded like an ordinary lit room — the strongest single step away from the cartoon, and with Outlines off above all. Neither costs a frame anything.'),
    ),
    setting(
      'Colours',
      'you',
      colors,
      h('p.setting-note', {}, 'Your own colour for the walls, the floor and the ceiling, over the floor’s own palette — a floor you ride to still looks like itself to everyone else. The floor keeps its planks: your colour is what they are painted in, with the second row and the seams run darker. The ceiling is the room’s tiles tinted, so a dark colour dims them. The button beside each well goes back to what the floor paints, which is what a well shows before you pick one.'),
    ),
  ];
}
