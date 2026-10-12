import { EMPTY_SPEND, type SpendState } from '../../../shared/protocol';
import type { Slice } from '../store';

declare module '../store' {
  interface Store {
    /** What the floor's project has spent in OMP, off OMP's own session records. */
    spend: SpendState;
  }
  interface Topics {
    spend: true;
  }
}

export const spend: Slice = {
  init(s) {
    s.spend = { ...EMPTY_SPEND };
  },
  on: {
    spend(s, m) {
      s.spend = m.state;
      return ['spend'];
    },
  },
  enter(s, v) {
    s.spend = v.spend;
    return ['spend'];
  },
};
