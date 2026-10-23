// Pure formatting helpers shared by the views and the alert selectors. No DOM.
export const byId = (list, id) => list.find((x) => x.id === id);

// mm:ss for short spans, "5h 20m" / "3d 4h" for long ones.
export function fmt(min) {
  const m = Math.max(0, min);
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 120) return `${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`;
  return `${String(Math.floor(m)).padStart(2, '0')}:${String(Math.floor((m % 1) * 60)).padStart(2, '0')}`;
}
export const clock = (min) => `T+${fmt(min)}`;
export const ago = (min) => (min < 1 ? 'just now' : min < 120 ? `${Math.round(min)} min ago` : `${Math.round(min / 60)} h ago`);

// Food-safety colour language, used everywhere: green safe, amber < 50 % of safe time left, red < 25 % or expired.
export function safety(left, total) {
  const pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return { pct, level: left <= 0 || pct < 0.25 ? 'bad' : pct < 0.5 ? 'warn' : 'ok' };
}
