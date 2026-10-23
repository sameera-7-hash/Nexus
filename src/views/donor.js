import { RULES, TIERS } from '../engine.js';
import { $, esc, fmt, icon, ring, setHTML, empty, toast } from '../ui/kit.js';
import { batchStatus, batchTotal, impact } from '../ui/derive.js';

export const nav = [
  { id: 'home', label: 'Overview', icon: 'home' },
  { id: 'post', label: 'Post food', icon: 'plus' },
  { id: 'donations', label: 'My donations', icon: 'list' },
  { id: 'impact', label: 'Impact', icon: 'heart' },
];

const ROUTING = {
  TIGHT: 'Goes only to verified sites that have checked in recently and that a rider can reach before it spoils.',
  PERISHABLE: 'Goes to relief camps and public food stations, where it is handed out the same day.',
  SHELF_STABLE: 'Fills stated needs at verified sites first; the rest restocks public food stations.',
};
const UNITS = { min: 1, h: 60, d: 1440 };

function splitTime(min) {
  if (min % 1440 === 0) return { value: min / 1440, unit: 'd' };
  if (min >= 180 && min % 60 === 0) return { value: min / 60, unit: 'h' };
  return { value: min, unit: 'min' };
}

export function mount(root, ctx) {
  const me = ctx.session;
  const section = ctx.section;
  const sec = {
    home: () => `
      <div class="page-head">
        <div><span class="eyebrow">${icon('gift')} Donor</span><h1>${esc(me.name)}</h1><p>Post surplus the moment you know you have it. Every minute of safe time counts.</p></div>
        <a class="btn primary big" href="#/donor/post">${icon('plus')} Post surplus food</a>
      </div>
      <section aria-labelledby="attn-h"><h2 id="attn-h" class="sr-only">Needs your attention</h2><div id="attention" class="attention"></div></section>
      <div class="split">
        <section class="panel"><div class="panel-head"><h2>${icon('list')} Live donations</h2><a href="#/donor/donations" class="hint">See all</a></div><div id="donations" class="list"><div class="skeleton"></div><div class="skeleton"></div></div></section>
        <section class="panel"><div class="panel-head"><h2>${icon('heart')} Your impact</h2></div><div id="impact"></div></section>
      </div>`,
    post: () => `
      <div class="page-head"><div><span class="eyebrow">${icon('plus')} Post surplus food</span><h1>What do you have to give?</h1><p>Three quick steps. The safe time fills in from the food type, and riders are dispatched the moment you confirm.</p></div></div>
      <form id="post" class="panel" novalidate>
        <ol class="stepper" aria-label="Steps"><li data-step="1"><b>1</b><span>Food type</span></li><li data-step="2"><b>2</b><span>Quantity &amp; pickup</span></li><li data-step="3"><b>3</b><span>Confirm</span></li></ol>
        <fieldset class="step" data-step="1">
          <legend class="sr-only">Food type</legend>
          <div class="food-grid">${Object.entries(RULES).map(([k, r], i) => `
            <label class="food-opt"><input type="radio" name="category" value="${k}" ${i === 0 ? 'checked' : ''} />
              <b>${esc(r.label)}</b><span class="chip tier-${r.tier}">${TIERS[r.tier].label}</span>
              <span class="sub">Safe for ~${fmt(r.safeMin)}${r.requires.length ? ` · needs ${r.requires.join(' + ')}` : ''}</span>
            </label>`).join('')}</div>
        </fieldset>
        <fieldset class="step stack" data-step="2" hidden>
          <legend class="sr-only">Quantity and pickup</legend>
          <div class="grid-2">
            <label class="field">Quantity <small id="unit-hint"></small><input name="qty" type="number" min="1" step="1" value="60" inputmode="numeric" required /></label>
            <div class="field"><span>Safe time left <small>pre-filled from the food type; edit if you know better</small></span>
              <div class="row start" style="flex-wrap:nowrap"><input name="safeVal" type="number" min="1" step="any" aria-label="Safe time value" required /><select name="safeUnit" aria-label="Safe time unit" style="width:auto"><option value="min">minutes</option><option value="h">hours</option><option value="d">days</option></select></div>
            </div>
          </div>
          <label class="photo-drop" id="photo-drop">${icon('camera')}<span id="photo-label">Add a photo (optional). It helps riders find the right boxes.</span><input type="file" name="photo" accept="image/*" class="sr-only" /></label>
          <label class="field">Pickup notes <textarea name="notes" placeholder="e.g. Back gate, ask for Ravi. Food is in 6 steel containers."></textarea></label>
        </fieldset>
        <fieldset class="step" data-step="3" hidden><legend class="sr-only">Confirm</legend><div id="confirm"></div></fieldset>
        <div class="form-nav">
          <button type="button" class="btn ghost" id="back">Back</button>
          <button type="submit" class="btn primary big" id="next">Continue</button>
        </div>
      </form>`,
    donations: () => `
      <div class="page-head"><div><span class="eyebrow">${icon('list')} My donations</span><h1>Where your food is right now</h1><p>Live status, the time it has left, and which rider and site got it.</p></div><a class="btn primary" href="#/donor/post">${icon('plus')} Post food</a></div>
      <section class="panel"><div id="donations" class="list"><div class="skeleton"></div><div class="skeleton"></div></div></section>`,
    impact: () => `
      <div class="page-head"><div><span class="eyebrow">${icon('heart')} Impact</span><h1>What your surplus became</h1><p>Counted only when a rider hands food over inside its safe time.</p></div></div>
      <section class="panel"><div id="impact"></div></section>
      <section class="panel"><div class="panel-head"><h2>Where it went</h2></div><div id="where" class="list"></div></section>`,
  };
  root.innerHTML = `<div class="page">${sec[section]()}</div>`;
  if (section === 'post') wirePost(root, ctx, me);

  return {
    update(s) {
      const mine = s.batches.filter((b) => b.donorId === me.entityId);
      if ($('#attention', root)) setHTML($('#attention', root), attention(s, mine));
      if ($('#donations', root)) setHTML($('#donations', root), donations(s, mine, section === 'home' ? 4 : 99));
      if ($('#impact', root)) setHTML($('#impact', root), impactCard(s, me.entityId));
      if ($('#where', root)) setHTML($('#where', root), where(s, mine));
    },
  };
}

