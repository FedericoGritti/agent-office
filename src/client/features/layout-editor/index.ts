/**
 * Arranging the room from inside it (F2), walking about and doing it yourself: look at a piece of
 * furniture or a window and press E to pick it up, and while you carry it, it follows where you look —
 * furniture over the floor on a 25 cm grid, a window along the wall you're looking at, or on to another
 * one. N puts a new window in the wall you're looking at and hands it to you. E puts it down (and it's
 * saved), R turns a piece of furniture a quarter, Canc takes it out of the room, Esc puts it back where
 * you found it. The hint bar says all of that as you go.
 */
import { forget, isAddition, labelFor, nextSpawnId, placements, setPlacements, spawn, spawned, type Placements } from '../../../shared/placement';
import type { CatalogKind } from '../../../shared/catalog';
import { MODEL_ADD_PATH, externalKind, kindLabel, type AdditionKind, type ModelSource } from '../../../shared/model-sources';
import { setWindows, windowLabel, type WindowPlacements } from '../../../shared/windows';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key } from '../../core/hint';
import { store } from '../../state';
import { toast } from '../../ui/dom';
import { buildAddition, declareAddition, discardAddition, applyCatalog, updateCatalog } from '../../world/office/catalog';
import { applyPiece, applyPlacements, placedPieces } from '../../world/office/placed';
import { makeBanner } from './banner';
import { Carrying } from './carry';
import { Windows } from './windows';
import { openCatalog } from './ui';

