// What a worker's body and face are doing, and how one way of holding itself is blended into the next
// (see src/client/world/character/worker-stance.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { blendStance, stanceOf, type Act, type Stance } from '../src/client/world/character/worker-stance.js';

const ACTS: Act[] = ['rest', 'up', 'waiting', 'type', 'edit', 'read', 'test', 'web', 'failing'];

test('every way of holding itself fills every part of the stance, and none of them is a hole', () => {
  const s = {} as Stance;
  for (const act of ACTS) {
    stanceOf(act, 1.5, s);
    for (const [key, value] of Object.entries(s)) {
      assert.equal(typeof value, 'number', `${act} leaves ${key} out`);
      assert.ok(Number.isFinite(value), `${act}.${key} is ${value}`);
    }
  }
});

test('its face moves with what it is doing', () => {
  const s = {} as Stance;
  // Hunched over the keys, brows down; arms up, brows up and mouth open.
  stanceOf('edit', 0, s);
  assert.ok(s.brow > 0.3 && s.mouth > 0, `edit: brow ${s.brow}, mouth ${s.mouth}`);
  stanceOf('up', 0, s);
  assert.ok(s.brow < -0.3 && s.mouth > 0.5, `up: brow ${s.brow}, mouth ${s.mouth}`);
  stanceOf('waiting', 0, s);
  assert.ok(s.brow > 0.3 && s.mouth === 0, `waiting: brow ${s.brow}, mouth ${s.mouth}`);
});

test('one way of holding itself is blended into the next, face and all', () => {
  const acts = new Map<Act, number>([['rest', 1]]);
  const scratch = {} as Stance;
  const out = {} as Stance;
  blendStance(acts, 'edit', 0.05, 0, scratch, out);
  // A twentieth of a second in, it is most of the way from resting to hunched over its keys.
  assert.ok(out.brow > 0 && out.brow < 0.9, `brow ${out.brow}`);
  assert.ok(out.lean > 0, `lean ${out.lean}`);
  blendStance(acts, 'edit', 1, 0, scratch, out);
  assert.ok(out.brow > 0.6, `settled: brow ${out.brow}`);
  assert.ok(!acts.has('rest'), 'resting was dropped, rather than blended forever');
});
