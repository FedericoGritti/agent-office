import type { Placements } from '../../../shared/placement';
import type { Slice, Store } from '../store';

declare module '../store' {
  interface Store {
    /** Where this floor's furniture stands: what the editor saved over layout.ts (see shared/placement). */
    layout: Placements;
  }
  interface Topics {
    layout: true;
  }
}

export const layout: Slice = {
  init(s) {
    s.layout = {};
  },
  on: {
    layout(s, m) {
      s.layout = m.placements;
      return ['layout'];
    },
  },
  enter(s, v) {
    s.layout = v.layout;
    return ['layout'];
  },
};
