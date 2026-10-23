// Small NEXUS pieces built on shadcn/ui: safety rings, empty states, callouts, page headers, section cards, KPI tiles.
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyArt, Pattern } from '@/components/app/art';
import { Icon } from '@/lib/icons';
import { TONE, TEXT, STROKE } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { fmt, safety } from '@/ui/kit.js';

// Countdown ring: how much of the food's safe time is left. `device` uses fixed light colours (phone preview).
export function Ring({ left, total, size = 56, device = false, className }) {
  const { pct, level } = safety(left, total);
  const r = 22;
  const c = 2 * Math.PI * r;
  const stroke = device ? { ok: '#15803d', warn: '#b45309', bad: '#b91c1c' }[level] : STROKE[level];
  return (
    <span
      role="img"
      aria-label={left > 0 ? `${fmt(left)} of safe time left` : 'Expired'}
      className={cn('relative inline-grid shrink-0 place-items-center', device && 'phone-ring', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
        <circle className="ring-track" cx="26" cy="26" r={r} fill="none" strokeWidth="5" />
        <circle className="ring-val" cx="26" cy="26" r={r} fill="none" strokeWidth="5" strokeLinecap="round" stroke={stroke}
          strokeDasharray={c.toFixed(2)} strokeDashoffset={(c * (1 - pct)).toFixed(2)} />
      </svg>
      <b className={cn('relative font-mono font-bold tracking-tighter tabular', device ? 'text-[#1b1a18]' : TEXT[level])} style={{ fontSize: size * 0.2 }}>
        {left > 0 ? fmt(left) : 'EXP'}
      </b>
    </span>
  );
}

// A ring-sized tinted disc with an icon, for finished batches and check-in state.
export function StatusDisc({ level = 'ok', icon, size = 56 }) {
  return (
    <span className={cn('inline-grid shrink-0 place-items-center rounded-full border', TONE[level])} style={{ width: size, height: size }}>
      <Icon name={icon} className="size-6" />
    </span>
  );
}

export function Empty({ icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
      <EmptyArt icon={icon} />
      <b className="text-sm font-semibold">{title}</b>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// "What needs me right now?" row.
export function Callout({ tone = 'info', icon, title, children, action, aside, className }) {
  const shell = {
    ok: 'border-ok/30 bg-ok/[0.06]',
    warn: 'border-warn/40 bg-warn/[0.07]',
    bad: 'border-bad/35 bg-bad/[0.06]',
    info: 'border-border bg-card',
  }[tone];
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', shell, className)}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-md border', TONE[tone])}><Icon name={icon} className="size-[18px]" /></span>
      <div className="min-w-0 flex-1">
        {title && <b className="block text-sm font-semibold">{title}</b>}
        {children && <span className="block text-[13px] text-muted-foreground">{children}</span>}
      </div>
      {aside}
      {action}
    </div>
  );
}

// Page title. By default it sits on a banner with a faint contour pattern; `plain` drops the banner
// for headers that are already inside a decorated card.
export function PageHeader({ eyebrow, icon, title, children, actions, plain = false }) {
  return (
    <div className={cn('relative flex flex-wrap items-end justify-between gap-4',
      !plain && 'grain overflow-hidden rounded-2xl border bg-gradient-to-br from-accent/70 via-card to-card px-5 py-6 shadow-xs sm:px-7 sm:py-7')}>
      {!plain && <>
        <Pattern kind="topo" className="fade-r text-primary/[0.13]" />
        {icon && <Icon name={icon} aria-hidden="true" strokeWidth={1.25} className="pointer-events-none absolute -right-6 -bottom-10 size-44 text-primary/[0.06] max-sm:hidden" />}
      </>}
      <div className="relative min-w-0 space-y-1.5">
        <Badge variant="outline" className="gap-1.5 border-primary/25 bg-primary/10 text-primary uppercase tracking-wider text-[11px]">
          {icon && <Icon name={icon} className="size-3.5" />}{eyebrow}
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-[28px]">{title}</h1>
        {children && <p className="max-w-2xl text-muted-foreground">{children}</p>}
      </div>
      {actions && <div className="relative flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// A titled panel. `bare` drops the content padding for full-bleed lists.
export function Section({ icon, title, description, action, children, className, contentClassName, ...rest }) {
  return (
    <Card className={cn('min-w-0 gap-4 py-5', className)} {...rest}>
      {(title || action) && (
        <CardHeader className="px-5">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon && <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary"><Icon name={icon} className="size-4" /></span>}
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn('px-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

// KPI tile. tone colours the number (ok / bad / warn / rec = brand).
export function Metric({ tone = 'rec', icon, value, label }) {
  const disc = { ok: TONE.ok, bad: TONE.bad, warn: TONE.warn, rec: TONE.accent }[tone];
  return (
    <Card className="gap-0 py-4 shadow-xs">
      <CardContent className="flex items-start gap-3 px-4">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-md border', disc)}><Icon name={icon} className="size-[18px]" /></span>
        <div className="min-w-0">
          <b className={cn('block font-mono text-2xl leading-tight font-bold tracking-tight tabular', TEXT[tone])}>{Math.round(value)}</b>
          <span className="block text-xs text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function Tone({ level = 'muted', icon, children, className, ...rest }) {
  return (
    <Badge variant="outline" className={cn('max-w-full whitespace-normal', TONE[level] ?? TONE.muted, className)} {...rest}>
      {icon && <Icon name={icon} />}{children}
    </Badge>
  );
}

export const TIER_TONE = { TIGHT: 'bad', PERISHABLE: 'warn', SHELF_STABLE: 'ok' };

// Label / value pairs in a row.
export function KV({ items, className }) {
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground', className)}>
      {items.filter(Boolean).map(([k, v, cls]) => (
        <span key={k}>{k} <b className={cn('font-mono font-bold text-foreground tabular', cls)}>{v}</b></span>
      ))}
    </div>
  );
}

// Thin progress bar coloured by level.
export function Bar({ pct, level = 'ok', className }) {
  const bg = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', accent: 'bg-primary' }[level];
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <i className={cn('block h-full rounded-full transition-[width] duration-500 ease-linear', bg)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
