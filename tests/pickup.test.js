import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG, createState, dispatch, tick, addBatch, pickupOf, site, speedOf, travelMin, setRiderTraffic, walkInFill,
} from '../src/engine.js';
import { scenario } from '../src/scenario.js';
import { inGrid, toGrid, toLatLng } from '../src/geo.js';

const run = (s, minutes, dt = 0.5) => { for (let t = 0; t < minutes; t += dt) tick(s, dt); };
const empty = () => { const s = createState({ ...scenario, batches: [] }); dispatch(s); return s; };
const pinAt = (x, y, label = 'Back gate') => { const [lat, lng] = toLatLng({ x, y }); return { lat, lng, label }; };
const near = (a, b, km = 1e-6) => Math.hypot(a.x - b.x, a.y - b.y) <= km;
const byId = (list, id) => list.find((x) => x.id === id);
// Run until the task reaches the phase (or the time runs out).
function runUntil(s, t, phase, maxMin = 120) {
  for (let m = 0; m < maxMin && t.phase !== phase; m += 0.25) tick(s, 0.25);
  assert.equal(t.phase, phase, `task never reached ${phase}`);
}

test('lat/lng -> grid -> lat/lng round trip is accurate to within 10 m', () => {
  for (const [x, y] of [[0, 0], [10, 10], [1.5, 1.5], [6.2, 7.9], [9.99, 0.01]]) {
    const [lat, lng] = toLatLng({ x, y });
    const g = toGrid({ lat, lng });
    assert.ok(Math.hypot(g.x - x, g.y - y) * 1000 < 10, `grid ${x},${y} -> ${g.x},${g.y}`);
    const [lat2, lng2] = toLatLng(g);
    assert.ok(Math.abs(lat2 - lat) * 110600 < 10 && Math.abs(lng2 - lng) * 104900 < 10);
  }
  // Pune city centre (the donor form's default pin) is the middle of the grid.
  const c = toGrid({ lat: 18.5204, lng: 73.8567 });
  assert.ok(near(c, { x: 5, y: 5 }, 0.01));
});

test('a batch with a custom pickup stores the pin and its grid position', () => {
  const s = empty();
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 20, shelfMin: 90, pickup: pinAt(6, 7) });
  assert.equal(b.pickup.label, 'Back gate');
  assert.ok(near(b.pickup, { x: 6, y: 7 }, 1e-9));
  const p = pickupOf(s, b);
  assert.ok(p.custom && near(p, b.pickup));
});

test('custom pickup: ETA is computed from the pin and the rider drives to the pin', () => {
  const s = empty();
  const donor = byId(s.donors, 'D1');
  const pin = { x: 6, y: 7 }; // ~7.4 km from the Banquet Hall's fixed spot
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 20, shelfMin: 90, pickup: pinAt(pin.x, pin.y) });
  const t = s.tasks.find((x) => x.batchId === b.id);
  assert.ok(t, 'batch should be assigned');
  const r = byId(s.riders, t.riderId);
  const sh = site(s, t.shelterId);
  const kmh = speedOf(r);
  const expected = s.now + travelMin(r, pin, kmh) + CONFIG.handlingMin + travelMin(pin, sh, kmh);
  assert.ok(Math.abs(t.eta - expected) < 1e-6, `eta ${t.eta} vs ${expected}`);
  const viaDonor = s.now + travelMin(r, donor, kmh) + CONFIG.handlingMin + travelMin(donor, sh, kmh);
  assert.ok(Math.abs(t.eta - viaDonor) > 1, 'the test pin must be far enough from the donor to tell them apart');

  runUntil(s, t, 'loading');
  assert.ok(near(r, pin), `rider loaded at ${r.x},${r.y}, not the pin`);
  assert.ok(!near(r, donor, 1));
});

test('a batch without a pickup still uses the donor fixed location', () => {
  const s = empty();
  const donor = byId(s.donors, 'D1');
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 20, shelfMin: 90 });
  assert.equal(pickupOf(s, b), donor);
  const t = s.tasks.find((x) => x.batchId === b.id);
  const r = byId(s.riders, t.riderId);
  const kmh = speedOf(r);
  const expected = s.now + travelMin(r, donor, kmh) + CONFIG.handlingMin + travelMin(donor, site(s, t.shelterId), kmh);
  assert.ok(Math.abs(t.eta - expected) < 1e-6);
  runUntil(s, t, 'loading');
  assert.ok(near(r, donor));
});

test('traffic re-forecast uses the pin, not the donor fixed spot', () => {
  const s = empty();
  const donor = byId(s.donors, 'D1');
  const pin = { x: 3.2, y: 3.6 }; // next to Shelter A; the Banquet Hall is ~3 km further out
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 20, shelfMin: 45, pickup: pinAt(pin.x, pin.y) });
  const t = s.tasks.find((x) => x.batchId === b.id);
  const r = byId(s.riders, t.riderId);
  const sh = site(s, t.shelterId);
  setRiderTraffic(s, r.id, true);
  const kmh = speedOf(r);
  const limit = b.expiresAt - CONFIG.safetyBufferMin;
  // Sanity: from the pin the slowed rider still makes it; from the donor's spot it would not.
  assert.ok(s.now + travelMin(r, pin, kmh) + CONFIG.handlingMin + travelMin(pin, sh, kmh) < limit);
  assert.ok(s.now + travelMin(r, donor, kmh) + CONFIG.handlingMin + travelMin(donor, sh, kmh) > limit);
  tick(s, 0.5);
  assert.equal(t.phase, 'to_pickup', 'forecast from the pin should keep the claim');
});

test('reroute while loading at the pin plans from the pin', () => {
  const s = empty();
  const pin = { x: 6, y: 7 };
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 20, shelfMin: 120, pickup: pinAt(pin.x, pin.y) });
  const t = s.tasks.find((x) => x.batchId === b.id);
  const r = byId(s.riders, t.riderId);
  runUntil(s, t, 'loading');
  const original = t.shelterId;
  walkInFill(s, original);
  assert.notEqual(t.shelterId, original, 'cargo should be rerouted');
  const expected = s.now + (t.loadUntil - s.now) + travelMin(pin, site(s, t.shelterId), speedOf(r));
  assert.ok(Math.abs(t.eta - expected) < 1e-6, `eta ${t.eta} vs ${expected}`);
  run(s, 60);
  assert.ok(b.delivered > 0, 'rerouted cargo should still be handed over');
});

test('a pin outside the grid is refused, never clamped to an edge', () => {
  const s = empty();
  const outside = pinAt(12, 5);
  assert.ok(!inGrid(toGrid(outside)));
  const before = s.batches.length;
  assert.throws(() => addBatch(s, { donorId: 'D1', category: 'meals', qty: 20, pickup: outside }), /outside the service area/);
  assert.equal(s.batches.length, before);
});

test('pickup pins survive the cross-tab state copy', () => {
  const s = empty();
  addBatch(s, { donorId: 'D2', category: 'bread', qty: 30, pickup: pinAt(4, 8, 'Hostel back gate') });
  const copy = JSON.parse(JSON.stringify(s)); // what BroadcastChannel / localStorage carry
  const b = copy.batches.at(-1);
  assert.equal(pickupOf(copy, b).name, 'Hostel back gate');
  assert.ok(near(pickupOf(copy, b), { x: 4, y: 8 }, 1e-9));
  run(copy, 1);
});
