import { RULES, FACILITY_LABEL, CONFIG, site, perPerson, nearestStation, isCarrying } from '../engine.js';
import { $, esc, fmt, ago, icon, setHTML, empty, safety } from '../ui/kit.js';
import { incomingTo, reroutedAway, checkInState, batchTotal } from '../ui/derive.js';
import { stationCards } from './stations.js';

export const nav = [
  { id: 'home', label: 'Today', icon: 'home' },
  { id: 'needs', label: 'Needs & facilities', icon: 'users' },
  { id: 'incoming', label: 'Incoming', icon: 'bike' },
  { id: 'food', label: 'Find food', icon: 'store' },
];

const WHY = {
  water: { icon: 'droplet', text: 'Needed to mix infant formula and cook dry rations. Without it we will not send formula or ration kits.' },
  fuel: { icon: 'flame', text: 'Needed to cook dry ration kits. Without it, kits go to a site that can actually cook them.' },
  cold: { icon: 'snow', text: 'Keeps short-life medicine and dairy safe. Without it, they are routed to a site with a fridge.' },
};

export function mount(root, ctx) {
  const me = ctx.session;
  const id = me.entityId;
  const section = ctx.section;
  const sec = {
    home: () => `
      <div class="page-head"><div><span class="eyebrow">${icon('home')} Receiving site</span><h1>${esc(me.name)}</h1><p>Check in every day so riders know you are open. Keep your numbers current and food will find you.</p></div><div id="verify" class="verify"></div></div>
      <section id="checkin" class="checkin" aria-live="polite"></section>
      <div id="attention" class="attention" aria-live="polite"></div>
      <div class="split">
        <section class="panel"><div class="panel-head"><h2>${icon('bike')} Incoming</h2><a class="hint" href="#/shelter/incoming">Full timeline</a></div><div id="incoming"></div></section>
        <section class="panel"><div class="panel-head"><h2>${icon('users')} Today at a glance</h2></div><div id="glance"></div></section>
      </div>`,
    needs: () => `
      <div class="page-head"><div><span class="eyebrow">${icon('users')} Needs &amp; facilities</span><h1>Tell us what you need</h1><p>Headcount decides your fair share when food is scarce. Facilities decide what we can safely send you.</p></div></div>
      <div class="split">
        <form id="needs-form" class="panel stack" novalidate>
          <div class="panel-head" style="margin:0"><h2>Headcount &amp; current needs</h2></div>
          <label class="field">People staying tonight <input name="headcount" type="number" min="0" inputmode="numeric" /></label>
          <div class="divider"></div>
          <div class="stack" id="need-rows"></div>
          <button class="btn primary" type="submit">Save needs</button>
        </form>
        <section class="panel"><div class="panel-head"><h2>Facilities</h2><span class="hint">Changes apply instantly</span></div><div id="facilities" class="stack"></div></section>
      </div>`,
    incoming: () => `
      <div class="page-head"><div><span class="eyebrow">${icon('bike')} Incoming</span><h1>Riders on their way</h1><p>Live ETAs. If something changes (you fill up, a rider is late), the reroute shows here.</p></div></div>
      <div class="split">
        <section class="panel"><div class="panel-head"><h2>On the way</h2></div><div id="incoming"></div></section>
        <section class="panel"><div class="panel-head"><h2>Reroute notices</h2></div><div id="reroutes" class="list"></div></section>
      </div>`,
    food: () => `
      <div class="page-head"><div><span class="eyebrow">${icon('store')} Find food</span><h1>Food stations near ${esc(me.name)}</h1><p>Send people here when your own supply runs out. Also public at <a href="#/stations">#/stations</a>, no login needed.</p></div></div>
      <div id="stations" class="grid-3"></div>`,
  };
  root.innerHTML = `<div class="page">${sec[section]()}</div>`;
  let state;

  if (section === 'needs') {
    const f = $('#needs-form', root);
    const sh = site(ctx.state(), id);
    f.headcount.value = sh.headcount;
    $('#need-rows', root).innerHTML = Object.entries(RULES).map(([k, r]) => `
      <label class="need-row"><span>${esc(r.label)} <span class="sub">(${r.unit})</span></span><input name="need-${k}" type="number" min="0" inputmode="numeric" value="${Math.max(0, sh.need[k] ?? 0)}" aria-label="${esc(r.label)} needed" /></label>`).join('');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const need = {};
      for (const k of Object.keys(RULES)) {
        const v = Number(f[`need-${k}`].value);
        if (v > 0 || (k in site(state, id).need)) need[k] = Math.max(0, v || 0);
      }
      ctx.act({ type: 'updateSite', id, headcount: Number(f.headcount.value) || 0, need }, 'Needs saved. Dispatch is re-planning with your new numbers.');
    });
    $('#facilities', root).addEventListener('change', (e) => {
      const fac = e.target.dataset.fac;
      if (!fac) return;
      ctx.act({ type: 'facility', id, facility: fac }, `${FACILITY_LABEL[fac][0].toUpperCase()}${FACILITY_LABEL[fac].slice(1)} marked ${e.target.checked ? 'available' : 'unavailable'}`, e.target.checked ? 'ok' : 'warn');
    });
  }

  return {
    update(s) {
      state = s;
      const sh = site(s, id);
      if ($('#verify', root)) setHTML($('#verify', root), verify(sh));
      if ($('#checkin', root)) {
        const ci = checkInState(s, sh);
        $('#checkin', root).className = `checkin ${ci.key === 'ok' ? '' : ci.key}`;
        setHTML($('#checkin', root), checkin(s, sh, ci));
      }
      if ($('#attention', root)) setHTML($('#attention', root), attention(s, sh));
      if ($('#incoming', root)) setHTML($('#incoming', root), timeline(s, sh));
      if ($('#glance', root)) setHTML($('#glance', root), glance(s, sh));
      if ($('#facilities', root)) setHTML($('#facilities', root), facilities(sh));
      if ($('#reroutes', root)) setHTML($('#reroutes', root), reroutes(s, sh));
      if ($('#stations', root)) setHTML($('#stations', root), stationCards(s, sh, { compact: true }));
    },
    onAct(act) {
      if (act === 'checkin') ctx.act({ type: 'checkIn', id }, 'Checked in. Riders can see you are open.');
      if (act === 'request-verify') ctx.act({ type: 'requestVerify', id }, 'Verification requested. A coordinator will review it.');
    },
  };
}

