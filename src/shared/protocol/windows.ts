// The windows in the office's outside walls: what the editor moves, adds and takes out of them (see
// shared/windows for the file itself, and features/layout-editor for the hands that change it). The
// room is one room, shared by every floor, so this is the office's state and not a floor's: the same
// message goes to everyone, whichever floor they're on.

import type { WindowPlacements } from '../windows.js';

/** What the editor saves: the windows that aren't where the room builds them, and the new ones. */
export type WindowsClientMsg = { t: 'windows.set'; windows: WindowPlacements };

/** The windows as they stand, to everyone in the office: the same on every floor. */
export type WindowsServerMsg = { t: 'windows'; windows: WindowPlacements };
