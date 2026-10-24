// Read-only selectors that turn engine state into what people need to see. No DOM.
import { RULES, CONFIG, VEHICLES, activeTasks, isCarrying, pickupOf, site, roadKm } from '../engine.js';

const byId = (list, id) => list.find((x) => x.id === id);
const ACTIVE = new Set(['queued', 'to_pickup', 'loading', 'to_dropoff']);

// Donor-facing status of one batch: Waiting / Rider assigned / Picked up / Rerouted / Delivered to X / Expired.
export function batchStatus(s, b) {
  const tasks = s.tasks.filter((t) => t.batchId === b.id);
  const active = tasks.filter((t) => ACTIVE.has(t.phase));
  const names = (ids) => [...new Set(ids)].map((id) => site(s, id)?.name).filter(Boolean).join(', ');
  const riders = [...new Set(active.map((t) => byId(s.riders, t.riderId).name))];
  const rerouted = active.filter((t) => t.rerouted);
  const deliveredTo = names(Object.keys(b.deliveredTo ?? {}));
  const spoiled = tasks.filter((t) => t.phase === 'spoiled').reduce((a, t) => a + t.qty, 0);
  const u = RULES[b.category].unit;

  if (rerouted.length) {
    const t = rerouted[0];
    return { key: 'rerouted', label: 'Rerouted', level: 'warn', riders, detail: `${byId(s.riders, t.riderId).name} rerouted to ${site(s, t.shelterId).name}: ${t.rerouted.reason}` };
  }
  if (active.some(isCarrying)) return { key: 'picked', label: 'Picked up', level: 'info', riders, detail: `On the way to ${names(active.map((t) => t.shelterId))}` };
  if (active.length) return { key: 'assigned', label: 'Rider assigned', level: 'info', riders, detail: `${riders.join(', ')} heading to you, then ${names(active.map((t) => t.shelterId))}` };
  if (b.remaining > 0 && b.status !== 'expired') return { key: 'waiting', label: 'Waiting', level: 'warn', riders, detail: 'Looking for a rider and a site that can take it safely' };
  if ((b.delivered ?? 0) > 0) {
    const extra = spoiled || b.status === 'expired' ? ` (${b.qty - b.delivered} ${u} could not be delivered safely)` : '';
    return { key: 'delivered', label: `Delivered to ${deliveredTo}`, level: 'ok', riders, detail: `${b.delivered} ${u} handed over${extra}` };
  }
  if (b.status === 'expired' || spoiled) return { key: 'expired', label: 'Expired', level: 'bad', riders, detail: 'Passed its safe time before it could be delivered. Never handed over.' };
  return { key: 'waiting', label: 'Waiting', level: 'warn', riders, detail: 'Queued for dispatch' };
}

// The engine's real match for one batch, for the donor's post confirmation and "My donations". Every line
// comes from engine state: tasks it created, the reason it logged for waiting, the sites it blocked.
// clockLive: some tab is running the clock (without it, riders don't move and retries don't happen).
// nowMs: real time now, to turn sim-minute ETAs into wall-clock (IST) times at the current sim speed.
// -> { key: 'sending' | 'waiting' | 'matched' | 'delivered' | 'expired', label, splits, waitReason, blocked,
//      remaining, delivered, expiredQty, paused, searching }
export function matchStatus(s, b, { clockLive = true, nowMs = Date.now() } = {}) {
  if (!b) return { key: 'sending', label: 'Sending to the dispatcher', splits: [], blocked: [], waitReason: null, remaining: 0, delivered: 0, expiredQty: 0, paused: !clockLive, searching: false };
  const speed = s.sim?.speed;
  const splits = s.tasks.filter((t) => t.batchId === b.id && t.phase !== 'released').map((t) => {
    const r = byId(s.riders, t.riderId);
    const sh = site(s, t.shelterId);
    const live = ACTIVE.has(t.phase);
    return {
      taskId: t.id, phase: t.phase, live, qty: t.qty, delivered: t.delivered ?? 0,
      rider: r.name, riderId: r.id, vehicle: VEHICLES[r.vehicle].label, shelter: sh.name, shelterId: sh.id,
      etaMin: live ? Math.max(0, t.eta - s.now) : null,
      // speed = sim minutes per real second. With the clock stopped there is no honest wall-clock ETA.
      etaMs: live && speed && clockLive ? nowMs + (Math.max(0, t.eta - s.now) / speed) * 1000 : null,
      rerouted: t.rerouted ?? null,
    };
  });
  const moving = splits.some((x) => x.live);
  const expired = b.status === 'expired';
  const waiting = b.remaining > 0 && !expired;
  const delivered = b.delivered ?? 0;
  const key = moving ? 'matched' : waiting ? 'waiting' : expired && b.expiredQty ? 'expired' : delivered > 0 ? 'delivered' : expired ? 'expired' : 'waiting';
  const label = { matched: 'Matched', waiting: 'Waiting for a match', delivered: 'Delivered', expired: 'Expired unclaimed' }[key];
  return {
    key, label, splits, delivered,
    remaining: b.remaining,
    expiredQty: b.expiredQty ?? 0,
    waitReason: waiting ? b.waitReason ?? null : null,
    blocked: b.blocked ?? [],
    paused: !clockLive && (moving || waiting),
    searching: key === 'waiting' && clockLive,
  };
}

export const batchTotal = (b) => Math.max(1, b.expiresAt - (b.postedAt ?? 0));

// Everything heading to a site, soonest first.
export function incomingTo(s, siteId) {
  return activeTasks(s).filter((t) => t.shelterId === siteId).sort((a, b) => a.eta - b.eta).map((t) => ({
    t, rider: byId(s.riders, t.riderId), batch: byId(s.batches, t.batchId), pickup: pickupOf(s, byId(s.batches, t.batchId)),
  }));
}

// Cargo that was heading to this site but got sent elsewhere (most recent first).
export function reroutedAway(s, siteId) {
  return s.tasks.filter((t) => t.rerouted && t.rerouted.from === site(s, siteId)?.name).sort((a, b) => b.rerouted.at - a.rerouted.at);
}

export function checkInState(s, sh) {
  const since = s.now - sh.lastCheckIn;
  if (!sh.confirmed) return { key: 'ghost', label: 'Unconfirmed', level: 'bad', since };
  if (since > CONFIG.checkInWindowMin * 0.75) return { key: 'overdue', label: 'Check-in due', level: 'warn', since };
  return { key: 'ok', label: 'Confirmed', level: 'ok', since };
}

export const distanceKm = (a, b) => roadKm(a, b);

export function stationsNear(s, from) {
  return [...s.stations].map((st) => ({ st, km: from ? roadKm(from, st) : null })).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
}

// Impact for one donor (or the whole city when donorId is omitted).
export function impact(s, donorId) {
  const batches = s.batches.filter((b) => !donorId || b.donorId === donorId);
  let meals = 0, people = 0, kg = 0, units = 0;
  for (const b of batches) {
    const r = RULES[b.category];
    const d = b.delivered ?? 0;
    units += d;
    if (b.category === 'meals') meals += d;
    people += d * r.serves;
    kg += d * r.kg;
  }
  return { meals, people: Math.round(people), kg: Math.round(kg), units, batches: batches.length };
}
