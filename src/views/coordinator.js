import { RULES, FACILITY_LABEL, activeTasks, isCarrying } from '../engine.js';
import { $, esc, byId, fmt, clock, setHTML } from '../ui/kit.js';

export const nav = [{ id: 'ops', label: 'Live Ops', icon: 'map' }];

export function mount(root, ctx) {
  root.innerHTML = `
    <div class="page">
      <div class="toolbar">
        <button class="btn primary" data-act="play" data-key="play" type="button"></button>
        <label class="field inline"><span>Speed</span>
          <select id="speed"><option value="1">1 min/s</option><option value="3">3 min/s</option><option value="6">6 min/s</option></select>
        </label>
        <button class="btn ghost" data-act="reset" type="button">↺ Reset</button>
      </div>
      <section class="metrics" id="metrics" aria-live="polite"></section>
      <div class="legacy-layout">
        <section class="panel map-panel"><div class="panel-head"><h2>Live city map</h2></div><svg id="map" viewBox="-0.6 -0.6 11.2 11.2" role="img" aria-label="City map"></svg></section>
        <section class="panel"><div class="panel-head"><h2>Riders</h2></div><div id="riders" class="list"></div></section>
        <section class="panel"><div class="panel-head"><h2>Receiving sites</h2></div><div id="sites" class="list"></div></section>
        <section class="panel"><div class="panel-head"><h2>Surplus batches</h2></div><div id="batches" class="list"></div></section>
        <section class="panel"><div class="panel-head"><h2>Decision log</h2></div><ol id="log" class="log"></ol></section>
      </div>
    </div>`;
  $('#speed', root).addEventListener('change', (e) => ctx.act({ type: 'speed', speed: Number(e.target.value) }, `Speed set to ${e.target.value} sim-min per second`));

  let state;
  return {
    update(s) {
      state = s;
      $('[data-act=play]', root).textContent = s.sim.running ? '❚❚ Pause' : '▶ Start';
      $('#speed', root).value = String(s.sim.speed);
      setHTML($('#metrics', root), metrics(s));
      setHTML($('#map', root), map(s));
      setHTML($('#riders', root), riders(s));
      setHTML($('#sites', root), sites(s));
      setHTML($('#batches', root), batches(s));
      setHTML($('#log', root), s.log.slice(0, 80).map((l) => `<li class="${l.level}"><time>${clock(l.t)}</time>${esc(l.msg)}</li>`).join(''));
    },
    onAct(act, d) {
      const r = d.id && byId(state.riders, d.id);
      if (act === 'play') ctx.act({ type: 'play', running: !state.sim.running }, state.sim.running ? 'Simulation paused' : 'Simulation running');
      if (act === 'reset') ctx.act({ type: 'reset' }, 'Demo city reset');
      if (act === 'silent') ctx.act({ type: 'riderSilent', id: d.id, silent: !r.silent }, `${r.name} ${r.silent ? 'back online' : 'went silent'}`, 'warn');
      if (act === 'traffic') ctx.act({ type: 'riderTraffic', id: d.id, traffic: !r.traffic }, `${r.name} ${r.traffic ? 'moving again' : 'stuck in traffic'}`, 'warn');
      if (act === 'walkin') ctx.act({ type: 'walkIn', id: d.id }, 'Walk-in donations filled the site', 'warn');
      if (act === 'fac') ctx.act({ type: 'facility', id: d.id, facility: d.fac }, `Toggled ${FACILITY_LABEL[d.fac]}`, 'warn');
      if (act === 'open') ctx.act({ type: 'open', id: d.id }, 'Site open/closed toggled', 'warn');
    },
  };
}

