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
import { makeBanner } from './banner';
import { Carrying } from './carry';

export function installLayoutEditor(ctx: Ctx) {
  const banner = makeBanner();

  /** What the sign and the hint bar say: the mode, what you're carrying, and what the keys do now. */
  function refresh(): void {
    const held = carrying.carrying;
    if (!carrying.on) banner.hide();
    else if (held) {
      // A thing hung on a wall turns nobody's way: it slides along its wall instead (see onWall).
      const turn = held.wall ? 'it slides along its wall' : 'R turns it';
      banner.set(`🛠️ Carrying ${labelFor(held.id)} — E puts it down · ${turn} · Canc takes it away · Esc puts it back`);
    } else banner.set('🛠️ Arranging the room — look at a piece and press E to pick it up · F2 or Esc to finish');
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
      aside(
        held
          ? held.wall
            ? 'It follows your look along its wall; E puts it down'
            : 'It follows your look; E puts it down'
          : 'Look at a piece and press E to pick it up',
      ),
      // Nothing hung on a wall turns: it slides along the wall it hangs on (see onWall).
      ...(held?.wall ? [] : [key('R', 'Quarter turn')]),
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
