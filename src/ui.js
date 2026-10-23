import {
  RULES, FACILITY_LABEL, createState, dispatch, tick, activeTasks, isCarrying,
  addBatch, setRiderSilent, setRiderTraffic, walkInFill, toggleFacility, toggleOpen,
} from './engine.js';
import { scenario } from './scenario.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (min) => {
  const m = Math.max(0, min);
  return `${String(Math.floor(m)).padStart(2, '0')}:${String(Math.floor((m % 1) * 60)).padStart(2, '0')}`;
};
const byId = (list, id) => list.find((x) => x.id === id);

let state;
let running = false;
let timer = null;
const TICK_MS = 100;

function start() {
  state = createState(scenario);
  dispatch(state);
  fillForm();
  render();
}

function loop() {
  const speed = Number($('speed').value); // simulated minutes per real second
  tick(state, (speed * TICK_MS) / 1000);
  render();
}

function setRunning(on) {
  running = on;
  clearInterval(timer);
  if (on) timer = setInterval(loop, TICK_MS);
  $('play').textContent = on ? '❚❚ Pause' : '▶ Start';
}

// ---------- Rendering ----------
function render() {
  $('clock').textContent = `T+${fmt(state.now)}`;
  renderMetrics();
  renderMap();
  renderRiders();
  renderSites();
  renderBatches();
  renderLog();
}

