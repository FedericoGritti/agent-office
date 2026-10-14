// The online catalogs the office can put things in the room from: Poly Haven and whatever comes next.
// Here is who they are and the shape of what they give; the adapters that reach them are server-side
// (src/server/model-sources/, one per source), and the window that searches them is features/layout-editor.
//
// A model is fetched once and kept in the floor's own .agent-office folder, next to layout.json — out of
// git and out of the sync, like the rest of what the office keeps for a floor. What a saved piece
// remembers is the source and the model's id (`polyhaven:ArmChair_01`), and nothing else: the room is
// rebuilt from that (see shared/placement and world/office/external.ts).

import { catalogEntry, isCatalogKind, type CatalogKind } from './catalog.js';

/** One online catalog: what it's called, and what it asks of whoever lists its models. */
export interface ModelSourceInfo {
  /** Its name, in the window and in the credit line. */
  readonly name: string;
  /** The credit its terms ask for while its own API is the one listing the models: shown in the window. */
  readonly credit: string;
  readonly site: string;
  /** What its models cost to use, once downloaded (the asset's own licence, not the API's terms). */
  readonly licence: string;
}

export const MODEL_SOURCES = {
  polyhaven: { name: 'Poly Haven', credit: 'Powered by Poly Haven', site: 'https://polyhaven.com', licence: 'CC0' },
} as const satisfies Record<string, ModelSourceInfo>;

export type ModelSource = keyof typeof MODEL_SOURCES;
export const MODEL_SOURCE_IDS = Object.keys(MODEL_SOURCES) as readonly ModelSource[];

export function isModelSource(v: unknown): v is ModelSource {
  return typeof v === 'string' && Object.hasOwn(MODEL_SOURCES, v);
}

/** What a model's id may be: the sources' ids are file names and parts of a URL, and nothing else is
 *  read — an id off a saved file names a folder, so a `..` in one never gets that far. */
export function isModelId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 80 && /^[A-Za-z0-9._-]+$/.test(id) && id !== '.' && id !== '..';
}

/** One model in a source, as the window shows it before anything is downloaded. */
export interface ModelInfo {
  id: string;
  /** What the source calls it. */
  name: string;
  categories: readonly string[];
  /** Triangles, as the source counts them: what a click would cost the room to draw. */
  polycount: number;
  /** What it measures, in metres. */
  size: readonly [number, number, number];
  authors: readonly string[];
  /** Its picture, wherever the source keeps it: the office fetches it like the ones on the walls. */
  thumbnail: string;
}

/** A model's name as a person reads it: `ArmChair_01` is "ArmChair 01". */
export function modelName(id: string): string {
  return id.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * What a piece the editor added is: a kind of the office's own (`monstera`, `fountain`), or the source
 * and the id of a model fetched from an online catalog (`polyhaven:ArmChair_01`).
 */
export type AdditionKind = CatalogKind | `${ModelSource}:${string}`;

/** The kind of an added model: what a saved piece says, for the room to build it again. */
export function externalKind(source: ModelSource, id: string): AdditionKind {
  return `${source}:${id}`;
}

/** The model an external kind names, or null for a kind of the office's own (or for nonsense). */
export function parseExternal(kind: string): { source: ModelSource; id: string } | null {
  const at = kind.indexOf(':');
  if (at < 0) return null;
  const source = kind.slice(0, at);
  const id = kind.slice(at + 1);
  return isModelSource(source) && isModelId(id) ? { source, id } : null;
}

/** Whether a name off a file or off the wire is something the room could build something from. */
export function isAdditionKind(v: unknown): v is AdditionKind {
  return typeof v === 'string' && (isCatalogKind(v) || parseExternal(v) !== null);
}

/** What a kind is called: a model fetched from outside by the name its source gives it, a kind of the
 *  office's own by its label. (See also labelFor in shared/placement, which reads the file for the name
 *  of a piece that's already written down — this one doesn't need the file.) */
export function kindLabel(kind: AdditionKind): string {
  if (isCatalogKind(kind)) return catalogEntry(kind).label;
  const external = parseExternal(kind);
  return external ? modelName(external.id) : kind;
}

/** The office's own routes for the search window (see src/server/http/routes/models.ts). */
export const MODEL_SEARCH_PATH = '/api/models/search';
export const MODEL_ADD_PATH = '/api/models/add';
export const MODEL_FILES_PREFIX = '/api/models/files/';

/** Where a downloaded model is served from: the folder answers with the model's own file, and the names
 *  inside that file resolve under the same folder (`…/ArmChair_01/textures/….jpg`), which is how the
 *  browser's loader reads a glTF that came in more than one piece. */
export function modelFolderPath(source: ModelSource, id: string): string {
  return `${MODEL_FILES_PREFIX}${source}/${id}/`;
}
