// What the office's machine says (see MachineState), for the hire dialogs, the queue and the monitor on the wall.

import type { MachineState } from './protocol.js';

/**
 * The screen the office's own machine shows on the wall (btop, see server/monitor.ts). It is not a
 * worker's, so it travels as a screen frame under this id, which no worker id is.
 */
export const MACHINE_SCREEN = 'machine';

/** The office has as many workers as it takes. */
export function officeFull(s: MachineState): boolean {
  return s.limit !== undefined && s.workers >= s.limit;
}

/** What the hire dialog says while the machine is under pressure. */
export function pressureNote(s: MachineState): string | undefined {
  return s.pressure ? `⚠️ This machine is under pressure: ${s.pressure}. Another worker may slow down the ones already working.` : undefined;
}