function verify(sh) {
  if (sh.verified) return `<span class="chip ok">${icon('shield')} Verified site</span>`;
  return `<span class="chip warn">${icon('shield')} ${sh.verifyRequested ? 'Verification pending' : 'Not verified'}</span>
    ${sh.verifyRequested ? '' : '<button class="btn small" type="button" data-act="request-verify" data-key="request-verify">Request verification</button>'}`;
}

function checkin(s, sh, ci) {
  const title = { ok: 'You are confirmed open', overdue: 'Please confirm you are open', ghost: 'You are marked unconfirmed' }[ci.key];
  const text = {
    ok: `Riders will bring cooked and fresh food. Next check-in due within ${Math.max(0, Math.round(CONFIG.checkInWindowMin - ci.since))} min.`,
    overdue: `It has been ${Math.round(ci.since)} min. Without a check-in in the next ${Math.max(0, Math.round(CONFIG.checkInWindowMin - ci.since))} min, cooked food stops coming here.`,
    ghost: 'No check-in for over an hour, so cooked and perishable food is going elsewhere. Check in to get back into rotation.',
  }[ci.key];
  return `
    <span class="ring ${ci.level}" style="--size:56px">${icon(ci.key === 'ok' ? 'check' : 'clock')}</span>
    <div class="grow"><div class="row start"><h2>${title}</h2><span class="chip ${ci.level}">${ci.label}</span></div>
      <p class="sub">${text} Last check-in: <b class="mono">${ago(ci.since)}</b>.</p></div>
    <button class="btn primary big" type="button" data-act="checkin" data-key="checkin">${icon('check')} We're open: confirm check-in</button>`;
}

function attention(s, sh) {
  const items = [];
  if (!sh.verified) {
    const st = nearestStation(s, sh);
    items.push(['warn', 'shield', 'Your needs are served through the nearest food station until you are verified', st ? `Send people to ${st.name} (${st.helpline}). Nobody is turned away.` : 'Call the city helpline.']);
  }
  if (!sh.open) items.push(['bad', 'alert', 'Site marked closed', 'Nothing will be sent until you reopen.']);
  for (const f of Object.keys(FACILITY_LABEL)) if (!sh.has[f] && Object.keys(sh.need).some((c) => RULES[c].requires.includes(f) && sh.need[c] > 0)) {
    items.push(['warn', WHY[f].icon, `No ${FACILITY_LABEL[f]}: some of your needs cannot be sent`, WHY[f].text]);
  }
  const away = reroutedAway(s, sh.id).filter((t) => s.now - t.rerouted.at < 30);
  if (away.length) items.push(['warn', 'zap', `${away.length} delivery${away.length > 1 ? ' deliveries' : ''} rerouted away from you`, away[0].rerouted.reason]);
  const inc = incomingTo(s, sh.id);
  if (inc.length) items.push(['info', 'bike', `${inc.length} rider${inc.length > 1 ? 's' : ''} on the way`, `First arrives in about ${Math.max(1, Math.round(inc[0].t.eta - s.now))} min with ${inc[0].t.qty} ${RULES[inc[0].t.category].unit}.`]);
  if (!items.length) return `<div class="attn ok">${icon('check')}<div class="grow"><b>All set</b><span class="sub">No riders on the way right now. Keep your needs current and check in daily.</span></div></div>`;
  return items.map(([lvl, ic, t, x]) => `<div class="attn ${lvl}">${icon(ic)}<div class="grow"><b>${esc(t)}</b><span class="sub">${esc(x)}</span></div></div>`).join('');
}

