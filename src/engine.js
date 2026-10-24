// NEXUS dispatch engine — pure logic, no DOM. Time unit: simulated minutes. Distance unit: km.
import { inGrid, toGrid } from './geo.js';

// Perishability tiers decide where food may go:
// TIGHT -> only confirmed, verified sites reachable in time (stations as last resort).
// PERISHABLE -> relief camps or food stations. SHELF_STABLE -> stated needs at verified sites, the rest restocks stations.
export const TIERS = {
  TIGHT:        { label: 'Tight',        blurb: 'Cooked food: under 2 h' },
  PERISHABLE:   { label: 'Perishable',   blurb: 'Bread, fruit, dairy: 8–9 h' },
  SHELF_STABLE: { label: 'Shelf-stable', blurb: 'Dry, canned, sealed: days' },
};

// safeMin: default safe time a donor gets pre-filled. kg / serves: per unit, for impact numbers.
export const RULES = {
  meals:   { label: 'Cooked meals',        unit: 'meals',  requires: [],                tier: 'TIGHT',        safeMin: 90,    kg: 0.4, serves: 1 },
  medical: { label: 'Short-life medicine', unit: 'packs',  requires: ['cold'],          tier: 'TIGHT',        safeMin: 120,   kg: 0.1, serves: 0 },
  bread:   { label: 'Bread & bakery',      unit: 'loaves', requires: [],                tier: 'PERISHABLE',   safeMin: 540,   kg: 0.4, serves: 1 },
  fruit:   { label: 'Fresh fruit',         unit: 'kg',     requires: [],                tier: 'PERISHABLE',   safeMin: 480,   kg: 1,   serves: 2 },
  dairy:   { label: 'Milk & dairy',        unit: 'litres', requires: ['cold'],          tier: 'PERISHABLE',   safeMin: 480,   kg: 1,   serves: 2 },
  ration:  { label: 'Dry ration kits',     unit: 'kits',   requires: ['water', 'fuel'], tier: 'SHELF_STABLE', safeMin: 4320,  kg: 5,   serves: 4 },
  canned:  { label: 'Canned food',         unit: 'cans',   requires: [],                tier: 'SHELF_STABLE', safeMin: 10080, kg: 0.4, serves: 1 },
  formula: { label: 'Infant formula tins', unit: 'tins',   requires: ['water'],         tier: 'SHELF_STABLE', safeMin: 4320,  kg: 0.9, serves: 1 },
};
export const tierOf = (category) => RULES[category].tier;

export const FACILITY_LABEL = { water: 'clean water', fuel: 'cooking fuel', cold: 'cold storage' };
// Storage needs apply everywhere; preparation needs (water, fuel) only where food is cooked or mixed.
// Food stations hand out sealed goods for families to prepare at home, so only storage applies there.
const STORAGE = new Set(['cold']);

export const VEHICLES = {
  cycle:   { label: 'Cycle',         capacity: 15,  speed: 12 },
  scooter: { label: 'Scooter',       capacity: 40,  speed: 20 },
  auto:    { label: 'Auto-rickshaw', capacity: 100, speed: 18 },
};

export const CONFIG = {
  roadFactor: 1.3,      // straight-line km -> road km
  handlingMin: 3,       // loading time at donor
  safetyBufferMin: 5,   // food must arrive this many minutes before expiry
  minHoldMin: 2,        // shortest allowed silence before a claim is released
  maxHoldMin: 8,        // longest allowed silence before a claim is released
  trafficFactor: 0.2,   // speed multiplier when a rider is stuck
  checkInWindowMin: 60, // a receiving site that hasn't checked in for this long is UNCONFIRMED (ghost station)
  autoCheckInMin: 40,   // simulated staff at healthy sites check in this often
  stationServeEveryMin: 10, // food stations hand out stock to walk-in families at this cadence
  stationServeQty: 4,
};

const ACTIVE = new Set(['queued', 'to_pickup', 'loading', 'to_dropoff']);
const CARRYING = new Set(['loading', 'to_dropoff']);

