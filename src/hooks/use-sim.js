import { useEffect, useState, useSyncExternalStore } from 'react';
import { getState, isLeader, leaderAlive, subscribe } from '@/store.js';

// The shared simulation state. The store swaps in a new object on every change, so this re-renders per update.
export const useSim = () => useSyncExternalStore(subscribe, getState);

// Re-render on a wall-clock interval, for things that depend on real time (leader heartbeat, highlight expiry).
export function useInterval(ms) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// True while some tab is running the simulation clock: riders move and dispatch retries only then.
export function useClockLive(s) {
  useInterval(1000); // the leader heartbeat is wall-clock based
  return (isLeader() || leaderAlive()) && !!s?.sim?.running;
}
