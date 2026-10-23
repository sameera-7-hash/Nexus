// RelayFresh dispatch engine — pure logic, no DOM. Time unit: simulated minutes. Distance unit: km.

export const RULES = {
  meals:   { label: 'Cooked meals',        unit: 'meals', requires: [] },
  medical: { label: 'Short-life medicine', unit: 'packs', requires: ['cold'] },
  ration:  { label: 'Raw ration kits',     unit: 'kits',  requires: ['water', 'fuel'] },
  formula: { label: 'Infant formula',      unit: 'tins',  requires: ['water'] },
};

export const FACILITY_LABEL = { water: 'clean water', fuel: 'cooking fuel', cold: 'cold storage' };

export const CONFIG = {
  roadFactor: 1.3,      // straight-line km -> road km
  handlingMin: 3,       // loading time at donor
  safetyBufferMin: 5,   // food must arrive this many minutes before expiry
  minHoldMin: 2,        // shortest allowed silence before a claim is released
  maxHoldMin: 8,        // longest allowed silence before a claim is released
  trafficFactor: 0.2,   // speed multiplier when a rider is stuck
};

const ACTIVE = new Set(['queued', 'to_pickup', 'loading', 'to_dropoff']);
const CARRYING = new Set(['loading', 'to_dropoff']);

