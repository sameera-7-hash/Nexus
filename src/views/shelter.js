import { RULES } from '../engine.js';
import { $, esc, byId, setHTML } from '../ui/kit.js';

export const nav = [{ id: 'home', label: 'Home', icon: 'home' }];

export function mount(root, ctx) {
  const me = ctx.session;
  root.innerHTML = `<div class="page"><h1>${esc(me.name)}</h1><div id="needs" class="panel"></div></div>`;
  return {
    update(s) {
      const sh = byId(s.shelters, me.entityId);
      setHTML($('#needs', root), Object.entries(sh.need).map(([c, v]) => `<p>${esc(RULES[c].label)}: <b>${Math.max(0, v)}</b> ${RULES[c].unit} needed</p>`).join(''));
    },
  };
}
