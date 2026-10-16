import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stationBrief } from '../src/server/stations.js';

// The procedure itself is the coordinator skill's; the brief names it and keeps only what the skill
// has no way to say: that this is the office's coordinator, that the first request is appended, and
// that it waits for the next request afterwards.
test("the coordinator's brief points at the skill and ends with the request", () => {
  const brief = stationBrief('coordinator');
  assert.match(brief, /Coordinator/);
  assert.match(brief, /skill:\/\/coordinator/);
  assert.match(brief, /the next request may come from someone else/);
  assert.ok(brief.endsWith('The request:'));
});
