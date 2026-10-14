# What is in the office, and what can be picked up

Back to the [README](../README.md) and to [Features](features.md).

The office is built from thirty-odd pieces, each declaring its own furniture as the room goes up
(`src/client/world/office/build.ts`). Press **F2** and what a piece *declares* can be picked up; the
rest is either the building itself or something another system owns. This is the whole roll call:
every piece, what stands in it, and — where something can't be moved — why not. **F2** also has a
catalog (**C**): the things the room doesn't have at all until you put one down (see *What you can put
in the room* below).

Anything you carry keeps its own height, so a board that hangs two metres up can be floated anywhere
in the room at two metres, and turned on the spot.

| Piece | In the room | Pick it up? |
| --- | --- | --- |
| `jukebox` | the jukebox | ✔ |
| `bookshelf` | the shelf of the project's docs | ✔ |
| `boards` | the checklist, the timeline, the phase and the token board | ✔ each |
| `whiteboard` | the whiteboard | ✔ |
| `figures` | the three figures boards | ✔ each |
| `gong` | the merge gong | ✔ |
| `cabinet` | the arcade cabinet | ✔ |
| `tv` | the lounge TV | ✔ |
| `machineMonitor` | the machine monitor, west wall | ✔ |
| `kitchen` | the counter, the coffee machine and the fridge, one model | ✔ together |
| `plants` | the room's six potted plants | ✔ each, the ones the back office grows over included |
| `rugs` | the rugs under the desks | ✔ each |
| `room.lounge` | the couch, the coffee table, their rug, the two cushions | ✔ each: a cushion and the couch take their seat along |
| `balcony` | the ashtray, the smoke-break sign | ✔ |
| `balcony` | the bistro table and its two plants | ✘ merged into the balcony's scenery as it is built — one mesh, nothing to move |
| `balcony` | the bench and the two stools | ✘ seats the balcony is furnished with |
| `loft` | the boss's desk, the telescope, the couch, the rug, the loft's two pots | ✔ each, on the loft's own floor |
| `loft` | the boss's chair | ✘ a seat |
| `loft` | the floor, the posts, the glass and the roof | ✘ the building |
| `meetingRoom` | the board on the back wall, the panel beside the door | ✔ each |
| `meetingRoom` | the table | ✔ |
| `meetingRoom` | the chairs round it | ✘ seats a meeting is seated at |
| `lamps` | five pendant lamps | ✘ each lights a halo of its own, and the light would stay behind |
| `desks`, `stationDesks` | every desk a worker sits at, and the coordinator's | ✔ each: the seat moves with the desk |
| `beanbags` | the cushions the overflow sits on, out in the room | ✔ each: the seat moves with the cushion |
| `signs` | the signs over the desks | ✘ on their own: each belongs to the desk it names, and travels with it |
| `walls`, `shell`, `elevator`, `garageLift`, `wing`, `stack`, `tower`, `plug`, `clearOfStairs` | the room itself | ✘ |
| `downstairs` (`cars`, `street`, `green`, `scenic`), `tee`, `hoop` | the street, the garage and the things out there | ✘ not this room |

## What you can put in the room

**C** while you're arranging opens the catalog — `src/shared/catalog.ts` is the list, and
`src/client/world/office/catalog.ts` builds each one. Picking a thing puts it in the room two metres in
front of you, on the same 25 cm grid, in your hands to place: **R** turns it, **E** puts it down where
you look, **PgUp**/**PgDn** (or the scroll wheel) lift it and lower it, **−**/**+** make it bigger or
smaller, **Canc** takes it away.

| In the catalog | What it is |
| --- | --- |
| 🌿 Monstera, 🪴 Snake plant, 🌳 Ficus, 🌵 Succulent | the room's four pot plant species, one each, at the size they read best (the same model, `plants.glb`) |
| 🧶 Rug, 🟪 Round rug | a soft rug and a round one, the colour taken from the piece's own number so no two come out alike |
| 🛋️ Coffee table | the lounge's round table, for a second one anywhere |
| ⛲ Fountain | a stone basin with water, a bowl on a column above it and that bowl's water falling back into the basin: built in code, out of cylinders, and the one thing in the room that moves on its own |

An addition is a piece of furniture like any other — it has a footprint, the editor carries and turns
it, and `Canc` takes it away with its colliders. What is different is that it has no position in
`layout.ts` to fall back on: it stands exactly where the file says and **nowhere** when the file hasn't
got it, so an addition made on one floor doesn't turn up on another. Three more fields, and only for
additions: `kind` says what it is, `y` says how high it stands — a pot up on the loft's floor has the
same `x` and `z` as the meeting room underneath it, and one the editor lifted into the air keeps the
height it was left at — and `scale` says how big it is when it isn't the size it was built at.

