# The figures boards follow `images/`

*written 2026-10-13, on branch `figures/follow-the-folder` off `main`*

## What is wrong

The figures boards — the two rolling stands and the whiteboard's row in the office — take their
pictures from the floor project's `images/` folder (`src/server/images.ts`, `features/figures/`). A
browser reads that folder **when it arrives on a floor, and when it changes floor**, and never again.

So when someone adds a figure, replaces one, or takes one away, every board keeps showing what it
was showing. Worse, a figure written again under the same name stays stale twice over: the client
keeps the decoded bitmap in its `pictures` map keyed by name, and it never asks for the bytes again.

The rest of the office does not work this way: the services window and the queue re-read their lists
on a timer (`src/client/ui/services.ts`, `ui/queue.ts`, both every 30 s), and the server's own
watchers publish only when something actually changed (`src/server/services.ts`,
`src/server/changes.ts`).

## What changes

1. **The list says when it changed.** `ImageList` (in `src/shared/images.ts`) gains a `stamp`: a
   digest of every figure's path, size and write time. `Images.list()` in `src/server/images.ts`
   computes it during the walk it already does. A figure that is added, removed or written again
   changes the stamp, whichever of the three it was — that is what makes a replaced picture
   detectable at all, since its name stays the same.

2. **The boards ask again.** `features/figures/index.ts` re-reads the list every 30 s, the cadence
   the office already polls its other lists at, and on arriving on a floor as it does today. When
   the stamp is unchanged it stops there and touches nothing: no picture is fetched again for
   nothing. When it changed it does what it does now — clears its pictures and shows each board's
   picture again — which re-creates the `<img>`, and the picture route already answers
   `cache-control: no-store`, so the bytes really are fetched again (a figure written again under the
   same name shows its new self).

3. **The docs say so.** `docs/features.md` (the figures boards) and `docs/room.md` where it describes
   them.

## What is out of scope

- The pictures hung on the walls (`decor`, the image proxy) already re-check their links and are not
  touched.
- The type a figure is served with is still read off its name; validating the bytes instead was the
  other reading of the report and the user asked for this one.
- Nothing about how a *worker's* worktree shows its own figures: the boards read the floor's project
  folder, which is what the docs promise.

## How it is verified

- A new test, `tests/images.test.ts`: the stamp is stable over the same folder, and changes when a
  figure is added, written again under the same name, or taken away; a picture's bytes are the ones
  on disk after it is written again.
- `npx tsc -p tsconfig.client.json` and `-p tsconfig.server.json`, the whole suite, `npm run build`.
- A browser on a running office: the page loads with no errors and the figures feature re-reads the
  list on its own (a second `GET /api/images` while nobody touches anything), with the boards showing
  a figure that appeared in `images/` while the page was open.
