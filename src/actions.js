// Every change to the shared simulation goes through applyAction, so any tab can describe a change
// and whichever tab owns the clock applies it. Pure: (state, action) -> state, no DOM.
import * as E from './engine.js';
import { scenario } from './scenario.js';

export function freshState() {
  const s = E.createState(scenario);
  s.sim = { running: true, speed: 3 };
  E.dispatch(s);
  return s;
}

const HANDLERS = {
  reset: () => freshState(),
  play: (s, { running }) => { s.sim.running = running; },
  speed: (s, { speed }) => { s.sim.speed = speed; },
  tick: (s, { dt }) => { E.tick(s, dt); },
  addBatch: (s, a) => { E.addBatch(s, a); },
  riderSilent: (s, { id, silent }) => E.setRiderSilent(s, id, silent),
  riderTraffic: (s, { id, traffic }) => E.setRiderTraffic(s, id, traffic),
  walkIn: (s, { id }) => E.walkInFill(s, id),
  facility: (s, { id, facility }) => E.toggleFacility(s, id, facility),
  open: (s, { id }) => E.toggleOpen(s, id),
  heartbeat: (s, { id }) => E.riderHeartbeat(s, id),
  checkIn: (s, { id }) => E.checkIn(s, id),
  ghost: (s, { id }) => E.goGhost(s, id),
  verify: (s, { id, reason }) => E.verifySite(s, id, reason),
  requestVerify: (s, { id }) => E.requestVerification(s, id),
  updateSite: (s, { id, headcount, need }) => E.updateSite(s, id, { headcount, need }),
  flood: (s, { ids }) => E.flashFlood(s, ids),
};

export function applyAction(s, action) {
  const h = HANDLERS[action.type];
  if (!h) throw new Error(`Unknown action ${action.type}`);
  const out = h(s, action);
  return out && out.riders ? out : s;
}

export const registerAction = (type, fn) => { HANDLERS[type] = fn; };
