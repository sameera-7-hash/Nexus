// Illustrations and faint background patterns. Everything is inline SVG / CSS drawn from theme tokens,
// so it follows light and dark mode and needs no network (no stock photos to fail on venue wifi).
import {
  Activity, Apple, BedDouble, Bike, Check, CookingPot, Croissant, HeartHandshake, House, MapPinned, Phone, Radar, Store, Users, Zap,
} from 'lucide-react';
import { Ring } from '@/components/app/bits';
import { Icon } from '@/lib/icons';
import { cn } from '@/lib/utils';

// A decorative pattern layer. Colour it with a text-* class at low opacity, e.g. "text-primary/15".
export function Pattern({ kind = 'dots', className }) {
  return <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', `pattern-${kind}`, className)} />;
}

const SCENES = {
  donor: { main: CookingPot, a: Croissant, b: Apple, color: 'var(--donor)' },
  shelter: { main: House, a: HeartHandshake, b: BedDouble, color: 'var(--shelter)' },
  coordinator: { main: Radar, a: Bike, b: Activity, color: 'var(--info)' },
  station: { main: Store, a: Phone, b: HeartHandshake, color: 'var(--station)' },
};

// Banner art for a role: a tinted contour field with an icon "constellation" joined by a dashed route.
export function RoleScene({ role, className }) {
  const s = SCENES[role];
  const tile = 'absolute grid place-items-center rounded-2xl bg-card shadow-md ring-1 ring-black/5 dark:ring-white/10';
  return (
    <div aria-hidden="true" className={cn('grain relative h-32 overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${s.color} 20%, transparent), color-mix(in oklab, ${s.color} 4%, transparent))` }}>
      <div className="pattern-topo absolute inset-0 opacity-[0.16]" style={{ color: s.color }} />
      <svg viewBox="0 0 300 128" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        <path d="M70 92 C 110 92, 112 52, 150 56 S 196 34, 230 40" fill="none" stroke={s.color} strokeWidth="1.6" strokeDasharray="4 5" strokeLinecap="round" opacity=".55" />
        <circle cx="70" cy="92" r="3" fill={s.color} opacity=".6" /><circle cx="230" cy="40" r="3" fill={s.color} opacity=".6" />
      </svg>
      <div className="absolute inset-0 mx-auto max-w-[300px]">
        <span className={cn(tile, 'top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2')} style={{ color: s.color }}><s.main className="size-7" strokeWidth={1.75} /></span>
        <span className={cn(tile, 'top-[58%] left-[14%] size-10 rounded-xl')} style={{ color: s.color }}><s.a className="size-[18px]" strokeWidth={1.75} /></span>
        <span className={cn(tile, 'top-[14%] right-[14%] size-10 rounded-xl')} style={{ color: s.color }}><s.b className="size-[18px]" strokeWidth={1.75} /></span>
      </div>
    </div>
  );
}

// Empty states: the icon at the centre of faint concentric rings over a dot field.
export function EmptyArt({ icon }) {
  return (
    <div aria-hidden="true" className="relative mb-2 grid size-28 place-items-center">
      <Pattern kind="dots" className="fade-radial text-foreground/[0.12]" />
      <span className="absolute size-24 rounded-full border border-dashed border-foreground/10" />
      <span className="absolute size-[72px] rounded-full border border-foreground/[0.07] bg-card/60" />
      <span className="relative grid size-12 place-items-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border">
        <Icon name={icon} className="size-[22px]" strokeWidth={1.75} />
      </span>
    </div>
  );
}

// Login hero: a small "product preview" collage. Decorative; the numbers are illustrative.
export function HeroPreview() {
  const pin = (x, y, color, r = 7) => <g><circle cx={x} cy={y} r={r + 5} fill={color} opacity=".14" /><circle cx={x} cy={y} r={r} fill={color} stroke="var(--card)" strokeWidth="2.5" /></g>;
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-[5/4] w-full max-w-[520px] select-none">
      <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" />
      {/* Base card: the live city */}
      <div className="grain absolute inset-x-6 top-6 bottom-10 overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className="flex gap-1.5"><i className="size-2.5 rounded-full bg-bad/60" /><i className="size-2.5 rounded-full bg-warn/60" /><i className="size-2.5 rounded-full bg-ok/60" /></span>
          <span className="ml-2 text-[11px] font-semibold text-muted-foreground">Live Ops · tonight</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-bold text-ok"><i className="size-1.5 animate-pulse-dot rounded-full bg-current" />LIVE</span>
        </div>
        <div className="relative h-full bg-map">
          <Pattern kind="grid" className="text-foreground/[0.05]" />
          <svg viewBox="0 0 400 260" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
            <path d="M-10 200 C 80 170, 120 230, 200 205 S 330 150, 420 175" fill="none" stroke="var(--info)" strokeOpacity=".14" strokeWidth="18" strokeLinecap="round" />
            <rect x="250" y="30" width="80" height="54" rx="10" fill="var(--ok)" opacity=".1" />
            <rect x="40" y="40" width="54" height="40" rx="10" fill="var(--ok)" opacity=".08" />
            <path d="M70 70 C 120 70, 150 120, 205 120" fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M205 120 C 260 120, 270 75, 310 62" fill="none" stroke="var(--rider)" strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" />
            <path d="M205 120 C 230 160, 280 170, 330 190" fill="none" stroke="var(--warn)" strokeWidth="2.5" strokeDasharray="7 5" strokeLinecap="round" />
            <rect x="60" y="60" width="20" height="20" rx="5" fill="var(--donor)" stroke="var(--card)" strokeWidth="2.5" />
            <rect x="300" y="52" width="20" height="20" rx="5" fill="var(--donor)" stroke="var(--card)" strokeWidth="2.5" />
            {pin(330, 190, 'var(--shelter)', 9)}
            <rect x="140" y="178" width="18" height="18" transform="rotate(45 149 187)" fill="var(--station)" stroke="var(--card)" strokeWidth="2.5" />
            {pin(205, 120, 'var(--rider)')}
          </svg>
        </div>
      </div>
      {/* Floating: spoilage countdown */}
      <div className="animate-float absolute top-[22%] -left-2 flex items-center gap-3 rounded-xl border bg-card/95 p-3 pr-4 shadow-xl backdrop-blur">
        <Ring left={42.3} total={90} size={48} />
        <div className="leading-tight"><b className="block text-[13px]">60 cooked meals</b><span className="text-[11px] text-muted-foreground">Banquet Hall · safe time left</span></div>
      </div>
      {/* Floating: reroute */}
      <div className="animate-float-slow absolute right-0 bottom-16 flex max-w-[230px] items-start gap-2.5 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warn/12 text-warn"><Zap className="size-4" /></span>
        <div className="leading-tight"><b className="block text-[12.5px]">Rerouted mid-trip</b><span className="text-[11px] text-muted-foreground">Shelter A filled up. Asha now heads to Relief Camp B.</span></div>
      </div>
      {/* Floating: delivered */}
      <div className="animate-float absolute bottom-0 left-10 flex items-center gap-2 rounded-full border bg-card/95 py-1.5 pr-3.5 pl-1.5 shadow-lg backdrop-blur">
        <span className="grid size-6 place-items-center rounded-full bg-ok text-white"><Check className="size-3.5" strokeWidth={3} /></span>
        <span className="text-[12px] font-semibold">180 meals delivered safe</span>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: CookingPot, color: 'var(--donor)', title: 'Donor posts surplus', text: 'Pick the food type; safe time fills in. Takes under a minute.' },
  { icon: MapPinned, color: 'var(--info)', title: 'Riders are dispatched', text: 'Batches split by capacity, routed to sites that can safely take them.' },
  { icon: Users, color: 'var(--shelter)', title: 'People are fed', text: 'Handed over inside its safe time, or held back. Never unsafe.' },
];

// "How it works" strip for the landing page.
export function HowItWorks() {
  return (
    <ol className="relative grid gap-6 md:grid-cols-3 md:gap-4">
      <span aria-hidden="true" className="absolute top-6 right-[16%] left-[16%] hidden border-t-2 border-dashed border-border md:block" />
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
          <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-card shadow-md ring-1 ring-border" style={{ color: s.color }}>
            <s.icon className="size-[22px]" strokeWidth={1.75} />
            <b className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-foreground font-mono text-[10px] text-background">{i + 1}</b>
          </span>
          <span>
            <b className="block text-sm font-semibold">{s.title}</b>
            <span className="block max-w-64 text-[13px] text-muted-foreground">{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
