/**
 * Arranging the room from inside it (F2), walking about and doing it yourself: look at a piece of
 * furniture or a window and press E to pick it up, and while you carry it, it follows where you look —
 * furniture over the floor on a 25 cm grid, a window along the wall you're looking at, or on to another
 * one. N puts a new window in the wall you're looking at and hands it to you. E puts it down (and it's
 * saved), R turns a piece of furniture a quarter, Canc takes it out of the room, Esc puts it back where
 * you found it. The hint bar says all of that as you go.
 */
import { labelFor, setPlacements, type Placements } from '../../../shared/placement';
import { setWindows, windowLabel, type WindowPlacements } from '../../../shared/windows';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key } from '../../core/hint';
import { store } from '../../state';
import { toast } from '../../ui/dom';
import { applyPlacements } from '../../world/office/placed';
import { makeBanner } from './banner';
import { Carrying } from './carry';
import { Windows } from './windows';

export function installLayoutEditor(ctx: Ctx) {
  const banner = makeBanner();

  /** Whether you're arranging the room at all: the mode the sign is up for. */
  function arranging(): boolean {
    return carrying.on || windows.on;
  }

  /** What the sign and the hint bar say: the mode, what you're carrying, and what the keys do now. */
  function refresh(): void {
    const window = windows.carrying;
    const held = carrying.carrying;
    if (!arranging()) banner.hide();
    else if (window) banner.set(`🛠️ Carrying ${windowLabel(window.id)} — E puts it in the wall · Canc takes it away · Esc puts it back${windows.refused ? ` · ${windows.refused}` : ''}`);
    else if (held) banner.set(`🛠️ Carrying ${labelFor(held.id)} — E puts it down · R turns it · Canc takes it away · Esc puts it back`);
    else banner.set('🛠️ Arranging the room — look at a piece or a window and press E · N puts in a new window · F2 or Esc to finish');
    ctx.hint.invalidate();
  }

  const carrying = new Carrying(ctx.office, ctx.camera, {
    save: (file: Placements) => ctx.net.send({ t: 'layout.set', placements: file }),
    changed: refresh,
  });

  const windows = new Windows(ctx.office, ctx.camera, {
    save: (file: WindowPlacements) => ctx.net.send({ t: 'windows.set', windows: file }),
    rebuild: () => ctx.office.windowsChanged(),
    changed: refresh,
  });

  /** In the mode, or out of it: anything in your hands goes back where you found it. */
  function arrange(on: boolean): void {
    if (on === arranging()) return;
    if (on) {
      carrying.toggle();
      windows.toggle();
    } else {
      carrying.stop();
      windows.stop();
    }
    refresh();
  }

  // The floor's file comes with its view, and again whenever anyone saves: the furniture goes where it
  // says. The room is built at layout.ts' numbers first, so a floor nobody has touched has no file.
  store.on('layout', () => {
    setPlacements(store.layout);
    applyPlacements(ctx.office);
  });

  // The office's windows come the same way, and the walls are built again round them (see shared/windows).
  store.on('windows', () => {
    setWindows(store.windows);
    ctx.office.windowsChanged();
  });

  ctx.ticks.add('world', () => {
    carrying.update();
    windows.update();
  });

  /** Takes what you're looking at: the window or the piece of furniture, whichever is nearer. */
  function take(): boolean {
    const window = windows.looking;
    if (window && (!carrying.aimed || windows.aimDistance <= carrying.aimDistance)) return windows.pickUp();
    return carrying.pickUp();
  }

  /** The keys while you're arranging: E takes and puts, N puts in a new window, and the rest work on what you carry. */
  function press(e: KeyboardEvent): boolean {
    if (!arranging()) return false;
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (windows.carrying) windows.putDown();
      else if (carrying.carrying) carrying.putDown();
      else if (!take()) toast('Look at something to pick it up');
      return true;
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      if (!carrying.carrying) toast('Only furniture turns');
      else carrying.turn(e.shiftKey);
      return true;
    }
    if (e.code === 'KeyN') {
      e.preventDefault();
      if (!windows.add()) toast(windows.refused ?? 'Look at a wall to put a window in', 'warn');
      return true;
    }
    if (e.code === 'Delete' || e.code === 'Backspace') {
      e.preventDefault();
      if (windows.carrying) windows.takeAway();
      else if (!carrying.takeAway()) toast('Pick something up first');
      return true;
    }
    if (e.code === 'Escape') {
      arrange(false);
      return true;
    }
    return false;
  }

  function hint(el: HTMLElement): void {
    const window = windows.carrying;
    const held = carrying.carrying;
    if (window) {
      el.replaceChildren(
        hintTitle(`🧰 Carrying ${windowLabel(window.id)}`),
        aside(windows.refused ?? 'It follows your look: along the wall, up and down it, or on to another one'),
        key('Canc', 'Take it away'),
        key('Esc', 'Put it back'),
      );
      return;
    }
    if (held) {
      el.replaceChildren(
        hintTitle(`🧰 Carrying ${labelFor(held.id)}`),
        aside('It follows your look; E puts it down'),
        key('R', 'Quarter turn'),
        key('Canc', 'Take it away'),
        key('Esc', 'Put it back'),
      );
      return;
    }
    const looking = windows.looking;
    el.replaceChildren(
      hintTitle('🧰 Arranging the room'),
      aside(looking ? `${windowLabel(looking.id)} — E takes it out of the wall` : 'Look at a piece or a window and press E'),
      key('N', 'New window in this wall'),
      key('Canc', 'Take it away'),
      key('Esc', 'Stop'),
    );
  }

  ctx.activities.add({
    id: 'moving',
    active: () => arranging(),
    // Walking about is the point; anything else that takes over puts what you're carrying back.
    stop: (why) => {
      if (why !== 'walk') arrange(false);
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
      arrange(!arranging());
    },
  });
}
