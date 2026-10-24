// Read-only selectors that turn engine state into what people need to see. No DOM.
import { RULES, CONFIG, activeTasks, isCarrying, pickupOf, site, roadKm } from '../engine.js';

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
