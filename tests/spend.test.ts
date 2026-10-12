import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OmpSpend } from '../src/server/omp-spend.js';

/** One OMP session file's lines: where it ran, then an assistant response that reports what it spent. */
function lines(cwd: string, at: Date, input: number, output: number, cost: number, provider = 'deepseek'): string {
  const rows = [
    JSON.stringify({ type: 'session', id: 's1', cwd }),
    JSON.stringify({ timestamp: at.toISOString(), message: { role: 'assistant', provider, model: 'deepseek-v4-flash', usage: { input, output, cacheRead: 0, cacheWrite: 0, cost: { total: cost } } } }),
  ];
  // OMP writes one record per line, each with its newline: a line without one waits for the rest.
  return `${rows.join('\n')}\n`;
}

/** A folder of OMP's sessions tree, named the way OMP names one: the cwd with its slashes turned to dashes. */
function folder(root: string, cwd: string): string {
  const dir = path.join(root, 'sessions', `-${cwd.replace(/^\/+/, '').replace(/\//g, '-')}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test("a project's spend counts its own folder and everything under it, its own agents, the workers' sub-agents and the advisor apart", () => {
  const home = mkdtempSync(path.join(tmpdir(), 'spend-'));
  process.env.PI_CODING_AGENT_DIR = home;
  const project = path.join(home, 'work', 'shop');
  const worktree = path.join(project, '.agent-office', 'worktrees', 'ada-1f2e');
  mkdirSync(worktree, { recursive: true });
  const today = new Date();
  const older = new Date(Date.now() - 36 * 60 * 60 * 1000);

  // The project's own session: one response today, one before it.
  const own = folder(home, project);
  const ownFile = path.join(own, '2026-10-12T10-00-00-000Z_aaa.jsonl');
  writeFileSync(ownFile, lines(project, today, 100, 10, 0.5) + lines(project, older, 50, 5, 0.25) + lines(project, today, 900, 900, 9.9, 'openai-codex'));
  // A sub-agent and the advisor, in the folder OMP files them in: inside that session's own folder.
  // The advisor works for that session, so its calls count with it.
  const inside = path.join(own, '2026-10-12T10-00-00-000Z_aaa');
  mkdirSync(inside, { recursive: true });
  writeFileSync(path.join(inside, 'Scout.jsonl'), lines(project, today, 20, 2, 0.1));
  writeFileSync(path.join(inside, '__advisor.jsonl'), lines(project, today, 5, 1, 0.02));
  // A worker's worktree under the project, and a folder that isn't this project at all.
  const work = folder(home, worktree);
  writeFileSync(path.join(work, '2026-10-12T11-00-00-000Z_bbb.jsonl'), lines(worktree, today, 30, 3, 0.15));
  const other = folder(home, path.join(home, 'work', 'other'));
  writeFileSync(path.join(other, '2026-10-12T12-00-00-000Z_ccc.jsonl'), lines(path.join(home, 'work', 'other'), today, 999, 999, 9.99));

  const spend = new OmpSpend(project, 'shop');
  const state = spend.refresh();

  assert.equal(state.project, 'shop');
  assert.equal(state.note, undefined);
  // Today: the project's own response, the sub-agent's, the advisor's and the worktree's — not `other`.
  assert.equal(state.today.tokens, 100 + 10 + 20 + 2 + 5 + 1 + 30 + 3);
  assert.equal(state.today.calls, 4);
  assert.equal(state.today.byAgent.agents.calls, 2); // the project's own session and its advisor
  assert.equal(state.today.byAgent.subagents.calls, 2); // the worker's worktree session and its sub-agent
  assert.equal(state.today.byProvider.deepseek.calls, 4);
  assert.equal(Math.round(state.today.cost * 1000) / 1000, 0.77);
  // All of it: today's four and the one from before them.
  assert.equal(state.total.calls, 5);
  assert.equal(state.total.tokens, 100 + 10 + 20 + 2 + 5 + 1 + 30 + 3 + 50 + 5);

  // Reading again doesn't count anything twice, and an OMP run on a subscription (Codex on ChatGPT)
  // isn't counted at all: its tokens have no per-token price to show beside a metered one's.
  assert.deepEqual(Object.keys(state.total.byProvider), ['deepseek']);
  const again = spend.refresh();
  assert.deepEqual(again.total, state.total);

  // A response written since: only the new one is added.
  writeFileSync(ownFile, lines(project, today, 7, 1, 0.01), { flag: 'a' });
  const grown = spend.refresh();
  assert.equal(grown.total.calls, 6);
  assert.equal(grown.total.tokens, state.total.tokens + 8);
});
