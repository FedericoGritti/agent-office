import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { JUKEBOX_TUNES, STREAM, YOUTUBE, checkStreamUrl, checkYouTubeUrl, isYouTubeLink, trackTitle, tuneById, type JukeboxPlay, type JukeboxState } from '../shared/jukebox.js';

/** How much of what it has played a floor keeps. */
const HISTORY = 40;
/** Longest title worth keeping. */
const TITLE = 200;

interface Saved {
  on: boolean;
  track: string;
  url?: string;
  video?: string;
  list?: string;
  title?: string;
  history?: JukeboxPlay[];
  by?: string;
  /** When the track started, on this machine's clock. */
  startedAt: number;
}

/**
 * The lounge jukebox on one floor, saved in .agent-office/jukebox.json. It only says what's on and
 * since when; every browser plays it for itself, from the same point. A YouTube link is kept as the
 * video and playlist it names, and everything it has played stays as its history, newest first.
 */
export class Jukebox {
  private s: Saved = { on: false, track: JUKEBOX_TUNES[0].id, startedAt: Date.now(), history: [] };
  private file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'jukebox.json');
    this.load();
  }

  state(): JukeboxState {
    const { on, track, url, video, list, title, by, startedAt, history } = this.s;
    const yt = track === YOUTUBE;
    return {
      on,
      track,
      ...(url && track === STREAM ? { url } : {}),
      ...(yt ? { video: video ?? '' } : {}),
      ...(yt && list ? { list } : {}),
      ...(yt && title ? { title } : {}),
      history: history ?? [],
      ...(by ? { by } : {}),
      startedAt,
      elapsed: Math.max(0, Date.now() - startedAt),
    };
  }

  /** What's on, for toasts: “Rainy Window”, a video's name, or where a stream comes from. */
  title(): string {
    return trackTitle(this.s);
  }

  /**
   * Puts on a tune, a stream or a YouTube link, or (with none of them) turns whatever it had back on.
   * Says whether anything changed, or why it can't.
   */
  play(input: { track?: unknown; url?: unknown }, by: string): { changed: boolean } | { error: string } {
    if (input.url !== undefined && input.url !== '') {
      if (isYouTubeLink(input.url)) {
        const yt = checkYouTubeUrl(input.url);
        if ('error' in yt) return yt;
        // A video the floor has played before comes back with the name it already has, until YouTube is asked again.
        const known = (this.s.history ?? []).find((p) => p.video === yt.video && (p.list ?? '') === (yt.list ?? ''))?.title;
        this.set({ on: true, track: YOUTUBE, video: yt.video, ...(yt.list ? { list: yt.list } : {}), ...(known ? { title: known } : {}), by });
        this.remember({ video: yt.video, ...(yt.list ? { list: yt.list } : {}), by, at: this.s.startedAt });
        return { changed: true };
      }
      const u = checkStreamUrl(input.url);
      if ('error' in u) return u;
      this.set({ on: true, track: STREAM, url: u.url, by });
    } else if (input.track !== undefined) {
      if (typeof input.track !== 'string' || !tuneById(input.track)) return { error: "The jukebox doesn't have that one" };
      this.set({ on: true, track: input.track, by });
    } else {
      if (this.s.on) return { changed: false };
      this.set({ ...this.s, on: true, by });
    }
    return { changed: true };
  }

  /** On to the next tune; from a stream or a video, back to the first tune. */
  skip(by: string) {
    const i = JUKEBOX_TUNES.findIndex((t) => t.id === this.s.track);
    this.set({ on: true, track: JUKEBOX_TUNES[(i + 1) % JUKEBOX_TUNES.length].id, by });
  }

  stop(by: string): boolean {
    if (!this.s.on) return false;
    this.s = { ...this.s, on: false, by };
    this.save();
    return true;
  }

  /** What YouTube calls a video: the office asks it (see ws/handlers/jukebox.ts), and this puts it on the
   *  video and on its history entry. Says whether the state changed, so the floor only needs telling once. */
  setTitle(video: string, title: string): boolean {
    const t = title.trim().slice(0, TITLE);
    if (!t) return false;
    const before = this.s.history ?? [];
    const history = before.map((p) => (p.video === video && !p.title ? { ...p, title: t } : p));
    const on = this.s.track === YOUTUBE && this.s.video === video;
    if (!(on && this.s.title !== t) && history.every((p, i) => p === before[i])) return false;
    this.s = { ...this.s, ...(on ? { title: t } : {}), history };
    this.save();
    return true;
  }

  /** Newest first, without repeating what is already on it. */
  private remember(play: JukeboxPlay) {
    const key = `${play.video}|${play.list ?? ''}`;
    const rest = (this.s.history ?? []).filter((p) => `${p.video}|${p.list ?? ''}` !== key);
    this.s = { ...this.s, history: [play, ...rest].slice(0, HISTORY) };
    this.save();
  }

  private set(s: Omit<Saved, 'startedAt' | 'history'>) {
    this.s = { ...s, history: this.s.history, startedAt: Date.now() };
    this.save();
  }

  private load() {
    if (!existsSync(this.file)) return;
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Saved>;
      const history = (Array.isArray(raw.history) ? raw.history : [])
        .filter((p): p is JukeboxPlay => !!p && typeof p === 'object' && typeof (p as JukeboxPlay).video === 'string')
        .slice(0, HISTORY)
        .map((p) => ({
          video: p.video.slice(0, 32),
          ...(typeof p.list === 'string' ? { list: p.list.slice(0, 64) } : {}),
          ...(typeof p.title === 'string' && p.title ? { title: p.title.slice(0, TITLE) } : {}),
          ...(typeof p.by === 'string' ? { by: p.by.slice(0, 24) } : {}),
          at: typeof p.at === 'number' && Number.isFinite(p.at) ? p.at : 0,
        }));
      const startedAt = typeof raw.startedAt === 'number' && Number.isFinite(raw.startedAt) ? raw.startedAt : Date.now();
      const by = typeof raw.by === 'string' ? raw.by.slice(0, 24) : undefined;
      const title = typeof raw.title === 'string' && raw.title ? raw.title.slice(0, TITLE) : undefined;
      const on = raw.on === true;
      const keep = { ...(by ? { by } : {}) };
      if (raw.track === YOUTUBE) {
        const yt = checkYouTubeUrl(raw.video ? `https://www.youtube.com/watch?v=${raw.video}${raw.list ? `&list=${raw.list}` : ''}` : `https://www.youtube.com/playlist?list=${raw.list}`);
        if ('error' in yt) return void (this.s = { ...this.s, history });
        this.s = { on, track: YOUTUBE, video: yt.video, ...(yt.list ? { list: yt.list } : {}), ...(title ? { title } : {}), history, ...keep, startedAt };
        return;
      }
      if (raw.track === STREAM) {
        const u = checkStreamUrl(raw.url);
        if ('error' in u) return void (this.s = { ...this.s, history });
        this.s = { on, track: STREAM, url: u.url, history, ...keep, startedAt };
        return;
      }
      if (typeof raw.track === 'string' && tuneById(raw.track)) this.s = { on, track: raw.track, history, ...keep, startedAt };
      else this.s = { ...this.s, history };
    } catch {
      // a broken file just means a quiet lounge
    }
  }

  private save() {
    try {
      writeFileSync(this.file, JSON.stringify(this.s, null, 2), { mode: 0o600 });
    } catch {
      // disk issues shouldn't take the office down
    }
  }
}
