/**
 * Arranging the room from inside it (F2), walking about and doing it yourself: look at a piece of
 * furniture and press E to pick it up, and while you carry it the piece follows where you look, on a
 * 25 cm grid. E puts it down (and it's saved), R turns it a quarter, Canc takes it out of the room, Esc
 * puts it back where you found it. The hint bar says all of that as you go.
 */
import { labelFor, setPlacements, type Placements } from '../../../shared/placement';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key } from '../../core/hint';
import { store } from '../../state';
import { toast } from '../../ui/dom';
import { applyPlacements } from '../../world/office/placed';
import { Carrying } from './carry';

export function installLayoutEditor(ctx: Ctx) {
  const carrying = new Carrying(ctx.office, ctx.camera, {
    save: (file: Placements) => ctx.net.send({ t: 'layout.set', placements: file }),
    changed: () => ctx.hint.invalidate(),
  });

  // The floor's file comes with its view, and again whenever anyone saves: the furniture goes where it
  // says. The room is built at layout.ts' numbers first, so a floor nobody has touched has no file.
  store.on('layout', () => {
    setPlacements(store.layout);
    applyPlacements(ctx.office);
  });

  ctx.ticks.add('world', () => carrying.update());

  /** The keys while you're arranging: E takes and puts, and the rest work on what you're carrying. */
  function press(e: KeyboardEvent): boolean {
    if (!carrying.on) return false;
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (carrying.carrying) carrying.putDown();
      else if (!carrying.pickUp()) toast('Look at something to pick it up');
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
      toast(carrying.on ? '🧰 Arranging the room: look at a piece and press E' : '🧰 The room is back to normal');
    },
  });
}
