import { RULES, TIERS, FACILITY_LABEL, VEHICLES, activeTasks, isCarrying, site, perPerson, minutesToNoReturn } from '../engine.js';
import { $, esc, byId, fmt, clock, ago, icon, ring, setHTML, empty, toast } from '../ui/kit.js';
import { batchStatus, batchTotal, checkInState, impact } from '../ui/derive.js';
import { alerts, SCENARIOS, scenarioActions } from '../ui/alerts.js';

export const nav = [
  { id: 'ops', label: 'Live Ops', icon: 'map' },
  { id: 'riders', label: 'Riders', icon: 'bike' },
  { id: 'sites', label: 'Sites & Stations', icon: 'home' },
  { id: 'batches', label: 'Batches', icon: 'gift' },
  { id: 'log', label: 'Log & Impact', icon: 'log' },
];

const TITLES = {
  ops: ['Live Ops', 'What needs you right now, and where every rider is.'],
  riders: ['Riders', 'Volunteers, their jobs and silence timers. Simulate failures here.'],
  sites: ['Sites & Stations', 'Check-ins, verification, needs, fair share and station stock.'],
  batches: ['Batches', 'Every batch of surplus, its safe time and where it is going.'],
  log: ['Log & Impact', 'Every automated decision, with its reason, and what the night achieved.'],
};
const VERIFY_REASONS = ['Govt relief camp (district office list)', 'NGO partner confirmed headcount', 'Field visit by coordinator', 'Flood relief: emergency verification'];

// Survives section changes so an alert click can land on, and highlight, its entity.
let selectedRider = null;
let focusId = null;
// Cards re-render every tick, so the highlight is part of the markup rather than a class added later.
let highlight = { id: null, until: 0 };
const hl = (id) => (id && id === highlight.id && Date.now() < highlight.until ? ' selected' : '');
let logFilter = 'all';

