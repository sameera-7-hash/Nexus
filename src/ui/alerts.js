// Coordinator alerts rail + one-click judge scenarios. Pure functions over engine state.
import { RULES, activeTasks, isCarrying, minutesToNoReturn, site } from '../engine.js';
import { ago } from './kit.js';

const byId = (list, id) => list.find((x) => x.id === id);
const RECENT_MIN = 20;

// Each alert: { level, icon, title, text, sec, id }. sec/id link to the entity's section.
export function alerts(s) {
  const out = [];
  for (const r of s.riders) {
    const t = r.taskId && byId(s.tasks, r.taskId);
    if (r.silent && t) out.push({ level: 'bad', icon: 'bike', title: `${r.name} has gone silent`, text: `${(s.now - r.lastPing).toFixed(1)} of ${t.holdMin.toFixed(1)} min silence limit used${isCarrying(t) ? ', carrying food. Call the rider.' : '; the claim will auto-release.'}`, sec: 'riders', id: r.id });
  }
  for (const sh of s.shelters) {
    if (!sh.confirmed) out.push({ level: 'warn', icon: 'clock', title: `Ghost station: ${sh.name}`, text: `Last seen ${ago(s.now - sh.lastCheckIn)}. No cooked or perishable food goes there until it checks in.`, sec: 'sites', id: sh.id });
    if (sh.verifyRequested && !sh.verified) out.push({ level: 'info', icon: 'shield', title: `${sh.name} asks to be verified`, text: `${sh.headcount} people. Verify to allow direct delivery.`, sec: 'sites', id: sh.id });
  }
  for (const b of s.batches) {
    if (b.status !== 'available' || b.remaining <= 0) continue;
    const ponr = minutesToNoReturn(s, b);
    if (ponr < 15) out.push({ level: 'bad', icon: 'alert', title: ponr <= 0 ? `${b.remaining} ${RULES[b.category].unit} can no longer be delivered safely` : `${b.remaining} ${RULES[b.category].unit} near point of no return`, text: ponr <= 0 ? `${byId(s.donors, b.donorId).name}: flagged and held back. Unsafe food never goes out.` : `${Math.round(ponr)} min left to get a rider to ${byId(s.donors, b.donorId).name}.`, sec: 'batches', id: b.id });
  }
  const seen = new Set();
  for (const l of s.log) {
    if (s.now - l.t > RECENT_MIN) break;
    const key = `${l.kind}:${l.rider ?? l.site ?? l.batch}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (l.kind === 'ghostRider') out.push({ level: 'warn', icon: 'bike', title: 'Ghost rider released', text: l.msg, sec: 'riders', id: l.rider });
    if (l.kind === 'reroute') out.push({ level: 'info', icon: 'zap', title: `Rerouted to ${site(s, l.site)?.name}`, text: l.msg, sec: 'riders', id: l.rider });
    if (l.kind === 'stranded') out.push({ level: 'bad', icon: 'alert', title: 'Rider stranded with food', text: l.msg, sec: 'riders', id: l.rider });
    if (l.kind === 'spoiled' || l.kind === 'expired') out.push({ level: 'bad', icon: 'alert', title: 'Safety stop', text: l.msg, sec: 'batches', id: l.batch });
    if (l.kind === 'flood') out.push({ level: 'bad', icon: 'droplet', title: 'Flash flood', text: l.msg, sec: 'sites' });
  }
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 10);
}

// One-click judge scenarios. Each returns { actions, message } or { error }.
export const SCENARIOS = [
  { id: 'tight', icon: 'clock', title: 'Tight expiry', text: 'Banquet Hall posts 40 meals with only 7 safe minutes. Nobody can make it safely, so it is flagged and never sent out.' },
  { id: 'ghostRider', icon: 'bike', title: 'Ghost rider', text: 'A rider heading to a pickup goes silent. The claim auto-releases and the rescue rider takes it.' },
  { id: 'fills', icon: 'users', title: 'Shelter fills mid-trip', text: 'Walk-ins fill the destination of a rider carrying food. The cargo is rerouted on the road.' },
  { id: 'water', icon: 'droplet', title: 'Site loses water', text: 'Women & Child C loses clean water. Formula and ration kits stop going there.' },
  { id: 'ghostStation', icon: 'home', title: 'Ghost station', text: 'A shelter stops checking in. It turns amber and cooked food goes elsewhere.' },
  { id: 'flood', icon: 'alert', title: 'Flash flood', text: 'Relief Camp B and Women & Child C close; every rider slows to 60%. Everything is re-planned.' },
];

export function scenarioActions(s, id) {
  const tasks = activeTasks(s);
  const rider = (t) => byId(s.riders, t.riderId);
  switch (id) {
    case 'tight':
      return { actions: [{ type: 'addBatch', donorId: 'D1', category: 'meals', qty: 40, shelfMin: 7 }], message: 'Posted 40 meals with 7 safe minutes. Watch them get flagged, not dispatched.', focus: ['batches'] };
    case 'ghostRider': {
      const t = tasks.find((x) => x.phase === 'to_pickup' && !rider(x).silent && !rider(x).standby) ?? tasks.find((x) => !rider(x).silent && !rider(x).standby);
      if (!t) return { error: 'No rider is on a job right now. Post some food first.' };
      return { actions: [{ type: 'riderSilent', id: t.riderId, silent: true }], message: `${rider(t).name} went silent. Watch the silence timer on the phone preview.`, focus: ['riders', t.riderId] };
    }
    case 'fills': {
      const t = tasks.find((x) => x.phase === 'to_dropoff' && site(s, x.shelterId).kind !== 'station') ?? tasks.find((x) => isCarrying(x)) ?? tasks[0];
      if (!t) return { error: 'No rider is carrying food yet. Start the clock and try again in a few seconds.' };
      return { actions: [{ type: 'walkIn', id: t.shelterId }], message: `Walk-ins filled ${site(s, t.shelterId).name}. ${rider(t).name}'s cargo is being rerouted.`, focus: ['riders', t.riderId] };
    }
    case 'water': {
      const sh = site(s, 'S3');
      const actions = sh.has.water ? [{ type: 'facility', id: 'S3', facility: 'water' }] : [];
      actions.push({ type: 'addBatch', donorId: 'D2', category: 'formula', qty: 12, shelfMin: 2880 });
      return { actions, message: 'Women & Child C lost clean water. New formula is routed to a site that has it.', focus: ['sites', 'S3'] };
    }
    case 'ghostStation': {
      const counts = s.shelters.filter((sh) => sh.confirmed && sh.verified).map((sh) => ({ sh, n: tasks.filter((t) => t.shelterId === sh.id).length })).sort((a, b) => b.n - a.n);
      const target = counts[0]?.sh;
      if (!target) return { error: 'Every shelter is already unconfirmed.' };
      return { actions: [{ type: 'ghost', id: target.id }], message: `${target.name} stopped checking in. It is now a ghost station.`, focus: ['sites', target.id] };
    }
    case 'flood':
      return { actions: [{ type: 'flood', ids: ['S2', 'S3'] }], message: 'Flash flood: two sites closed and every rider slowed. Routes re-planned.', focus: ['ops'] };
    default:
      return { error: 'Unknown scenario' };
  }
}
