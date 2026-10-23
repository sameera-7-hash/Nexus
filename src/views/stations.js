// Public "Find food near you" page: no login, for individuals in need. Also reused inside the shelter dashboard.
import { RULES } from '../engine.js';
import { $, esc, icon, setHTML, empty } from '../ui/kit.js';
import { stationsNear } from '../ui/derive.js';

// Rough walking time on the city grid (5 km/h).
const walk = (km) => `${Math.max(1, Math.round((km / 5) * 60))} min walk`;

export function stationCards(s, from, { compact = false } = {}) {
  const list = stationsNear(s, from);
  if (!list.length) return empty('store', 'No food stations listed yet', 'Call the city helpline below and someone will direct you.');
  return list.map(({ st, km }, i) => {
    const stock = Object.entries(st.stock).filter(([, n]) => n > 0);
    const tel = st.helpline.replace(/[^+\d]/g, '');
    return `
    <article class="card station ${st.open ? '' : 'alert'}" aria-label="${esc(st.name)}">
      <div class="row">
        <div><span class="name">${esc(st.name)}</span>${i === 0 && from && st.open ? ' <span class="chip accent">Nearest</span>' : ''}
          <div class="sub">${esc(st.hours ?? '')}${km != null ? ` · ${km.toFixed(1)} km · ${walk(km)}` : ''}</div></div>
        <span class="chip ${st.open ? 'ok' : 'bad'}">${st.open ? 'Open now' : 'Closed'}</span>
      </div>
      ${stock.length
        ? `<div class="stock">${stock.map(([cat, n]) => `<div class="${n < 5 ? 'low' : ''}"><b>${Math.floor(n)}</b>${esc(RULES[cat].unit)} · ${esc(RULES[cat].label.toLowerCase())}</div>`).join('')}</div>`
        : '<p class="sub">Shelves are empty right now. New stock is on the way. Call to check before you travel.</p>'}
      ${compact ? '' : `<p class="sub">Free for anyone. No ID or registration needed.</p>`}
      <a class="btn ${st.open ? 'primary' : ''} call" href="tel:${tel}">${icon('phone')} Call ${esc(st.helpline)}</a>
    </article>`;
  }).join('');
}

export function mount(root, ctx) {
  root.innerHTML = `
    <div class="page">
      <section class="hero-public">
        <span class="eyebrow">${icon('store')} Public food stations</span>
        <h1>Find food near you</h1>
        <p class="sub" style="font-size:15px;max-width:620px;margin-top:6px">Free food, no questions asked. Stock updates live as riders drop off donations. Tap a number to call the station before you go.</p>
        <label class="field" style="max-width:340px;margin-top:16px">I am near
          <select id="near"><option value="">Choose a landmark…</option></select>
        </label>
      </section>
      <section aria-labelledby="st-h"><h2 id="st-h" class="sr-only">Stations</h2><div id="stations" class="grid-3"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></section>
      <section class="panel"><div class="row"><div><h2>City food helpline</h2><p class="sub">24 hours. We will tell you where food is available tonight. (Demo numbers throughout: they do not connect to a real line.)</p></div><a class="btn primary big" href="tel:+910000011000">${icon('phone')} Call +91 00000 11000</a></div></section>
      ${ctx.session ? '' : `<p class="sub">Run a shelter or have food to give? <a href="#/login">Sign in</a>.</p>`}
    </div>`;
  let from = null;
  let last;
  const near = $('#near', root);
  near.addEventListener('change', () => {
    const [kind, id] = near.value.split(':');
    from = !kind ? null : (kind === 'd' ? last.donors : [...last.shelters, ...last.stations]).find((x) => x.id === id) ?? null;
    if (last) setHTML($('#stations', root), stationCards(last, from));
  });
  return {
    update(s) {
      if (!last) {
        near.insertAdjacentHTML('beforeend', [...s.shelters.map((x) => `<option value="s:${x.id}">${esc(x.name)}</option>`), ...s.donors.map((x) => `<option value="d:${x.id}">${esc(x.name)}</option>`)].join(''));
      }
      last = s;
      setHTML($('#stations', root), stationCards(s, from));
    },
  };
}
