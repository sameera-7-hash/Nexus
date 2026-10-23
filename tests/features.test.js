import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, CONFIG, VEHICLES, createState, dispatch, tick, activeTasks, addBatch, fairShares, canReceive,
  checkIn, goGhost, verifySite, requestVerification, riderHeartbeat, setRiderSilent, flashFlood, site, perPerson,
} from '../src/engine.js';
import { scenario } from '../src/scenario.js';
import { applyAction, freshState } from '../src/actions.js';

const run = (s, minutes, dt = 0.5) => { for (let t = 0; t < minutes; t += dt) tick(s, dt); };
const fresh = () => { const s = createState(scenario); dispatch(s); return s; };
const empty = () => { const s = createState({ ...scenario, batches: [] }); dispatch(s); return s; };
const sentTo = (s, batchId) => s.tasks.filter((t) => t.batchId === batchId && t.phase !== 'released').map((t) => site(s, t.shelterId));

// ---------- Perishability tiers ----------
test('each food type has a tier and a default safe time that matches it', () => {
  for (const r of Object.values(RULES)) {
    if (r.tier === 'TIGHT') assert.ok(r.safeMin <= 120);
    if (r.tier === 'PERISHABLE') assert.ok(r.safeMin >= 480 && r.safeMin <= 540);
    if (r.tier === 'SHELF_STABLE') assert.ok(r.safeMin >= 1440);
  }
  const s = empty();
  const b = addBatch(s, { donorId: 'D1', category: 'bread', qty: 20 });
  assert.equal(b.expiresAt - s.now, RULES.bread.safeMin);
});

test('PERISHABLE food goes only to relief camps or food stations', () => {
  const s = empty();
  const b = addBatch(s, { donorId: 'D2', category: 'bread', qty: 120 });
  const dests = sentTo(s, b.id);
  assert.ok(dests.length > 0);
  for (const d of dests) assert.ok(d.kind === 'camp' || d.kind === 'station', `${d.name} is a ${d.kind}`);
});

test('SHELF_STABLE surplus with no stated need restocks food-station inventory', () => {
  const s = empty();
  const before = s.stations.reduce((a, st) => a + (st.stock.canned || 0), 0);
  const b = addBatch(s, { donorId: 'D1', category: 'canned', qty: 30 });
  for (const d of sentTo(s, b.id)) assert.equal(d.kind, 'station');
  run(s, 90);
  const after = s.stations.reduce((a, st) => a + (st.stock.canned || 0) + (st.received.canned || 0), 0);
  assert.ok(after >= before + 30 - CONFIG.stationServeQty * 30, 'stations should have received the cans');
  assert.equal(b.delivered, 30);
});

// ---------- Ghost stations ----------
test('healthy sites stay confirmed through a long shift (simulated staff check in)', () => {
  const s = fresh();
  run(s, 240);
  for (const sh of s.shelters) assert.equal(sh.confirmed, true, sh.name);
});

test('a site that stops checking in becomes UNCONFIRMED and gets no TIGHT food; check-in restores it', () => {
  const s = empty();
  goGhost(s, 'S1');
  const sh = site(s, 'S1');
  assert.equal(sh.confirmed, false);
  assert.ok(s.log.some((l) => l.kind === 'ghostStation' && l.site === 'S1'));
  assert.equal(canReceive(s, sh, 'meals'), false);
  assert.equal(canReceive(s, sh, 'canned'), true, 'shelf-stable can still go to a ghost site');
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 40 });
  assert.ok(!sentTo(s, b.id).some((d) => d.id === 'S1'), 'no meals to a ghost station');
  checkIn(s, 'S1');
  assert.equal(sh.confirmed, true);
  assert.ok(s.log.some((l) => l.kind === 'checkIn' && l.site === 'S1'));
});

test('a site going ghost mid-trip reroutes cooked food already heading there', () => {
  const s = fresh();
  const t = activeTasks(s).find((x) => x.category === 'meals' && x.shelterId === 'S1');
  assert.ok(t);
  goGhost(s, 'S1');
  assert.ok(t.shelterId !== 'S1' || t.phase === 'released');
});

test('a ghost site goes unconfirmed on its own once the check-in window passes', () => {
  const s = empty();
  site(s, 'S2').autoCheckIn = false;
  run(s, CONFIG.checkInWindowMin + 2);
  assert.equal(site(s, 'S2').confirmed, false);
  assert.equal(site(s, 'S1').confirmed, true);
});

// ---------- Verification tiers ----------
test('unverified needs never capture direct deliveries until a coordinator verifies the site', () => {
  const s = empty();
  const rv = site(s, 'S5');
  assert.equal(rv.verified, false);
  for (const sh of s.shelters) if (sh.id !== 'S5') sh.need.meals = 0;
  const b = addBatch(s, { donorId: 'D2', category: 'meals', qty: 30 });
  assert.ok(!sentTo(s, b.id).some((d) => d.id === 'S5'));
  requestVerification(s, 'S5');
  assert.equal(rv.verifyRequested, true);
  verifySite(s, 'S5', 'NGO partner confirmed headcount');
  const b2 = addBatch(s, { donorId: 'D2', category: 'meals', qty: 20 });
  assert.ok(sentTo(s, b2.id).some((d) => d.id === 'S5'), 'verified site now receives directly');
});

