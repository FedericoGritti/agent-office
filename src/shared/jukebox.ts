// The lounge jukebox: the tunes it has and what it's playing, shared by the server (which keeps one
// per floor) and the browser (which synthesizes the tunes, see client/sound/music.ts).

export interface JukeboxTune {
  id: string;
  title: string;
  /** A few words on the card in its list. */
  mood: string;
}

export const JUKEBOX_TUNES: readonly JukeboxTune[] = [
  { id: 'rainy-window', title: 'Rainy Window', mood: 'slow and dreamy' },
  { id: 'coffee-break', title: 'Coffee Break', mood: 'jazzy, easy swing' },
  { id: 'late-commit', title: 'Late Commit', mood: 'minor key, 2 a.m.' },
  { id: 'green-build', title: 'Green Build', mood: 'bright and bouncy' },
];

/** The `track` of a stream someone pasted. */
export const STREAM = 'stream';
/** The `track` of a YouTube video or playlist someone pasted. */
export const YOUTUBE = 'youtube';

/** One thing the jukebox has played, kept as the floor's history. */
export interface JukeboxPlay {
  /** The video id, or '' for a playlist with no video of its own. */
  video: string;
  /** The playlist the link carried, when it carried one. */
  list?: string;
  /** What YouTube calls it, once the office has asked; the id stands in until then. */
  title?: string;
  by?: string;
  /** When it went on, on the office's clock. */
  at: number;
}

export interface JukeboxState {
  on: boolean;
  /** One of JUKEBOX_TUNES, or STREAM for `url`, or YOUTUBE for `video`. It stays put while off, to turn back on. */
  track: string;
  /** Internet radio or an audio file someone pasted. */
  url?: string;
  /** The video and playlist of `track === YOUTUBE`. */
  video?: string;
  list?: string;
  /** What YouTube calls the video: the office fetches it (see server/jukebox.ts). */
  title?: string;
  /** What this floor has played, newest first, capped (see server/jukebox.ts). */
  history: JukeboxPlay[];
  /** Who last put something on, or turned it off. */
  by?: string;
  /** When the track started, on the office's clock (see the 'pong' message), so everyone hears the same bar. */
  startedAt: number;
  /** How far into the track it was when this was sent, in ms, for until the clocks are compared. */
  elapsed: number;
}

export const tuneById = (id: string): JukeboxTune | undefined => JUKEBOX_TUNES.find((t) => t.id === id);

/** What's on, for the hint bar and the jukebox's own display: a tune's title, a video's, or where the stream comes from. */
export function trackTitle(s: Pick<JukeboxState, 'track' | 'url'> & { title?: string; video?: string }): string {
  if (s.track === YOUTUBE) return s.title?.trim() || `YouTube · ${s.video || 'playlist'}`;
  if (s.track !== STREAM) return tuneById(s.track)?.title ?? 'A tune';
  try {
    const u = new URL(s.url ?? '');
    const file = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '');
    return file ? `${u.hostname} · ${file}` : u.hostname;
  } catch {
    return 'A stream';
  }
}

export function checkStreamUrl(raw: unknown): { url: string } | { error: string } {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return { error: 'Paste a link to a stream or an audio file' };
  if (s.length > 2048) return { error: 'That link is too long' };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { error: "That isn't a web link. Paste an address that starts with https://" };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'Only http and https links can play on the jukebox' };
  return { url: u.href };
}

/** The hosts whose links are YouTube's: what decides between the embed player and a plain audio stream. */
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be']);
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,60}$/;

/** Whether a link is YouTube's at all. */
export function isYouTubeLink(raw: unknown): boolean {
  try {
    return YOUTUBE_HOSTS.has(new URL(String(raw ?? '').trim()).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * The video and playlist of a YouTube link: a watch link, a youtu.be one, Shorts, an embed, or a playlist
 * on its own (then there is no video and `video` is empty).
 */
export function checkYouTubeUrl(raw: unknown): { video: string; list?: string } | { error: string } {
  let u: URL;
  try {
    u = new URL(String(raw ?? '').trim());
  } catch {
    return { error: "That isn't a web link" };
  }
  if (!YOUTUBE_HOSTS.has(u.hostname.toLowerCase())) return { error: 'That link is not a YouTube one' };
  const play = (v: string, l: string) => ({ video: VIDEO_ID.test(v) ? v : '', ...(LIST_ID.test(l) ? { list: l } : {}) });
  const seg = u.pathname.split('/').filter(Boolean);
  const list = u.searchParams.get('list') ?? '';
  const v = u.searchParams.get('v');
  if (v) return VIDEO_ID.test(v) ? play(v, list) : { error: "That isn't a YouTube video id" };
  if (u.hostname.endsWith('youtu.be') && seg[0]) return VIDEO_ID.test(seg[0]) ? play(seg[0], list) : { error: "That isn't a YouTube video id" };
  if ((seg[0] === 'shorts' || seg[0] === 'embed' || seg[0] === 'live' || seg[0] === 'videoseries') && seg[1]) return VIDEO_ID.test(seg[1]) ? play(seg[1], list) : { error: "That isn't a YouTube video id" };
  // A playlist's own link: the player can still run it through the videoseries embed.
  if ((seg[0] === 'playlist' || seg[0] === 'videoseries') && LIST_ID.test(list)) return { video: '' };
  if (LIST_ID.test(list)) return { video: '' };
  return { error: 'Paste a YouTube video or playlist link' };
}

/** The page the office's own player loads: the video, its playlist, or a playlist on its own. */
export function youtubeEmbed(video: string, list?: string): string {
  const l = list && LIST_ID.test(list) ? `list=${encodeURIComponent(list)}` : '';
  if (!video) return `https://www.youtube.com/embed/videoseries?${l}`;
  return `https://www.youtube.com/embed/${encodeURIComponent(video)}${l ? `?${l}` : ''}`;
}

/** The page a person can open instead, in YouTube itself. */
export function youtubeWatch(video: string, list?: string): string {
  const l = list && LIST_ID.test(list) ? `list=${encodeURIComponent(list)}` : '';
  if (!video) return `https://www.youtube.com/playlist?${l}`;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(video)}${l ? `&${l}` : ''}`;
}

/** The oEmbed answer, which is where the office gets a video's name without a key. */
export function youtubeOembed(video: string, list?: string): string {
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatch(video, list))}`;
}
