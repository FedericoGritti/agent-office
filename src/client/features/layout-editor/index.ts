/**
 * Arranging the room from inside it (F2), walking about and doing it yourself: look at a piece of
 * furniture and press E to pick it up, and while you carry it the piece follows where you look, on a
 * 25 cm grid. E puts it down (and it's saved), R turns it a quarter, Canc takes it out of the room, Esc
 * puts it back where you found it. The hint bar says all of that as you go.
 */
import { labelFor, nextSpawnId, placements, setPlacements, spawn, type Placements } from '../../../shared/placement';
import { CATALOG, type CatalogKind } from '../../../shared/catalog';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key } from '../../core/hint';
import { store } from '../../state';
import { toast } from '../../ui/dom';
import { addPiece, applyCatalog, updateCatalog } from '../../world/office/catalog';
import { applyPlacements } from '../../world/office/placed';
import { makeBanner } from './banner';
import { Carrying } from './carry';
import { openCatalog } from './ui';

export function installLayoutEditor(ctx: Ctx) {
  const banner = makeBanner();

  /** What the sign and the hint bar say: the mode, what you're carrying, and what the keys do now. */
  function refresh(): void {
    const held = carrying.carrying;
    if (!carrying.on) banner.hide();
    else if (held) banner.set(`🛠️ Carrying ${labelFor(held.id)} — E puts it down · R turns it · Canc takes it away · Esc puts it back`);
    else banner.set('🛠️ Arranging the room — look at a piece and press E to pick it up · F2 or Esc to finish');
    ctx.hint.invalidate();
  }

  const carrying = new Carrying(ctx.office, ctx.camera, {
    save: (file: Placements) => ctx.net.send({ t: 'layout.set', placements: file }),
    changed: refresh,
  });

  // The floor's file comes with its view, and again whenever anyone saves: the furniture goes where it
  // says. The room is built at layout.ts' numbers first, so a floor nobody has touched has no file.
  store.on('layout', () => {
    setPlacements(store.layout);
    applyPlacements(ctx.office);
    // And the things somebody added here off the catalog, which the file is the only record of.
    applyCatalog(ctx.office);
  });

  ctx.ticks.add('world', () => carrying.update());
  // What the additions do each frame: the fountain's water, and nothing else yet.
  ctx.ticks.add('env', (f) => updateCatalog(f.t));

  /**
   * Puts something new in the room, off the catalog: it lands in front of you (see spotAhead), in your
   * hands to put down where it goes. The file gets it first, so the room doesn't put it away again on
   * the next floor it arrives on.
   */
  function add(kind: CatalogKind): void {
    // Whatever was in your hands stays where you left it, saved, before the next one arrives.
    carrying.putDown();
    const at = carrying.spotAhead(ctx.player.pos, ctx.player.facing);
    const id = nextSpawnId();
    spawn(id, kind, at);
    carrying.hold(addPiece(kind, id, at, ctx.office));
    carrying.save();
    refresh();
    toast(`${CATALOG[kind].label} added — E puts it down where you look`);
  }

  /** The keys while you're arranging: E takes and puts, and the rest work on what you're carrying. */
  function press(e: KeyboardEvent): boolean {
    if (!carrying.on) return false;
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (carrying.carrying) carrying.putDown();
      else if (!carrying.pickUp()) toast('Look at something to pick it up');
      return true;
    }
    if (e.code === 'KeyC') {
      e.preventDefault();
      openCatalog({ add });
      return true;
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      carrying.turn(e.shiftKey);
      return true;
    }
    if (e.code === 'Delete' || e.code === 'Backspace') {
      e.preventDefault();
      if (!carrying.takeAway()) toast('Pick something up first');
      return true;
    }
    if (e.code === 'Escape') {
      carrying.stop();
      return true;
    }
    return false;
  }

  function hint(el: HTMLElement): void {
    const held = carrying.carrying;
    el.replaceChildren(
      hintTitle(held ? `🧰 Carrying ${labelFor(held.id)}` : '🧰 Arranging the room'),
      aside(held ? 'It follows your look; E puts it down' : 'Look at a piece and press E to pick it up'),
      key('C', 'Catalog'),
      key('R', 'Quarter turn'),
      key('Canc', 'Take it away'),
      key('Esc', held ? 'Put it back' : 'Stop'),
    );
  }

  ctx.activities.add({
    id: 'moving',
    active: () => carrying.on,
    // Walking about is the point; anything else that takes over puts what you're carrying back.
    stop: (why) => {
      if (why !== 'walk') carrying.stop();
    },
    key: press,
    hint,
  });

  ctx.keys.bind({
    code: 'F2',
    run: () => {
      if (!store.floor) {
        toast('Take the elevator to a floor first', 'warn');
        return;
      }
      carrying.toggle();
      refresh();
    },
  });
}
