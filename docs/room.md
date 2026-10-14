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
you look, **Canc** takes it away.

| In the catalog | What it is |
| --- | --- |
| 🌿 Monstera, 🪴 Snake plant, 🌳 Ficus, 🌵 Succulent | the room's four pot plant species, one each, at the size they read best (the same model, `plants.glb`) |
| 🧶 Rug, 🟪 Round rug | a soft rug and a round one, the colour taken from the piece's own number so no two come out alike |
| 🛋️ Coffee table | the lounge's round table, for a second one anywhere |
| ⛲ Fountain | a stone basin with water, a bowl on a column above it and that bowl's water falling back into the basin: built in code, out of cylinders, and the one thing in the room that moves on its own |

An addition is a piece of furniture like any other — it has a footprint, the editor carries and turns
it, and `Canc` takes it away with its colliders. What is different is that it has no position in
`layout.ts` to fall back on: it stands exactly where the file says and **nowhere** when the file hasn't
got it, so an addition made on one floor doesn't turn up on another. Two more fields, and only for
additions: `kind` says what it is, and `y` says how high it stands — a pot up on the loft's floor has
the same `x` and `z` as the meeting room underneath it.

Nothing with a seat is in the catalog, and not for lack of furniture: see the next section.

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
