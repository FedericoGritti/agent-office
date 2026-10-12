import './spend.css';
import { fmtCost, fmtTokens, type SpendAgent, type SpendState, type SpendWindow } from '../../shared/protocol';
import type { Net } from '../net';
import { store } from '../state';
import { h, openModal, timeAgo } from './dom';

/** The three kinds of agent the board tells apart, in the order it lists them. */
const KINDS: readonly { key: SpendAgent; label: string }[] = [
  { key: 'agents', label: 'Agenti' },
  { key: 'subagents', label: 'Sotto-agenti' },
  { key: 'advisors', label: 'Advisor' },
];

/** One kind of agent, and the same for every provider that spent. */
function rows(w: SpendWindow): HTMLElement {
  const byProvider = Object.entries(w.byProvider).sort((a, b) => b[1].cost - a[1].cost);
  return h(
    'div.spend-rows',
    {},
    ...KINDS.map((k) => h('div.spend-row', {}, h('span.spend-label', {}, k.label), h('span.spend-num', {}, fmtTokens(w.byAgent[k.key].tokens)), h('span.spend-cost', {}, fmtCost(w.byAgent[k.key].cost)))),
    ...byProvider.map(([name, n]) => h('div.spend-row.provider', {}, h('span.spend-label', {}, name), h('span.spend-num', {}, fmtTokens(n.tokens)), h('span.spend-cost', {}, fmtCost(n.cost)))),
  );
}

/** The window's own blocks: today and all of it. */
function pane(title: string, w: SpendWindow): HTMLElement {
  return h(
    'div.spend-pane',
    {},
    h('h4', {}, title),
    h('div.spend-total', {}, h('b', {}, fmtTokens(w.tokens)), h('span', {}, `token · ≈ API eq. ${fmtCost(w.cost)}`), h('small', {}, `${w.calls} richieste${w.unpriced ? ` · ${w.unpriced} senza prezzo` : ''}`)),
    rows(w),
    h('p.spend-buckets', {}, `input ${fmtTokens(w.input)} · output ${fmtTokens(w.output)} · cache read ${fmtTokens(w.cacheRead)} · cache write ${fmtTokens(w.cacheWrite)}`),
  );
}

/** The spend board as a window: what the floor's project has spent in OMP, and the button to read it again. */
export function openSpend(net: Net) {
  const body = h('div.body.spend-body');
  const when = h('span.spend-when');
  const close = h('button.btn.close', { 'aria-label': 'Close' }, '✕');
  const refresh = h('button.btn', { title: 'Read the session records again', onclick: () => net.send({ t: 'spend.refresh' }) }, '🔄 Refresh');
  const el = h(
    'div.modal.spend',
    { role: 'dialog', 'aria-label': 'Tokens', style: 'width:min(820px,100%)' },
    h('header', {}, h('h2', {}, '🪙 Token'), when, refresh, close),
    body,
    h('footer', {}, 'Il costo è l’equivalente API: una parte sta dentro un piano a prezzo fisso (ChatGPT), il resto è a consumo.'),
  );

  function render() {
    const st: SpendState = store.spend;
    when.textContent = st.at ? `read ${timeAgo(st.at)}` : 'not read yet';
    body.replaceChildren(
      ...(st.note ? [h('p.spend-empty', {}, `⚠️ ${st.note}`)] : []),
      pane('Oggi', st.today),
      pane('Totale', st.total),
    );
  }

  const unsub = store.on('spend', render);
  const modal = openModal(el, { doing: '🪙 at the spend board', onClose: () => unsub() });
  close.addEventListener('click', () => modal.close());
  render();
}
