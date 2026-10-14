// The online catalogs of models the office can fetch from, one adapter each. The table is typed with
// every source of shared/model-sources in it: a source nobody has written an adapter for doesn't compile, so
// the window can never offer a catalog the server can't reach.

import type { ModelSource } from '../../shared/model-sources.js';
import { polyhaven } from './polyhaven.js';
import type { ModelAdapter } from './types.js';

export const MODEL_ADAPTERS: Record<ModelSource, ModelAdapter> = {
  polyhaven,
};
