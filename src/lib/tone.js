// Tinted surfaces for the safety / status levels the selectors return (ok, warn, bad, info, accent, station).
export const TONE = {
  ok: 'border-ok/25 bg-ok/10 text-ok',
  warn: 'border-warn/30 bg-warn/12 text-warn',
  bad: 'border-bad/25 bg-bad/10 text-bad',
  info: 'border-info/25 bg-info/10 text-info',
  accent: 'border-primary/25 bg-primary/10 text-primary',
  station: 'border-station/25 bg-station/10 text-station',
  muted: 'border-border bg-muted text-muted-foreground',
};
export const TEXT = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', info: 'text-info', accent: 'text-primary', rec: 'text-primary' };
export const STROKE = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' };
// Card outline for a row that needs attention.
export const CARD_TONE = {
  bad: 'border-bad/45 bg-bad/[0.04]',
  warn: 'border-warn/50 bg-warn/[0.05]',
};
