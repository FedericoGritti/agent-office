import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAME_WINDOW, frameCost, framesWatched, onReading, phaseTimes, sampleFrame, span, watchFrames, worstCost } from '../src/client/core/perf.js';

/** One frame as the loop measures it: the phases its own work took, and how long the browser gave it. */
function frame(ms: number, phases: Record<string, number> = {}) {
  const times = phaseTimes();
  for (const [phase, took] of Object.entries(phases)) times.set(phase as never, took);
  sampleFrame(ms);
}

test('a frame is read only while watched, and only once a whole window of them has gone by', () => {
  // Nobody watching: nothing is measured at all.
  watchFrames(false);
  frame(50, { render: 10 });
  for (let i = 0; i < FRAME_WINDOW; i++) frame(50, { render: 10 });
  assert.equal(framesWatched(), false);
  assert.equal(frameCost(), null);

  watchFrames(true);
  assert.equal(framesWatched(), true);
  assert.equal(frameCost(), null);
  // One frame says nothing: a reading appears only once a whole window of them has gone by.
  for (let i = 0; i < FRAME_WINDOW - 1; i++) frame(25, { render: 10 });
  assert.equal(frameCost(), null);
  watchFrames(false);
});

test('a reading is the average over its window, biggest phase first, and what is left over', () => {
  watchFrames(false);
  watchFrames(true);
  for (let i = 0; i < FRAME_WINDOW; i++) frame(25, { render: 10, world: 5 });
  const cost = frameCost()!;
  assert.equal(cost.frame, 25);
  assert.equal(cost.fps, 40);
  assert.deepEqual(cost.phases, [
    { phase: 'render', ms: 10 },
    { phase: 'world', ms: 5 },
  ]);
  // Everything the phases didn't account for: the browser drawing the page, layout, other tabs.
  assert.equal(cost.elsewhere, 10);
  assert.equal(cost.worst, 25);
  assert.deepEqual(cost.spans, []);

  // The worst window is what a stutter looks like, and it survives the frames after it: this is what you
  // read after walking into the lag, rather than having to catch the moment.
  for (let i = 0; i < FRAME_WINDOW; i++) frame(90, { render: 80 });
  assert.equal(frameCost()!.frame, 90);
  assert.equal(frameCost()!.worst, 90);
  assert.deepEqual(worstCost()!.phases, [{ phase: 'render', ms: 80 }]);
  for (let i = 0; i < FRAME_WINDOW; i++) frame(16, { render: 5 });
  assert.equal(frameCost()!.frame, 16);
  assert.equal(worstCost()!.frame, 90);

  // Asking again for what is already going on keeps the reading: it's thrown away only by stopping and starting.
  watchFrames(true);
  assert.equal(frameCost()!.frame, 16);
  watchFrames(false);
  watchFrames(true);
  assert.equal(frameCost(), null);
  assert.equal(worstCost(), null);
  watchFrames(false);
});

test('a named piece inside a phase is timed, and runs whether or not anyone is watching', () => {
  watchFrames(false);
  let ran = 0;
  // A millisecond of work, so the timing is well clear of the clock's own noise.
  const work = () => {
    ran++;
    const t0 = performance.now();
    while (performance.now() - t0 < 1) {
      /* spin */
    }
    return 'hit';
  };
  assert.equal(span('ray', work), 'hit');
  assert.equal(ran, 1);
  // Not watching: the phases are recorded, and the named piece is not measured at all.
  for (let i = 0; i < FRAME_WINDOW; i++) frame(20, { aim: 5 });
  assert.equal(frameCost(), null);

  watchFrames(true);
  for (let i = 0; i < FRAME_WINDOW; i++) {
    span('ray', work);
    frame(20, { aim: 5 });
  }
  const cost = frameCost()!;
  assert.equal(cost.phases[0].phase, 'aim');
  // A span is a piece of a phase, timed on its own: it says which job inside the aim is the slow one.
  assert.deepEqual(
    cost.spans.map((s) => s.name),
    ['ray'],
  );
  assert.ok(cost.spans[0].ms >= 0.5, `a millisecond of work read as ${cost.spans[0].ms} ms`);
  watchFrames(false);
});

test('a reading is handed out to whoever is listening, and only while it is being watched', () => {
  const heard: number[] = [];
  onReading((cost) => heard.push(cost.frame));
  watchFrames(false);
  watchFrames(true);
  for (let i = 0; i < FRAME_WINDOW; i++) frame(30);
  // One window in a second at most: two windows straight after each other are one reading.
  for (let i = 0; i < FRAME_WINDOW; i++) frame(30);
  assert.deepEqual(heard, [30]);
  watchFrames(false);
  for (let i = 0; i < FRAME_WINDOW; i++) frame(30);
  assert.deepEqual(heard, [30]);
  onReading(null);
});