export function installLayoutEditor(ctx: Ctx) {
  const banner = makeBanner({
    size: (dir) => void carrying.resize(dir),
    lift: (dir) => void carrying.raise(dir),
    // A quarter turn each way, the same as R and Shift+R: a button is one step, and in third person a
    // button is what there is (see banner.ts).
    turn: (dir) => void carrying.turn(dir < 0),
    // A step across the way the piece faces, on the room's own 25 cm grid: where the look leaves it, one
    // step over (see Carrying.nudge).
    move: (dir) => void carrying.nudge(dir),
    // A window's own two steps: a hole in a wall is widened and heightened where it stands, not turned.
    widen: (dir) => void windows.resize(dir),
    heighten: (dir) => void windows.heighten(dir),
  });

  /** Whether you're arranging the room at all: the mode the sign is up for. */
  function arranging(): boolean {
    return carrying.on || windows.on;
  }

  /** What the sign and the hint bar say: the mode, what you're carrying, how big it is and how high. */
  function refresh(): void {
    const window = windows.carrying;
    const held = carrying.carrying;
    if (!arranging()) banner.hide();
    else if (window)
      banner.set({
        text: `🛠️ Carrying ${windowLabel(window.id)} — E puts it in the wall · scroll sizes it · −/+ its height · Canc takes it away · Esc puts it back${windows.refused ? ` · ${windows.refused}` : ''}`,
        window: { width: windows.width, height: windows.height },
      });
    else if (held)
      banner.set({
        text: `🛠️ Carrying ${labelFor(held.id)} — E puts it down · R turns it · [ ] steps it across${carrying.adjustable ? ' · scroll sizes it · −/+ up and down' : ''} · Canc takes it away · Esc puts it back`,
        // A piece with a seat has no size, height or facing of its own to change: a desk or a couch keeps
        // the way the room built it (see room.md), so the sign carries no buttons.
        ...(carrying.adjustable ? { piece: { size: carrying.size, height: carrying.height, turned: carrying.turned } } : {}),
      });
    else banner.set({ text: '🛠️ Arranging the room — look at a piece or a window and press E · N puts in a new window · F2 or Esc to finish' });
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
    // And the things somebody added here off the catalog, which the file is the only record of.
    if (store.floor) applyCatalog(ctx.office, store.floor);
  });

  // The office's windows come the same way, and the walls are built again round them (see shared/windows).
  store.on('windows', () => {
    setWindows(store.windows);
    ctx.office.windowsChanged();
  });

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

  /** What the room declares but this floor's file has taken away: the list behind the catalog's "put
   *  back" button, and the only way back for what can't be copied yet (see Carrying.bringBack). */
  function gone(): { id: string; label: string; forgettable: boolean }[] {
    // A piece of the room's own cannot be forgotten: it is kept out of the room by being cancelled, and
    // forgotten it would only be built again (see forget in shared/placement).
    const out = placedPieces()
      .filter((piece) => piece.at.hidden)
      .map((piece) => ({ id: piece.id, label: labelFor(piece.id), forgettable: isAddition(piece.id) }));
    // Additions the room took out and never built — nothing is fetched or held for something that isn't
    // in the room (see world/office/catalog) — listed from the file, and built when they're put back.
    for (const it of spawned()) if (it.deleted && !out.some((g) => g.id === it.id)) out.push({ id: it.id, label: labelFor(it.id), forgettable: true });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Forgets a cancelled piece for good: out of the room, and its line out of the floor's file, so nothing
   * puts it back and the list stops naming it (see discardAddition and forget). Cancelling keeps a thing
   * within reach; this is the way to say it will never be wanted again.
   */
  function forgetOne(id: string): void {
    discardAddition(id, ctx.office);
    if (!forget(id)) return;
    carrying.save();
    refresh();
  }

  /**
   * Puts back an addition the room had taken out and never built: nothing is fetched or held for a model
   * that isn't in the room (see world/office/catalog), so this is where one is built again — on the spot
   * the file names, as big as it was — and then saved, so it is nobody's cancelled piece any more.
   */
  async function putBackOne(id: string): Promise<void> {
    const it = spawned().find((s) => s.id === id);
    const floor = store.floor;
    if (!it || !floor) return;
    const at = { x: it.x, y: it.y, z: it.z, rotY: it.rotY };
    const built = await buildAddition(it.kind, id, at, floor);
    if (!built) {
      toast(`${kindLabel(it.kind)} couldn't be put back — it may not be downloaded any more`);
      return;
    }
    applyPiece(declareAddition(built, id, at, ctx.office), { ...at, scale: it.scale, hidden: false }, ctx.office);
    carrying.save();
    refresh();
  }

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
    if (e.code === 'KeyC') {
      e.preventDefault();
      openCatalog({
        add,
        addModel,
        gone,
        forget: forgetOne,
        restore: (id) => {
          const piece = placedPieces().find((p) => p.id === id);
          if (piece) carrying.bringBack(piece);
          else void putBackOne(id);
        },
      });
      return true;
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      if (!carrying.carrying) toast('Only furniture turns');
      else carrying.turn(e.shiftKey);
      return true;
    }
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
      // A step across the way the piece faces: the Move buttons' own work, for first person, where the
      // mouse is looking around and a button has no cursor (see Carrying.nudge).
      if (!carrying.carrying) return false;
      e.preventDefault();
      carrying.nudge(e.code === 'BracketRight' ? 1 : -1);
      return true;
    }
    if (e.code === 'KeyN') {
      e.preventDefault();
      if (!windows.add()) toast(windows.refused ?? 'Look at a wall to put a window in', 'warn');
      return true;
    }
    if (e.code === 'Minus' || e.code === 'Equal' || e.key === '-' || e.key === '+') {
      // Up and down is a button, not the wheel: a scroll can run away with a piece, and these two are on
      // every keyboard — `-` lowers it, `+` raises it. Read by the character as well as by the key, so a
      // layout that puts `+` somewhere else (or a numeric keypad) still works. The wheel is for the size
      // (see below). A piece of the room's own with a seat has no height of its own to change, so the
      // keys aren't the editor's there at all.
      //
      // A window is the other way round: where it stands on the wall is where you look — up and down it
      // as much as along it — so the same two keys make it taller and shorter instead, and the wheel
      // wider and narrower. A hole is sized, not raised (see Windows.resize and .heighten).
      const dir = e.code === 'Equal' || e.key === '+' ? 1 : -1;
      if (windows.carrying) {
        e.preventDefault();
        windows.heighten(dir);
        return true;
      }
      if (!carrying.adjustable) return false;
      e.preventDefault();
      carrying.raise(dir);
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
        key('Scroll', 'Wider / narrower'),
        key('− / +', 'Taller / shorter'),
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
      key('C', 'Catalog'),
      key('R', 'Quarter turn'),
      ...(carrying.adjustable ? [key('Scroll', 'Size'), key('− / +', 'Up / down')] : []),
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

  // The wheel sizes what you're carrying, instead of zooming the camera: a tenth a notch, and a scroll
  // is what a size wants. Up and down is the two keys instead (see press) — a scroll running away with a
  // piece leaves it a metre off, and the keys are exact. On window, in the capture phase, so it runs
  // before the player's own handler on the canvas; anything else — an empty hand, a seat's furniture —
  // passes straight through to the camera.
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.target !== ctx.canvas) return;
      if (windows.carrying) {
        e.preventDefault();
        e.stopPropagation();
        windows.resize(e.deltaY < 0 ? 1 : -1);
        return;
      }
      if (!carrying.adjustable) return;
      e.preventDefault();
      e.stopPropagation();
      carrying.resize(e.deltaY < 0 ? 1 : -1);
    },
    { capture: true, passive: false },
  );
}
