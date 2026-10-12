/**
 * Moving the room's furniture and taking it away, from inside the room (F2). Where a piece stands stops
 * being a number in layout.ts and becomes a file this writes (see shared/placement for the file and
 * world/office/placed for what a piece is), so the room can be rearranged without rebuilding the
 * office. What can be picked up is what the room's builders declared with placed(): the jukebox, the
 * shelf of the project's docs, the boards, the whiteboard, the figures, the gong and the cabinet.
 */
import { setPlacements } from '../../../shared/placement';
import type { Ctx } from '../../core/context';
import { store } from '../../state';
import { toast } from '../../ui/dom';
import { applyPlacements } from '../../world/office/placed';
import { Hands } from './hands';
import { openLayoutEditor } from './ui';

export function installLayoutEditor(ctx: Ctx) {
  const hands = new Hands(ctx.office, ctx.camera, ctx.canvas, {
    send: (file) => ctx.net.send({ t: 'layout.set', placements: file }),
  });

  // The floor's file comes with its view, and again whenever anyone saves: the furniture goes where it
  // says. The room is built at layout.ts' numbers first, so a floor nobody has touched has no file.
  store.on('layout', () => {
    setPlacements(store.layout);
    applyPlacements(ctx.office);
  });

  let open = false;
  ctx.keys.bind({
    code: 'F2',
    run: () => {
      if (open) {
        toast('The room is already open');
        return;
      }
      if (!store.floor) {
        toast('Take the elevator to a floor first', 'warn');
        return;
      }
      open = true;
      openLayoutEditor(hands, {
        canEdit: () => !!store.floor,
        save: (file) => {
          setPlacements(file);
          ctx.net.send({ t: 'layout.set', placements: file });
        },
      });
    },
  });
  ctx.messages.on('layout', () => (open = false));
}