**A thing you added can be resized; the room's own furniture can't.** Press **=** (or **−**) while you
carry one and it grows or shrinks — a hundredth of what it came as at the smallest, a hundred times at
the largest, a tenth a press — about its own middle and the height it stands at, so it stays where
you're putting it, and what you walk into grows with it. The sign at the top says how big it is
(`Carrying Monstera (130%)`), and the size is saved with everything else: it comes back that size for
everyone on the floor and after a restart.

**And it can be lifted.** While you carry a thing you added, **PgUp** raises it a quarter of a metre and
**PgDn** lowers it — or the scroll wheel, a step a turn. It goes straight up and down where it stands,
never drifting towards you or the floor, and never under the floor or through the ceiling above it (less
the thing's own height, so a tall model held up over the loft doesn't end up standing through the roof).
Left up there it stays up there, because nothing in this room falls. The height is saved with the rest
(`y` in the file, where the floor is 0 and needs no saying), and the sign at the top says it
(`Carrying Monstera (130% · 3.25 m up)`): a lamp raised over the lounge is still hanging there for
everyone on the floor, and after a restart. The room's own furniture is not lifted — a board stays at the
height it hangs at and a desk on the floor — and carrying one of those is carrying it across the room.

Only an addition can be resized or lifted because the room's own furniture is where the room's *plan* is
measured: a desk's seat, the chairs round the meeting table, a jukebox's use-point and the walk map round
them are numbers the office hires workers into and walks by — a desk half its size would be a seat nobody
could sit at. An addition has no seat and no use-point; it is furniture and nothing else, so its size and
its height are nobody's business but yours.

Nothing with a seat is in the catalog, and not for lack of furniture: see the next section.

### From an online catalog

The same window searches **Poly Haven** (521 models, all **CC0** — furniture, seating, tables, office
things, plants, rocks, food) and what you pick is fetched into the floor's own folder and stood in the
room like anything else: `kind: "polyhaven:ArmChair_01"` in the same file, with the model's own
materials and a footprint taken from what it measures. The results say the triangles, the metres and
who made the model, so a click is an informed one.

- **The office does the asking and the downloading** (`src/server/model-sources/`, one adapter per source,
  and the routes in `src/server/http/routes/models.ts`): a browser never reaches across to a catalog,
  and the models come down into `<project>/.agent-office/models/<source>/<id>/`, out of git and out of
  the sync like the rest of the floor's state.
- **A Poly Haven model is not one file**: a glTF, its `.bin` and its textures, all fetched together
  (the smallest resolution they offer — five to eight files, about two megabytes) and served back with
  their own names intact, so the browser's loader reads them exactly as it reads the office's own.
- **Their terms, and what the office does about them**: every call is signed as agent-office, and the
  window shows *Powered by Poly Haven*, which is the credit their API asks for while it's the one
  listing the models. The models themselves are CC0: no attribution needed once downloaded.
- **Two limits worth knowing**: an addition of this sort lives on the floor it was put on and in the
  machine that downloaded it (a second machine would fetch it again, and today nothing does that on
  its own), and an external model can only be turned in quarter turns, so one that doesn't face the
  same way the office's own models do stays as it came.
- **Other sources are one adapter away**: `src/shared/model-sources.ts` lists them and
  `src/server/model-sources/index.ts` needs one each; Poly Pizza (a free API key) and Sketchfab (a token) are
  the two that would come next, and Kenney's packs (CC0, no API) after them.

## Why one and not the other

A piece is pickable when its builder said so, with `placed(...)` (see
`src/client/world/office/placed.ts`): the objects to move together, the position the room was built
with, and the colliders it pushed. So "can I move it?" is exactly "did the builder declare it?", and
everything the room walks into travels with the piece it belongs to.

Some seats are furniture too — a desk, a cushion, a couch. Moving one of those writes the piece *and*
the seat (see `applyToSeats` in `src/shared/placement.ts`), so the office hires into the new place and
the walk map around it is computed from it. The cushions out in the room and the meeting chairs are
seats and nothing else: there is no furniture of their own to move.

That is also why the catalog has no cushion, couch or chair in it. A seat the room's list hasn't got is
a place the office can't hire into, the queue can't count and the walk map doesn't know
(`SEATING` in `src/shared/layout.ts`, and a worker per desk): the catalog puts furniture in the room,
while a seat is a place, and the room's places are settled. A cushion you couldn't sit on would be a
cushion shaped like one.

Moving is exact: at a quarter turn the objects, their colliders and the piece's use-point turn about
the piece's own middle together, and the colliders stay square to the room. A collider is written into
rather than replaced, because the room's list of what's in the way holds that very object — a
replacement would leave the old shape standing as a wall you can't see. A piece taken out of the room
leaves the room's colliders and what you can use, and comes back with them.

Nothing is tied to the wall it was built on: a board comes off it like anything else, keeps the height
it hangs at, and can be left floating anywhere in the room — or hung back where it was. A piece up in
the loft is carried along the loft's floor, not the ground floor's.
