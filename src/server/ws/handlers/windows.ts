// What the editor does to the office's windows: saves the ones it moved, added or took out. The room is
// one room and the building's outside carries its windows on every floor, so everyone hears it, whichever
// floor they're on (see shared/windows).

import type { WindowsClientMsg } from '../../../shared/protocol.js';
import { sanitizeWindows } from '../../../shared/windows.js';
import type { HandlerMap } from './types.js';

export const windowsHandlers = {
  'windows.set'(ctx, _c, msg) {
    // Whatever arrives is read the way a file off the disk is: numbers where numbers go, and nothing
    // where no window can stand (see sanitizeWindows).
    if (!ctx.windows.set(sanitizeWindows(msg.windows))) return;
    ctx.broadcast({ t: 'windows', windows: ctx.windows.state() });
  },
} satisfies HandlerMap<WindowsClientMsg>;
