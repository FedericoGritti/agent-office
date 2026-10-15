// ⚙️ Settings' Palette page: the colours the room and everything in it is painted from, and the schemes
// to start from (see palette.ts for the schemes, core/appearance.ts for when they are applied and
// world/office/paint.ts for what each colour reaches).

import { PALETTES, PALETTE_COLOURS, PALETTE_GROUPS, atFloor, type Colour, type Palette } from '../palette';
import { store, type Settings } from '../state';
import { h } from './dom';
import { setting } from './settings-rows';

/** What each colour of the palette paints. */
const LABELS: Record<Colour, string> = {
  wall: 'Walls',
  trim: 'Skirting, frames',
  floor: 'Floor',
  ceiling: 'Ceiling',
  wood: 'Wood',
  ink: 'Dark fittings',
  metal: 'Grey metal',
  brass: 'Warm metal',
  desk: 'Desk tops, paper',
  plant: 'Plants',
  pot: 'Pots',
};

/** How many accents the wells offer: the schemes all have four. */
const ACCENTS = 4;

/** The Palette page: a scheme to start from, then the colours themselves. */
export function paletteRows(settings: Settings, change: (some: Partial<Settings>) => void): Node[] {
  /** What the wells show: your palette, or what the floor is painted with today. */
  const shown = () => settings.palette ?? atFloor(store.currentFloor()?.palette ?? 0);
  /** Yours from here on: one colour of the shown palette changed (see palette.ts). */
  const edit = (key: Colour, color: string) => change({ palette: { ...shown(), [key]: color, name: 'Your own' } });
  const editAccent = (i: number, color: string) => {
    const p = shown();
    const accents = [...p.accents];
    while (accents.length <= i) accents.push(color);
    accents[i] = color;
    change({ palette: { ...p, accents, name: 'Your own' } });
  };

  const chips = h('div.seg.schemes', { role: 'radiogroup', 'aria-label': 'Scheme' });
  /** The schemes, with the floor's own first and none of them picked when the palette is yours. */
  const paintChips = () => {
    const mine = settings.palette;
    const chip = (on: boolean, label: string, title: string, run: () => void, swatches: readonly string[] = []) =>
      h(
        'button.btn.scheme',
        { type: 'button', role: 'radio', 'aria-checked': String(on), class: on ? 'on' : '', title, onclick: () => { run(); paint(); } },
        ...swatches.map((c) => h('i.swatch', { style: `background:${c}` })),
        label ? h('span', {}, label) : null,
      );
    chips.replaceChildren(
      chip(!mine, 'The floor’s own', 'Each floor keeps the palette it was given', () => change({ palette: null })),
      ...PALETTES.map((preset) =>
        chip(mine?.name === preset.name, '', preset.name, () => change({ palette: { ...preset } }), [preset.wall, preset.trim, preset.floor, preset.wood, ...preset.accents.slice(0, 2)]),
      ),
    );
  };

  const wells: HTMLInputElement[] = [];
  const colors = h('div');
  for (const group of PALETTE_GROUPS) {
    colors.append(h('h5', {}, group.title));
    for (const key of group.keys) {
      const input = h('input', { type: 'color', 'aria-label': LABELS[key], oninput: () => edit(key, input.value) }) as HTMLInputElement;
      wells.push(input);
      colors.append(h('div.look-row', {}, h('span.look-name', {}, LABELS[key]), input));
    }
  }
  const accentWells: HTMLInputElement[] = [];
  const accents = h('div');
  for (let i = 0; i < ACCENTS; i++) {
    const input = h('input', { type: 'color', 'aria-label': `Accent ${i + 1}`, oninput: () => editAccent(i, input.value) }) as HTMLInputElement;
    accentWells.push(input);
    accents.append(h('div.look-row', {}, h('span.look-name', {}, `Accent ${i + 1}`), input));
  }

  const note = h('p.setting-note');
  /** The wells and the note, from the palette in force. */
  function paint() {
    const p: Palette = shown();
    paintChips();
    wells.forEach((input, i) => (input.value = p[PALETTE_COLOURS[i]]));
    accentWells.forEach((input, i) => (input.value = p.accents[i] ?? p.accents.at(-1) ?? '#ffffff'));
    note.textContent = settings.palette
      ? `Your own palette, painted on everything the office builds itself. The floor keeps its planks and the office keeps its shapes: this is the paint, not the furniture. Kept in this browser, so a floor you ride to still looks like itself to everyone else.`
      : `The floor’s own palette, the one this project was given — every floor in the building is painted in one of these. Pick a scheme or change a colour and the whole room follows, for you only.`;
  }
  paint();

  return [
    setting('Scheme', 'you', chips, h('p.setting-note', {}, 'Sixteen palettes, built as a whole room each: the surfaces, the furniture and the accents chosen together, so nothing fights. The first ten are the floors’ own; the rest are drawn by hand. Changing any colour below makes it yours.')),
    setting('The room and the furniture', 'you', colors, note),
    setting('The accents', 'you', accents, h('p.setting-note', {}, 'What the rugs, the chairs, the poufs and the couch’s pillows are made of: they take these in turn, so no two neighbours in a row match and none of them is random.')),
  ];
}
