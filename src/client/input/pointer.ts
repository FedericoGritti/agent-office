/**
 * Pointing at things and using them: what's under the crosshair (first person) or what you're
 * standing at (third), within each kind's reach (see ctx.interactions), the note on the issues board
 * the mouse points at, and clicking the world to use what's there.
 */
import * as THREE from 'three';
import { SLAB } from '../../shared/layout';
import type { GhIssue } from '../../shared/protocol';
import type { Ctx } from '../core/context';
import type { CoreState } from '../core/ctx';
import type { Parts } from '../core/parts';
import { interactionAvailable, type DeskKey } from '../interaction';
import { span } from '../core/perf';
import { coarseMeshes } from '../core/raycast';
import { EYE_HEIGHT } from '../player';
import { store } from '../state';
import { modalOpen, toast } from '../ui/dom';
import type { Interactable } from '../world/types';

export type PointerParts = Pick<Parts, 'worlds' | 'rooftop' | 'place' | 'you' | 'boards' | 'cards' | 'seating' | 'hoops' | 'emotes' | 'hanging' | 'telescope' | 'hintbar'>;

/** How often the heavy models the ray meets are looked for again (see sweepHeavyMeshes). */
const SWEEP_MS = 2000;

/** Listens for the mouse over the canvas, registers the aim tick ('aim'), and takes the player's clicks. */
export function installPointer(ctx: Ctx, core: CoreState, parts: PointerParts) {
  const { player, camera, canvas, office } = ctx;
  const { inOffice, plan } = parts.worlds;
  const reach = () => parts.you.reach();

  let target: Interactable | null = null;
  /** The note on the issues board under the crosshair (or, in third person, the mouse), which E takes. */
  let aimedNote: GhIssue | null = null;
  /** Where the mouse is over the scene, for pointing at notes in third person; null when it's off it. */
  let pointer: THREE.Vector2 | null = null;
  /** The checklist board's arrow under the aim (the crosshair, or the mouse), if any. */
  let aimedArrow: 'up' | 'down' | null = null;
  /** Whether the spend board's refresh button is under the aim. */
  let aimedRefresh = false;

  function pickTarget(): Interactable | null {
    // Nearly everything you can use is upstairs; down on the street you're under it all, but for the
    // elevator's stop in the garage.
    const below = player.pos.y < -SLAB - 1;
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const list of usable()) {
      for (const it of list) {
        if (it.off) continue;
        if (below !== (it.y ?? 0) < -SLAB - 1) continue;
        // Up on the loft, or down underneath it.
        if (Math.abs((it.y ?? 0) - player.pos.y) > 1.5) continue;
        const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z);
        if (d < it.radius && d < bestD) {
          best = it;
          bestD = d;
        }
      }
    }
    return best;
  }

  /** What you can use where you are, and what's in the way of looking at it. */
  function usable(): (readonly Interactable[])[] {
    const roof = parts.rooftop.roof();
    if (core.upTop && roof) return [roof.interactables];
    return inOffice() ? [office.interactables, ...ctx.usables.lists()] : [ctx.world().interactables, parts.worlds.court()?.interactables ?? []];
  }

  /** `note` is the issue note you're pointing at on the issues board, if any (see aimedNote). */
  function interact(target: Interactable | null, key: DeskKey, note = aimedNote) {
    if (!target) return;
    if (target.kind !== 'issues') note = null;
    const carrying = core.carrying;
    if (key === 'E' && carrying && parts.cards.dropCard(target, carrying, note)) return;
    // What each kind of thing does is defined with it (see ctx.interactions).
    ctx.interactions.use(target, key, note);
  }

  /** Keys that use what you're facing: at a desk, each does something else (see interact). */
  function use(it: Interactable | null, key: DeskKey, note = aimedNote): boolean {
    const worker = it?.deskId ? store.workerAtDesk(it.deskId) : undefined;
    const room = !!(it?.deskId && plan().byId.get(it.deskId)?.room);
    if (!interactionAvailable(it, key, { worker, room, note, carrying: !!core.carrying })) return false;
    reach();
    interact(it, key, note);
    return true;
  }

  // ---- Clicking the world: use what's under the crosshair (first person) or the mouse (third) ----------
  const raycaster = new THREE.Raycaster();
  // Nothing further than this can be used (the longest reach is the TV's 10 m, plus the 2.5 m of slack a
  // click in third person allows), and nothing further can be in the way of something you can use: the ray
  // needn't be cast through the street, the garage or the floors above to answer "what am I facing?".
  raycaster.far = 20;
  const CROSSHAIR = new THREE.Vector2(0, 0);
  const eye = new THREE.Vector3();
  /** What the ray is cast through, and how often the heavy models in it are looked for again. */
  function rayRoots(): THREE.Object3D[] {
    const roof = core.upTop ? parts.rooftop.roof() : null;
    if (roof) return roof.pickables;
    return inOffice() ? [office.group, ...ctx.usables.pickables()] : ctx.world().pickables;
  }
  let sweptAt = -SWEEP_MS;

  /**
   * A model with tens of thousands of triangles costs three about a millisecond per thousand of them, every
   * frame the ray meets it (see core/raycast.ts). Swept again now and then rather than once, because the
   * room gains pieces while you're in it.
   */
  function sweepHeavyMeshes() {
    const now = performance.now();
    if (now - sweptAt < SWEEP_MS) return;
    sweptAt = now;
    span('sweep', () => coarseMeshes(rayRoots()));
  }

  /** What the ray through `ndc` lands on first, whether it is within reach (plus `slack` meters), and where it hit. */
  function aimedAt(ndc: THREE.Vector2, slack = 0): { it: Interactable; near: boolean; hit: THREE.Intersection } | null {
    raycaster.setFromCamera(ndc, camera);
    eye.set(player.pos.x, player.pos.y + EYE_HEIGHT, player.pos.z);
    // (Workers standing in line in the castle carry their spot's interactable: see Court.)
    for (const hit of raycaster.intersectObjects(rayRoots(), true)) {
      let it: Interactable | undefined;
      let shown = true;
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        if (!o.visible) shown = false;
        it ??= o.userData.interact as Interactable | undefined;
      }
      if (!shown) continue;
      if (!it || it.off) return null; // a wall, the floor, a plant… is in the way
      // How close you must be to use it is each kind's own (see ctx.interactions).
      return { it, near: hit.point.distanceTo(eye) <= ctx.interactions.reach(it.kind) + slack, hit };
    }
    return null;
  }

  /**
   * On the throne, E is for whoever's first in line (or, with nobody waiting, the herald beside you):
   * what you'd be facing, sat there. Null when you're not on the throne.
   */
  function throneTarget(): Interactable | null {
    const id = plan().throne?.id;
    if (!id || player.seat?.seatId !== id) return null;
    const first = parts.worlds.court()?.interactables.find((it) => !it.off);
    return first ?? ctx.world().herald?.interactable ?? null;
  }

  /** The issue whose note on the issues board an aim lands on, or null (bare cork, the frame, anything else). */
  function noteUnder(aim: { it: Interactable; hit: THREE.Intersection } | null): GhIssue | null {
    if (aim?.it.kind !== 'issues' || aim.hit.object !== ctx.world().boardMeshes.issues || !aim.hit.uv) return null;
    const n = parts.boards.issuesTex.noteAt(aim.hit.uv);
    return n === undefined ? null : (store.issues.items.find((i) => i.number === n) ?? null);
  }

  /** The checklist board's arrow an aim lands on, or null (a row, the frame, anything else). */
  function arrowUnder(aim: { it: Interactable; hit: THREE.Intersection } | null): 'up' | 'down' | null {
    if (aim?.it.kind !== 'issues' || aim.hit.object !== ctx.world().boardMeshes.issues || !aim.hit.uv) return null;
    return parts.boards.checklistTex.arrowAt(aim.hit.uv);
  }

  /** The checklist board's arrow a click moves: the office changes it for everyone on the floor. */
  function scrollBoard(arrow: 'up' | 'down' | null): boolean {
    if (!arrow) return false;
    ctx.net.send({ t: 'coordinator.scroll', by: arrow === 'up' ? -1 : 1 });
    return true;
  }

  /** Whether an aim lands on the spend board's refresh button. */
  function refreshUnder(aim: { it: Interactable; hit: THREE.Intersection } | null): boolean {
    if (aim?.it.kind !== 'services' || aim.hit.object !== ctx.world().boardMeshes.services || !aim.hit.uv) return false;
    return parts.boards.spendTex.refreshAt(aim.hit.uv);
  }

  /** Reads the project's session records again: what the spend board's button does. */
  function refreshSpend(): void {
    ctx.net.send({ t: 'spend.refresh' });
  }

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    (pointer ??= new THREE.Vector2()).set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  canvas.addEventListener('pointerleave', () => (pointer = null));
  // What you're pointing at (first person) or standing at (third), and what the hint bar says about it.
  ctx.ticks.add('aim', () => {
    const { seating, hoops } = parts;
    sweepHeavyMeshes();
    const firstPerson = player.view === 'first';
    aimedNote = null;
    aimedArrow = null;
    aimedRefresh = false;
    if (modalOpen() || parts.telescope.active || ctx.activities.busy()) target = null;
    else if (firstPerson) {
      const aim = span('ray', () => aimedAt(CROSSHAIR));
      target = aim?.near ? aim.it : (throneTarget() ?? seating.mySeat() ?? (inOffice() ? hoops.ballAtFeet() : null));
      if (aim?.near) {
        aimedNote = noteUnder(aim);
        aimedArrow = arrowUnder(aim);
        aimedRefresh = refreshUnder(aim);
      }
    } else {
      target = throneTarget() ?? seating.mySeat() ?? pickTarget();
      // By a board, the mouse points at the note you'd take, an arrow you'd click, or its button.
      const over = pointer;
      if (over && (target?.kind === 'issues' || target?.kind === 'services')) {
        const aim = span('ray', () => aimedAt(over, 2.5));
        if (aim?.near) {
          aimedNote = noteUnder(aim);
          aimedArrow = arrowUnder(aim);
          aimedRefresh = refreshUnder(aim);
        }
      }
    }
    span('boards', () => {
      parts.boards.checklistTex.hover(aimedArrow);
      parts.boards.spendTex.hover(aimedRefresh);
      parts.boards.issuesTex.lift(aimedNote?.number ?? null);
    });
    span('hint', () => {
      parts.hintbar.renderHint();
      parts.hintbar.renderCrosshair();
    });
  });

  player.onClick = (ndc) => {
    const { emotes, hoops } = parts;
    // At the tee, a click is you steadying the mouse to aim: nothing else is in reach.
    // At the dart board or the axe lane, the button throws (see Thrower).
    if (modalOpen() || ctx.activities.any('takesCamera')) return;
    if (emotes.emoteWheel.isOpen) return emotes.emoteWheel.click();
    // The ball in your hands: press to wind up, let go (or click again, with no mouse captured) to shoot.
    if (hoops.holding()) {
      if (hoops.winding() && !player.locked) hoops.letFly();
      else hoops.windUp();
      return;
    }
    const { hanger } = parts.hanging;
    if (hanger.active) {
      reach();
      hanger.place(ndc);
      return;
    }
    if (player.view === 'first') {
      const pointed = aimedAt(CROSSHAIR);
      if (pointed?.near) {
        if (scrollBoard(arrowUnder(pointed))) return;
        if (refreshUnder(pointed)) {
          refreshSpend();
          return;
        }
      }
      // Reach out even at nothing, like poking the air.
      reach();
      if (target) interact(target, 'E');
      return;
    }
    const aim = aimedAt(ndc, 2.5);
    if (!aim) return;
    if (!aim.near) {
      toast('Walk closer to that first');
      return;
    }
    // A board's own controls: an arrow moves the checklist, the button reads the spend again.
    if (scrollBoard(arrowUnder(aim))) return;
    if (refreshUnder(aim)) {
      refreshSpend();
      return;
    }
    use(aim.it, 'E', noteUnder(aim));
  };

  return {
    /** What you're pointing at (first person) or standing at (third), if anything. */
    target: () => target,
    /** Lets go of what you were pointing at (looking through the telescope, say). */
    clearTarget: () => void (target = null),
    aimedNote: () => aimedNote,
    usable,
    use,
  };
}
