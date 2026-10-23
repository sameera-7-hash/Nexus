import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, dispatch, tick, activeTasks, addBatch,
  setRiderSilent, setRiderTraffic, walkInFill, toggleFacility, toggleOpen,
} from '../src/engine.js';
import { scenario } from '../src/scenario.js';

const run = (s, minutes, dt = 0.5) => { for (let t = 0; t < minutes; t += dt) tick(s, dt); };
const fresh = () => { const s = createState(scenario); dispatch(s); return s; };

test('splits a 180-meal batch across riders without exceeding capacity', () => {
  const s = fresh();
  const tasks = s.tasks.filter((t) => t.batchId === 'B1');
  assert.ok(tasks.length >= 2, 'batch should be split across several riders');
  for (const t of tasks) {
    const r = s.riders.find((x) => x.id === t.riderId);
    assert.ok(t.qty <= r.capacity);
  }
});

test('never over-commits a shelter beyond its stated need', () => {
  const s = fresh();
  for (const sh of s.shelters) {
    for (const [cat, need] of Object.entries(sh.need)) {
      const coming = activeTasks(s).filter((t) => t.shelterId === sh.id && t.category === cat).reduce((a, t) => a + t.qty, 0);
      assert.ok(coming <= need, `${sh.name} ${cat}: ${coming} > ${need}`);
    }
  }
});

test('baseline night delivers everything with zero waste', () => {
  const s = fresh();
  run(s, 200);
  assert.equal(s.metrics.wasted, 0);
  assert.ok(s.metrics.delivered > 200);
});

test('unresponsive rider: ghost claim is released and the food is re-dispatched', () => {
  const s = fresh();
  const t = s.tasks.find((x) => x.phase === 'to_pickup');
  setRiderSilent(s, t.riderId, true);
  run(s, t.holdMin + 1);
  assert.equal(t.phase, 'released');
  assert.equal(s.metrics.ghostReleased, 1);
  const again = s.tasks.filter((x) => x.batchId === t.batchId && x.riderId !== t.riderId && x.createdAt > 0);
  assert.ok(again.length > 0, 'released units should be claimed by another rider');
});

test('rider stuck in traffic releases a pickup that can no longer arrive safely', () => {
  const s = fresh();
  const t = s.tasks.find((x) => x.batchId === 'B2' && x.phase === 'to_pickup');
  setRiderTraffic(s, t.riderId, true);
  run(s, 1);
  assert.equal(t.phase, 'released');
});

test('walk-in fills the destination: in-transit cargo is rerouted, not stranded', () => {
  const s = fresh();
  run(s, 12);
  const t = activeTasks(s).find((x) => x.phase === 'to_dropoff' || x.phase === 'loading');
  assert.ok(t, 'expected a rider carrying food by now');
  const original = t.shelterId;
  walkInFill(s, original);
  assert.notEqual(t.shelterId, original);
  assert.ok(['to_dropoff', 'loading'].includes(t.phase));
  assert.ok(s.metrics.reroutes >= 1);
});

test('closing a site reroutes everything heading there', () => {
  const s = fresh();
  run(s, 12);
  const target = activeTasks(s)[0].shelterId;
  toggleOpen(s, target);
  assert.equal(activeTasks(s).filter((t) => t.shelterId === target).length, 0);
});

test('dependency rule: ration kits never go to a site without cooking fuel', () => {
  const s = fresh();
  run(s, 300);
  const toCampB = s.tasks.filter((t) => t.category === 'ration' && t.shelterId === 'S2');
  assert.equal(toCampB.length, 0);
});

test('losing clean water mid-trip reroutes infant formula', () => {
  const s = fresh();
  addBatch(s, { donorId: 'D2', category: 'formula', qty: 10, shelfMin: 240 });
  run(s, 20);
  const t = activeTasks(s).find((x) => x.category === 'formula');
  assert.ok(t);
  const original = t.shelterId;
  toggleFacility(s, original, 'water');
  assert.ok(t.shelterId !== original || t.phase === 'released' || t.phase === 'stranded');
});

test('expired food is never handed over', () => {
  const s = fresh();
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 40, shelfMin: 6 });
  run(s, 10);
  assert.equal(b.status, 'expired');
  assert.equal(s.tasks.filter((t) => t.batchId === b.id && t.phase === 'done').length, 0);
});
