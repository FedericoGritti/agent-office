import type { WindowPlacements } from '../../../shared/windows';
import type { Slice } from '../store';

declare module '../store' {
  interface Store {
    /** The windows in the office's outside walls: the same on every floor (see shared/windows). */
    windows: WindowPlacements;
  }
  interface Topics {
    windows: true;
  }
}

export const windows: Slice = {
  init(s) {
    s.windows = {};
  },
  on: {
    welcome(s, m) {
      s.windows = m.windows;
      return ['windows'];
    },
    windows(s, m) {
      s.windows = m.windows;
      return ['windows'];
    },
  },
};
