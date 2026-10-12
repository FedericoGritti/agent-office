# What is in the office, and what can be picked up

Back to the [README](../README.md) and to [Features](features.md).

The office is built from thirty-odd pieces, each declaring its own furniture as the room goes up
(`src/client/world/office/build.ts`). Press **F2** and what a piece *declares* can be picked up; the
rest is either the building itself or something another system owns. This is the whole roll call:
every piece, what stands in it, and — where something can't be moved — why not.

| Piece | In the room | Pick it up? |
| --- | --- | --- |
| `jukebox` | the jukebox | ✔ |
| `bookshelf` | the shelf of the project's docs | ✔ |
| `boards` | the checklist, the timeline, the phase and the token board | ✔ each, along the wall it hangs on |
| `whiteboard` | the whiteboard | ✔ |
| `figures` | the two figures boards | ✔ each |
| `gong` | the merge gong | ✔ |
| `cabinet` | the arcade cabinet | ✔ |
| `tv` | the lounge TV | ✔, along the east wall |
| `machineMonitor` | the machine monitor, west wall | ✔, along the west wall |
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
| `meetingRoom` | the board on the back wall, the panel beside the door | ✔ each, along the wall it hangs on |
| `meetingRoom` | the table | ✔ |
| `meetingRoom` | the chairs round it | ✘ seats a meeting is seated at |
| `lamps` | five pendant lamps | ✘ each lights a halo of its own, and the light would stay behind |
| `desks`, `stationDesks` | every desk a worker sits at, and the coordinator's | ✔ each: the seat moves with the desk |
| `beanbags` | the cushions the overflow sits on, out in the room | ✔ each: the seat moves with the cushion |
| `signs` | the signs over the desks | ✘ on their own: each belongs to the desk it names, and travels with it |
| `walls`, `shell`, `elevator`, `garageLift`, `wing`, `stack`, `tower`, `plug`, `clearOfStairs` | the room itself | ✘ |
| `downstairs` (`cars`, `street`, `green`, `scenic`), `tee`, `hoop` | the street, the garage and the things out there | ✘ not this room |

## Why one and not the other

A piece is pickable when its builder said so, with `placed(...)` (see
`src/client/world/office/placed.ts`): the objects to move together, the position the room was built
with, the wall it hangs on and the colliders it pushed. So "can I move it?" is exactly "did the
builder declare it?", and everything the room walks into travels with the piece it belongs to.

Some seats are furniture too — a desk, a cushion, a couch. Moving one of those writes the piece *and*
the seat (see `applyToSeats` in `src/shared/placement.ts`), so the office hires into the new place and
the walk map around it is computed from it. The cushions out in the room and the meeting chairs are
seats and nothing else: there is no furniture of their own to move.

Moving is exact: at a quarter turn the objects, their colliders and the piece's use-point turn about
the piece's own middle together, and the colliders stay square to the room. A collider is written into
rather than replaced, because the room's list of what's in the way holds that very object — a
replacement would leave the old shape standing as a wall you can't see. A piece taken out of the room
leaves the room's colliders and what you can use, and comes back with them.

A thing hung on a wall — a board, the TV, the monitor, the meeting room's board and its panel — keeps
its wall: it slides along it and keeps its distance from it, and it doesn't turn (it faces into the
room it hangs over). A piece up in the loft is carried along the loft's floor, not the ground floor's.
