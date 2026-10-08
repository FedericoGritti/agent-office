import './coordinator.css';
import { localDay } from '../../shared/coordinator';
import type { CoordinatorState, SubplanCard } from '../../shared/protocol';
import type { Net } from '../net';
import { store } from '../state';
import { h, openModal } from './dom';

/** Which of the three boards E was pressed at, so the window opens on it. */
export type CoordinatorFocus = 'checklist' | 'timeline' | 'summary';

/** The class a status is shown under, e.g. "In flight" → st-in-flight. */
const statusClass = (status: string) => `st-${status.toLowerCase().replace(/\s+/g, '-')}`;

/** One subplan: where it stands, its id, its name, and who's on it or why it waits. */
function card(c: SubplanCard) {
  return h(
    'li.coord-card',
    { class: statusClass(c.status) },
    h('span.coord-dot', { class: statusClass(c.status), title: c.status }),
    h('span.coord-id', {}, c.id),
    h('span.coord-name', {}, c.name),
    h('span.coord-status', {}, c.statusText),
    c.owner ? h('span.coord-owner', {}, `🙋 ${c.owner}`) : c.note ? h('span.coord-note', {}, c.note) : null,
  );
}

/** The chapter a card belongs to, by its number, when the master plan names one. */
function chapterTitle(state: CoordinatorState, n: string): string {
  const chapter = state.chapters.find((c) => c.n === n);
  return chapter ? `${chapter.n} — ${chapter.title}` : n || '—';
}

/** The checklist, one group per chapter. */
function checklistPane(st: CoordinatorState): HTMLElement {
  const groups = new Map<string, SubplanCard[]>();
  for (const c of st.cards) {
    const k = c.chapter || '—';
    const list = groups.get(k);
    if (list) list.push(c);
    else groups.set(k, [c]);
  }
  return h(
    'div.coord-pane',
    {},
    h('h4', {}, 'Checklist', st.cards.length ? h('span.count', {}, String(st.cards.length)) : null),
    st.cards.length
      ? h('div', {}, ...[...groups].map(([n, cards]) => h('div.coord-group', {}, h('h5', {}, chapterTitle(st, n)), h('ul.coord-list', {}, ...cards.map(card)))))
      : h('p.coord-empty', {}, st.error ? `⚠️ ${st.error}` : 'No plan in this project’s plans/ folder yet.'),
  );
}

/** The day's timeline. */
function timelinePane(st: CoordinatorState): HTMLElement {
  const today = st.timeline.filter((e) => e.date === localDay());
  return h(
    'div.coord-pane',
    {},
    h('h4', {}, 'Today', today.length ? h('span.count', {}, String(today.length)) : null),
    today.length
      ? h('ul.coord-timeline', {}, ...today.map((e) => h('li', {}, h('span.coord-time', {}, e.time), h('span.coord-text', {}, e.text))))
      : h('p.coord-empty', {}, 'Nothing on today’s timeline yet.'),
  );
}

/** The phase and its chapters. */
function summaryPane(st: CoordinatorState): HTMLElement {
  return h(
    'div.coord-pane',
    {},
    h('h4', {}, 'Phase'),
    h('p.coord-goal', {}, st.goal ?? 'No goal written in the master plan yet.'),
    st.chapters.length
      ? h('ul.coord-chapters', {}, ...st.chapters.map((c) => h('li', { title: c.question ?? '' }, h('b', {}, c.n), ' ', c.title, c.question ? h('small', {}, ` — ${c.question}`) : null)))
      : h('p.coord-empty', {}, 'No chapters written in the master plan yet.'),
  );
}

/** What each board shows, and what its tab is called. */
const PANES: Record<CoordinatorFocus, (st: CoordinatorState) => HTMLElement> = { checklist: checklistPane, timeline: timelinePane, summary: summaryPane };
const LABELS: Record<CoordinatorFocus, string> = { checklist: '📋 Checklist', timeline: '🕓 Today', summary: '🎯 Phase' };
const FOCI: readonly CoordinatorFocus[] = ['checklist', 'timeline', 'summary'];

/** The coordinator's board as a window: one tab per board, opened on the one E was pressed at. */
export function openCoordinator(net: Net, focus: CoordinatorFocus) {
  const body = h('div.body.coord-body');
  const phase = h('span.coord-phase');
  const close = h('button.btn.close', { 'aria-label': 'Close' }, '✕');
  const refresh = h('button.btn', { title: 'Look at the plan files again', onclick: () => net.send({ t: 'coordinator.refresh' }) }, '🔄 Refresh');
  const buttons = {} as Record<CoordinatorFocus, HTMLElement>;
  let active: CoordinatorFocus = focus;
  const tabs = h('div.coord-tabs', { role: 'tablist' });
  for (const f of FOCI) {
    buttons[f] = h('button.coord-tab', { type: 'button', onclick: () => show(f) }, LABELS[f]);
    tabs.append(buttons[f]);
  }
  const el = h(
    'div.modal.coordinator',
    { role: 'dialog', 'aria-label': 'Coordinator board', style: 'width:min(820px,100%)' },
    h('header', {}, h('h2', {}, '📋 Coordinator'), phase, refresh, close),
    tabs,
    body,
  );

  function show(f: CoordinatorFocus) {
    active = f;
    render();
  }

  function render() {
    const st = store.coordinator;
    phase.textContent = st.phase ?? (st.error ? 'unreadable' : 'no plan');
    for (const f of FOCI) {
      buttons[f].classList.toggle('on', f === active);
      buttons[f].setAttribute('aria-selected', String(f === active));
    }
    body.replaceChildren(PANES[active](st));
  }

  const unsub = store.on('coordinator', render);
  const modal = openModal(el, {
    doing: '📋 at the coordinator board',
    onClose: () => unsub(),
  });
  close.addEventListener('click', () => modal.close());
  net.send({ t: 'coordinator.refresh' });
  render();
}