const byId = (list, id) => list.find((x) => x.id === id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const roadKm = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * CONFIG.roadFactor;
export const speedOf = (r) => r.speed * (r.traffic ? CONFIG.trafficFactor : 1);
export const travelMin = (a, b, kmh) => (roadKm(a, b) / kmh) * 60;

export function createState(scenario) {
  const s = structuredClone(scenario);
  s.now = 0;
  s.tasks = [];
  s.log = [];
  s.seq = 1;
  s.metrics = { delivered: 0, wasted: 0, ghostReleased: 0, reroutes: 0, spoiledBlocked: 0 };
  for (const r of s.riders) Object.assign(r, { status: 'idle', silent: false, traffic: false, lastPing: 0, taskId: null, nextTaskId: null });
  for (const b of s.batches) initBatch(s, b);
  for (const sh of s.shelters) sh.open ??= true;
  return s;
}

function initBatch(s, b) {
  b.remaining ??= b.qty;
  b.postedAt ??= s.now;
  b.status = 'available';
  b.warned = false;
  b.blockedNoted = false;
  log(s, 'info', `New batch: ${b.qty} ${RULES[b.category].unit} of ${RULES[b.category].label.toLowerCase()} at ${byId(s.donors, b.donorId).name}, safe for ${Math.round(b.expiresAt - s.now)} min.`);
}

export function log(s, level, msg) {
  s.log.unshift({ t: s.now, level, msg });
  if (s.log.length > 200) s.log.pop();
}

export const activeTasks = (s) => s.tasks.filter((t) => ACTIVE.has(t.phase));
export const isCarrying = (t) => CARRYING.has(t.phase);

export function compatible(shelter, category) {
  return shelter.open && RULES[category].requires.every((f) => shelter.has[f]);
}

export function missingFacilities(shelter, category) {
  return RULES[category].requires.filter((f) => !shelter.has[f]);
}

function incoming(s, shelterId, category, excludeId) {
  return activeTasks(s)
    .filter((t) => t.shelterId === shelterId && t.category === category && t.id !== excludeId)
    .reduce((sum, t) => sum + t.qty, 0);
}

export function unmet(s, shelter, category, excludeId) {
  return (shelter.need[category] || 0) - incoming(s, shelter.id, category, excludeId);
}

// ---------- Dispatch: split batches across riders and shelters, most urgent first ----------
export function dispatch(s) {
  const batches = s.batches
    .filter((b) => b.status === 'available' && b.remaining > 0)
    .sort((a, b) => a.expiresAt - b.expiresAt);

  for (const b of batches) {
    const donor = byId(s.donors, b.donorId);
    noteBlockedShelters(s, b);
    let best;
    do {
      best = null;
      for (const c of candidateRiders(s, b)) {
        const { r, from, freeAt, queued } = c;
        const kmh = speedOf(r);
        const tPick = travelMin(from, donor, kmh);
        for (const sh of s.shelters) {
          if (!compatible(sh, b.category)) continue;
          const room = unmet(s, sh, b.category);
          if (room <= 0) continue;
          const arrive = freeAt + tPick + CONFIG.handlingMin + travelMin(donor, sh, kmh);
          const slack = b.expiresAt - CONFIG.safetyBufferMin - arrive;
          if (slack < 0) continue;
          const qty = Math.min(b.remaining, r.capacity, room);
          const score = arrive - qty * 0.05 + (sh.fallback ? 1000 : 0) + (queued ? 2 : 0);
          if (!best || score < best.score) best = { r, sh, qty, arrive, slack, score, queued };
        }
      }
      if (best) assign(s, b, best);
    } while (best && b.remaining > 0);

    if (b.remaining > 0 && !b.warned) {
      b.warned = true;
      log(s, 'warn', `${b.remaining} ${RULES[b.category].unit} at ${donor.name} have no safe route yet (no free rider or receiving site can make it before spoilage). Waiting for capacity.`);
    }
  }
}

// Idle riders are free now. Riders already carrying food are free once they drop it off,
// so we can pre-book their next pickup instead of letting food wait for nobody.
// Standby riders are a rescue reserve: only used for batches whose earlier claim fell through.
function candidateRiders(s, b) {
  const out = [];
  for (const r of s.riders) {
    if (r.silent || (r.standby && !b.rescue)) continue;
    if (r.status === 'idle') { out.push({ r, from: r, freeAt: s.now, queued: false }); continue; }
    const cur = r.taskId && s.tasks.find((t) => t.id === r.taskId);
    if (r.status === 'busy' && cur && cur.phase === 'to_dropoff' && !r.nextTaskId) {
      const sh = s.shelters.find((x) => x.id === cur.shelterId);
      out.push({ r, from: sh, freeAt: Math.max(s.now, cur.eta), queued: true });
    }
  }
  return out;
}

function noteBlockedShelters(s, b) {
  if (b.blockedNoted) return;
  b.blockedNoted = true;
  for (const sh of s.shelters) {
    const missing = missingFacilities(sh, b.category);
    if (sh.open && (sh.need[b.category] || 0) > 0 && missing.length) {
      log(s, 'block', `Blocked: ${RULES[b.category].label.toLowerCase()} will not go to ${sh.name}; it has no ${missing.map((f) => FACILITY_LABEL[f]).join(' or ')}.`);
    }
  }
}

function assign(s, b, { r, sh, qty, arrive, slack, queued }) {
  const holdMin = clamp((b.expiresAt - s.now) * 0.15, CONFIG.minHoldMin, CONFIG.maxHoldMin);
  const t = {
    id: `T${s.seq++}`, batchId: b.id, riderId: r.id, shelterId: sh.id, category: b.category,
    qty, phase: queued ? 'queued' : 'to_pickup', createdAt: s.now, eta: arrive, holdMin, loadUntil: null,
  };
  s.tasks.push(t);
  b.remaining -= qty;
  b.warned = false;
  if (b.remaining === 0) b.status = 'allocated';
  if (queued) r.nextTaskId = t.id;
  else { r.status = 'busy'; r.taskId = t.id; }
  r.lastPing = s.now;
  const donor = byId(s.donors, b.donorId);
  log(s, 'assign', `${r.name} ${queued ? 'pre-booked (after current drop-off)' : 'claimed'} ${qty} ${RULES[b.category].unit}: ${donor.name} → ${sh.name}. ETA ${Math.round(arrive - s.now)} min, ${Math.round(slack)} min to spare. Must stay reachable (silence limit ${holdMin.toFixed(1)} min).`);
}

// ---------- Recovery ----------
function releaseToPool(s, t, reason) {
  const b = byId(s.batches, t.batchId);
  const r = byId(s.riders, t.riderId);
  const wasQueued = t.phase === 'queued';
  t.phase = 'released';
  b.remaining += t.qty;
  b.rescue = true;
  if (b.status === 'allocated') b.status = 'available';
  b.warned = false;
  if (wasQueued) r.nextTaskId = null;
  else { r.taskId = null; r.status = r.silent ? 'unresponsive' : 'idle'; startNext(s, r); }
  log(s, 'recover', `Released ${t.qty} ${RULES[t.category].unit} from ${r.name}: ${reason}. Back in the pool for re-dispatch.`);
}

function reroute(s, t, reason) {
  const r = byId(s.riders, t.riderId);
  if (t.phase === 'to_pickup' || t.phase === 'queued') return releaseToPool(s, t, reason);
  const b = byId(s.batches, t.batchId);
  const kmh = speedOf(r);
  let best = null;
  for (const sh of s.shelters) {
    if (sh.id === t.shelterId || !compatible(sh, t.category)) continue;
    if (unmet(s, sh, t.category, t.id) <= 0) continue;
    const arrive = s.now + (t.phase === 'loading' ? t.loadUntil - s.now : 0) + travelMin(r, sh, kmh);
    if (arrive > b.expiresAt - 1) continue;
    const score = arrive + (sh.fallback ? 1000 : 0);
    if (!best || score < best.score) best = { sh, arrive, score };
  }
  const from = byId(s.shelters, t.shelterId)?.name ?? 'destination';
  s.metrics.reroutes++;
  if (best) {
    t.shelterId = best.sh.id;
    t.eta = best.arrive;
    log(s, 'recover', `Rerouted ${r.name} (${t.qty} ${RULES[t.category].unit}) from ${from} → ${best.sh.name}: ${reason}. New ETA ${Math.round(best.arrive - s.now)} min.`);
  } else {
    t.phase = 'stranded';
    r.status = 'idle';
    r.taskId = null;
    startNext(s, r);
    log(s, 'critical', `${r.name} is stranded with ${t.qty} ${RULES[t.category].unit} (${reason}); no site can receive them before spoilage. Coordinator must take over by phone.`);
  }
}

function spoil(s, t, where) {
  const r = byId(s.riders, t.riderId);
  t.phase = 'spoiled';
  s.metrics.wasted += t.qty;
  s.metrics.spoiledBlocked += t.qty;
  r.status = r.silent ? 'unresponsive' : 'idle';
  r.taskId = null;
  startNext(s, r);
  log(s, 'critical', `Safety stop: ${t.qty} ${RULES[t.category].unit} with ${r.name} passed their safe time ${where}. Delivery blocked; rider told to dispose safely.`);
}

function startNext(s, r) {
  if (!r.nextTaskId || r.silent) return;
  const t = byId(s.tasks, r.nextTaskId);
  r.nextTaskId = null;
  if (!t || t.phase !== 'queued') return;
  t.phase = 'to_pickup';
  r.status = 'busy';
  r.taskId = t.id;
  r.lastPing = s.now;
}

// Re-check every receiving site against what is heading to it (walk-ins, closures, lost facilities).
function reconcileShelters(s) {
  for (const sh of s.shelters) {
    for (const cat of Object.keys(RULES)) {
      const heading = activeTasks(s)
        .filter((t) => t.shelterId === sh.id && t.category === cat)
        .sort((a, b) => a.eta - b.eta);
      if (!heading.length) continue;
      if (!sh.open) { heading.forEach((t) => reroute(s, t, `${sh.name} closed`)); continue; }
      const missing = missingFacilities(sh, cat);
      if (missing.length) { heading.forEach((t) => reroute(s, t, `${sh.name} lost ${missing.map((f) => FACILITY_LABEL[f]).join(' and ')}`)); continue; }
      let left = sh.need[cat] || 0;
      for (const t of heading) {
        if (left > 0) left -= t.qty;
        else reroute(s, t, `${sh.name} no longer needs ${RULES[cat].unit}`);
      }
    }
  }
}

// ---------- Simulation step ----------
export function tick(s, dt) {
  s.now += dt;

  for (const r of s.riders) if (!r.silent) r.lastPing = s.now;

  for (const t of activeTasks(s)) {
    const r = byId(s.riders, t.riderId);
    const b = byId(s.batches, t.batchId);
    const donor = byId(s.donors, b.donorId);
    const sh = byId(s.shelters, t.shelterId);

    // 1. Expiry while carrying (applies even if the rider is silent)
    if (isCarrying(t) && s.now >= b.expiresAt) { spoil(s, t, 'in transit'); continue; }

    // 2. Ghost reservation watchdog
    if (s.now - r.lastPing > t.holdMin) {
      if (t.phase === 'queued') {
        s.metrics.ghostReleased++;
        releaseToPool(s, t, `pre-booked rider silent for ${(s.now - r.lastPing).toFixed(1)} min`);
      } else if (t.phase === 'to_pickup') {
        s.metrics.ghostReleased++;
        r.status = 'unresponsive';
        releaseToPool(s, t, `no response for ${(s.now - r.lastPing).toFixed(1)} min`);
      } else if (!t.alerted) {
        t.alerted = true;
        log(s, 'critical', `${r.name} went silent while carrying ${t.qty} ${RULES[t.category].unit}. Coordinator alerted to call rider; ${sh.name} warned.`);
      }
      continue;
    }
    if (r.silent || t.phase === 'queued') continue;

    // 3. Spoilage forecast (e.g. traffic): release pickups that can no longer make it
    const kmh = speedOf(r);
    if (t.phase === 'to_pickup') {
      const projected = s.now + travelMin(r, donor, kmh) + CONFIG.handlingMin + travelMin(donor, sh, kmh);
      if (projected > b.expiresAt - CONFIG.safetyBufferMin) {
        releaseToPool(s, t, `projected arrival ${Math.round(projected - s.now)} min is too late for the food`);
        continue;
      }
    } else if (t.phase === 'to_dropoff') {
      const projected = s.now + travelMin(r, sh, kmh);
      if (projected > b.expiresAt) { reroute(s, t, 'cannot reach in time'); if (t.phase !== 'to_dropoff') continue; }
    }

    // 4. Movement
    if (t.phase === 'loading') {
      if (s.now >= t.loadUntil) { t.phase = 'to_dropoff'; log(s, 'move', `${r.name} picked up ${t.qty} ${RULES[t.category].unit} from ${donor.name}.`); }
      continue;
    }
    const target = t.phase === 'to_pickup' ? donor : byId(s.shelters, t.shelterId);
    const step = (kmh * dt) / 60 / CONFIG.roadFactor;
    const d = Math.hypot(target.x - r.x, target.y - r.y);
    if (d <= step) {
      r.x = target.x; r.y = target.y;
      if (t.phase === 'to_pickup') { t.phase = 'loading'; t.loadUntil = s.now + CONFIG.handlingMin; }
      else arrive(s, t);
    } else {
      r.x += ((target.x - r.x) / d) * step;
      r.y += ((target.y - r.y) / d) * step;
    }
  }

  // Unclaimed food that spoiled at the donor
  for (const b of s.batches) {
    if (b.status !== 'expired' && s.now >= b.expiresAt && b.remaining > 0) {
      s.metrics.wasted += b.remaining;
      log(s, 'critical', `${b.remaining} ${RULES[b.category].unit} expired unclaimed at ${byId(s.donors, b.donorId).name}.`);
      b.remaining = 0;
      b.status = 'expired';
    }
  }

  reconcileShelters(s);
  dispatch(s);
}

function arrive(s, t) {
  const r = byId(s.riders, t.riderId);
  const b = byId(s.batches, t.batchId);
  const sh = byId(s.shelters, t.shelterId);
  if (s.now > b.expiresAt) return spoil(s, t, `on arrival at ${sh.name}`);
  const room = Math.max(0, sh.need[t.category] || 0);
  const handed = Math.min(t.qty, room);
  if (handed > 0) {
    sh.need[t.category] -= handed;
    s.metrics.delivered += handed;
    log(s, 'done', `${r.name} delivered ${handed} ${RULES[t.category].unit} to ${sh.name}.`);
  }
  const left = t.qty - handed;
  if (left > 0) {
    t.qty = left;
    t.phase = 'to_dropoff';
    reroute(s, t, `${sh.name} could only take ${handed}`);
    if (t.phase === 'to_dropoff') return;
  } else {
    t.phase = 'done';
  }
  r.status = 'idle';
  r.taskId = null;
  startNext(s, r);
}

// ---------- Operator / field events ----------
export function addBatch(s, { donorId, category, qty, shelfMin }) {
  const b = { id: `B${s.seq++}`, donorId, category, qty, expiresAt: s.now + shelfMin };
  s.batches.push(b);
  initBatch(s, b);
  dispatch(s);
  return b;
}

export function setRiderSilent(s, riderId, silent) {
  const r = byId(s.riders, riderId);
  r.silent = silent;
  if (silent) log(s, 'event', `Field event: ${r.name} stopped responding.`);
  else {
    r.lastPing = s.now;
    if (r.status === 'unresponsive') r.status = 'idle';
    log(s, 'event', `${r.name} is back online.`);
  }
  dispatch(s);
}

export function setRiderTraffic(s, riderId, traffic) {
  const r = byId(s.riders, riderId);
  r.traffic = traffic;
  log(s, 'event', traffic ? `Field event: ${r.name} stuck in traffic (speed down to ${Math.round(speedOf(r))} km/h).` : `${r.name} is moving freely again.`);
}

export function walkInFill(s, shelterId) {
  const sh = byId(s.shelters, shelterId);
  for (const cat of Object.keys(sh.need)) sh.need[cat] = 0;
  log(s, 'event', `Field event: walk-in donations fully met ${sh.name}'s needs.`);
  reconcileShelters(s);
  dispatch(s);
}

export function toggleFacility(s, shelterId, facility) {
  const sh = byId(s.shelters, shelterId);
  sh.has[facility] = !sh.has[facility];
  log(s, 'event', `Field event: ${sh.name} ${sh.has[facility] ? 'now has' : 'lost'} ${FACILITY_LABEL[facility]}.`);
  reconcileShelters(s);
  dispatch(s);
}

export function toggleOpen(s, shelterId) {
  const sh = byId(s.shelters, shelterId);
  sh.open = !sh.open;
  log(s, 'event', `Field event: ${sh.name} ${sh.open ? 'reopened' : 'closed to new arrivals'}.`);
  reconcileShelters(s);
  dispatch(s);
}
