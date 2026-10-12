// The lounge jukebox on every floor.
import type { Floor } from '../../floor.js';
import { JUKEBOX_TUNES, STREAM, YOUTUBE, youtubeOembed } from '../../../shared/jukebox.js';
import type { JukeboxClientMsg } from '../../../shared/protocol.js';
import type { Ctx } from '../../office/context.js';
import { here } from './common.js';
import type { HandlerMap, ViewPieces } from './types.js';

export const jukeboxView: ViewPieces['jukebox'] = (_ctx, floor) => floor?.jukebox.state() ?? { on: false, track: JUKEBOX_TUNES[0].id, history: [], startedAt: Date.now(), elapsed: 0 };
export const jukeboxChanged = (ctx: Ctx, floor: Floor) => ctx.toFloor(floor, { t: 'jukebox', state: floor.jukebox.state() });

/**
 * Asks YouTube what the video is called and tells the floor when it answers. oEmbed needs no key and no
 * account, and a video we can't name keeps its id on the board.
 */
async function nameVideo(ctx: Ctx, floor: Floor, video: string, list?: string) {
  try {
    const r = await fetch(youtubeOembed(video, list), { signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' } });
    if (!r.ok) return;
    const body = (await r.json()) as { title?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title && floor.jukebox.setTitle(video, title)) {
      jukeboxChanged(ctx, floor);
      ctx.toastFloor(floor, `📺 ${title}`);
    }
  } catch {
    // no name is a name too: the board shows the id until someone plays it again
  }
}

export const jukeboxHandlers = {
  'jukebox.play'(ctx, c, msg) {
    const who = c.peer.name;
    const floor = here(ctx, c);
    if (!floor) return;
    const r = floor.jukebox.play({ track: msg.track, url: msg.url }, who);
    if ('error' in r) return ctx.warn(c, r.error);
    if (!r.changed) return;
    jukeboxChanged(ctx, floor);
    const on = floor.jukebox.state();
    if (on.track === YOUTUBE && on.on) void nameVideo(ctx, floor, on.video ?? '', on.list);
    ctx.toastFloor(
      floor,
      on.track === YOUTUBE
        ? `📺 ${who} put a video on`
        : on.track === STREAM
          ? `📻 ${who} tuned the jukebox to ${floor.jukebox.title()}`
          : `🎵 ${who} put on “${floor.jukebox.title()}”`,
    );
  },
  'jukebox.skip'(ctx, c) {
    const who = c.peer.name;
    const floor = here(ctx, c);
    if (!floor) return;
    floor.jukebox.skip(who);
    jukeboxChanged(ctx, floor);
    ctx.toastFloor(floor, `⏭️ ${who} skipped to “${floor.jukebox.title()}”`);
  },
  'jukebox.stop'(ctx, c) {
    const who = c.peer.name;
    const floor = here(ctx, c);
    if (!floor || !floor.jukebox.stop(who)) return;
    jukeboxChanged(ctx, floor);
    ctx.toastFloor(floor, `🔇 ${who} turned the jukebox off`);
  },
} satisfies HandlerMap<JukeboxClientMsg>;