function attention(s, mine) {
  const items = [];
  for (const b of mine) {
    const st = batchStatus(s, b);
    const left = b.expiresAt - s.now;
    const r = RULES[b.category];
    if (st.key === 'waiting' && left > 0) items.push(['bad', 'alert', `${b.remaining} ${r.unit} still waiting for a rider`, `${fmt(left)} of safe time left. The dispatcher is retrying every tick; keep the food covered and ready.`]);
    else if (st.key === 'assigned') items.push(['info', 'bike', `${st.riders.join(', ')} on the way to collect ${r.label.toLowerCase()}`, 'Have it packed and at the pickup point.']);
    else if (st.key === 'rerouted') items.push(['warn', 'zap', 'A delivery was rerouted', st.detail]);
  }
  if (!items.length) {
    return mine.length
      ? `<div class="attn ok">${icon('check')}<div class="grow"><b>Nothing needs you right now</b><span class="sub">All your food is moving or delivered.</span></div></div>`
      : `<div class="attn info">${icon('gift')}<div class="grow"><b>Have surplus tonight?</b><span class="sub">Post it in under a minute; riders are dispatched instantly.</span></div><a class="btn primary" href="#/donor/post">Post food</a></div>`;
  }
  return items.slice(0, 3).map(([lvl, ic, title, text]) => `<div class="attn ${lvl}">${icon(ic)}<div class="grow"><b>${esc(title)}</b><span class="sub">${esc(text)}</span></div></div>`).join('');
}

function donations(s, mine, limit) {
  if (!mine.length) return empty('gift', 'No surplus posted yet', 'Post your first batch: pick the food type and the safe time fills in for you.', '<a class="btn primary" href="#/donor/post">Post your first batch</a>');
  const order = { waiting: 0, assigned: 1, picked: 2, rerouted: 1, delivered: 3, expired: 4 };
  return mine.map((b) => ({ b, st: batchStatus(s, b) }))
    .sort((x, y) => order[x.st.key] - order[y.st.key] || y.b.postedAt - x.b.postedAt)
    .slice(0, limit)
    .map(({ b, st }) => {
      const r = RULES[b.category];
      const left = b.expiresAt - s.now;
      const live = !['delivered', 'expired'].includes(st.key);
      return `
      <article class="card donation ${st.key === 'waiting' && left < batchTotal(b) * 0.25 ? 'alert' : ''}">
        ${live ? ring(left, batchTotal(b)) : `<span class="ring ${st.level === 'ok' ? 'ok' : 'bad'}" style="--size:56px">${icon(st.level === 'ok' ? 'check' : 'x')}</span>`}
        <div class="grow">
          <div class="row"><span class="name">${b.qty} ${r.unit} · ${esc(r.label)}</span><span class="chip ${st.level}">${esc(st.label)}</span></div>
          <div class="route-line">${esc(st.detail)}</div>
          <div class="kv" style="margin-top:6px"><span>Tier <b>${TIERS[r.tier].label}</b></span>${st.riders.length ? `<span>Rider <b>${esc(st.riders.join(', '))}</b></span>` : ''}<span>Delivered <b>${b.delivered ?? 0}/${b.qty}</b></span>${b.notes ? `<span>Notes: ${esc(b.notes)}</span>` : ''}</div>
        </div>
      </article>`;
    }).join('');
}

