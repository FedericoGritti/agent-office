# Controls

Back to the [README](../README.md).

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk (hold Shift to run); on the ladder, W and S climb; in a car, W is the gas, S brakes and reverses, A and D steer |
| Space | Jump (you can land on desks, couches and the cars in the garage); in a car, brake |
| Mouse drag / wheel | Orbit / zoom the camera |
| E | Interact: hire a worker, open its terminal, read a board, open the coordinator's terminal, call a meeting in the meeting room, draw on the whiteboard, read the docs at the bookshelf, watch the TV, sit down (or get up), ride the elevator, climb the ladder (or get off it), slide down a fire pole, grab a coffee, take a smoke break, tee off at the golf tee, pet the dog, pick up the basketball (then hold E and let go to shoot), order a drink at the rooftop bar, blow the DJ's air horn, step up to the dart board or the axe lane on the roof (then hold Space and let go to throw), get into one of the cars in the garage (behind the wheel, or beside whoever's driving) or out of it, knock through the north wall past the gong for 2 more desks (at the **🚧 Room to grow** sign). In the [castle](maps.md#the-castle): sit on the throne, where E is for whoever's first in line (or the Hand of the King, with nobody waiting), and speak to the Hand to send out a new worker. On the [space station](maps.md#the-space-station) it's the captain's chair and the First Officer |
| F2 | Arrange the room: look at a piece of furniture, **E** picks it up and puts it down, **R** turns it, **C** opens the catalog of things to put in the room — its own shelf of furniture, a search over models online, and at the bottom a button for what was cancelled, to put back, **scroll** sizes a piece (a hundredth to a hundred times what it came as) and **−**/**+** raise and lower it a quarter of a metre a step, **`[`**/**`]`** step it across the way it faces — or click the buttons the sign at the top carries, one step a click, each in a box of its own with its name over its buttons: **⟲**/**⟳** a quarter turn each way (0°, 90°, 180°, 270°), **←**/**→** a step across, the size, and the height (a piece a seat comes with stays as the room built it), and it stays where you leave it — **Canc** takes it away, **Esc** puts it back — **N** puts a new window in the wall you're looking at, and a window you carry follows your look along the wall, up and down it or on to another one, **scroll** sizes the window in your hands (wider or narrower) and **−**/**+** make it taller or shorter from its sill, never into another window, a doorway or the end of the wall — a sign at the top of the screen says you're arranging and how big the window is (see [Features](features.md)) |
| Y | At a chess board (see [Features](features.md)): start the game again from the first position |
| K | On the castle's throne (or in the station's captain's chair): speak to the Hand of the King (the First Officer), to send out a new worker |
| P | Prompt: give a task to a new worker, or to the one at this desk or the coordinator |
| C | Changes: the files the worker at this desk changed and their diff; commit, discard or open a PR |
| B | Open a shared shell at an empty desk |
| R | Resume a sleeping worker (or restart a shell) |
| X | Send a worker home (frees the desk; a worker with its own worktree asks what to do with it). In the [castle](maps.md#the-castle), the Kingsguard takes it down to the dungeon; on the [space station](maps.md#the-space-station), Security puts it out of the airlock |
| L | Hang a big sign over the desk you face (*Operations*, *Code cleanup*), in one of seven colors; again to change it or take it down |
| O | Open a pull request for a worker on its own branch, or see the one it has (a worker across several projects gets one in each) |
| N | Go to the worker that has waited longest on someone; again for the next one |
| F | Hang a picture from the web on a wall (scroll to size it, click to hang it) |
| Q | Put back the issue card you're carrying, or drop the basketball |
| H | These controls; in a car, honk the horn |
| T / Enter | Chat |
| G / 1–6 | Emote: hold G for the wheel (point and let go) or press 1–6 to wave, give a thumbs up, clap, dance, point or facepalm; everyone on your floor sees it |
| / | Search the chat and every terminal on your floor |
| Ctrl + K (⌘K on a Mac) | Command palette: find a worker, issue, PR, service, board, teammate or action; Enter opens it, Shift+Enter walks you there first |
| V | Join voice; in voice, hold to talk (you're muted when you let go) |
| M | Mute / unmute in voice |
| Ctrl + Space | Dictate, in a worker's terminal or a prompt box: hold it and talk, and what you said is typed in when you let go. A quick tap leaves it listening until the next tap. The **🎤** does the same |
| Tab | The ☰ menu: every window, and what shows on screen |
| Esc | Close any window but a terminal, and get back to looking around. In a terminal it is the program's key instead (see below) |
| Ctrl + [ | Send Esc to a terminal, to close a menu like Claude's `/skills` or interrupt the agent — as does the **Esc** key while one is open |
| Ctrl + ] | Close the terminal window, and get back to looking around |

You can also click a nearby desk to interact with it, or click a worker in the Workers panel (**🤖 Workers**, top right) to open its terminal.

On a phone, use the 2D view at `/lite` instead: a terminal there has a row of keys under it (**1** **2** **3**, the arrows, Enter, Tab, Esc, Ctrl+C) and a box to send a prompt. See [Features](features.md).

## In a terminal

The prompt edits the way it does in your own terminal (iTerm2's *Natural Text Editing*, or VS Code's), in Claude Code, Codex, OpenCode and a shell alike:

| Key | Action |
| --- | --- |
| Shift + Enter | A new line in an agent's prompt, without sending it (in a shell it runs the line, like Enter) |
| Ctrl + Space | Dictate: hold it and talk, and what you said is typed in at the cursor when you let go (see [Features](features.md)). **🎤 Dictate** in the terminal's header does the same |
| Ctrl + ⌫ / ⌥ + ⌫ | Delete the word before the cursor |
| ⌘ + ⌫ | Delete to the start of the line (Mac) |
| ⌘ + ⌦ | Delete to the end of the line (Mac) |
| ⌘ + ← / → | Jump to the start / end of the line (Mac) |
| Esc | Esc to the program: close a menu like Claude's `/skills`, or interrupt what it is doing. **Ctrl + [** does the same |
| ⛶ | Full screen, or back to a window. What this browser remembers, so the next terminal opens the way you left it |

The terminal is the one window **Esc** doesn't close: it is the program's key there. Close it with its **✕**, **Ctrl + ]** or a click outside it.