const byId = (list, id) => list.find((x) => x.id === id);
// Receiving sites: shelters and camps (direct delivery) plus public food stations.
export const sites = (s) => (s.stations ? [...s.shelters, ...s.stations] : s.shelters);
export const site = (s, id) => byId(s.shelters, id) ?? byId(s.stations ?? [], id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const roadKm = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * CONFIG.roadFactor;
export const speedOf = (r) => r.speed * (r.traffic ? CONFIG.trafficFactor : 1) * (r.speedMul ?? 1);
export const travelMin = (a, b, kmh) => (roadKm(a, b) / kmh) * 60;

// Where a batch is collected: the pin the donor chose when posting, else the donor's fixed spot
// (seeded scenario batches). Every pickup ETA, movement and label goes through this.
export function pickupOf(s, b) {
  const donor = byId(s.donors, b.donorId);
  const p = b.pickup;
  if (p && p.x != null) return { x: p.x, y: p.y, name: p.label || `${donor.name} pickup pin`, custom: true };
  return donor;
}

export function createState(scenario) {
  const s = structuredClone(scenario);
  s.now = 0;
  s.tasks = [];
  s.log = [];
  s.seq = 1;
  s.metrics = { delivered: 0, wasted: 0, ghostReleased: 0, reroutes: 0, spoiledBlocked: 0, kgSaved: 0, peopleFed: 0, servedAtStations: 0, ghostStations: 0 };
  s.stations ??= [];
  for (const r of s.riders) {
    const v = VEHICLES[r.vehicle ??= 'scooter'];
    r.capacity ??= v.capacity;
    r.speed ??= v.speed;
    Object.assign(r, { status: 'idle', silent: false, traffic: false, lastPing: 0, taskId: null, nextTaskId: null });
  }
  for (const sh of s.shelters) {
    sh.open ??= true;
    sh.kind ??= 'shelter';
    sh.verified ??= true;
    sh.headcount ??= 0;
    sh.lastCheckIn ??= s.now;
    sh.autoCheckIn ??= true;
    sh.confirmed = true;
    sh.received = {};
  }
  for (const st of s.stations) {
    Object.assign(st, { kind: 'station', received: {}, lastServe: s.now });
    st.open ??= true;
    st.has ??= {};
    st.stock ??= {};
  }
  for (const b of s.batches) initBatch(s, b);
  return s;
}

function initBatch(s, b) {
  b.remaining ??= b.qty;
  b.postedAt ??= s.now;
  b.status = 'available';
  b.warned = false;
  b.blockedNoted = false;
  b.delivered = 0;
  b.deliveredTo = {};
  b.blocked = [];
  b.waitReason = null;
  log(s, 'info', `New batch: ${b.qty} ${RULES[b.category].unit} of ${RULES[b.category].label.toLowerCase()} at ${pickupOf(s, b).name}, safe for ${Math.round(b.expiresAt - s.now)} min.`, { batch: b.id });
}

// meta (optional) tags an entry for the alerts rail: { kind, rider, site, batch }.
export function log(s, level, msg, meta) {
  s.log.unshift({ t: s.now, level, msg, ...meta });
  if (s.log.length > 200) s.log.pop();
}

export const activeTasks = (s) => s.tasks.filter((t) => ACTIVE.has(t.phase));
export const isCarrying = (t) => CARRYING.has(t.phase);

export function missingFacilities(shelter, category) {
  return RULES[category].requires.filter((f) => (shelter.kind !== 'station' || STORAGE.has(f)) && !shelter.has[f]);
}

export function compatible(shelter, category) {
  return shelter.open && missingFacilities(shelter, category).length === 0;
}

// Full routing rule: facilities + tier + check-in + verification.
export function canReceive(s, sh, category) {
  if (!compatible(sh, category)) return false;
  if (sh.kind === 'station') return true;
  if (!sh.verified) return false; // unverified needs are served through public food stations
  const tier = tierOf(category);
  if (tier !== 'SHELF_STABLE' && !sh.confirmed) return false; // ghost station: no perishable food
  if (tier === 'PERISHABLE' && sh.kind !== 'camp') return false;
  return true;
}

function refusal(s, sh, category) {
  if (!sh.open) return `${sh.name} closed`;
  const missing = missingFacilities(sh, category);
  if (missing.length) return `${sh.name} lost ${missing.map((f) => FACILITY_LABEL[f]).join(' and ')}`;
  if (canReceive(s, sh, category)) return null;
  return sh.verified ? `${sh.name} has not checked in (possible ghost station)` : `${sh.name} is not verified`;
}

// Stations are the last resort for cooked food and sealed goods, but a first-class home for perishables.
const sitePenalty = (sh, category) => (sh.kind === 'station' && tierOf(category) !== 'PERISHABLE' ? 1000 : 0);

function incoming(s, shelterId, category, excludeId) {
  return activeTasks(s)
    .filter((t) => t.shelterId === shelterId && t.category === category && t.id !== excludeId)
    .reduce((sum, t) => sum + t.qty, 0);
}

export function unmet(s, shelter, category, excludeId) {
  return (shelter.need[category] || 0) - incoming(s, shelter.id, category, excludeId);
}

// Units per person a site has received or has on the way: the fairness number shown to coordinators.
export function perPerson(s, sh, category = 'meals') {
  if (!sh.headcount) return null;
  return ((sh.received[category] || 0) + incoming(s, sh.id, category)) / sh.headcount;
}

// Split `supply` across claims in proportion to headcount, never giving a site more than it needs
// (water-filling), in whole units. claims: [{ id, need, headcount }] -> { id: units }.
export function fairShares(supply, claims) {
  const out = Object.fromEntries(claims.map((c) => [c.id, 0]));
  const heads = (c) => Math.max(1, c.headcount || 0);
  let left = Math.max(0, Math.floor(supply));
  let active = claims.filter((c) => c.need > 0);
  while (left > 0 && active.length) {
    const perHead = left / active.reduce((a, c) => a + heads(c), 0);
    const capped = active.filter((c) => c.need - out[c.id] <= perHead * heads(c));
    if (capped.length) {
      for (const c of capped) { left -= c.need - out[c.id]; out[c.id] = c.need; }
      active = active.filter((c) => !capped.includes(c));
      continue;
    }
    const exact = active.map((c) => ({ c, v: perHead * heads(c) }));
    let given = 0;
    for (const e of exact) { const f = Math.floor(e.v); out[e.c.id] += f; given += f; }
    let rem = left - given;
    exact.sort((a, b) => (b.v % 1) - (a.v % 1));
    for (const e of exact) { if (rem <= 0) break; out[e.c.id]++; rem--; }
    left = 0;
  }
  return out;
}

// When the pool of available food in a category can't cover what verified sites need, cap each site
// at its headcount share. Returns null when supply covers demand (plain nearest-first dispatch).
function shareCaps(s, category) {
  const supply = s.batches.filter((b) => b.category === category && b.status === 'available').reduce((a, b) => a + b.remaining, 0);
  const claims = s.shelters.filter((sh) => canReceive(s, sh, category))
    .map((sh) => ({ id: sh.id, need: Math.max(0, unmet(s, sh, category)), headcount: sh.headcount }));
  const demand = claims.reduce((a, c) => a + c.need, 0);
  return supply > 0 && supply < demand ? { caps: fairShares(supply, claims), supply, demand } : null;
}

// ---------- Dispatch: split batches across riders and shelters, most urgent first ----------
export function dispatch(s) {
  const batches = s.batches
    .filter((b) => b.status === 'available' && b.remaining > 0)
    .sort((a, b) => a.expiresAt - b.expiresAt);

  const fair = {};
  for (const b of batches) {
    const pickup = pickupOf(s, b);
    noteBlockedShelters(s, b);
    if (!(b.category in fair)) fair[b.category] = shareCaps(s, b.category);
    const share = fair[b.category];
    // Pass 1 honours fair-share caps (direct sites only). Pass 2 drops the caps so food that no capped
    // site can reach in time still goes somewhere safe instead of spoiling.
    for (const capped of share ? [true, false] : [false]) {
      let best;
      do {
        best = null;
        for (const c of candidateRiders(s, b)) {
          const { r, from, freeAt, queued } = c;
          const kmh = speedOf(r);
          const tPick = travelMin(from, pickup, kmh);
          for (const sh of sites(s)) {
            if (!canReceive(s, sh, b.category)) continue;
            if (capped && sh.kind === 'station') continue;
            let room = unmet(s, sh, b.category);
            if (capped) room = Math.min(room, share.caps[sh.id] ?? 0);
            if (room <= 0) continue;
            const arrive = freeAt + tPick + CONFIG.handlingMin + travelMin(pickup, sh, kmh);
            const slack = b.expiresAt - CONFIG.safetyBufferMin - arrive;
            if (slack < 0) continue;
            const qty = Math.min(b.remaining, r.capacity, room);
            const score = arrive - qty * 0.05 + sitePenalty(sh, b.category) + (queued ? 2 : 0);
            if (!best || score < best.score) best = { r, sh, qty, arrive, slack, score, queued };
          }
        }
        if (best) {
          if (capped) {
            share.caps[best.sh.id] -= best.qty;
            if (!b.fairNoted) noteFairShare(s, b, share);
          }
          assign(s, b, best);
        }
      } while (best && b.remaining > 0);
      if (b.remaining === 0) break;
    }

    if (b.remaining > 0 && !b.warned) {
      b.warned = true;
      b.waitReason = `${b.remaining} ${RULES[b.category].unit} at ${pickup.name} have no safe route yet (no free rider or receiving site can make it before spoilage). Waiting for capacity.`;
      log(s, 'warn', b.waitReason, { kind: 'noRoute', batch: b.id });
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
      const sh = site(s, cur.shelterId);
      out.push({ r, from: sh, freeAt: Math.max(s.now, cur.eta), queued: true });
    }
  }
  return out;
}

function noteFairShare(s, b, share) {
  b.fairNoted = true;
  const people = Object.keys(share.caps).map((id) => `${site(s, id).name} ${site(s, id).headcount}`).join(', ');
  log(s, 'info', `Fair share: only ${share.supply} ${RULES[b.category].unit} for ${share.demand} needed, so they are split by headcount (${people} people), not nearest-first.`, { kind: 'fair', batch: b.id });
}

function noteBlockedShelters(s, b) {
  if (b.blockedNoted) return;
  b.blockedNoted = true;
  for (const sh of s.shelters) {
    const missing = missingFacilities(sh, b.category);
    if (sh.open && (sh.need[b.category] || 0) > 0 && missing.length) {
      const reason = `Blocked: ${RULES[b.category].label.toLowerCase()} will not go to ${sh.name}; it has no ${missing.map((f) => FACILITY_LABEL[f]).join(' or ')}.`;
      (b.blocked ??= []).push({ site: sh.id, name: sh.name, reason });
      log(s, 'block', reason, { site: sh.id, batch: b.id });
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
  b.waitReason = null;
  if (b.remaining === 0) b.status = 'allocated';
  if (queued) r.nextTaskId = t.id;
  else { r.status = 'busy'; r.taskId = t.id; }
  r.lastPing = s.now;
  log(s, 'assign', `${r.name} ${queued ? 'pre-booked (after current drop-off)' : 'claimed'} ${qty} ${RULES[b.category].unit}: ${pickupOf(s, b).name} → ${sh.name}. ETA ${Math.round(arrive - s.now)} min, ${Math.round(slack)} min to spare. Must stay reachable (silence limit ${holdMin.toFixed(1)} min).`, { rider: r.id, site: sh.id, batch: b.id });
}

// ---------- Recovery ----------
function releaseToPool(s, t, reason, ghost = false) {
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
  log(s, 'recover', `Released ${t.qty} ${RULES[t.category].unit} from ${r.name}: ${reason}. Back in the pool for re-dispatch.`, { kind: ghost ? 'ghostRider' : 'released', rider: r.id, batch: b.id });
}

function reroute(s, t, reason) {
  const r = byId(s.riders, t.riderId);
  if (t.phase === 'to_pickup' || t.phase === 'queued') return releaseToPool(s, t, reason);
  const b = byId(s.batches, t.batchId);
  const kmh = speedOf(r);
  let best = null;
  for (const sh of sites(s)) {
    if (sh.id === t.shelterId || !canReceive(s, sh, t.category)) continue;
    if (unmet(s, sh, t.category, t.id) <= 0) continue;
    const arrive = s.now + (t.phase === 'loading' ? t.loadUntil - s.now : 0) + travelMin(r, sh, kmh);
    if (arrive > b.expiresAt - 1) continue;
    const score = arrive + sitePenalty(sh, t.category);
    if (!best || score < best.score) best = { sh, arrive, score };
  }
  const from = site(s, t.shelterId)?.name ?? 'destination';
  s.metrics.reroutes++;
  if (best) {
    t.shelterId = best.sh.id;
    t.eta = best.arrive;
    t.rerouted = { at: s.now, reason, from };
    log(s, 'recover', `Rerouted ${r.name} (${t.qty} ${RULES[t.category].unit}) from ${from} → ${best.sh.name}: ${reason}. New ETA ${Math.round(best.arrive - s.now)} min.`, { kind: 'reroute', rider: r.id, site: best.sh.id, batch: b.id });
  } else {
    t.phase = 'stranded';
    r.status = 'idle';
    r.taskId = null;
    startNext(s, r);
    log(s, 'critical', `${r.name} is stranded with ${t.qty} ${RULES[t.category].unit} (${reason}); no site can receive them before spoilage. Coordinator must take over by phone.`, { kind: 'stranded', rider: r.id, batch: b.id });
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
  log(s, 'critical', `Safety stop: ${t.qty} ${RULES[t.category].unit} with ${r.name} passed their safe time ${where}. Delivery blocked; rider told to dispose safely.`, { kind: 'spoiled', rider: r.id, batch: t.batchId });
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
  for (const sh of sites(s)) {
    for (const cat of Object.keys(RULES)) {
      const heading = activeTasks(s)
        .filter((t) => t.shelterId === sh.id && t.category === cat)
        .sort((a, b) => a.eta - b.eta);
      if (!heading.length) continue;
      const why = refusal(s, sh, cat);
      if (why) { heading.forEach((t) => reroute(s, t, why)); continue; }
      let left = sh.need[cat] || 0;
      for (const t of heading) {
        if (left > 0) left -= t.qty;
        else reroute(s, t, `${sh.name} no longer needs ${RULES[cat].unit}`);
      }
    }
  }
}

// ---------- Simulation step ----------
// Ghost stations: a receiving site that stops checking in is UNCONFIRMED and gets no cooked or perishable food.
function checkInSweep(s) {
  for (const sh of s.shelters) {
    if (sh.autoCheckIn && s.now - sh.lastCheckIn >= CONFIG.autoCheckInMin) sh.lastCheckIn = s.now;
    const confirmed = s.now - sh.lastCheckIn <= CONFIG.checkInWindowMin;
    if (confirmed === sh.confirmed) continue;
    sh.confirmed = confirmed;
    if (!confirmed) {
      s.metrics.ghostStations++;
      log(s, 'warn', `Ghost station: ${sh.name} has not checked in for ${Math.round(s.now - sh.lastCheckIn)} min. Marked UNCONFIRMED; no cooked or perishable food goes there until it checks in.`, { kind: 'ghostStation', site: sh.id });
    }
  }
}

// Families collect from food stations through the day, which frees shelf space for new stock.
function serveStations(s) {
  for (const st of s.stations) {
    if (!st.open || s.now - st.lastServe < CONFIG.stationServeEveryMin) continue;
    st.lastServe = s.now;
    for (const [cat, n] of Object.entries(st.stock)) {
      const served = Math.min(n, CONFIG.stationServeQty);
      if (served <= 0) continue;
      st.stock[cat] -= served;
      st.need[cat] = (st.need[cat] || 0) + served;
      s.metrics.servedAtStations += served;
    }
  }
}

export function tick(s, dt) {
  s.now += dt;
  checkInSweep(s);
  serveStations(s);

  for (const r of s.riders) if (!r.silent) r.lastPing = s.now;

  for (const t of activeTasks(s)) {
    const r = byId(s.riders, t.riderId);
    const b = byId(s.batches, t.batchId);
    const pickup = pickupOf(s, b);
    const sh = site(s, t.shelterId);

    // 1. Expiry while carrying (applies even if the rider is silent)
    if (isCarrying(t) && s.now >= b.expiresAt) { spoil(s, t, 'in transit'); continue; }

    // 2. Ghost reservation watchdog
    if (s.now - r.lastPing > t.holdMin) {
      if (t.phase === 'queued') {
        s.metrics.ghostReleased++;
        releaseToPool(s, t, `pre-booked rider silent for ${(s.now - r.lastPing).toFixed(1)} min`, true);
      } else if (t.phase === 'to_pickup') {
        s.metrics.ghostReleased++;
        r.status = 'unresponsive';
        releaseToPool(s, t, `no response for ${(s.now - r.lastPing).toFixed(1)} min`, true);
      } else if (!t.alerted) {
        t.alerted = true;
        log(s, 'critical', `${r.name} went silent while carrying ${t.qty} ${RULES[t.category].unit}. Coordinator alerted to call rider; ${sh.name} warned.`, { kind: 'silentCarrying', rider: r.id, batch: b.id });
      }
      continue;
    }
    if (r.silent || t.phase === 'queued') continue;

    // 3. Spoilage forecast (e.g. traffic): release pickups that can no longer make it
    const kmh = speedOf(r);
    if (t.phase === 'to_pickup') {
      const projected = s.now + travelMin(r, pickup, kmh) + CONFIG.handlingMin + travelMin(pickup, sh, kmh);
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
      if (s.now >= t.loadUntil) { t.phase = 'to_dropoff'; log(s, 'move', `${r.name} picked up ${t.qty} ${RULES[t.category].unit} from ${pickup.name}.`, { rider: r.id, batch: b.id }); }
      continue;
    }
    const target = t.phase === 'to_pickup' ? pickup : site(s, t.shelterId);
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
      log(s, 'critical', `${b.remaining} ${RULES[b.category].unit} expired unclaimed at ${pickupOf(s, b).name}.`, { kind: 'expired', batch: b.id });
      b.expiredQty = b.remaining;
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
  const sh = site(s, t.shelterId);
  if (s.now > b.expiresAt) return spoil(s, t, `on arrival at ${sh.name}`);
  const room = Math.max(0, sh.need[t.category] || 0);
  const handed = Math.min(t.qty, room);
  if (handed > 0) {
    const rule = RULES[t.category];
    sh.need[t.category] -= handed;
    sh.received[t.category] = (sh.received[t.category] || 0) + handed;
    if (sh.kind === 'station') sh.stock[t.category] = (sh.stock[t.category] || 0) + handed;
    b.delivered += handed;
    b.deliveredTo[sh.id] = (b.deliveredTo[sh.id] || 0) + handed;
    t.delivered = (t.delivered || 0) + handed;
    s.metrics.delivered += handed;
    s.metrics.kgSaved += handed * rule.kg;
    s.metrics.peopleFed += handed * rule.serves;
    log(s, 'done', `${r.name} delivered ${handed} ${rule.unit} to ${sh.name}${sh.kind === 'station' ? ' (station restocked)' : ''}.`, { rider: r.id, site: sh.id, batch: b.id });
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
// pickup (optional): the donor's chosen pin { lat, lng, label, contact }. Its grid position is stored on
// the batch so riders are sent there. Pins outside the grid are refused, never clamped: the donor UI
// blocks them first, and this guard stops any other caller from silently sending riders to an edge.
// postId (optional): lets the posting tab find the batches it created, whichever tab applies the action.
export function addBatch(s, { donorId, category, qty, shelfMin, notes, photo, pickup, postId }) {
  let where;
  if (pickup && pickup.lat != null) {
    const g = toGrid(pickup);
    if (!inGrid(g)) throw new Error(`Pickup pin ${pickup.lat}, ${pickup.lng} is outside the service area`);
    where = { ...pickup, x: g.x, y: g.y };
  }
  const b = { id: `B${s.seq++}`, donorId, category, qty, expiresAt: s.now + (shelfMin ?? RULES[category].safeMin), notes, photo, pickup: where, postId };
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
  const sh = site(s, shelterId);
  for (const cat of Object.keys(sh.need)) sh.need[cat] = 0;
  log(s, 'event', `Field event: walk-in donations fully met ${sh.name}'s needs.`);
  reconcileShelters(s);
  dispatch(s);
}

export function toggleFacility(s, shelterId, facility) {
  const sh = site(s, shelterId);
  sh.has[facility] = !sh.has[facility];
  log(s, 'event', `Field event: ${sh.name} ${sh.has[facility] ? 'now has' : 'lost'} ${FACILITY_LABEL[facility]}.`);
  reconcileShelters(s);
  dispatch(s);
}

export function toggleOpen(s, shelterId) {
  const sh = site(s, shelterId);
  sh.open = !sh.open;
  log(s, 'event', `Field event: ${sh.name} ${sh.open ? 'reopened' : 'closed to new arrivals'}.`);
  reconcileShelters(s);
  dispatch(s);
}

// The volunteer app's "I'm still on it" button: proves the rider is alive and resets the silence timer.
export function riderHeartbeat(s, riderId) {
  const r = byId(s.riders, riderId);
  if (r.silent) return setRiderSilent(s, riderId, false);
  r.lastPing = s.now;
  log(s, 'info', `${r.name} tapped "I'm still on it". Silence timer reset.`, { rider: r.id });
}

export function checkIn(s, siteId) {
  const sh = site(s, siteId);
  const was = sh.confirmed;
  const gap = s.now - sh.lastCheckIn;
  sh.lastCheckIn = s.now;
  sh.autoCheckIn = true;
  sh.confirmed = true;
  if (!was) log(s, 'recover', `${sh.name} checked in after ${Math.round(gap)} min. Confirmed again and back in rotation for all food.`, { kind: 'checkIn', site: sh.id });
  else log(s, 'info', `${sh.name} checked in: open and receiving.`, { site: sh.id });
  dispatch(s);
}

// A site whose staff stopped responding: no check-in for longer than the window (judge scenario).
export function goGhost(s, siteId) {
  const sh = site(s, siteId);
  sh.autoCheckIn = false;
  sh.lastCheckIn = Math.min(sh.lastCheckIn, s.now - CONFIG.checkInWindowMin - 1);
  log(s, 'event', `Field event: ${sh.name} staff stopped responding (no check-in).`, { site: sh.id });
  checkInSweep(s);
  reconcileShelters(s);
  dispatch(s);
}

export function verifySite(s, siteId, reason) {
  const sh = site(s, siteId);
  sh.verified = true;
  sh.verifyRequested = false;
  sh.verifyReason = reason;
  log(s, 'recover', `${sh.name} verified by coordinator (${reason}). Now eligible for direct delivery.`, { kind: 'verified', site: sh.id });
  dispatch(s);
}

export function requestVerification(s, siteId) {
  const sh = site(s, siteId);
  sh.verifyRequested = true;
  log(s, 'info', `${sh.name} requested verification. Until then its people are served through the nearest food station.`, { kind: 'verifyRequest', site: sh.id });
}

export function updateSite(s, siteId, { headcount, need }) {
  const sh = site(s, siteId);
  if (headcount != null) sh.headcount = Math.max(0, Math.round(headcount));
  if (need) for (const [cat, v] of Object.entries(need)) sh.need[cat] = Math.max(0, Math.round(v));
  const needs = Object.entries(sh.need).filter(([, v]) => v > 0).map(([c, v]) => `${v} ${RULES[c].unit}`).join(', ');
  log(s, 'event', `${sh.name} updated its numbers: ${sh.headcount} people; needs ${needs || 'nothing right now'}.`, { site: sh.id });
  reconcileShelters(s);
  dispatch(s);
}

// Judge scenario: a flash flood closes sites and slows every rider.
export function flashFlood(s, siteIds, speedMul = 0.6) {
  for (const id of siteIds) site(s, id).open = false;
  for (const r of s.riders) r.speedMul = speedMul;
  s.flood = true;
  log(s, 'critical', `Flash flood: ${siteIds.map((id) => site(s, id).name).join(' and ')} closed; all riders slowed to ${Math.round(speedMul * 100)}% speed. Re-planning every route.`, { kind: 'flood' });
  reconcileShelters(s);
  dispatch(s);
}

export function nearestStation(s, from) {
  return s.stations.filter((st) => st.open).sort((a, b) => roadKm(from, a) - roadKm(from, b))[0] ?? null;
}

// Minutes until no rider could still get this food anywhere safely (its point of no return).
export function minutesToNoReturn(s, b) {
  const pickup = pickupOf(s, b);
  const fastest = Math.max(...s.riders.map(speedOf));
  const hops = sites(s).filter((sh) => canReceive(s, sh, b.category)).map((sh) => travelMin(pickup, sh, fastest));
  if (!hops.length) return 0;
  return b.expiresAt - CONFIG.safetyBufferMin - CONFIG.handlingMin - Math.min(...hops) - s.now;
}