export function mount(root, ctx) {
  const section = ctx.section;
  const [title, blurb] = TITLES[section];
  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><span class="eyebrow">${icon('map')} Coordinator</span><h1>${title}</h1><p>${blurb}</p></div>
        <div class="toolbar">
          <button class="btn primary" type="button" id="play" data-act="play" data-key="play"></button>
          <div class="seg" role="group" aria-label="Simulation speed">${[1, 3, 6].map((v) => `<button type="button" data-act="speed" data-v="${v}" data-key="speed-${v}">${v}×</button>`).join('')}</div>
          <button class="btn ghost" type="button" data-act="reset" title="Reset the demo city">↺ Reset</button>
          <div class="scenarios">
            <button class="btn" type="button" id="scn-btn" aria-haspopup="true" aria-expanded="false" aria-controls="scn-menu">${icon('zap')} Judge scenarios</button>
            <div class="menu" id="scn-menu" role="menu">${SCENARIOS.map((x) => `<button type="button" role="menuitem" data-act="scenario" data-id="${x.id}">${icon(x.icon)}<div><b>${esc(x.title)}</b><span>${esc(x.text)}</span></div></button>`).join('')}</div>
          </div>
        </div>
      </div>
      <section aria-label="Alerts"><div id="alerts" class="alerts-rail" aria-live="polite"></div></section>
      ${body(section)}
    </div>
    <dialog id="verify-dlg" class="panel" aria-labelledby="verify-h">
      <form method="dialog" class="stack">
        <h2 id="verify-h">Verify site</h2>
        <p class="sub" id="verify-sub"></p>
        <label class="field">Reason <select name="reason">${VERIFY_REASONS.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
        <div class="row"><button class="btn ghost" value="cancel" type="submit">Cancel</button><button class="btn primary" value="ok" type="submit">${icon('shield')} Verify</button></div>
      </form>
    </dialog>`;

  // Scenario menu: open/close, Escape and outside click close it.
  const menuBtn = $('#scn-btn', root);
  const menu = $('#scn-menu', root);
  const setMenu = (open) => { menu.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button')?.focus(); };
  menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  const outside = (e) => { if (!e.target.closest('.scenarios')) setMenu(false); };
  const esc_ = (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); menuBtn.focus(); } };
  document.addEventListener('click', outside);
  document.addEventListener('keydown', esc_);

  const dlg = $('#verify-dlg', root);
  let verifyId = null;
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'ok' && verifyId) {
      const reason = dlg.querySelector('select').value;
      ctx.act({ type: 'verify', id: verifyId, reason }, `${site(state, verifyId).name} verified: ${reason}`);
    }
    verifyId = null;
  });

  if (section === 'batches') {
    const f = $('#batch-form', root);
    const s0 = ctx.state();
    f.donorId.innerHTML = s0.donors.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    f.category.innerHTML = Object.entries(RULES).map(([k, v]) => `<option value="${k}">${esc(v.label)} · ${TIERS[v.tier].label}</option>`).join('');
    const prefill = () => { f.shelfMin.value = RULES[f.category.value].safeMin; };
    f.category.addEventListener('change', prefill);
    prefill();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const qty = Math.max(1, Math.round(Number(f.qty.value) || 0));
      const shelfMin = Math.max(1, Number(f.shelfMin.value) || 0);
      ctx.act({ type: 'addBatch', donorId: f.donorId.value, category: f.category.value, qty, shelfMin }, `Posted ${qty} ${RULES[f.category.value].unit} for ${fmt(shelfMin)}`);
    });
  }
  if (section === 'log') {
    root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      logFilter = b.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (state) setHTML($('#log', root), logList(state));
    }));
  }

  let state;
  let riderNodes = null;
  let focused = false;
  const repaintSelection = () => {
    if ($('#phone', root)) setHTML($('#phone', root), phone(state));
    if ($('#riders', root)) setHTML($('#riders', root), riders(state));
    if ($('#map', root)) riderNodes = renderMap(state, $('#map', root), riderNodes);
  };
  root.addEventListener('change', (e) => {
    if (e.target.id !== 'phone-pick') return;
    selectedRider = e.target.value;
    repaintSelection();
  });

  return {
    update(s) {
      state = s;
      if (!selectedRider || !byId(s.riders, selectedRider)) selectedRider = (s.riders.find((r) => r.taskId) ?? s.riders[0]).id;
      $('#play', root).innerHTML = s.sim.running ? '❚❚ Pause' : '▶ Start';
      root.querySelectorAll('[data-act=speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === s.sim.speed)));
      setHTML($('#alerts', root), alertsRail(s));
      if ($('#kpis', root)) setHTML($('#kpis', root), kpis(s));
      if ($('#map', root)) riderNodes = renderMap(s, $('#map', root), riderNodes);
      if ($('#phone', root)) setHTML($('#phone', root), phone(s));
      if ($('#phone-pick', root)) setHTML($('#phone-pick', root), s.riders.map((r) => `<option value="${r.id}" ${r.id === selectedRider ? 'selected' : ''}>${esc(r.name)} · ${VEHICLES[r.vehicle].label}</option>`).join(''));
      if ($('#riders', root)) setHTML($('#riders', root), riders(s));
      if ($('#sites', root)) setHTML($('#sites', root), sites(s));
      if ($('#stations', root)) setHTML($('#stations', root), stations(s));
      if ($('#batches', root)) setHTML($('#batches', root), batches(s));
      if ($('#log', root)) setHTML($('#log', root), logList(s));
      if ($('#impact', root)) setHTML($('#impact', root), impactTiles(s));
      if ($('#ops-batches', root)) setHTML($('#ops-batches', root), urgentBatches(s));
      if (focusId && !focused) {
        const el = root.querySelector(`[data-entity="${CSS.escape(focusId)}"]`);
        if (el) { focused = true; highlight = { id: focusId, until: Date.now() + 3000 }; el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); focusId = null; }
      }
    },
    onAct(act, d) {
      const s = state;
      const r = d.id && byId(s.riders, d.id);
      const sh = d.id && site(s, d.id);
      switch (act) {
        case 'play': ctx.act({ type: 'play', running: !s.sim.running }, s.sim.running ? 'Simulation paused' : 'Simulation running'); break;
        case 'speed': ctx.act({ type: 'speed', speed: Number(d.v) }, `Speed: ${d.v} simulated min per second`); break;
        case 'reset': ctx.act({ type: 'reset' }, 'Demo city reset to the start of the night'); break;
        case 'scenario': {
          menu.classList.remove('open');
          menuBtn.setAttribute('aria-expanded', 'false');
          const out = scenarioActions(s, d.id);
          if (out.error) { toast(out.error, 'warn'); break; }
          for (const a of out.actions) ctx.act(a);
          if (!s.sim.running) ctx.act({ type: 'play', running: true });
          toast(out.message, 'warn');
          if (out.focus) { const [sec, id] = out.focus; if (sec === 'riders' && id) selectedRider = id; focusId = id ?? null; if (sec !== section) ctx.go(`#/coordinator${sec === 'ops' ? '' : `/${sec}`}`); else focused = false; }
          break;
        }
        case 'goto':
          if (d.sec === 'riders' && d.id) selectedRider = d.id;
          focusId = d.id || null;
          focused = false;
          if (d.sec !== section) ctx.go(`#/coordinator${d.sec === 'ops' ? '' : `/${d.sec}`}`);
          break;
        case 'select-rider': selectedRider = d.id; repaintSelection(); break;
        case 'silent': ctx.act({ type: 'riderSilent', id: d.id, silent: !r.silent }, r.silent ? `${r.name} is back online` : `${r.name} went silent. The silence timer is running.`, 'warn'); break;
        case 'traffic': ctx.act({ type: 'riderTraffic', id: d.id, traffic: !r.traffic }, r.traffic ? `${r.name} is moving freely again` : `${r.name} is stuck in traffic. ETAs re-forecast.`, 'warn'); break;
        case 'heartbeat': ctx.act({ type: 'heartbeat', id: d.id }, `${r.name}: "I'm still on it". Silence timer reset.`); break;
        case 'walkin': ctx.act({ type: 'walkIn', id: d.id }, `Walk-ins filled ${sh.name}. Cargo heading there is rerouted.`, 'warn'); break;
        case 'fac': ctx.act({ type: 'facility', id: d.id, facility: d.fac }, `${sh.name}: ${FACILITY_LABEL[d.fac]} ${sh.has[d.fac] ? 'lost' : 'restored'}`, 'warn'); break;
        case 'open': ctx.act({ type: 'open', id: d.id }, `${sh.name} ${sh.open ? 'closed' : 'reopened'}`, 'warn'); break;
        case 'ghost': ctx.act({ type: 'ghost', id: d.id }, `${sh.name} stopped checking in`, 'warn'); break;
        case 'checkin': ctx.act({ type: 'checkIn', id: d.id }, `${sh.name} checked in`); break;
        case 'verify':
          verifyId = d.id;
          $('#verify-sub', root).textContent = `${sh.name} · ${sh.headcount} people. Verified sites get direct delivery; unverified needs are served through food stations.`;
          dlg.showModal();
          break;
        default: break;
      }
    },
    destroy() { document.removeEventListener('click', outside); document.removeEventListener('keydown', esc_); },
  };
}

