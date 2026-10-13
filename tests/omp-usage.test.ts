import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { OmpUsageReader, adoptOmpSessions, ompAgentDir, ompSessionDir, ompSessionDirName, ompSessionFile, ompSessionFileIn } from '../src/server/omp-usage.js';

/** One assistant record as OMP writes it, with what it says about the response. */
const record = (usage: unknown) => JSON.stringify({ type: 'message', message: { role: 'assistant', model: 'deepseek-v4-flash', usage } });

/** A response's numbers: total = input + output + cacheRead + cacheWrite. */
const spent = { input: 210, output: 267, cacheRead: 19072, cacheWrite: 0, totalTokens: 19549, reasoningTokens: 113, cost: { total: 0.000248916 } };

const scratch = (t: { after(fn: () => void): void }) => {
  const root = mkdtempSync(path.join(tmpdir(), 'office-omp-usage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
};

test('OMP sessions are found in the store OMP itself keeps them in', (t) => {
  const root = scratch(t);
  const sessions = path.join(root, 'agent', 'sessions');
  const project = path.join(sessions, '-work-project');
  mkdirSync(project, { recursive: true });
  const file = path.join(project, '2026-10-08T13-41-09-440Z_01a11bbf.jsonl');
  writeFileSync(file, record(spent) + '\n');

  // Where OMP keeps everything: $PI_CODING_AGENT_DIR, else ~/.omp/agent (see `omp --help`).
  assert.equal(ompAgentDir('/cwd', { HOME: root }), path.join(root, '.omp', 'agent'));
  assert.equal(ompAgentDir('/cwd', { HOME: root, PI_CODING_AGENT_DIR: path.join(root, 'agent') }), path.join(root, 'agent'));
  // A session is found in whichever project folder holds it, and in a desk folder of its own.
  assert.equal(ompSessionFile(sessions, '01a11bbf'), file);
  assert.equal(ompSessionFile(sessions, '0100nope'), undefined);
  assert.equal(ompSessionFileIn(project, '01a11bbf'), file);
  // A session id names a file: none of it ever reaches outside the folder it is looked for in.
  assert.equal(ompSessionFileIn(project, '../outside'), undefined);
});

test('OMP usage is what its session records say, counted neither twice nor once too often', (t) => {
  const root = scratch(t);
  const file = path.join(root, 'session.jsonl');
  writeFileSync(file, record(spent) + '\n' + record(spent) + '\n');
  const reader = new OmpUsageReader();

  // output is reported including reasoning, which the office keeps apart; the cost is OMP's own.
  assert.deepEqual(reader.read(file, root), {
    input: 420,
    output: 308,
    cacheRead: 38144,
    cacheWrite: 0,
    cost: 0.000248916 + 0.000248916,
    calls: 2,
    costKnown: true,
    reasoning: 226,
    model: 'deepseek-v4-flash',
  });
  // The file grows as the agent works: what was already read is never counted again...
  writeFileSync(file, record(spent) + '\n', { flag: 'a' });
  assert.equal(reader.read(file, root)?.calls, 3);
  // ...and a scan with nothing new to read changes nothing.
  assert.equal(reader.read(file, root)?.calls, 3);
});

test('the reader takes only this desk\'s own session, and never invents a number', (t) => {
  const root = scratch(t);
  const file = path.join(root, 'session.jsonl');
  const outside = path.join(root, '..', 'other.jsonl');
  writeFileSync(file, record(spent) + '\n');
  writeFileSync(outside, record(spent) + '\n');
  const reader = new OmpUsageReader();

  // A file outside the folder a desk's session lives in is not this desk's conversation.
  assert.equal(reader.read(outside, root), undefined);
  // A record whose numbers don't add up is skipped, one without a price leaves the cost a floor, and
  // a user message or a line that isn't JSON at all is not a response.
  writeFileSync(file, [
    record({ ...spent, reasoningTokens: 999 }),
    record({ input: 10, output: 5, cacheRead: 0, cacheWrite: 0 }),
    JSON.stringify({ type: 'message', message: { role: 'user', model: 'deepseek-v4-flash', usage: spent } }),
    'not json',
  ].join('\n') + '\n');
  assert.deepEqual(reader.read(file, root), {
    input: 10,
    output: 5,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    calls: 1,
    costKnown: false,
    model: 'deepseek-v4-flash',
  });
});

test("a folder's session directory is named the way OMP names one, so the office can file a worker where OMP would", () => {
  // Under home: from home, separators to dashes.
  assert.equal(ompSessionDirName(path.join(homedir(), 'work', 'shop')), '-work-shop');
  // Under the temp root, which OMP asks first (on Windows it nests inside home).
  assert.ok(ompSessionDirName(path.join(tmpdir(), 'shop')).startsWith('-tmp'));
  // Neither: the whole path between dashes.
  assert.equal(ompSessionDirName('/srv/shop'), '--srv-shop--');
  assert.equal(ompSessionDir('/srv/shop', '/sessions'), '/sessions/--srv-shop--');
  // A worktree's own folder is a path like any other: it is where OMP would file a session run there.
  assert.equal(ompSessionDirName('/srv/shop/.agent-office/worktrees/pixel-1f2e'), '--srv-shop-.agent-office-worktrees-pixel-1f2e--');
});

test("the office moves its earlier OMP sessions into the project's own folder, and leaves alone what a saved worker still names", (t) => {
  const root = scratch(t);
  const project = path.join(root, 'shop');
  const worktree = path.join(project, '.agent-office', 'worktrees', 'pixel-1f2e');
  const sessionsRoot = path.join(root, 'agent', 'sessions');
  const dataDir = path.join(project, '.agent-office');
  mkdirSync(dataDir, { recursive: true });
  const session = (cwd: string, id: string) => `${JSON.stringify({ type: 'session', id, cwd })}\n`;
  const at = (cwd: string, id: string, stem: string) => {
    const dir = ompSessionDir(cwd, sessionsRoot);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${stem}.jsonl`), session(cwd, id));
    return path.join(dir, `${stem}.jsonl`);
  };

  // A worker's conversation, in the folder OMP made for its worktree, with its artifacts folder and
  // the sub-agent it spawned inside it.
  const file = at(worktree, 'a1', '2026-10-08T21-49-35-420Z_a1');
  const own = path.join(path.dirname(file), '2026-10-08T21-49-35-420Z_a1');
  mkdirSync(own, { recursive: true });
  writeFileSync(path.join(own, '2.bash.log'), 'output\n');
  writeFileSync(path.join(own, 'Scout.jsonl'), session(worktree, 'scout'));
  // One of them is a worker the floor still has saved: it may be running on it, so it stays.
  at(worktree, 'b2', '2026-10-08T22-00-00-000Z_b2');
  writeFileSync(path.join(dataDir, 'workers.json'), JSON.stringify([{ id: 'beef', sessionId: 'b2' }]));
  // The project's own conversation, and another project's: neither is the office's to move.
  const kept = at(project, 'c3', '2026-10-08T20-00-00-000Z_c3');
  const elsewhere = at(path.join(root, 'other'), 'd4', '2026-10-08T20-00-00-000Z_d4');
  // A desk's own folder from before, of a worker that is gone: its conversation goes too.
  const desk = path.join(dataDir, 'omp-sessions', 'deadbeef');
  mkdirSync(desk, { recursive: true });
  writeFileSync(path.join(desk, '2026-10-08T13-41-09-440Z_e5.jsonl'), session(project, 'e5'));

  assert.equal(adoptOmpSessions({ dir: project, dataDir, sessionsRoot }), 2);
  const to = path.join(path.dirname(kept), '2026-10-08T21-49-35-420Z_a1');
  // The conversation, what it wrote, and the sub-agent OMP filed inside it moved together.
  assert.ok(existsSync(`${to}.jsonl`));
  assert.equal(readFileSync(path.join(to, '2.bash.log'), 'utf8'), 'output\n');
  assert.ok(existsSync(path.join(to, 'Scout.jsonl')));
  assert.ok(existsSync(path.join(path.dirname(kept), '2026-10-08T13-41-09-440Z_e5.jsonl')));
  // What a saved worker names, and what was never the office's, is where it was.
  assert.ok(existsSync(path.join(ompSessionDir(worktree, sessionsRoot), '2026-10-08T22-00-00-000Z_b2.jsonl')));
  assert.ok(existsSync(kept));
  assert.ok(existsSync(elsewhere));
  assert.equal(existsSync(path.join(dataDir, 'omp-sessions')), false);
  // Nothing left to move: a second start of the office changes nothing.
  assert.equal(adoptOmpSessions({ dir: project, dataDir, sessionsRoot }), 0);
});