function timeline(s, sh) {
  const inc = incomingTo(s, sh.id);
  if (!inc.length) return empty('bike', 'No riders on the way', 'When a donor posts food that fits your needs, the rider and ETA appear here instantly.');
  return `<ol class="timeline">${inc.map(({ t, rider, batch, donor }) => {
    const left = batch.expiresAt - s.now;
    const lvl = safety(left, batchTotal(batch)).level;
    const phase = t.phase === 'to_pickup' || t.phase === 'queued' ? `Heading to ${esc(donor.name)} to collect` : t.phase === 'loading' ? `Loading at ${esc(donor.name)}` : 'Carrying it to you';
    return `<li class="${t.rerouted ? 'reroute' : isCarrying(t) ? 'carry' : ''}"><span class="node"></span>
      <div class="row"><span class="name">${t.qty} ${RULES[t.category].unit} · ${esc(RULES[t.category].label)}</span><span class="chip ${lvl}">ETA ${Math.max(1, Math.round(t.eta - s.now))} min</span></div>
      <div class="sub">${esc(rider.name)} (${esc(rider.vehicle)}) · ${phase} · food safe for <span class="mono">${fmt(left)}</span></div>
      ${t.rerouted ? `<div class="sub" style="color:var(--warn)">Rerouted here from ${esc(t.rerouted.from)}: ${esc(t.rerouted.reason)}</div>` : ''}
    </li>`;
  }).join('')}</ol>`;
}

function glance(s, sh) {
  const pp = perPerson(s, sh);
  const needs = Object.entries(sh.need).filter(([, v]) => v > 0);
  return `<div class="stack">
    <div class="kv"><span>People <b>${sh.headcount}</b></span><span>Meals per person <b>${pp == null ? '–' : pp.toFixed(2)}</b></span><span>Received <b>${sh.received.meals ?? 0}</b> meals</span></div>
    <div class="needs">${needs.length ? needs.map(([c, v]) => `<span class="chip">${v} ${RULES[c].unit}</span>`).join('') : '<span class="sub">No open needs. Update them if that changes.</span>'}</div>
    <div class="row start" style="gap:6px">${Object.keys(FACILITY_LABEL).map((f) => `<span class="chip ${sh.has[f] ? 'ok' : 'bad'}">${icon(WHY[f].icon)} ${FACILITY_LABEL[f]}</span>`).join('')}</div>
    <a class="btn" href="#/shelter/needs">Update needs &amp; facilities</a>
  </div>`;
}

function facilities(sh) {
  return Object.keys(FACILITY_LABEL).map((f) => `
    <div class="facility">
      <span class="veh">${icon(WHY[f].icon)}</span>
      <div class="grow"><b>${FACILITY_LABEL[f][0].toUpperCase()}${FACILITY_LABEL[f].slice(1)}</b><p>${esc(WHY[f].text)}</p></div>
      <label class="switch"><input type="checkbox" data-fac="${f}" data-key="fac-${f}" ${sh.has[f] ? 'checked' : ''} aria-label="${esc(FACILITY_LABEL[f])} available" /><span></span></label>
    </div>`).join('');
}

function reroutes(s, sh) {
  const away = reroutedAway(s, sh.id);
  const into = s.tasks.filter((t) => t.rerouted && t.shelterId === sh.id);
  const rows = [
    ...away.map((t) => ({ at: t.rerouted.at, html: `<b>${t.qty} ${RULES[t.category].unit} sent elsewhere</b><span class="sub">${esc(t.rerouted.reason)} → now going to ${esc(site(s, t.shelterId).name)}</span>`, lvl: 'warn' })),
    ...into.map((t) => ({ at: t.rerouted.at, html: `<b>${t.qty} ${RULES[t.category].unit} rerouted to you</b><span class="sub">From ${esc(t.rerouted.from)}: ${esc(t.rerouted.reason)}</span>`, lvl: 'info' })),
  ].sort((a, b) => b.at - a.at);
  if (!rows.length) return empty('zap', 'No reroutes', 'If a rider is redirected to or away from you, the reason shows up here.');
  return rows.map((r) => `<div class="attn ${r.lvl}">${icon('zap')}<div class="grow">${r.html}</div><span class="mono sub">${fmt(r.at)}</span></div>`).join('');
}

