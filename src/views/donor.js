import { RULES } from '../engine.js';
import { $, esc, fmt, setHTML } from '../ui/kit.js';

export const nav = [{ id: 'home', label: 'Home', icon: 'home' }];

export function mount(root, ctx) {
  const me = ctx.session;
  root.innerHTML = `
    <div class="page">
      <h1>${esc(me.name)}</h1>
      <form id="post" class="panel stack">
        <label class="field"><span>Food type</span><select name="category">${Object.entries(RULES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>
        <label class="field"><span>Quantity</span><input name="qty" type="number" min="1" value="60" /></label>
        <label class="field"><span>Safe minutes</span><input name="shelfMin" type="number" min="5" value="60" /></label>
        <button class="btn primary" type="submit">Post surplus food</button>
      </form>
      <div id="mine" class="list"></div>
    </div>`;
  $('#post', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const qty = Math.max(1, Number(f.get('qty')));
    ctx.act({ type: 'addBatch', donorId: me.entityId, category: f.get('category'), qty, shelfMin: Math.max(5, Number(f.get('shelfMin'))) }, `Posted ${qty} ${RULES[f.get('category')].unit}`);
  });
  return {
    update(s) {
      setHTML($('#mine', root), s.batches.filter((b) => b.donorId === me.entityId).reverse().map((b) =>
        `<div class="card"><b>${b.qty} ${RULES[b.category].unit}</b> · ${esc(b.status)} · ${b.expiresAt > s.now ? `safe for ${fmt(b.expiresAt - s.now)}` : 'expired'}</div>`).join('') || '<p class="sub">No surplus posted yet.</p>');
    },
  };
}
