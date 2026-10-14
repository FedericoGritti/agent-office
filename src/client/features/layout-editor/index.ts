/**
 * Arranging the room from inside it (F2), walking about and doing it yourself: look at a piece of
 * furniture and press E to pick it up, and while you carry it the piece follows where you look, on a
 * 25 cm grid. E puts it down (and it's saved), R turns it a quarter, Canc takes it out of the room, Esc
 * puts it back where you found it. The hint bar says all of that as you go.
 */
import { labelFor, nextSpawnId, placements, setPlacements, spawn, type Placements } from '../../../shared/placement';
import type { CatalogKind } from '../../../shared/catalog';
import { MODEL_ADD_PATH, externalKind, kindLabel, type AdditionKind, type ModelSource } from '../../../shared/model-sources';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key } from '../../core/hint';
import { store } from '../../state';
import { toast } from '../../ui/dom';
import { buildAddition, declareAddition, applyCatalog, updateCatalog } from '../../world/office/catalog';
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
    if (store.floor) applyCatalog(ctx.office, store.floor);
  });

  ctx.ticks.add('world', () => carrying.update());
  // What the additions do each frame: the fountain's water, and nothing else yet.
  ctx.ticks.add('env', (f) => updateCatalog(f.t));

  /** What the window calls to put one of the office's own kinds in the room. */
  function add(kind: CatalogKind): Promise<void> {
    return stand(kind);
  }

  /**
   * Puts something new in the room, off a catalog: it lands in front of you (see spotAhead), in your
   * hands to put down where it goes. Built first, and written into the file only once it's really there,
   * so a kind that can't be built — a model that isn't downloaded, a file that won't load — leaves the
   * room and the file exactly as they were. Throws with what went wrong: the window is waiting on it.
   */
  async function stand(kind: AdditionKind): Promise<void> {
    const floor = store.floor;
    if (!floor) throw new Error('Take the elevator to a floor first');
    // Whatever was in your hands stays where you left it, saved, before the next one arrives.
    carrying.putDown();
    const at = carrying.spotAhead(ctx.player.pos, ctx.player.facing);
    const id = nextSpawnId();
    const built = await buildAddition(kind, id, at, floor);
    if (!built) throw new Error(`${kindLabel(kind)} couldn't be built — it may not be downloaded, or may be too big for the room`);
    spawn(id, kind, at);
    carrying.hold(declareAddition(built, id, at, ctx.office));
    carrying.save();
    refresh();
    toast(`${kindLabel(kind)} added — E puts it down where you look`);
  }

  /**
   * Fetches a model from an online catalog and puts it in the room. The office does the downloading (see
   * the models routes), into this floor's own folder, where the room then finds it: the browser never
   * reaches across, and the model is there for everyone on the floor and after a restart.
   */
  async function addModel(source: ModelSource, id: string): Promise<void> {
    const floor = store.floor;
    if (!floor) throw new Error('Take the elevator to a floor first');
    const res = await fetch(`${MODEL_ADD_PATH}?floor=${encodeURIComponent(floor)}&source=${source}&id=${id}`, { method: 'POST' });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? `the office answered ${res.status}`);
    await stand(externalKind(source, id));
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
      openCatalog({ add, addModel });
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
