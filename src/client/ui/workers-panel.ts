// The workers list in the sidebar: every worker on your floor, what it's on, and what it has spent.
// One that needs you goes to the top, in red, saying what it's asking and for how long.

import { needyFirst } from '../nextup';
import { store } from '../state';
import { DESK_BY_ID } from '../../shared/layout';
import { $, h, STATUS_LABEL, timeAgo } from './dom';
import { usageLabel, usageTitle } from './usage';
import { providerLabel, providerUsageState, providerWaitingLabel, resolvedProvider, modelBadge } from './provider';

/** What a row opens, and the row the pointer went down on. */
let openRow: ((id: string) => void) | null = null;
let pressedRow: string | null = null;
let bound = false;

/**
 * Opening a row is handled on the list rather than on each row: a worker update redraws the list, and
 * a row replaced between press and release takes the pointer's own node with it, so a per-row click
 * never fires. That redraw lands while a worker is busy — the very moment you want to watch it — which
 * is why it only swallows a click now and then. The list itself is never replaced, so pressing and
 * releasing on the same worker always opens its terminal.
 */
function bindRows(ul: HTMLElement) {
  if (bound) return;
  bound = true;
  const rowAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest('li[data-id]')?.getAttribute('data-id') ?? null;
  ul.addEventListener('pointerdown', (e) => {
    if (e.button === 0) pressedRow = rowAt(e.target);
  });
  ul.addEventListener('pointerup', (e) => {
    const row = rowAt(e.target);
    const down = pressedRow;
    pressedRow = null;
    if (e.button === 0 && row && row === down) openRow?.(row);
  });
  ul.addEventListener('pointercancel', () => {
    pressedRow = null;
  });
}

export function renderWorkers(onOpen: (id: string) => void) {
  openRow = onOpen;
  const ul = $('workers');
  bindRows(ul);
  ul.replaceChildren();
  const workers = needyFirst(store.workers.values());
  for (const w of workers) {
    const asking = w.status === 'needs_input' && !w.lost;
    const provider = w.kind === 'agent' ? providerLabel(w.provider, store.project) : null;
    const providerKind = w.kind === 'agent' ? resolvedProvider(w.provider, store.project) : undefined;
    const usageState = w.kind === 'agent' ? providerUsageState(w.provider, store.project, w.usage) : undefined;
    const waiting = usageState === 'waiting' ? providerWaitingLabel(providerKind, store.project) : '';
    const usageNote = usageState === 'untracked' ? ' · usage untracked' : waiting ? ` · ${waiting}` : '';
    const badge = w.kind === 'agent' ? modelBadge(w.provider, w.model, w.effort, w.usage?.model) : undefined;
    const sub = [provider && `⚙️ ${provider}${badge ? ` · ${badge}` : ''}${usageNote}`, w.worktree && `🌿 ${w.worktree.branch}`, w.repos?.length && `🗂️ ${w.repos.length + 1} repos`, w.pr && `🔀 PR #${w.pr.number}`, w.activity || w.title || w.prompt].filter(Boolean).join(' · ');
    // What it's stopped on, and since when, on a line of its own under its name.
    const ask = asking ? h('span.ask', {}, `🙋 ${w.activity ?? 'Waiting on an answer'}${w.waitingSince ? ` · ${timeAgo(w.waitingSince)}` : ''}`) : null;
    ul.append(
      h(
        'li',
        { class: asking ? 'needs-you-row' : '', 'data-id': w.id, title: asking ? `${w.name} needs you: open its terminal to answer` : `Open ${w.name}'s terminal` },
        h('span.dot', { style: `background:${w.color}` }),
        h('span.name', {}, w.name, sub ? h('span.sub', {}, sub) : null,
          usageState === 'tracked' && w.usage ? h('span.cost', { title: usageTitle(w.usage, providerKind) }, usageLabel(w.usage, providerKind)) : null),
        w.lost ? h('span.pill.lost', { title: 'Its worktree was deleted outside agent-office: open it to fix it' }, 'worktree deleted') : h('span.pill', { class: w.status }, asking ? 'NEEDS YOU' : (STATUS_LABEL[w.status] ?? w.status)),
        ask,
      ),
    );
  }
  if (!workers.length) ul.append(h('li.empty', {}, 'Walk up to a desk and press E to hire one'));
  // The count is the workers hired onto desks and bean bags (and a meeting's table): the board agents
  // standing at the Issues, PR and queue kiosks are listed but aren't counted.
  const hired = workers.filter((w) => !DESK_BY_ID.get(w.deskId)?.station).length;
  $('worker-count').textContent = hired ? String(hired) : '';
  $('workers-panel').classList.toggle('needs-you-panel', workers.some((w) => w.status === 'needs_input'));
}
