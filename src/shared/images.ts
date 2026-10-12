// The figures of a floor's project: the `images/` folder at its root (one images folder per
// repository, the file names are the index — see the project's own rules). The gallery in the office
// (features/gallery/) shows them one at a time, off this list and these bytes.

/** What GET /api/images answers: the floor's figures, by path from the project folder. */
export interface ImageList {
  files: string[];
  /** There were more than the office lists. */
  more: boolean;
  /**
   * Says when the folder changed: a figure added, taken away or written again under the same name
   * all move it. The boards re-read when it does (see features/figures), which is how a figure
   * written again shows its new self.
   */
  stamp: string;
}
