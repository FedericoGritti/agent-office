// One online catalog of models, as the office uses it (see src/server/model-sources/ for the ones there are).

import type { ModelInfo } from '../../shared/model-sources.js';

export interface ModelAdapter {
  /** What it holds that matches `q` — the words a person typed, or nothing for "whatever you have" — as
   *  the window shows it. Throws when the catalog can't be reached: the route says so. */
  search(q: string): Promise<ModelInfo[]>;

  /**
   * Downloads one model's files into `dir`, the folder the office serves it from, and says which of them
   * is the model's own (`entry`): the file the browser's loader asks for, whose neighbours it reads by
   * the names inside it. Anything that goes wrong comes back as an error rather than a throw: fetching
   * is the one thing here that a person is waiting on.
   */
  fetch(id: string, dir: string): Promise<{ entry: string } | { error: string }>;
}
