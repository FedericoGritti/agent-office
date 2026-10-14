// The pieces ⚙️ Settings' rows are made of (see settings.ts).

import { h } from './dom';

/** Who a setting is for, shown by its name: some are yours alone, some the whole office's. */
export type Scope = 'you' | 'floor' | 'office';
const SCOPE: Record<Scope, [label: string, title: string]> = {
  you: ['Just you', 'Only for you, kept in this browser'],
  floor: ['This floor', 'The same for everyone on this floor'],
  office: ['Everyone', 'The same for everyone in the building'],
};

/** One setting: its name and who it's for, then whatever sets it. */
export const setting = (title: string, scope: Scope | null, ...body: Node[]) =>
  h('div.setting', {}, h('div.setting-head', {}, h('h4', {}, title), scope && h('span.scope', { class: scope, title: SCOPE[scope][1] }, SCOPE[scope][0])), ...body);

/** A row of buttons to pick one of `options` from. `get` says which is picked now, and `set` picks another. */
export function choiceRow<T>(label: string, options: readonly (readonly [value: T, label: string])[], get: () => T, set: (value: T) => void): HTMLElement {
  const row = h('div.seg', { role: 'radiogroup', 'aria-label': label });
  const paint = () =>
    row.replaceChildren(
      ...options.map(([value, text]) =>
        h(
          'button.btn',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(get() === value),
            class: get() === value ? 'on' : '',
            onclick: () => {
              if (get() === value) return;
              set(value);
              paint();
            },
          },
          text,
        ),
      ),
    );
  paint();
  return row;
}
