import './ui.css';
import { JUKEBOX_TUNES, STREAM, YOUTUBE, checkStreamUrl, trackTitle, tuneById, youtubeEmbed, youtubeWatch, type JukeboxPlay } from '../../../shared/jukebox';
import type { Net } from '../../net';
import { store } from '../../state';
import { h, openModal, toast } from '../../ui/dom';

/** "2 minutes ago", for the history. */
function ago(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hours = Math.round(m / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** The jukebox: what's on, the tunes to pick from, skip and stop, a box for a stream or a YouTube link,
 *  and what the floor has played before, newest first. */
export function openJukebox(net: Net, openVolume: () => void, showPlayer: () => void) {
  const close = h('button.btn.close', { 'aria-label': 'Close' }, '✕');
  const now = h('div.jb-now');
  const list = h('ul.svc-list');
  const screen = h('div.jb-screen');
  const history = h('ul.svc-list.jb-history');
  const url = h('input', { type: 'text', placeholder: 'https://… internet radio, an .mp3, or a YouTube link', 'aria-label': 'Stream, audio file or YouTube link', spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
  const playUrl = h('button.btn.primary', { type: 'button' }, '▶️ Play');
  const volume = h('button.btn', { type: 'button' }, '🔈 Your volume');
  const el = h(
    'div.modal.jukebox',
    { role: 'dialog', 'aria-label': 'Jukebox' },
    h('header', {}, h('h2', {}, '🎵 Jukebox'), close),
    h(
      'div.body',
      {},
      now,
      screen,
      h('label', { style: 'margin-top:16px' }, 'Put on a tune'),
      list,
      h('label', { style: 'margin-top:16px' }, 'Or play a stream or a YouTube link'),
      h('div.webhook', {}, url, playUrl),
      h('p.setting-note', {}, 'Internet radio, an audio file, or any YouTube video, Shorts or playlist link. A YouTube link plays in its own player above, so you can also watch it; the link and everything the floor has played are kept, so you can put it on again.'),
      h('label', { style: 'margin-top:16px' }, 'Played on this floor'),
      history,
    ),
    h('footer', {}, h('span.grow', {}, 'Everyone on this floor hears the same thing, at the same volume wherever they stand.'), volume),
  );

  const button = (label: string, title: string, send: () => void, primary = false) => h(primary ? 'button.btn.primary' : 'button.btn', { type: 'button', title, onclick: send }, label);

  /** Where a YouTube link plays: the jukebox's own player, out on your screen, so it carries on while you
   *  walk the floor. The window only points at it — two players would play twice. */
  const wherePlays = (j: typeof store.jukebox) => {
    if (!j.on || j.track !== YOUTUBE) return '';
    return h(
      'div.jb-where',
      {},
      h('div.svc-meta', {}, 'It plays in the jukebox’s player, on your screen, so it carries on while you walk the floor.'),
      button('▶️ Show the player', 'Bring the jukebox’s player back', () => showPlayer()),
    );
  };

  /** One history row: what it was, who put it on, when. Clicking it puts it on again. */
  const row = (p: JukeboxPlay, playing: boolean) => {
    const li = h(
      'li',
      { class: playing ? 'on' : '', tabindex: 0, role: 'button', 'aria-pressed': String(playing), title: playing ? 'Playing now' : 'Put it on again' },
      h('span.jb-icon', {}, playing ? '🔊' : '📺'),
      h(
        'div.svc-main',
        {},
        h('div.svc-title', {}, p.title?.trim() || `YouTube · ${p.video || 'playlist'}`),
        h('div.svc-meta', {}, [p.by && `put on by ${p.by}`, p.at ? ago(p.at) : ''].filter(Boolean).join(' · ')),
      ),
    );
    const again = () => {
      if (!playing) net.send({ t: 'jukebox.play', url: youtubeWatch(p.video, p.list) });
    };
    li.addEventListener('click', again);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        again();
      }
    });
    return li;
  };

  const render = () => {
    const j = store.jukebox;
    const stream = j.track === STREAM;
    const youtube = j.track === YOUTUBE;
    now.replaceChildren(
      h('span.jb-disc', { class: j.on ? 'spin' : '' }, youtube ? '📺' : stream ? '📻' : '💿'),
      h(
        'div.svc-main',
        {},
        h('div.svc-title', {}, j.on ? trackTitle(j) : 'The jukebox is off'),
        h(
          'div.svc-meta',
          {},
          j.on ? [youtube ? 'YouTube' : stream ? 'a stream' : tuneById(j.track)?.mood, j.by && `put on by ${j.by}`].filter(Boolean).join(' · ') : j.by ? `${j.by} turned it off` : 'Pick a tune to put it on',
        ),
      ),
      j.on ? button('⏭️ Skip', 'On to the next tune', () => net.send({ t: 'jukebox.skip' })) : button('▶️ Play', `Put ${trackTitle(j)} back on`, () => net.send({ t: 'jukebox.play' }), true),
      j.on ? button('⏹️ Stop', 'Turn the jukebox off', () => net.send({ t: 'jukebox.stop' })) : '',
    );
    screen.replaceChildren(wherePlays(j));
    list.replaceChildren(
      ...JUKEBOX_TUNES.map((t) => {
        const playing = j.on && j.track === t.id;
        const li = h(
          'li',
          { class: playing ? 'on' : '', tabindex: 0, role: 'button', 'aria-pressed': String(playing), title: playing ? 'Playing now' : `Put on ${t.title}` },
          h('span.jb-icon', {}, playing ? '🔊' : '🎵'),
          h('div.svc-main', {}, h('div.svc-title', {}, t.title), h('div.svc-meta', {}, t.mood)),
        );
        const pick = () => {
          if (!playing) net.send({ t: 'jukebox.play', track: t.id });
        };
        li.addEventListener('click', pick);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        });
        return li;
      }),
    );
    const played = j.history ?? [];
    if (!played.length) history.replaceChildren(h('li', { class: 'jb-empty' }, h('div.svc-meta', {}, 'Nothing yet: paste a YouTube link above.')));
    else history.replaceChildren(...played.map((p) => row(p, youtube && j.on && p.video === (j.video ?? ''))));
  };

  const play = () => {
    const u = checkStreamUrl(url.value);
    if ('error' in u) {
      toast(u.error, 'warn');
      return url.focus();
    }
    net.send({ t: 'jukebox.play', url: u.url });
    url.value = '';
  };
  playUrl.addEventListener('click', play);
  url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') play();
  });

  const modal = openModal(el, { doing: '🎵 at the jukebox', onClose: store.on('jukebox', render) });
  close.addEventListener('click', () => modal.close());
  volume.addEventListener('click', () => {
    modal.close();
    openVolume();
  });
  render();
}
