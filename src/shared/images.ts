// The pictures a floor's Figures boards show: the project's `images/` folder by default, or another
// folder on the office machine chosen at the boards.

/** What GET /api/images answers: the selected folder and its figures by relative path. */
export interface ImageList {
  /** The absolute source folder on the office machine. */
  folder: string;
  files: string[];
  /** There were more than the office lists. */
  more: boolean;
}