function impactCard(s, donorId) {
  const m = impact(s, donorId);
  return `<div class="impact">
    <div><b>${m.meals}</b><span>meals delivered</span></div>
    <div><b>${m.people}</b><span>people fed</span></div>
    <div><b>${m.kg}</b><span>kg of food waste avoided</span></div>
  </div>`;
}

function where(s, mine) {
  const tally = {};
  for (const b of mine) for (const [id, n] of Object.entries(b.deliveredTo ?? {})) {
    const key = `${id}:${b.category}`;
    tally[key] = (tally[key] || 0) + n;
  }
  const rows = Object.entries(tally);
  if (!rows.length) return empty('map', 'Nothing delivered yet', 'Once a rider hands your food over, the receiving site shows up here.');
  return rows.map(([key, n]) => {
    const [id, cat] = key.split(':');
    const sh = s.shelters.find((x) => x.id === id) ?? s.stations.find((x) => x.id === id);
    return `<div class="card row"><span class="name">${esc(sh.name)} <span class="chip ${sh.kind === 'station' ? 'station' : 'accent'}">${sh.kind}</span></span><span class="mono">${n} ${RULES[cat].unit}</span></div>`;
  }).join('');
}

function wirePost(root, ctx, me) {
  const f = $('#post', root);
  let step = 1;
  let photoName = '';
  const show = () => {
    f.querySelectorAll('fieldset.step').forEach((el) => { el.hidden = Number(el.dataset.step) !== step; });
    f.querySelectorAll('.stepper li').forEach((li) => {
      const n = Number(li.dataset.step);
      li.className = n === step ? 'on' : n < step ? 'done' : '';
      if (n === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('#back', root).style.visibility = step === 1 ? 'hidden' : 'visible';
    $('#next', root).textContent = step === 3 ? 'Post and dispatch riders' : 'Continue';
    if (step === 3) renderConfirm();
    f.querySelector(`fieldset[data-step="${step}"] input, fieldset[data-step="${step}"] select`)?.focus({ preventScroll: true });
  };
  const cat = () => f.category.value;
  const safeMin = () => Number(f.safeVal.value) * UNITS[f.safeUnit.value];
  const prefill = () => {
    const { value, unit } = splitTime(RULES[cat()].safeMin);
    f.safeVal.value = value;
    f.safeUnit.value = unit;
    $('#unit-hint', root).textContent = `in ${RULES[cat()].unit}`;
  };
  const renderConfirm = () => {
    const r = RULES[cat()];
    const mins = safeMin();
    $('#confirm', root).innerHTML = `
      <dl class="summary">
        <dt>Food</dt><dd>${esc(r.label)} <span class="chip tier-${r.tier}">${TIERS[r.tier].label}</span></dd>
        <dt>Quantity</dt><dd>${Number(f.qty.value)} ${r.unit}</dd>
        <dt>Safe for</dt><dd class="mono">${fmt(mins)}</dd>
        <dt>Pickup</dt><dd>${esc(me.name)}</dd>
        ${f.notes.value.trim() ? `<dt>Notes</dt><dd>${esc(f.notes.value.trim())}</dd>` : ''}
        <dt>Photo</dt><dd>${photoName ? esc(photoName) : 'None'}</dd>
      </dl>
      <div class="attn info" style="margin-top:16px">${icon('shield')}<div class="grow"><b>How it will be routed</b><span class="sub">${esc(ROUTING[r.tier])}${mins < 20 ? ' With this little safe time, riders may not reach anyone safely; if so it is flagged and never sent out.' : ''}</span></div></div>`;
  };
  f.addEventListener('change', (e) => {
    if (e.target.name === 'category') prefill();
    if (e.target.name === 'photo') {
      photoName = e.target.files?.[0]?.name ?? '';
      $('#photo-label', root).textContent = photoName ? `Photo attached: ${photoName}` : 'Add a photo (optional).';
      $('#photo-drop', root).classList.toggle('has', !!photoName);
      if (photoName) toast('Photo attached');
    }
  });
  $('#back', root).addEventListener('click', () => { step = Math.max(1, step - 1); show(); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step === 2) {
      if (!(Number(f.qty.value) >= 1)) { toast('Enter how much food you have (at least 1).', 'bad'); f.qty.focus(); return; }
      if (!(safeMin() >= 1)) { toast('Enter how long the food stays safe.', 'bad'); f.safeVal.focus(); return; }
    }
    if (step < 3) { step++; show(); return; }
    const r = RULES[cat()];
    const qty = Math.round(Number(f.qty.value));
    ctx.act({ type: 'addBatch', donorId: me.entityId, category: cat(), qty, shelfMin: safeMin(), notes: f.notes.value.trim() || undefined, photo: photoName || undefined },
      `Posted ${qty} ${r.unit} of ${r.label.toLowerCase()}. Dispatching riders now.`);
    ctx.go('#/donor/donations');
  });
  prefill();
  show();
}
