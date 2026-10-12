// The figures of a floor's project: the `images/` folder at its root (one images folder per
// repository, the file names are the index — see the project's own rules). The gallery in the office
// (features/gallery/) shows them one at a time, off this list and these bytes.

/** What GET /api/images answers: the floor's figures, by path from the project folder. */
export interface ImageList {
  files: string[];
  /** There were more than the office lists. */
  more: boolean;
}