function body(section) {
  const phonePanel = `
    <section class="panel" aria-label="Volunteer phone preview">
      <div class="panel-head"><h2>${icon('phone')} Volunteer app</h2>
        <label class="field inline"><span class="sr-only">Rider</span><select id="phone-pick" data-key="phone-pick"></select></label></div>
      <div id="phone"></div>
    </section>`;
  switch (section) {
    case 'ops': return `
      <section id="kpis" class="metrics" aria-label="Key numbers"></section>
      <div class="ops">
        <section class="panel">
          <div class="panel-head"><h2>${icon('map')} Live city map</h2>
            <div class="legend"><span><i class="dot donor"></i>Donor</span><span><i class="dot shelter"></i>Shelter / camp</span><span><i class="dot station"></i>Food station</span><span><i class="dot ghost"></i>Unconfirmed</span><span><i class="dot rider"></i>Rider</span></div></div>
          <svg id="map" class="map" viewBox="-0.6 -0.6 11.2 11.2" role="img" aria-label="City map with donors, receiving sites, food stations and riders"></svg>
        </section>
        <div class="stack">${phonePanel}
          <section class="panel"><div class="panel-head"><h2>${icon('clock')} Most urgent food</h2><a class="hint" href="#/coordinator/batches">All batches</a></div><div id="ops-batches" class="list"></div></section>
        </div>
      </div>`;
    case 'riders': return `<div class="split"><section class="panel"><div class="panel-head"><h2>${icon('bike')} Riders</h2><span class="hint">Click a rider to preview their phone</span></div><div id="riders" class="list"></div></section><div class="stack" style="position:sticky;top:calc(var(--topbar-h) + 16px)">${phonePanel}</div></div>`;
    case 'sites': return `
      <section class="panel"><div class="panel-head"><h2>${icon('home')} Shelters &amp; camps</h2><span class="hint">Meals/person shows fairness across sites</span></div><div id="sites" class="grid-2"></div></section>
      <section class="panel"><div class="panel-head"><h2>${icon('store')} Food stations</h2><a class="hint" href="#/stations">Public page</a></div><div id="stations" class="grid-3"></div></section>`;
    case 'batches': return `
      <form id="batch-form" class="panel" novalidate>
        <div class="panel-head" style="margin-bottom:8px"><h2>${icon('plus')} Post a batch on a donor's behalf</h2></div>
        <div class="grid-3" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-items:end">
          <label class="field">Donor <select name="donorId"></select></label>
          <label class="field">Food type <select name="category"></select></label>
          <label class="field">Quantity <input name="qty" type="number" min="1" value="120" inputmode="numeric" /></label>
          <label class="field">Safe minutes <input name="shelfMin" type="number" min="1" inputmode="numeric" /></label>
          <button class="btn primary" type="submit">${icon('plus')} Post batch</button>
        </div>
      </form>
      <section class="panel"><div id="batches" class="list"></div></section>`;
    case 'log': return `
      <section class="panel"><div class="panel-head"><h2>${icon('heart')} Impact tonight</h2></div><div id="impact" class="metrics"></div></section>
      <section class="panel"><div class="panel-head"><h2>${icon('log')} Decision log</h2>
        <div class="seg" role="group" aria-label="Filter log">${[['all', 'All'], ['recover', 'Recoveries'], ['critical', 'Critical'], ['assign', 'Dispatch']].map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${k === logFilter}">${l}</button>`).join('')}</div></div>
        <ol id="log" class="log scroll"></ol></section>`;
    default: return '';
  }
}

function alertsRail(s) {
  const list = alerts(s);
  if (!list.length) return `<div class="all-clear">${icon('check')} All clear: every rider is responding, every site has checked in, no food is near its point of no return.</div>`;
  return list.map((a, i) => `<button type="button" class="alert-item ${a.level}" data-act="goto" data-sec="${a.sec}" data-id="${a.id ?? ''}" data-key="alert-${i}">${icon(a.icon)}<div><b>${esc(a.title)}</b><span>${esc(a.text)}</span></div></button>`).join('');
}

function kpis(s) {
  const m = s.metrics;
  const silent = s.riders.filter((r) => r.silent).length;
  const ghosts = s.shelters.filter((x) => !x.confirmed).length;
  const moving = activeTasks(s).filter(isCarrying).reduce((a, t) => a + t.qty, 0);
  return [
    ['ok', 'check', m.delivered, 'units delivered safely'],
    ['rec', 'bike', moving, 'units on the road now'],
    [silent ? 'bad' : 'rec', 'bell', m.ghostReleased, `ghost claims released${silent ? ` · ${silent} silent now` : ''}`],
    [ghosts ? 'warn' : 'rec', 'home', ghosts, 'ghost stations right now'],
    ['rec', 'zap', m.reroutes, 'mid-trip reroutes'],
    [m.wasted ? 'bad' : 'ok', 'alert', m.wasted, 'units wasted'],
  ].map(([c, ic, v, l]) => `<div class="metric ${c}">${icon(ic)}<b>${Math.round(v)}</b><span>${l}</span></div>`).join('');
}

// Map: static layers re-render as markup; riders are persistent nodes moved with a CSS transform so
// they glide between updates instead of jumping.
function renderMap(s, svg, nodes) {
  if (!nodes) {
    svg.innerHTML = '<g id="m-base"></g><g id="m-routes"></g><g id="m-riders"></g>';
    nodes = new Map();
  }
  const base = [];
  for (let i = 0; i <= 10; i++) base.push(`<line x1="${i}" y1="0" x2="${i}" y2="10" class="grid"/><line x1="0" y1="${i}" x2="10" y2="${i}" class="grid"/>`);
  for (const d of s.donors) {
    const left = s.batches.filter((b) => b.donorId === d.id && b.remaining > 0 && b.status !== 'expired').reduce((a, b) => a + b.remaining, 0);
    base.push(`<rect x="${d.x - 0.22}" y="${d.y - 0.22}" width="0.44" height="0.44" rx="0.06" fill="var(--donor)"/><text x="${d.x}" y="${d.y - 0.36}" text-anchor="middle" class="lbl">${esc(d.name)}</text>${left ? `<text x="${d.x}" y="${d.y + 0.55}" text-anchor="middle" class="lbl small">${left} waiting</text>` : ''}`);
  }
  for (const sh of s.shelters) {
    const ci = checkInState(s, sh);
    const col = !sh.open ? 'var(--bad)' : ci.key === 'ghost' ? 'var(--warn)' : 'var(--shelter)';
    const fill = sh.verified ? col : 'var(--surface-2)';
    base.push(`<g class="site ${ci.key === 'ghost' ? 'ghost' : ''}"><circle cx="${sh.x}" cy="${sh.y}" r="0.28" fill="${fill}" stroke="${col}" stroke-width="0.07"/></g>
      <text x="${sh.x}" y="${sh.y + 0.6}" text-anchor="middle" class="lbl">${esc(sh.name)}</text>
      <text x="${sh.x}" y="${sh.y + 0.88}" text-anchor="middle" class="lbl small">${!sh.open ? 'CLOSED' : ci.key === 'ghost' ? `last seen ${ago(ci.since)}` : !sh.verified ? 'unverified · via station' : `${sh.headcount} people`}</text>`);
  }
  for (const st of s.stations) {
    base.push(`<rect x="${st.x - 0.2}" y="${st.y - 0.2}" width="0.4" height="0.4" transform="rotate(45 ${st.x} ${st.y})" fill="${st.open ? 'var(--station)' : 'var(--bad)'}"/><text x="${st.x}" y="${st.y + 0.6}" text-anchor="middle" class="lbl">${esc(st.name)}</text>`);
  }
  setHTML(svg.querySelector('#m-base'), base.join(''));

  const routes = [];
  for (const t of activeTasks(s)) {
    const r = byId(s.riders, t.riderId);
    const b = byId(s.batches, t.batchId);
    const d = byId(s.donors, b.donorId);
    const sh = site(s, t.shelterId);
    if (t.phase === 'queued') continue;
    if (t.phase === 'to_pickup') routes.push(`<line x1="${r.x}" y1="${r.y}" x2="${d.x}" y2="${d.y}" class="route pickup"/><line x1="${d.x}" y1="${d.y}" x2="${sh.x}" y2="${sh.y}" class="route pickup" opacity=".3"/>`);
    else routes.push(`<line x1="${r.x}" y1="${r.y}" x2="${sh.x}" y2="${sh.y}" class="route ${t.rerouted ? 'reroute' : 'carry'}"/>`);
  }
  svg.querySelector('#m-routes').innerHTML = routes.join('');

  const layer = svg.querySelector('#m-riders');
  for (const r of s.riders) {
    let g = nodes.get(r.id);
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'rider');
      g.dataset.act = 'select-rider';
      g.dataset.id = r.id;
      g.style.cursor = 'pointer';
      layer.appendChild(g);
      nodes.set(r.id, g);
    }
    const t = r.taskId && byId(s.tasks, r.taskId);
    const color = r.silent ? 'var(--bad)' : r.traffic ? 'var(--warn)' : 'var(--rider)';
    const html = `${r.id === selectedRider ? '<circle r="0.3" class="sel"/>' : ''}<circle r="0.16" fill="${color}"/><text x="0.24" y="0.08" class="lbl rider-lbl" fill="${color}">${esc(r.name)}${t && isCarrying(t) ? ` · ${t.qty}` : ''}${r.silent ? ' ⚠' : ''}</text><title>${esc(r.name)}: click to preview their phone</title>`;
    if (g.dataset.html !== html) { g.innerHTML = html; g.dataset.html = html; }
    g.style.transform = `translate(${r.x}px, ${r.y}px)`;
  }
  return nodes;
}

function jobLine(s, r) {
  const t = r.taskId && byId(s.tasks, r.taskId);
  if (!t) return r.status === 'unresponsive' ? 'Silent: excluded from dispatch' : r.standby ? 'Rescue reserve: takes over failed claims' : 'Waiting for a job';
  const b = byId(s.batches, t.batchId);
  const d = byId(s.donors, b.donorId);
  const sh = site(s, t.shelterId);
  const u = RULES[t.category].unit;
  if (t.phase === 'to_pickup') return `Heading to ${esc(d.name)} for ${t.qty} ${u} → ${esc(sh.name)}`;
  if (t.phase === 'loading') return `Loading ${t.qty} ${u} at ${esc(d.name)}`;
  return `Carrying ${t.qty} ${u} → ${esc(sh.name)} · ETA ${Math.max(1, Math.round(t.eta - s.now))} min`;
}

function riders(s) {
  return s.riders.map((r) => {
    const t = r.taskId && byId(s.tasks, r.taskId);
    const n = r.nextTaskId && byId(s.tasks, r.nextTaskId);
    const silence = s.now - r.lastPing;
    const v = VEHICLES[r.vehicle];
    return `
    <article class="card ${r.silent ? 'alert' : r.traffic ? 'amber' : ''} ${r.id === selectedRider ? 'selected' : ''}" data-entity="${r.id}">
      <div class="rider-card" data-act="select-rider" data-id="${r.id}">
        <span class="veh ${r.silent ? 'silent' : ''}" title="${v.label}">${icon('bike')}</span>
        <div class="grow">
          <div class="row"><span class="name">${esc(r.name)} <span class="sub">· ${v.label}, ${r.capacity} units, ${Math.round(r.speed * (r.speedMul ?? 1))} km/h${r.standby ? ' · rescue reserve' : ''}</span></span><span class="chip ${r.status}">${r.status}</span></div>
          <div class="sub">${jobLine(s, r)}</div>
          ${n ? `<div class="sub">Next (pre-booked): ${n.qty} ${RULES[n.category].unit} → ${esc(site(s, n.shelterId).name)}</div>` : ''}
          ${r.silent && t ? `<div class="fair" style="margin-top:6px"><span class="mono" style="color:var(--bad)">silent ${silence.toFixed(1)}/${t.holdMin.toFixed(1)} min</span><div class="bar"><i class="bad" style="width:${Math.min(100, (silence / t.holdMin) * 100)}%"></i></div></div>` : ''}
        </div>
      </div>
      <div class="actions">
        <button class="btn small ${r.silent ? 'on' : ''}" type="button" data-act="silent" data-id="${r.id}" data-key="silent-${r.id}">${r.silent ? 'Bring back online' : 'Go unresponsive'}</button>
        <button class="btn small ${r.traffic ? 'on' : ''}" type="button" data-act="traffic" data-id="${r.id}" data-key="traffic-${r.id}">${r.traffic ? 'Clear traffic' : 'Stuck in traffic'}</button>
      </div>
    </article>`;
  }).join('');
}

function phone(s) {
  const r = byId(s.riders, selectedRider);
  if (!r) return '';
  const t = r.taskId && byId(s.tasks, r.taskId);
  const b = t && byId(s.batches, t.batchId);
  const d = b && byId(s.donors, b.donorId);
  const sh = t && site(s, t.shelterId);
  const silence = s.now - r.lastPing;
  let job;
  if (!t) {
    job = `<div class="phone-job"><b>${r.silent ? 'You are offline' : r.standby ? 'On standby' : 'No job right now'}</b><span style="font-size:13px;color:#66615a">${r.standby ? 'You will get jobs that another rider dropped.' : 'Stay nearby. A new pickup can come in any minute.'}</span></div>`;
  } else {
    const left = b.expiresAt - s.now;
    const atPickup = t.phase === 'to_pickup' || t.phase === 'queued';
    job = `<div class="phone-job">
      <div class="row" style="flex-wrap:nowrap">${ring(left, batchTotal(b), 64)}<div style="flex:1"><b style="font-size:15px">${t.qty} ${RULES[t.category].unit}</b><div style="font-size:12px;color:#66615a">${esc(RULES[t.category].label)} · safe time left</div></div></div>
      <div class="phone-step ${atPickup ? '' : 'muted'}"><i></i><span>${atPickup ? 'Pick up at' : 'Picked up from'} <b>${esc(d.name)}</b></span></div>
      <div class="phone-step to ${atPickup ? 'muted' : ''}"><i></i><span>Drop at <b>${esc(sh.name)}</b> · ETA ${Math.max(1, Math.round(t.eta - s.now))} min</span></div>
      ${b.notes ? `<div style="font-size:12px;color:#66615a">Note: ${esc(b.notes)}</div>` : ''}
    </div>`;
  }
  const alertCards = [];
  if (t?.rerouted && s.now - t.rerouted.at < 30) alertCards.push(`<div class="phone-alert"><b>${icon('zap')} New drop-off: ${esc(sh.name)}</b>${esc(t.rerouted.reason)}. Follow the new route.</div>`);
  if (r.silent && t) alertCards.push(`<div class="phone-alert bad"><b>Are you still on it?</b>No signal for ${silence.toFixed(1)} min. This job is released in ${Math.max(0, t.holdMin - silence).toFixed(1)} min unless you tap below.</div>`);
  if (r.traffic) alertCards.push('<div class="phone-alert"><b>Heavy traffic on your route</b>We are re-checking your ETA against the food’s safe time.</div>');
  return `<div class="phone"><div class="phone-screen">
    <div class="phone-notch"></div>
    <div class="phone-bar"><span>${clock(s.now).replace('T+', '')}</span><span>${r.silent ? 'No signal' : '4G ▮▮▮'}</span></div>
    <div class="phone-body">
      <div><div style="font-size:12px;color:#66615a">RelayFresh Rider · ${VEHICLES[r.vehicle].label}</div><h3>Hi ${esc(r.name)}</h3></div>
      ${alertCards.join('')}
      ${job}
      <button type="button" class="heartbeat ${r.silent ? 'silent' : ''}" data-act="heartbeat" data-id="${r.id}" data-key="heartbeat">${icon('heart')} I'm still on it</button>
      <div class="phone-meta">${t ? `Silence limit ${t.holdMin.toFixed(1)} min · scales with the food's safe time` : 'Heartbeat keeps your jobs reserved'}</div>
    </div>
  </div></div>`;
}

function sites(s) {
  return s.shelters.map((sh) => {
    const ci = checkInState(s, sh);
    const pp = perPerson(s, sh);
    const maxPP = Math.max(0.01, ...s.shelters.map((x) => perPerson(s, x) ?? 0));
    const needs = Object.entries(sh.need).map(([c, v]) => {
      const coming = activeTasks(s).filter((t) => t.shelterId === sh.id && t.category === c).reduce((a, t) => a + t.qty, 0);
      return `<span>${RULES[c].unit}: <b>${Math.max(0, v)}</b>${coming ? ` <span class="sub">(+${coming} en route)</span>` : ''}</span>`;
    }).join('');
    return `
    <article class="card ${!sh.open ? 'alert' : ci.key === 'ghost' ? 'amber' : ''}${hl(sh.id)}" data-entity="${sh.id}">
      <div class="row"><span class="name">${esc(sh.name)} <span class="sub">· ${sh.kind}</span></span>
        <span class="row start" style="gap:4px">
          <span class="chip ${sh.open ? 'ok' : 'bad'}">${sh.open ? 'open' : 'closed'}</span>
          <span class="chip ${ci.level}" title="Last check-in ${ago(ci.since)}">${ci.key === 'ghost' ? `unconfirmed · last seen ${ago(ci.since)}` : ci.key === 'overdue' ? 'check-in due' : 'confirmed'}</span>
          <span class="chip ${sh.verified ? 'accent' : 'warn'}">${icon('shield')} ${sh.verified ? 'verified' : sh.verifyRequested ? 'verification requested' : 'unverified'}</span>
        </span></div>
      <div class="fair" style="margin-top:8px"><span>${sh.headcount} people</span><div class="bar"><i style="width:${pp == null ? 0 : Math.min(100, (pp / maxPP) * 100)}%"></i></div><span class="mono">${pp == null ? '–' : pp.toFixed(2)} meals/person</span></div>
      <div class="needs">${needs}</div>
      ${!sh.verified ? `<p class="sub" style="margin-top:6px">Served via the nearest food station until verified.</p>` : sh.verifyReason ? `<p class="sub" style="margin-top:6px">Verified: ${esc(sh.verifyReason)}</p>` : ''}
      <div class="actions">${Object.keys(FACILITY_LABEL).map((f) => `<button type="button" class="chip fac ${sh.has[f] ? '' : 'off'}" data-act="fac" data-id="${sh.id}" data-fac="${f}" data-key="fac-${sh.id}-${f}" aria-pressed="${!!sh.has[f]}" title="Toggle ${FACILITY_LABEL[f]}">${FACILITY_LABEL[f]}</button>`).join('')}</div>
      <div class="actions">
        ${!sh.verified ? `<button class="btn small primary" type="button" data-act="verify" data-id="${sh.id}" data-key="verify-${sh.id}">${icon('shield')} Verify…</button>` : ''}
        ${ci.key === 'ghost' ? `<button class="btn small" type="button" data-act="checkin" data-id="${sh.id}" data-key="ci-${sh.id}">Mark checked in</button>` : `<button class="btn small" type="button" data-act="ghost" data-id="${sh.id}" data-key="gh-${sh.id}">Stop check-ins</button>`}
        <button class="btn small" type="button" data-act="walkin" data-id="${sh.id}" data-key="wi-${sh.id}">Walk-in fills demand</button>
        <button class="btn small ${sh.open ? 'danger' : 'on'}" type="button" data-act="open" data-id="${sh.id}" data-key="op-${sh.id}">${sh.open ? 'Close site' : 'Reopen'}</button>
      </div>
    </article>`;
  }).join('');
}

function stations(s) {
  return s.stations.map((st) => {
    const stock = Object.entries(st.stock).filter(([, n]) => n > 0);
    const coming = activeTasks(s).filter((t) => t.shelterId === st.id).reduce((a, t) => a + t.qty, 0);
    return `
    <article class="card station ${st.open ? '' : 'alert'}${hl(st.id)}" data-entity="${st.id}">
      <div class="row"><span class="name">${esc(st.name)}</span><span class="chip ${st.open ? 'station' : 'bad'}">${st.open ? 'open' : 'closed'}</span></div>
      <div class="sub">${esc(st.hours ?? '')} · ${esc(st.helpline)}${coming ? ` · +${coming} units en route` : ''}</div>
      ${stock.length ? `<div class="stock">${stock.map(([c, n]) => `<div class="${n < 5 ? 'low' : ''}"><b>${Math.floor(n)}</b>${RULES[c].unit}</div>`).join('')}</div>` : '<p class="sub">Shelves empty.</p>'}
      <div class="actions"><button class="btn small ${st.open ? 'danger' : 'on'}" type="button" data-act="open" data-id="${st.id}" data-key="op-${st.id}">${st.open ? 'Close station' : 'Reopen'}</button></div>
    </article>`;
  }).join('');
}

function batchCard(s, b) {
  const st = batchStatus(s, b);
  const left = b.expiresAt - s.now;
  const live = !['delivered', 'expired'].includes(st.key);
  const moving = activeTasks(s).filter((t) => t.batchId === b.id).reduce((a, t) => a + t.qty, 0);
  const ponr = b.status === 'available' && b.remaining > 0 ? minutesToNoReturn(s, b) : null;
  return `
    <article class="card donation ${ponr != null && ponr < 15 ? 'alert' : ''}${hl(b.id)}" data-entity="${b.id}">
      ${live ? ring(left, batchTotal(b), 52) : `<span class="ring ${st.level === 'ok' ? 'ok' : 'bad'}" style="--size:52px">${icon(st.level === 'ok' ? 'check' : 'x')}</span>`}
      <div class="grow">
        <div class="row"><span class="name">${b.qty} ${RULES[b.category].unit} · ${esc(byId(s.donors, b.donorId).name)}</span><span class="row start" style="gap:4px"><span class="chip tier-${RULES[b.category].tier}">${TIERS[RULES[b.category].tier].label}</span><span class="chip ${st.level}">${esc(st.label)}</span></span></div>
        <div class="sub">${esc(st.detail)}</div>
        <div class="kv" style="margin-top:4px"><span>Unclaimed <b>${b.remaining}</b></span><span>Moving <b>${moving}</b></span><span>Delivered <b>${b.delivered ?? 0}</b></span>${ponr != null ? `<span>Point of no return <b style="color:var(--${ponr < 15 ? 'bad' : 'ink'})">${ponr > 0 ? `${Math.round(ponr)} min` : 'passed'}</b></span>` : ''}</div>
      </div>
    </article>`;
}

function batches(s) {
  if (!s.batches.length) return empty('gift', 'No surplus posted yet', 'Donors post from their dashboard, or post one above on their behalf.');
  return [...s.batches].reverse().map((b) => batchCard(s, b)).join('');
}

function urgentBatches(s) {
  const live = s.batches.filter((b) => b.expiresAt > s.now && (b.remaining > 0 || activeTasks(s).some((t) => t.batchId === b.id)));
  if (!live.length) return empty('check', 'Nothing urgent', 'All posted food is delivered. New posts from donors appear here instantly.');
  return live.sort((a, b) => (a.expiresAt - s.now) / batchTotal(a) - (b.expiresAt - s.now) / batchTotal(b)).slice(0, 4).map((b) => batchCard(s, b)).join('');
}

function logList(s) {
  const match = { all: () => true, recover: (l) => l.level === 'recover', critical: (l) => l.level === 'critical' || l.level === 'warn' || l.level === 'block', assign: (l) => l.level === 'assign' || l.level === 'done' }[logFilter];
  const rows = s.log.filter(match).slice(0, 120);
  if (!rows.length) return `<li>${logFilter === 'all' ? 'No decisions yet. Start the clock.' : 'Nothing of this kind yet.'}</li>`;
  return rows.map((l) => `<li class="${l.level}"><time>${clock(l.t)}</time>${esc(l.msg)}</li>`).join('');
}

function impactTiles(s) {
  const m = s.metrics;
  const im = impact(s);
  return [
    ['ok', 'heart', im.people, 'people fed'],
    ['ok', 'check', im.meals, 'meals delivered'],
    ['ok', 'leaf', im.kg, 'kg of food waste avoided'],
    ['rec', 'store', m.servedAtStations, 'units handed out at stations'],
    ['rec', 'bike', m.ghostReleased, 'ghost riders caught'],
    ['warn', 'home', m.ghostStations, 'ghost stations caught'],
    ['rec', 'zap', m.reroutes, 'mid-trip reroutes'],
    ['bad', 'shield', m.spoiledBlocked, 'unsafe handovers blocked'],
    [m.wasted ? 'bad' : 'ok', 'alert', m.wasted, 'units wasted'],
  ].map(([c, ic, v, l]) => `<div class="metric ${c}">${icon(ic)}<b>${Math.round(v)}</b><span>${l}</span></div>`).join('');
}

