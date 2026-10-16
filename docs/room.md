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
| `desks`, `stationDesks` | every desk a worker sits at, and the coordinator's | ✔ each: the seat moves with the desk |
| `beanbags` | the cushions the overflow sits on, out in the room | ✔ each: the seat moves with the cushion |
| `signs` | the signs over the desks | ✘ on their own: each belongs to the desk it names, and travels with it |
| `walls`, `shell`, `elevator`, `garageLift`, `wing`, `stack`, `tower`, `plug`, `clearOfStairs` | the room itself | ✘ |
| `downstairs` (`cars`, `street`, `green`, `scenic`), `tee`, `hoop` | the street, the garage and the things out there | ✘ not this room |

Anything with a **✔** can also be lifted and resized (**−**/**+**, **scroll**) — the room's own
furniture as much as what the catalog adds — except the pieces that say a seat comes with them (a desk, a
cushion, a couch): those keep the height and the size the room builds them at, for the reason below.

## The windows

The windows are not pieces: each is a hole in an outside wall, cut where `src/shared/windows.ts` says
(`src/client/world/office/shell.ts`). **F2** picks one out of the wall with **E** like furniture, but
then it behaves differently: it follows your look — along the wall you're looking at, up and down it,
or on to another wall — with **N** putting in a new one and **Canc** taking one out for good, leaving a
plain run of wall. The walls are not moved but built again round the list as it stands, and the
building's outside with them.

A window is carried about its wall rather than over the floor: it follows your look along the wall and
up and down it, and it stops at the floor and at the ceiling. **Scroll** while you carry one and it grows
or shrinks sideways, about its own middle, so it stays where it stands; **−**/**+** make it taller or
shorter, growing upwards so that the sill the room's row put it on stays. The sign at the top says how
wide it is and how tall, in metres, and carries a pair of buttons for each.

A step stops where a window stops: never under the smallest hole that is a window — two rungs of the
grid, 50 cm, which still leaves the walls the 40 cm they keep between two holes — never into another
window or a doorway, never past the end of its wall or through the ceiling. A step that would go there is
not taken at all, so the window stays exactly as it is and the sign goes on saying what it is.

Every window is measured on the room's own 25 cm grid — its place along the wall, its width, its sill and
its head — the same ladder the furniture moves and grows by, and the one a step sizes a window on. The
room's own windows are on it, so two of them are the same size and sit on one line, and one put in by
hand copies a size that is on it; anything off it is a window a few centimetres out of line with the next.

A window can only go where a window can be: inside the ends of its wall, clear of the other windows and
of the doorways, and off the slab the boss's office stands on. A new one copies the size of the window
nearest it at that height (the boss's office's row, or the meeting room's below it, not whichever is
nearer along the wall). And it is the building's windows, not the floor's: every floor is the same room
and the tower outside carries them on every floor, so the list is kept in `.agent-office/windows.json`,
one file for the office, beside the sky and the decorations.

## What you can put in the room

**C** while you're arranging opens the catalog — `src/shared/catalog.ts` is the list, and
`src/client/world/office/catalog.ts` builds each one. Picking a thing puts it in the room two metres in
front of you, on the same 25 cm grid, in your hands to place: **R** turns it, **E** puts it down where
you look, **−**/**+** lift it and lower it, **scroll** makes it bigger or smaller, **Canc** takes it away.

| In the catalog | What it is |
| --- | --- |
| 🌿 Monstera, 🪴 Snake plant, 🌳 Ficus, 🌵 Succulent | the room's four pot plant species, one each, at the size they read best (the same model, `plants.glb`) |
| 🧶 Rug, 🟪 Round rug | a soft rug and a round one, the colour taken from the piece's own number so no two come out alike |
| 🛋️ Coffee table | the lounge's round table, for a second one anywhere |
| 🪀 Cushion, mint · sun · blush | a floor cushion, the lounge's own pouf in three colours: a corner to throw yourself into, or a ring of them round a table |
| ⛲ Fountain | a stone basin with water, a bowl on a column above it and that bowl's water falling back into the basin: built in code, out of cylinders, and the one thing in the room that moves on its own |

A shelf isn't everything the room has, and the reason is worth knowing: the television, the whiteboard,
the four boards, the machine monitor and the figures boards are **one of a kind**, because the feature
that draws them draws one screen. A copy of a screen would be a screen nobody paints. Making them
replicable is one step per feature — its own file learns to paint every screen of its kind — and until
that is done they are not on the shelf. Nor is anything with a seat: a desk or a couch the office's list
hasn't got is a place nobody can be hired into, which is why a cushion here is furniture and not a place
to sit.

The window has two tabs, because there are two kinds of thing in it. **🧰 The office's own** is what the
room can build then and there — a shelf of groups (🪴 Plants, 🪡 Floor and tables, 🪀 Cushions, ⛲ Water),
with a box to narrow it down — and picking one builds a copy in front of you: as many as you like, of
anything on the shelf. **🌐 Online catalogs** is searched and fetched (see below), and nothing goes over
the network until that tab is opened.

One button at the bottom, **↩️ Put back something cancelled…**, opens a list of what the floor's file has
taken out of the room — click one and it stands where it was, as big and as high as it was left. It is
kept out of the way because it isn't what the window is for, but it is the one way back for a **Canc**
pressed by mistake, and for now the only way back at all for the furniture that can't be copied yet (the
screens: a cancelled whiteboard is a whiteboard there is no second one of).

An addition is a piece of furniture like any other — it has a footprint, the editor carries and turns
it, and `Canc` takes it away with its colliders. What is different is that it has no position in
`layout.ts` to fall back on: it stands exactly where the file says and **nowhere** when the file hasn't
got it, so an addition made on one floor doesn't turn up on another. One more field, and only for
additions: `kind` says what it is. The other two are any piece's: `y` says how high it stands — a pot up
on the loft's floor has the same `x` and `z` as the meeting room underneath it, and one the editor lifted
keeps the height it was left at — and `scale` says how big it is when it isn't the size it was built at.
It is a rung of the room's ladder (see *Anything you can pick up* below): a size read off a file that
isn't one — anything a hand wrote, or a layout saved before there was a ladder — is brought to the rung
nearest it.

**Anything you can pick up can be resized and lifted; a seat's own furniture can't.** Scroll while you
carry a piece and it grows or shrinks one rung of the room's own ladder at a time — 100%, 125%, 150%,
200%, 250%, 300%, 400%, 500%, 750%, and the same rungs at every power of ten, up to a hundred times what
it came as and down to a hundredth — and **−**/**+** raise and lower it a quarter of a metre a step (`=`
is the `+` key on most keyboards, and the `-` and `+` characters work wherever they are). Both ladders are
the whole room's, not the piece's: two pieces at 150% are the same size, one at 300% is exactly twice the
one at 150%, and a height is counted **from the floor** — 0, 0.25, 0.5, … — and not a quarter of a metre
from wherever that piece happens to have been built, so a picture lifted to 2.25 is on the same line as
the boards the room hangs at 2.25 and the pictures hung beside them. It grows about its own middle and the
height it stands at, and goes straight up and down where it stands, so it stays where you're putting it;
what you walk into grows with it and goes up with it, and the place you use it from goes up too, so a
board lifted two metres is still the board you press E at. The sign at the top carries a **−**/**+** pair
for each — the size and the height beside them — and a click is one step and no more,
which is what a scroll can't promise; a button needs a cursor, so in first person, where the mouse is
captured, it is the keys that do it (**`[`**/**`]`** step a piece across the way it faces, on the room's
25 cm grid: where the look carries it, one step over, for setting a piece against something rather than
looking at it square). Each of the sign's controls is a box of its own, its name over its own buttons —
**Turn** a quarter turn each way, **Move** a step across, **Size**, **Up** — because a run of names and
buttons along one line leaves you counting along it to find out which name a button belongs to.
Left up there it stays up there, because nothing in this room falls.
It stops at the room's floor and at the ceiling above it, less the thing's own height, so a tall model
held up over the loft doesn't end up standing through the roof. The sign says how big it is and how high
on those buttons, and both are saved with everything else: they come back that way for everyone on the
floor, and after a restart.

Anything with a seat — a desk, a station, a cushion, a couch — is where the room's plan is measured: that
is the place the office hires into and the walk map goes round. Moving one writes the seat as well as the
furniture, so the office follows it; but a desk half its size would be a seat nobody could sit at, and one
up in the air a place nobody could reach, so a seat's furniture keeps the size and the height `layout.ts`
builds it at. Nothing else in the room is anything but furniture, so nothing else is anybody's business
but yours.

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
