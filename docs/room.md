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
| `boards` | the checklist, the timeline, the phase and the token board | ✔ each |
| `whiteboard` | the whiteboard | ✔ |
| `figures` | the two figures boards | ✔ each |
| `gong` | the merge gong | ✔ |
| `cabinet` | the arcade cabinet | ✔ |
| `tv` | the lounge TV | ✔ |
| `machineMonitor` | the machine monitor, west wall | ✔ |
| `kitchen` | the counter, the coffee machine and the fridge, one model | ✔ together |
| `plants` | six potted plants | ✔ each, but the two the back office grows over |
| `rugs` | the rugs under the desks | ✔ each |
| `room.lounge` | the coffee table and its rug | ✔ |
| `room.lounge` | the couch and the two poufs | ✘ seats: the office's seating plan has their places, and the server hires into them |
| `balcony` | the ashtray, the smoke-break sign | ✔ |
| `balcony` | the bistro table and its two plants | ✘ merged into the balcony's scenery as it is built — one mesh, nothing to move |
| `balcony` | the bench and the two stools | ✘ seats |
| `loft` | the boss's desk, the telescope, the loft's two pots | ✔ |
| `loft` | the boss's chair and the couch | ✘ seats |
| `loft` | the floor, the posts, the glass and the roof | ✘ the building |
| `meetingRoom` | the board on the back wall, the panel beside the door | ✔ |
| `meetingRoom` | the table and its chairs | ✘ the seats a meeting is seated at |
| `lamps` | five pendant lamps | ✘ each lights a halo of its own, and the light would stay behind |
| `desks`, `beanbags`, `stationDesks` | every desk, every bean bag, the coordinator's post | ✘ the seating plan the server hires into |
| `signs` | the signs over the desks | ✘ they belong to the desk they're over |
| `walls`, `shell`, `elevator`, `garageLift`, `wing`, `stack`, `tower`, `plug`, `clearOfStairs` | the room itself | ✘ |
| `downstairs` (`cars`, `street`, `green`, `scenic`), `tee`, `hoop` | the street, the garage and the things out there | ✘ not this room |

## Why one and not the other

A piece is pickable when its builder said so, with `placed(...)` (see
`src/client/world/office/placed.ts`): the objects to move together, the position the room was built
with, and the colliders it pushed. So "can I move it?" is exactly "did the builder declare it?", and
everything the room walks into travels with the piece it belongs to — which is why a seat can't be
moved by the same gesture: its place is data the office hires by (the floor plan, the queue's
"workers at once", the walk map), not part of the furniture.

Moving is exact: at a quarter turn the objects, their colliders and the piece's use-point turn about
the piece's own middle together, and the colliders stay square to the room. A piece taken out of the
room leaves the room's colliders and what you can use, and comes back with them.