// ---------- Fair share ----------
test('fairShares splits by headcount, caps at need, and hands out every unit', () => {
  const out = fairShares(100, [{ id: 'a', need: 500, headcount: 100 }, { id: 'b', need: 500, headcount: 300 }]);
  assert.deepEqual(out, { a: 25, b: 75 });
  const capped = fairShares(100, [{ id: 'a', need: 10, headcount: 100 }, { id: 'b', need: 500, headcount: 100 }]);
  assert.deepEqual(capped, { a: 10, b: 90 });
  const odd = fairShares(10, [{ id: 'a', need: 9, headcount: 1 }, { id: 'b', need: 9, headcount: 1 }, { id: 'c', need: 9, headcount: 1 }]);
  assert.equal(odd.a + odd.b + odd.c, 10);
});

test('scarce cooked food is split by headcount, not nearest-first', () => {
  const s = empty();
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 60, shelfMin: 120 });
  const by = {};
  for (const t of s.tasks.filter((x) => x.batchId === b.id)) by[t.shelterId] = (by[t.shelterId] || 0) + t.qty;
  // Headcounts 50 / 120 / 45: Relief Camp B, the farthest site, still gets the biggest share.
  assert.ok(by.S2 >= 30, `camp B got ${by.S2}`);
  assert.ok((by.S1 || 0) <= 15, `shelter A got ${by.S1}`);
  assert.ok(s.log.some((l) => l.kind === 'fair'));
  const pp = ['S1', 'S2', 'S3'].map((id) => perPerson(s, site(s, id)));
  assert.ok(Math.max(...pp) - Math.min(...pp) < 0.05, `meals/person should be even: ${pp}`);
});

// ---------- Vehicles, heartbeat, flood ----------
test('vehicle types set capacity and speed', () => {
  const s = empty();
  const cycle = s.riders.find((r) => r.vehicle === 'cycle');
  const auto = s.riders.find((r) => r.vehicle === 'auto');
  assert.equal(cycle.capacity, VEHICLES.cycle.capacity);
  assert.equal(cycle.speed, VEHICLES.cycle.speed);
  assert.equal(auto.capacity, 100);
});

test('"I\'m still on it" heartbeat brings a silent rider back before the claim is released', () => {
  const s = fresh();
  const t = s.tasks.find((x) => x.phase === 'to_pickup');
  setRiderSilent(s, t.riderId, true);
  run(s, t.holdMin / 2);
  riderHeartbeat(s, t.riderId);
  run(s, t.holdMin);
  assert.notEqual(t.phase, 'released');
  assert.equal(s.metrics.ghostReleased, 0);
});

test('flash flood closes two sites, reroutes their cargo and slows every rider', () => {
  const s = fresh();
  run(s, 10);
  flashFlood(s, ['S1', 'S2']);
  assert.equal(site(s, 'S1').open, false);
  assert.equal(activeTasks(s).filter((t) => t.shelterId === 'S1' || t.shelterId === 'S2').length, 0);
  assert.ok(s.riders.every((r) => r.speedMul < 1));
});

test('food stations hand stock out over time, freeing shelf space', () => {
  const s = empty();
  const st = site(s, 'F2');
  const stock = st.stock.canned;
  const room = st.need.canned;
  run(s, 30);
  assert.ok(st.stock.canned < stock);
  assert.equal(st.need.canned - room, stock - st.stock.canned);
  assert.ok(s.metrics.servedAtStations > 0);
});

// ---------- Shared-state reducer ----------
test('actions reducer applies the same changes any tab would send', () => {
  let s = freshState();
  const n = s.batches.length;
  s = applyAction(s, { type: 'addBatch', donorId: 'D1', category: 'meals', qty: 10, shelfMin: 60 });
  assert.equal(s.batches.length, n + 1);
  s = applyAction(s, { type: 'ghost', id: 'S3' });
  assert.equal(site(s, 'S3').confirmed, false);
  s = applyAction(s, { type: 'checkIn', id: 'S3' });
  assert.equal(site(s, 'S3').confirmed, true);
  s = applyAction(s, { type: 'reset' });
  assert.equal(s.batches.length, n);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(s)), 'state must survive localStorage');
});

test('a rider carrying food to a food station can be pre-booked for the next pickup', () => {
  const s = empty();
  for (const sh of s.shelters) sh.need = {};
  const b = addBatch(s, { donorId: 'D1', category: 'canned', qty: 20 });
  run(s, 15);
  const t = activeTasks(s).find((x) => x.batchId === b.id && x.phase === 'to_dropoff');
  assert.ok(t && site(s, t.shelterId).kind === 'station', 'expected cargo heading to a station');
  for (const r of s.riders) if (r.id !== t.riderId) r.silent = true;
  assert.doesNotThrow(() => addBatch(s, { donorId: 'D2', category: 'canned', qty: 10 }));
  const r = s.riders.find((x) => x.id === t.riderId);
  assert.ok(r.nextTaskId, 'the busy rider should be pre-booked');
});
