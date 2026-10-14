import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAME_WINDOW, frameCost, framesWatched, phaseTimes, sampleFrame, watchFrames } from '../src/client/core/perf.js';

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
});

test('a reading is the average over its window, biggest phase first, and what is left over', () => {
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

  // A reading is about now: watching again forgets the last one.
  watchFrames(true);
  assert.equal(frameCost(), null);
  watchFrames(false);
});