function metrics(s) {
  const m = s.metrics;
  return [['ok', m.delivered, 'units delivered safely'], ['bad', m.wasted, 'units wasted'], ['rec', m.ghostReleased, 'ghost claims auto-released'], ['rec', m.reroutes, 'mid-trip reroutes'], ['bad', m.spoiledBlocked, 'unsafe deliveries blocked']]
    .map(([c, v, l]) => `<div class="metric ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
}

function map(s) {
  const parts = [];
  for (let i = 0; i <= 10; i++) parts.push(`<line x1="${i}" y1="0" x2="${i}" y2="10" class="grid"/><line x1="0" y1="${i}" x2="10" y2="${i}" class="grid"/>`);
  for (const t of activeTasks(s)) {
    const r = byId(s.riders, t.riderId); const b = byId(s.batches, t.batchId);
    const d = byId(s.donors, b.donorId); const sh = byId(s.shelters, t.shelterId);
    if (t.phase === 'to_pickup') parts.push(`<line x1="${r.x}" y1="${r.y}" x2="${d.x}" y2="${d.y}" class="route pickup"/>`);
    else parts.push(`<line x1="${r.x}" y1="${r.y}" x2="${sh.x}" y2="${sh.y}" class="route carry"/>`);
  }
  for (const d of s.donors) parts.push(`<rect x="${d.x - 0.22}" y="${d.y - 0.22}" width="0.44" height="0.44" rx="0.06" fill="var(--donor)"/><text x="${d.x}" y="${d.y - 0.36}" text-anchor="middle" class="lbl">${esc(d.name)}</text>`);
  for (const sh of s.shelters) parts.push(`<circle cx="${sh.x}" cy="${sh.y}" r="0.28" fill="${sh.open ? 'var(--shelter)' : 'var(--bad)'}"/><text x="${sh.x}" y="${sh.y + 0.58}" text-anchor="middle" class="lbl">${esc(sh.name)}</text>`);
  for (const r of s.riders) {
    const t = r.taskId && byId(s.tasks, r.taskId);
    const color = r.silent ? 'var(--bad)' : r.traffic ? 'var(--warn)' : 'var(--rider)';
    parts.push(`<circle cx="${r.x}" cy="${r.y}" r="0.16" fill="${color}"/><text x="${r.x + 0.24}" y="${r.y + 0.09}" class="lbl" fill="${color}">${esc(r.name)}${t && isCarrying(t) ? ` · ${t.qty}` : ''}</text>`);
  }
  return parts.join('');
}

function riders(s) {
  return s.riders.map((r) => `
    <div class="card ${r.silent ? 'alert' : ''}">
      <div class="row"><span class="name">${esc(r.name)}</span><span class="chip ${r.status}">${r.status}</span></div>
      <div class="actions">
        <button class="btn small ${r.silent ? 'on' : ''}" type="button" data-act="silent" data-id="${r.id}" data-key="silent-${r.id}">${r.silent ? 'Bring back online' : 'Go unresponsive'}</button>
        <button class="btn small ${r.traffic ? 'on' : ''}" type="button" data-act="traffic" data-id="${r.id}" data-key="traffic-${r.id}">${r.traffic ? 'Clear traffic' : 'Stuck in traffic'}</button>
      </div>
    </div>`).join('');
}

function sites(s) {
  return s.shelters.map((sh) => `
    <div class="card ${sh.open ? '' : 'alert'}">
      <div class="row"><span class="name">${esc(sh.name)}</span><span class="chip ${sh.open ? 'idle' : 'closed'}">${sh.open ? 'open' : 'closed'}</span></div>
      <div class="needs">${Object.entries(sh.need).map(([c, v]) => `<span>${RULES[c].unit}: <b>${Math.max(0, v)}</b></span>`).join('')}</div>
      <div class="actions">${Object.keys(FACILITY_LABEL).map((f) => `<button type="button" class="chip fac ${sh.has[f] ? '' : 'off'}" data-act="fac" data-id="${sh.id}" data-fac="${f}" data-key="fac-${sh.id}-${f}">${FACILITY_LABEL[f]}</button>`).join(' ')}</div>
      <div class="actions">
        <button class="btn small" type="button" data-act="walkin" data-id="${sh.id}">Walk-in fills demand</button>
        <button class="btn small" type="button" data-act="open" data-id="${sh.id}">${sh.open ? 'Close site' : 'Reopen'}</button>
      </div>
    </div>`).join('');
}

function batches(s) {
  return [...s.batches].reverse().map((b) => {
    const d = byId(s.donors, b.donorId);
    const left = b.expiresAt - s.now;
    return `<div class="card"><div class="row"><span class="name">${b.qty} ${RULES[b.category].unit} · ${esc(d.name)}</span><span class="chip ${b.status}">${b.status}</span></div><div class="sub">${b.remaining} unclaimed · ${left > 0 ? `safe for ${fmt(left)}` : 'expired'}</div></div>`;
  }).join('');
}
