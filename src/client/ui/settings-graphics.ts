// ⚙️ Settings' Graphics page: what the office draws, and what a frame actually costs.
//
// The three settings are applied by core/graphics.ts; the reading and the strip on screen come from
// core/perf.ts. They're together because they answer one question, and the answer is a measurement: a
// setting whose number doesn't move is a setting that isn't doing anything (see docs/how-it-works.md).

import type { Settings } from '../state';
import { store } from '../state';
import { frameCost, framesWatched, onReading } from '../core/perf';
import { h } from './dom';
import { choiceRow, setting } from './settings-rows';

/** The Graphics page: the three things a frame costs, and then what it actually costs right now. */
export function graphicsRows(settings: Settings, change: (some: Partial<Settings>) => void): Node[] {
  const outlinesRow = choiceRow('Outlines', [[true, '🖊️ On'], [false, 'Off']], () => settings.outlines, (outlines) => change({ outlines }));
  const shadowsRow = choiceRow('Shadows', [[true, '🌤️ On'], [false, 'Off']], () => settings.shadows, (shadows) => change({ shadows }));
  const resolutionRow = choiceRow('Resolution', [[2, 'Full'], [1.5, '1.5×'], [1, '1×']], () => settings.resolution, (resolution) => change({ resolution }));
  const measureRow = choiceRow('Keep measuring while I play', [[false, 'Off'], [true, '📈 On']], () => settings.measure, (measure) => change({ measure }));

  // The reading, kept up while someone is looking at it. It stops itself when measuring stops, and when the
  // window is closed with it (which the element leaves the page on): an interval outliving its element is a
  // leak nobody would ever find.
  const costRow = (() => {
    const el = h('p.setting-note', {}, 'Measuring…');
    const tick = setInterval(() => {
      if (!framesWatched() || !el.isConnected) {
        clearInterval(tick);
        return;
      }
      const cost = frameCost();
      if (!cost) return;
      const work = cost.phases.slice(0, 4).map((p) => `${p.phase} ${p.ms.toFixed(1)}`).join(' · ') || 'nothing measurable';
      const inner = cost.spans.length ? ` Inside those: ${cost.spans.slice(0, 4).map((s) => `${s.name} ${s.ms.toFixed(1)}`).join(' · ')}.` : '';
      el.textContent = `Frame ${cost.frame.toFixed(1)} ms · ${cost.fps.toFixed(0)} a second. The frame's own work: ${work}.${inner} ${cost.elsewhere.toFixed(1)} ms elsewhere (the browser drawing the page, layout, other tabs).`;
    }, 500);
    return el;
  })();

  // While the strip is on, each reading also goes to the office, which writes it down on the floor: the
  // number is then read from the machine instead of asked of whoever is watching a slow screen (see
  // server/http/routes/perf.ts). Nothing is sent while the measurement is off.
  onReading((cost, worst) => {
    const floor = store.floor ?? '';
    void fetch(`/api/perf?floor=${encodeURIComponent(floor)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at: new Date().toISOString(),
        graphics: { outlines: settings.outlines, shadows: settings.shadows, resolution: settings.resolution },
        view: settings.view,
        now: cost,
        worst,
      }),
    }).catch(() => {
      // Offline, or the office is restarting: a reading that didn't arrive is not worth a word on screen.
    });
  });

  return [
    setting('Outlines', 'you', outlinesRow, h('p.setting-note', {}, 'The ink line round everything, which is the office’s own look — and the whole room drawn a second time, every frame. Off, a slow room costs about half as much to draw and looks a little flatter.')),
    setting('Shadows', 'you', shadowsRow, h('p.setting-note', {}, 'The sun’s shadows: a map 2048 across, drawn again every frame, and looked up for every pixel of the room. Off, the room is lit flat and costs less — most of all where there is a lot in view.')),
    setting('Resolution', 'you', resolutionRow, h('p.setting-note', {}, 'How many pixels the office draws for each pixel of your screen. Full is the sharpest and the most work; 1× draws a quarter of the pixels and is hard to tell from it on a dense screen. A slow frame here is usually this, or the outlines.')),
    h('p.setting-note', {}, 'These are yours alone, kept in this browser. The office itself already offers the 2D view when frames stay slow for ten seconds — accepting it is the surest way out.'),
    setting('What a frame costs', 'you', costRow, h('p.setting-note', {}, 'Measured while this page is open (or after you close it, if you asked it to keep going), so nothing is slowed down by measuring it. Read it with the three above at Full and then turned down: if the frame time hardly moves, what the office costs is its own work every frame — the workers, the sky, the smoke — and not what it draws, and no drawing setting will fix it. The biggest phases are named first.')),
    setting('Keep measuring while I play', 'you', measureRow, h('p.setting-note', {}, 'A small strip in the corner of the screen saying what a frame costs right now and the worst one since you switched it on, kept up while you walk about — this window takes the controls while it is open, so a stutter can only be caught out there. Switch it on, go and do the thing that stutters, read the strip, then switch it off.')),
  ];
}
