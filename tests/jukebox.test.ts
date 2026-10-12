import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Jukebox } from '../src/server/jukebox.js';
import { STREAM, YOUTUBE, checkYouTubeUrl, isYouTubeLink, trackTitle, youtubeEmbed, youtubeWatch } from '../src/shared/jukebox.js';

/** A jukebox of its own, on a floor of its own: it only ever writes its own jukebox.json. */
const fresh = () => new Jukebox(mkdtempSync(join(tmpdir(), 'jukebox-')));

test('a YouTube link is read whichever way it is written, and a plain stream is not one', () => {
  assert.deepEqual(checkYouTubeUrl('https://www.youtube.com/watch?v=HAm0DayQ13E&list=RDHAm0DayQ13E&start_radio=1'), { video: 'HAm0DayQ13E', list: 'RDHAm0DayQ13E' });
  assert.deepEqual(checkYouTubeUrl('https://youtu.be/HAm0DayQ13E'), { video: 'HAm0DayQ13E' });
  assert.deepEqual(checkYouTubeUrl('https://www.youtube.com/shorts/HAm0DayQ13E'), { video: 'HAm0DayQ13E' });
  assert.deepEqual(checkYouTubeUrl('https://music.youtube.com/watch?v=HAm0DayQ13E'), { video: 'HAm0DayQ13E' });
  // A playlist's own link has no video, and the player still runs the playlist.
  assert.deepEqual(checkYouTubeUrl('https://www.youtube.com/playlist?list=PL1234567890abcdef'), { video: '' });
  assert.deepEqual(checkYouTubeUrl('https://www.youtube.com/@LoungeFocus'), { error: 'Paste a YouTube video or playlist link' });
  // The office's own pages are not YouTube's.
  assert.equal(isYouTubeLink('https://radio.example.org/live.mp3'), false);
  assert.equal(isYouTubeLink('https://www.youtube.com/watch?v=HAm0DayQ13E'), true);
});

test('the embed and the watch pages carry the video and its playlist', () => {
  assert.equal(youtubeEmbed('HAm0DayQ13E', 'PL1234567890abcdef'), 'https://www.youtube.com/embed/HAm0DayQ13E?list=PL1234567890abcdef');
  assert.equal(youtubeEmbed('', 'PL1234567890abcdef'), 'https://www.youtube.com/embed/videoseries?list=PL1234567890abcdef');
  assert.equal(youtubeWatch('HAm0DayQ13E'), 'https://www.youtube.com/watch?v=HAm0DayQ13E');
});

test('a video put on the jukebox stays there, keeps its history and comes back after a restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jukebox-'));
  const j = new Jukebox(dir);
  assert.deepEqual(j.play({ url: 'https://www.youtube.com/watch?v=HAm0DayQ13E&list=RDHAm0DayQ13E' }, 'Ada'), { changed: true });
  const s = j.state();
  assert.equal(s.track, YOUTUBE);
  assert.equal(s.on, true);
  assert.equal(s.video, 'HAm0DayQ13E');
  assert.equal(s.list, 'RDHAm0DayQ13E');
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].by, 'Ada');
  // The office asks YouTube what it is called, and the name lands on the video and on its history row.
  assert.equal(j.setTitle('HAm0DayQ13E', 'born to win.'), true);
  assert.equal(j.state().title, 'born to win.');
  assert.equal(j.state().history[0].title, 'born to win.');
  assert.equal(j.setTitle('HAm0DayQ13E', 'born to win.'), false, 'and telling it twice changes nothing');
  // The same video again: on top, once.
  j.play({ url: 'https://www.youtube.com/watch?v=HAm0DayQ13E&list=RDHAm0DayQ13E' }, 'Babbage');
  assert.equal(j.state().history.length, 1);
  assert.equal(j.state().history[0].by, 'Babbage');
  // A restart reads it all back.
  const back = new Jukebox(dir);
  assert.equal(back.state().track, YOUTUBE);
  assert.equal(back.state().video, 'HAm0DayQ13E');
  assert.equal(back.state().title, 'born to win.');
  assert.equal(back.state().history.length, 1);
});

test('a stream is still a stream, and off is off', () => {
  const j = fresh();
  assert.deepEqual(j.play({ url: 'https://radio.example.org/live.mp3' }, 'Ada'), { changed: true });
  assert.equal(j.state().track, STREAM);
  assert.equal(j.state().url, 'https://radio.example.org/live.mp3');
  assert.equal(j.state().history.length, 0, 'streams are not part of the history');
  assert.equal(trackTitle(j.state()), 'radio.example.org · live.mp3');
  assert.deepEqual(j.play({ url: 'not a link' }, 'Ada'), { error: "That isn't a web link. Paste an address that starts with https://" });
  assert.equal(j.stop('Ada'), true);
  assert.deepEqual(j.play({}, 'Ada'), { changed: true }, 'play with nothing turns it back on');
  assert.deepEqual(j.play({}, 'Ada'), { changed: false }, 'and a second time there is nothing to do');
});

test('the history keeps the newest first and stops growing', () => {
  const j = fresh();
  for (let i = 0; i < 45; i++) j.play({ url: `https://youtu.be/video${String(i).padStart(4, '0')}` }, 'Ada');
  const h = j.state().history;
  assert.equal(h.length, 40);
  assert.equal(h[0].video, 'video0044');
  assert.equal(h[39].video, 'video0005');
});
