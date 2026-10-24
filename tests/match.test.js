import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, dispatch, tick, addBatch, setRiderSilent, site } from '../src/engine.js';
import { scenario } from '../src/scenario.js';
import { applyAction, freshState } from '../src/actions.js';
import { matchStatus } from '../src/ui/derive.js';
import { toLatLng } from '../src/geo.js';

const empty = () => { const s = createState({ ...scenario, batches: [] }); s.sim = { running: true, speed: 3 }; dispatch(s); return s; };
const run = (s, minutes, dt = 0.5) => { for (let t = 0; t < minutes; t += dt) tick(s, dt); };
const byId = (list, id) => list.find((x) => x.id === id);

test('matched: the status lists exactly the tasks the engine created, with rider, shelter and ETA', () => {
  const s = empty();
  const [lat, lng] = toLatLng({ x: 6, y: 7 });
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 90, shelfMin: 90, pickup: { lat, lng, label: 'Back gate' } });
  const tasks = s.tasks.filter((t) => t.batchId === b.id);
  assert.ok(tasks.length >= 2, '90 meals should be split across riders');

  const nowMs = 1_700_000_000_000;
  const m = matchStatus(s, b, { nowMs });
  assert.equal(m.key, 'matched');
  assert.equal(m.searching, false, 'no ripple once a rider is assigned');
  assert.equal(m.splits.length, tasks.length);
  for (const t of tasks) {
    const x = m.splits.find((y) => y.taskId === t.id);
    const r = byId(s.riders, t.riderId);
    assert.equal(x.rider, r.name);
    assert.equal(x.riderId, r.id);
    assert.equal(x.shelter, site(s, t.shelterId).name);
    assert.equal(x.qty, t.qty);
    assert.equal(x.etaMin, t.eta - s.now);
    assert.equal(x.etaMs, nowMs + ((t.eta - s.now) / s.sim.speed) * 1000);
  }
  assert.equal(m.splits.reduce((a, x) => a + x.qty, 0) + b.remaining, 90);
});

test('the status follows the batch through the action reducer (what the posting tab reads back)', () => {
  let s = freshState();
  s = applyAction(s, { type: 'addBatch', donorId: 'D2', category: 'bread', qty: 30, postId: 'p1' });
  const b = s.batches.find((x) => x.postId === 'p1');
  assert.ok(b);
  const m = matchStatus(s, b);
  const tasks = s.tasks.filter((t) => t.batchId === b.id);
  assert.deepEqual(m.splits.map((x) => x.taskId), tasks.map((t) => t.id));
});

test('waiting: shows the engine logged reason, and the ripple only while the clock runs', () => {
  const s = empty();
  for (const r of s.riders) setRiderSilent(s, r.id, true); // nobody can take it
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 20, shelfMin: 90 });
  const m = matchStatus(s, b, { clockLive: true });
  assert.equal(m.key, 'waiting');
  assert.equal(m.splits.length, 0);
  const logged = s.log.find((l) => l.kind === 'noRoute' && l.batch === b.id);
  assert.ok(logged, 'engine should log why it is waiting');
  assert.equal(m.waitReason, logged.msg);
  assert.match(m.waitReason, /Waiting for capacity/);
  assert.equal(m.searching, true);

  const paused = matchStatus(s, b, { clockLive: false });
  assert.equal(paused.paused, true);
  assert.equal(paused.searching, false);
});

test('blocked: sites skipped by facility rules are listed with the engine reason', () => {
  const s = empty();
  const b = addBatch(s, { donorId: 'D2', category: 'ration', qty: 10, shelfMin: 600 });
  const m = matchStatus(s, b);
  const camp = m.blocked.find((x) => x.site === 'S2');
  assert.ok(camp, 'Relief Camp B has no cooking fuel, so ration kits are blocked there');
  assert.match(camp.reason, /Relief Camp B; it has no cooking fuel/);
  assert.ok(s.log.some((l) => l.kind === undefined && l.msg === camp.reason));
  assert.ok(m.splits.every((x) => x.shelterId !== 'S2'));
});

test('expired: unclaimed food that runs out of safe time says so plainly', () => {
  const s = empty();
  for (const r of s.riders) setRiderSilent(s, r.id, true);
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 40, shelfMin: 6 });
  run(s, 8);
  const m = matchStatus(s, b);
  assert.equal(m.key, 'expired');
  assert.equal(m.expiredQty, 40);
  assert.equal(m.waitReason, null);
  assert.equal(m.searching, false);
});

test('delivered: once handed over the status says where it went', () => {
  const s = empty();
  const b = addBatch(s, { donorId: 'D1', category: 'meals', qty: 20, shelfMin: 90 });
  run(s, 60);
  const m = matchStatus(s, b);
  assert.equal(m.key, 'delivered');
  assert.equal(m.delivered, 20);
  assert.ok(m.splits.every((x) => x.phase === 'done'));
});
