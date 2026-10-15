// The office's palette: the schemes ⚙️ → Palette offers, and that a palette out of this browser's
// storage is a whole one (see src/client/palette.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, PALETTE_GROUPS, atFloor, readPalette, shade } from '../src/client/palette.js';
import { PALETTE } from '../src/client/world/office/materials.js';
import { accent, paintPalette, PARTS } from '../src/client/world/office/paint.js';
import { toon } from '../src/client/world/toon.js';
import { FLOOR_PALETTES } from '../src/shared/floors.js';

const HEX = /^#[0-9a-f]{6}$/;
/** A material's colour as it is written in the tables. */
const hex = (m: { color: { getHexString(): string } }) => `#${m.color.getHexString()}`;
/** One of the schemes, by the name ⚙️ → Palette shows. */
const scheme = (name: string) => PALETTES.find((p) => p.name === name)!;

test('every scheme is a whole palette: every colour a colour, and accents to take turns through', () => {
  assert.ok(PALETTES.length >= 8, `${PALETTES.length} schemes`);
  for (const p of PALETTES) {
    for (const [key, value] of Object.entries(p)) {
      if (key === 'name' || key === 'accents') continue;
      assert.match(value as string, HEX, `${p.name}.${key}`);
    }
    assert.ok(p.accents.length >= 3 && p.accents.length <= 8, `${p.name} has ${p.accents.length} accents`);
    for (const a of p.accents) assert.match(a, HEX, `${p.name}'s accents`);
    // A room painted one colour is not a scheme: what the rugs take is not the wall.
    assert.ok(!p.accents.includes(p.wall), `${p.name}'s accents are not the wall`);
  }
});

test("a floor's own scheme keeps the floor's surfaces under the office's furniture", () => {
  const first = atFloor(0);
  assert.equal(first.wall, FLOOR_PALETTES[0].wall);
  assert.equal(first.trim, FLOOR_PALETTES[0].trim);
  assert.equal(first.floor, FLOOR_PALETTES[0].floor);
  // Only the surfaces are the floor's: the furniture is the office's, whichever floor you are on.
  assert.equal(first.wood, atFloor(3).wood);
  assert.equal(first.accents, atFloor(9).accents);
  // Every floor has a scheme to fall back to, whatever its own is: no palette paints every floor its own.
  for (let i = 0; i < FLOOR_PALETTES.length; i++) assert.equal(atFloor(i).wall, FLOOR_PALETTES[i].wall);
  // The office as it always was is offered as a scheme, so it can be come back to from any of the others.
  assert.ok(PALETTES.some((p) => p.wall === FLOOR_PALETTES[0].wall && p.wood === '#c98b5a'));
});

test('a palette out of storage is all of it or none of it', () => {
  const good = { ...atFloor(0), accents: ['#AABBCC', '#bbccdd', '#ccddee'] };
  assert.deepEqual(readPalette(good)?.accents, ['#aabbcc', '#bbccdd', '#ccddee']);
  assert.equal(readPalette(null), null);
  assert.equal(readPalette('a palette'), null);
  // Half a palette is worse than the office's own: one colour wrong is the whole thing refused.
  assert.equal(readPalette({ ...good, floor: 'red' }), null);
  assert.equal(readPalette({ ...good, accents: ['#aabbcc'] }), null);
  assert.equal(readPalette({ ...good, accents: ['#aabbcc', 'blue', '#ccddee'] }), null);
  assert.ok(readPalette({ ...good, name: 7 }));
});

test('shade darkens a colour, and leaves it alone at 1', () => {
  assert.equal(shade('#ffffff', 1), '#ffffff');
  assert.equal(shade('#ffffff', 0.5), '#808080');
  assert.equal(shade('#000000', 0.5), '#000000');
  // Same length, so the strings compare as the colours do.
  assert.ok(shade('#f2d7b0', 0.9) < '#f2d7b0' && shade('#f2d7b0', 0.9) > shade('#f2d7b0', 0.5));
  assert.match(shade('#f2d7b0', 0.9), HEX);
  // Over 1 brightens, and never overflows a channel into a shorter hex.
  assert.equal(shade('#ffffff', 2), '#ffffff');
  assert.equal(shade('#808080', 2), '#ffffff');
  assert.match(shade('#c9952c', 1.6), HEX);
});

test('the wells cover every colour a palette has, once each', () => {
  const keys = PALETTE_GROUPS.flatMap((g) => g.keys);
  assert.equal(new Set(keys).size, keys.length);
  const own = Object.keys(PALETTES[0]).filter((k) => k !== 'name' && k !== 'accents');
  assert.deepEqual([...keys].sort(), own.sort());
});

test("no colour the office builds with is claimed by two parts of the room", () => {
  const claimed = new Map<string, string>();
  for (const [part, list] of Object.entries(PARTS)) {
    for (const [own] of list) {
      const already = claimed.get(own);
      assert.equal(already, undefined, `${own} is in ${part} and ${already}`);
      claimed.set(own, part);
    }
  }
  // A table that stopped covering anything is a table that stopped painting anything.
  assert.ok(claimed.size > 50, `${claimed.size} colours claimed`);
});

test('a lit material answers to the palette too, and its glow comes with it', () => {
  // The fire pole and the lamp bulbs: the same colour as something unlit, made with an emissive, which
  // is a material of its own (see toon) and used to be left out.
  const pole = toon('#f2c14e', { emissive: '#3a2a00' });
  const espresso = scheme('Espresso');

  paintPalette(espresso);
  assert.equal(hex(pole), shade(espresso.brass, 0.98));
  assert.notEqual(`#${pole.emissive.getHexString()}`, '3a2a00', 'the glow turned with the colour');

  paintPalette(null);
  assert.equal(hex(pole), '#f2c14e');
  assert.equal(`#${pole.emissive.getHexString()}`, '#3a2a00');
});

test("painting the room moves the office's own materials, and puts them back", () => {
  const wood = toon(PALETTE.wood);
  const rug = accent(0, '#123456');
  const petrol = scheme('Petrol');

  paintPalette(petrol);
  assert.equal(hex(wood), petrol.wood);
  assert.equal(hex(rug), petrol.accents[0]);
  // The accents take turns, so a row of rugs is not one colour.
  assert.equal(hex(accent(1, '#654321')), petrol.accents[1 % petrol.accents.length]);

  paintPalette(null);
  assert.equal(hex(wood), PALETTE.wood);
  assert.equal(hex(rug), '#123456');
});
