// Shared live state across tabs.
// - The coordinator tab holds a heartbeat lock ("leader") and owns the simulation clock.
// - Every other tab renders the state it is sent and posts actions to the leader.
// - If no leader is alive, a tab applies its own action to the persisted state, so posting food
//   still works with only a donor tab open (the clock just doesn't move).
import { applyAction, freshState } from './actions.js';

const STATE_KEY = 'rf:state:v3';
const LEADER_KEY = 'rf:leader';
const LEADER_TTL = 3000;
const TICK_MS = 100;
const BROADCAST_MS = 200;
const PERSIST_MS = 1000;
const MAX_STEP_MIN = 0.5; // largest single engine step, in simulated minutes

const tabId = Math.random().toString(36).slice(2);
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('relayfresh') : null;
const listeners = new Set();

let state = null;
let leading = false;
let wantLead = false;
let loop = null;
let lastBroadcast = 0;
let lastPersist = 0;
let lastStep = 0;

function readJSON(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: tabs still sync over BroadcastChannel */ }
}

function persist() { lastPersist = Date.now(); writeJSON(STATE_KEY, state); }
function broadcast() { lastBroadcast = Date.now(); channel?.postMessage({ kind: 'state', from: tabId, state }); }
function emit() { for (const fn of listeners) fn(state); }

export function leaderAlive() {
  const l = readJSON(LEADER_KEY);
  return !!l && Date.now() - l.at < LEADER_TTL;
}
export const isLeader = () => leading;

function claimLeadership() {
  const l = readJSON(LEADER_KEY);
  if (!l || l.tab === tabId || Date.now() - l.at > LEADER_TTL) {
    writeJSON(LEADER_KEY, { tab: tabId, at: Date.now() });
    const check = readJSON(LEADER_KEY);
    // If storage is blocked there is no lock to read back; lead anyway so the demo still runs.
    return !check || check.tab === tabId;
  }
  return false;
}

let lastRenew = 0;
function renewLeadership(now) {
  if (now - lastRenew < 1000) return;
  lastRenew = now;
  const l = readJSON(LEADER_KEY);
  if (l && l.tab !== tabId && now - l.at < LEADER_TTL) { leading = false; return; } // another coordinator took over
  writeJSON(LEADER_KEY, { tab: tabId, at: now });
}

function step() {
  const now = Date.now();
  if (!wantLead) return;
  if (leading) renewLeadership(now);
  else if (!leaderAlive()) leading = claimLeadership();
  const elapsed = Math.min(5000, now - (lastStep || now));
  lastStep = now;
  if (!leading) return;
  if (state.sim.running) {
    // Advance by real elapsed time (background tabs throttle timers to ~1/s), in small sub-steps so the
    // engine sees the same granularity as a foreground tab.
    let simDt = (state.sim.speed * Math.max(elapsed, TICK_MS)) / 1000;
    while (simDt > 1e-6) {
      const dt = Math.min(simDt, MAX_STEP_MIN);
      if (!safeApply({ type: 'tick', dt })) { state.sim.running = false; break; }
      simDt -= dt;
    }
    if (now - lastBroadcast >= BROADCAST_MS) broadcast();
    if (now - lastPersist >= PERSIST_MS) persist();
    emit();
  }
}

export function initStore() {
  state = readJSON(STATE_KEY);
  if (!state || !state.sim) { state = freshState(); persist(); }
  channel?.addEventListener('message', ({ data }) => {
    if (data.from === tabId) return;
    if (data.kind === 'state' && !leading) { state = data.state; emit(); }
    if (data.kind === 'action' && leading) commit(data.action);
    if (data.kind === 'hello' && leading) broadcast();
  });
  // Fallback for browsers without BroadcastChannel: follow localStorage writes.
  window.addEventListener('storage', (e) => {
    if (e.key === STATE_KEY && e.newValue && !leading) {
      try { state = JSON.parse(e.newValue); emit(); } catch { /* ignore a partial write */ }
    }
  });
  window.addEventListener('beforeunload', () => {
    if (leading && readJSON(LEADER_KEY)?.tab === tabId) { try { localStorage.removeItem(LEADER_KEY); } catch { /* ignore */ } }
  });
  channel?.postMessage({ kind: 'hello', from: tabId });
  loop = setInterval(step, TICK_MS);
  return state;
}

// The coordinator tab asks to own the clock; other roles never do.
export function setLeadership(want) {
  wantLead = want;
  leading = want ? claimLeadership() : false;
  if (!want && readJSON(LEADER_KEY)?.tab === tabId) { try { localStorage.removeItem(LEADER_KEY); } catch { /* ignore */ } }
}

// Apply on a copy so an engine error can never leave the shared state half-updated mid-demo.
function safeApply(action) {
  try {
    state = applyAction(structuredClone(state), action);
    return true;
  } catch (err) {
    console.error(`RelayFresh: action "${action.type}" failed and was rolled back`, err);
    return false;
  }
}

function commit(action) {
  if (!safeApply(action)) return;
  persist();
  broadcast();
  emit();
}

export function act(action) {
  if (leading || !leaderAlive() || !channel) {
    if (!leading) state = readJSON(STATE_KEY) ?? state; // pick up anything another tab wrote
    commit(action);
  } else {
    channel.postMessage({ kind: 'action', from: tabId, action });
  }
}

export const getState = () => state;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const stopStore = () => clearInterval(loop);