function renderMetrics() {
  const m = state.metrics;
  const tiles = [
    ['good', m.delivered, 'units delivered safely'],
    ['bad', m.wasted, 'units wasted'],
    ['rec', m.ghostReleased, 'ghost claims auto-released'],
    ['rec', m.reroutes, 'mid-trip reroutes'],
    ['bad', m.spoiledBlocked, 'unsafe deliveries blocked'],
  ];
  $('metrics').innerHTML = tiles.map(([c, v, l]) => `<div class="metric ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
}

function renderMap() {
  const parts = [];
  for (let i = 0; i <= 10; i++) {
    parts.push(`<line x1="${i}" y1="0" x2="${i}" y2="10" stroke="var(--line)" stroke-width="0.02"/>`);
    parts.push(`<line x1="0" y1="${i}" x2="10" y2="${i}" stroke="var(--line)" stroke-width="0.02"/>`);
  }
  for (const t of activeTasks(state)) {
    const r = byId(state.riders, t.riderId);
    const b = byId(state.batches, t.batchId);
    const d = byId(state.donors, b.donorId);
    const sh = byId(state.shelters, t.shelterId);
    if (t.phase === 'to_pickup') {
      parts.push(`<line x1="${r.x}" y1="${r.y}" x2="${d.x}" y2="${d.y}" stroke="var(--rider)" stroke-width="0.05" stroke-dasharray="0.15 0.12" opacity=".6"/>`);
      parts.push(`<line x1="${d.x}" y1="${d.y}" x2="${sh.x}" y2="${sh.y}" stroke="var(--rider)" stroke-width="0.03" stroke-dasharray="0.05 0.12" opacity=".35"/>`);
    } else {
      parts.push(`<line x1="${r.x}" y1="${r.y}" x2="${sh.x}" y2="${sh.y}" stroke="var(--accent)" stroke-width="0.07" opacity=".75"/>`);
    }
  }
  for (const d of state.donors) {
    const left = state.batches.filter((b) => b.donorId === d.id && b.remaining > 0).reduce((s, b) => s + b.remaining, 0);
    parts.push(`<rect x="${d.x - 0.22}" y="${d.y - 0.22}" width="0.44" height="0.44" rx="0.06" fill="var(--donor)"/>`);
    parts.push(`<text x="${d.x}" y="${d.y - 0.36}" text-anchor="middle" font-size="0.3" font-weight="600" fill="var(--ink)">${esc(d.name)}${left ? ` · ${left} waiting` : ''}</text>`);
  }
  for (const sh of state.shelters) {
    const need = Object.values(sh.need).reduce((a, b) => a + Math.max(0, b), 0);
    const stroke = sh.fallback ? 'var(--fallback)' : 'var(--shelter)';
    const fill = sh.open ? (sh.fallback ? 'transparent' : 'var(--shelter)') : 'var(--bad)';
    parts.push(`<circle cx="${sh.x}" cy="${sh.y}" r="0.28" fill="${fill}" stroke="${stroke}" stroke-width="0.07" ${sh.fallback ? 'stroke-dasharray="0.1 0.07"' : ''}/>`);
    parts.push(`<text x="${sh.x}" y="${sh.y + 0.58}" text-anchor="middle" font-size="0.28" font-weight="600" fill="var(--ink)">${esc(sh.name)}</text>`);
    parts.push(`<text x="${sh.x}" y="${sh.y + 0.88}" text-anchor="middle" font-size="0.22" fill="var(--muted)">${sh.open ? `needs ${need}` : 'CLOSED'}</text>`);
  }
  for (const r of state.riders) {
    const t = r.taskId && byId(state.tasks, r.taskId);
    const color = r.silent ? 'var(--bad)' : r.traffic ? 'var(--warn)' : 'var(--rider)';
    parts.push(`<circle cx="${r.x}" cy="${r.y}" r="0.16" fill="${color}" stroke="var(--surface)" stroke-width="0.04"/>`);
    const label = `${r.name}${t && isCarrying(t) ? ` · ${t.qty}` : ''}${r.silent ? ' ⚠' : ''}`;
    parts.push(`<text x="${r.x + 0.24}" y="${r.y + 0.09}" font-size="0.24" fill="${color}" font-weight="700">${esc(label)}</text>`);
  }
  $('map').innerHTML = parts.join('');
}

function riderLine(r) {
  const t = r.taskId && byId(state.tasks, r.taskId);
  if (!t) return r.status === 'unresponsive' ? 'Silent — excluded from dispatch' : r.standby ? 'On standby for failed claims' : 'Waiting for a job';
  const b = byId(state.batches, t.batchId);
  const d = byId(state.donors, b.donorId);
  const sh = byId(state.shelters, t.shelterId);
  const u = RULES[t.category].unit;
  const silence = state.now - r.lastPing;
  const watchdog = r.silent ? ` · silent ${silence.toFixed(1)}/${t.holdMin.toFixed(1)} min` : '';
  if (t.phase === 'to_pickup') return `Heading to ${esc(d.name)} for ${t.qty} ${u} → ${esc(sh.name)}${watchdog}`;
  if (t.phase === 'loading') return `Loading ${t.qty} ${u} at ${esc(d.name)}${watchdog}`;
  return `Carrying ${t.qty} ${u} → ${esc(sh.name)} · food safe for ${fmt(b.expiresAt - state.now)}${watchdog}`;
}

function nextLine(r) {
  const n = r.nextTaskId && byId(state.tasks, r.nextTaskId);
  if (!n) return '';
  const b = byId(state.batches, n.batchId);
  return `<div class="sub">Next (pre-booked): ${n.qty} ${RULES[n.category].unit} ${esc(byId(state.donors, b.donorId).name)} → ${esc(byId(state.shelters, n.shelterId).name)}</div>`;
}

function renderRiders() {
  $('riders').innerHTML = state.riders.map((r) => `
    <div class="card ${r.silent ? 'alert' : ''}">
      <div class="row">
        <span class="name">${esc(r.name)} <span class="sub">· ${r.capacity} cap${r.standby ? ' · rescue reserve' : ''}</span></span>
        <span class="chip ${r.status}">${r.status}</span>
      </div>
      <div class="sub">${riderLine(r)}</div>
      ${nextLine(r)}
      <div class="actions">
        <button class="btn small ${r.silent ? 'on' : ''}" data-act="silent" data-id="${r.id}">${r.silent ? 'Bring back online' : 'Go unresponsive'}</button>
        <button class="btn small ${r.traffic ? 'on' : ''}" data-act="traffic" data-id="${r.id}">${r.traffic ? 'Clear traffic' : 'Stuck in traffic'}</button>
      </div>
    </div>`).join('');
}

function renderSites() {
  $('sites').innerHTML = state.shelters.map((sh) => {
    const needs = Object.entries(sh.need).map(([c, v]) => {
      const coming = activeTasks(state).filter((t) => t.shelterId === sh.id && t.category === c).reduce((s, t) => s + t.qty, 0);
      return `<span>${RULES[c].unit}: <b>${Math.max(0, v)}</b>${coming ? ` <span class="sub">(+${coming} en route)</span>` : ''}</span>`;
    }).join('');
    const facs = Object.keys(FACILITY_LABEL).map((f) =>
      `<button class="chip fac ${sh.has[f] ? '' : 'off'}" data-act="fac" data-id="${sh.id}" data-fac="${f}" title="Toggle ${FACILITY_LABEL[f]}">${FACILITY_LABEL[f]}</button>`).join(' ');
    return `
      <div class="card ${sh.open ? '' : 'alert'}">
        <div class="row">
          <span class="name">${esc(sh.name)}${sh.fallback ? ' <span class="sub">· fallback</span>' : ''}</span>
          <span class="chip ${sh.open ? 'idle' : 'closed'}">${sh.open ? 'open' : 'closed'}</span>
        </div>
        <div class="needs">${needs}</div>
        <div class="actions">${facs}</div>
        <div class="actions">
          <button class="btn small" data-act="walkin" data-id="${sh.id}">Walk-in fills demand</button>
          <button class="btn small ${sh.open ? '' : 'on'}" data-act="open" data-id="${sh.id}">${sh.open ? 'Close site' : 'Reopen'}</button>
        </div>
      </div>`;
  }).join('');
}

function renderBatches() {
  const rows = [...state.batches].reverse().map((b) => {
    const d = byId(state.donors, b.donorId);
    const total = b.expiresAt - (b.postedAt ?? 0);
    const left = b.expiresAt - state.now;
    const pct = Math.max(0, Math.min(100, (left / total) * 100));
    const cls = pct < 25 ? 'low' : pct < 50 ? 'mid' : '';
    const moving = activeTasks(state).filter((t) => t.batchId === b.id).reduce((s, t) => s + t.qty, 0);
    return `
      <div class="card">
        <div class="row">
          <span class="name">${b.qty} ${RULES[b.category].unit} · ${esc(d.name)}</span>
          <span class="chip ${b.status}">${b.status}</span>
        </div>
        <div class="sub">${RULES[b.category].label} · ${b.remaining} unclaimed · ${moving} in motion · ${left > 0 ? `safe for ${fmt(left)}` : 'expired'}</div>
        <div class="bar"><i class="${cls}" style="width:${pct}%"></i></div>
      </div>`;
  });
  $('batches').innerHTML = rows.join('');
}

function renderLog() {
  $('log').innerHTML = state.log.slice(0, 80).map((l) =>
    `<li class="${l.level}"><time>T+${fmt(l.t)}</time>${esc(l.msg)}</li>`).join('');
}

function fillForm() {
  const f = $('batch-form');
  f.donorId.innerHTML = state.donors.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  f.category.innerHTML = Object.entries(RULES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
}

// ---------- Events ----------
// pointerdown so a click is never lost when panels re-render between press and release
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.dataset.id;
  const act = el.dataset.act;
  if (act === 'silent') setRiderSilent(state, id, !byId(state.riders, id).silent);
  if (act === 'traffic') { const r = byId(state.riders, id); setRiderTraffic(state, id, !r.traffic); }
  if (act === 'walkin') walkInFill(state, id);
  if (act === 'fac') toggleFacility(state, id, el.dataset.fac);
  if (act === 'open') toggleOpen(state, id);
  render();
});

$('batch-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  addBatch(state, {
    donorId: f.get('donorId'), category: f.get('category'),
    qty: Math.max(1, Number(f.get('qty'))), shelfMin: Math.max(5, Number(f.get('shelfMin'))),
  });
  render();
});

$('play').addEventListener('click', () => setRunning(!running));
$('reset').addEventListener('click', () => { setRunning(false); start(); });

start();
