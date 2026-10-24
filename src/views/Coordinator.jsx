import { useEffect, useRef, useState } from 'react';
import { Bike, House, Package, Pause, Play, Plus, RotateCcw, ShieldCheck, Truck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bar, Empty, KV, Metric, PageHeader, Ring, Section, StatusDisc, TIER_TONE, Tone } from '@/components/app/bits';
import { CityMap } from '@/components/app/city-map';
import { Icon } from '@/lib/icons';
import { notify } from '@/lib/notify';
import { CARD_TONE, TONE } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { RULES, TIERS, FACILITY_LABEL, VEHICLES, activeTasks, isCarrying, site, perPerson, minutesToNoReturn } from '@/engine.js';
import { byId, fmt, clock, ago, ist, istShort } from '@/ui/kit.js';
import { useInterval } from '@/hooks/use-sim';
import { batchStatus, batchTotal, checkInState, impact } from '@/ui/derive.js';
import { alerts, SCENARIOS, scenarioActions } from '@/ui/alerts.js';

export const nav = [
  { id: 'ops', label: 'Live Ops', icon: 'map' },
  { id: 'riders', label: 'Riders', icon: 'bike' },
  { id: 'sites', label: 'Sites & Stations', icon: 'home' },
  { id: 'batches', label: 'Batches', icon: 'gift' },
  { id: 'log', label: 'Log & Impact', icon: 'log' },
];

const TITLES = {
  ops: ['Live Ops', 'What needs you right now, and where every rider is.'],
  riders: ['Riders', 'Volunteers, their jobs and silence timers. Simulate failures here.'],
  sites: ['Sites & Stations', 'Check-ins, verification, needs, fair share and station stock.'],
  batches: ['Batches', 'Every batch of surplus, its safe time and where it is going.'],
  log: ['Log & Impact', 'Every automated decision, with its reason, and what the night achieved.'],
};
const VERIFY_REASONS = ['Govt relief camp (district office list)', 'NGO partner confirmed headcount', 'Field visit by coordinator', 'Flood relief: emergency verification'];
const secHash = (sec) => `#/coordinator${sec === 'ops' ? '' : `/${sec}`}`;

export default function CoordinatorView({ s, section, ctx }) {
  // Survive section changes (this component stays mounted) so an alert click can land on, and highlight, its entity.
  const [selected, setSelected] = useState(() => (s.riders.find((r) => r.taskId) ?? s.riders[0]).id);
  const [focusId, setFocusId] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [logFilter, setLogFilter] = useState('all');
  const [verifyId, setVerifyId] = useState(null);
  const rider = byId(s.riders, selected) ? selected : s.riders[0].id;

  // Once the target section has rendered, scroll the entity into view and ring it for 3 s.
  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector(`[data-entity="${CSS.escape(focusId)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setHighlight(focusId);
    setFocusId(null);
  }, [focusId, section, s]);
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 3000);
    return () => clearTimeout(t);
  }, [highlight]);

  const jump = (sec, id) => {
    if (sec === 'riders' && id) setSelected(id);
    setFocusId(id || null);
    if (sec !== section) ctx.go(secHash(sec));
  };
  const runScenario = (id) => {
    const out = scenarioActions(s, id);
    if (out.error) { notify(out.error, 'warn'); return; }
    for (const a of out.actions) ctx.act(a);
    if (!s.sim.running) ctx.act({ type: 'play', running: true });
    notify(out.message, 'warn');
    if (out.focus) jump(out.focus[0], out.focus[1]);
  };
  const hl = (id) => id && id === highlight && 'border-primary ring-[3px] ring-primary/25';
  const view = { s, ctx, selected: rider, onSelect: setSelected, hl, onVerify: setVerifyId };
  const [title, blurb] = TITLES[section];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader eyebrow="Coordinator" icon="map" title={title} actions={<Controls s={s} ctx={ctx} onScenario={runScenario} />}>{blurb}</PageHeader>
      <AlertsRail s={s} onJump={jump} />

      {section === 'ops' && <>
        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6"><Kpis s={s} /></section>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
          <Section icon="map" title="Live city map" action={<Legend />} contentClassName="pt-1">
            <CityMap s={s} selected={rider} onSelect={setSelected} />
          </Section>
          <div className="flex flex-col gap-4">
            <PhonePanel {...view} />
            <Section icon="clock" title="Most urgent food" action={<Button variant="link" size="sm" asChild className="h-auto p-0"><a href="#/coordinator/batches">All batches</a></Button>}>
              <UrgentBatches {...view} />
            </Section>
          </div>
        </div>
      </>}

      {section === 'riders' && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <Section icon="bike" title="Riders" description="Click a rider to preview their phone"><Riders {...view} /></Section>
          <div className="xl:sticky xl:top-20"><PhonePanel {...view} /></div>
        </div>
      )}

      {section === 'sites' && <>
        <Section icon="home" title="Shelters & camps" description="Meals/person shows fairness across sites"><Sites {...view} /></Section>
        <Section icon="store" title="Food stations" action={<Button variant="link" size="sm" asChild className="h-auto p-0"><a href="#/stations">Public page</a></Button>}>
          <Stations {...view} />
        </Section>
      </>}

      {section === 'batches' && <>
        <BatchForm s={s} ctx={ctx} />
        <Section><Batches {...view} /></Section>
      </>}

      {section === 'log' && <>
        <Section icon="heart" title="Impact tonight">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"><ImpactTiles s={s} /></div>
        </Section>
        <Section icon="log" title="Decision log" action={
          <ToggleGroup type="single" variant="outline" size="sm" value={logFilter} onValueChange={(v) => v && setLogFilter(v)} aria-label="Filter log">
            {[['all', 'All'], ['recover', 'Recoveries'], ['critical', 'Critical'], ['assign', 'Dispatch']].map(([k, l]) => <ToggleGroupItem key={k} value={k} className="px-3">{l}</ToggleGroupItem>)}
          </ToggleGroup>
        }>
          <LogList s={s} filter={logFilter} />
        </Section>
      </>}

      <VerifyDialog s={s} id={verifyId} onClose={() => setVerifyId(null)} ctx={ctx} />
    </div>
  );
}

function Controls({ s, ctx, onScenario }) {
  return <>
    <Button onClick={() => ctx.act({ type: 'play', running: !s.sim.running }, s.sim.running ? 'Simulation paused' : 'Simulation running')} className="min-w-24">
      {s.sim.running ? <><Pause /> Pause</> : <><Play /> Start</>}
    </Button>
    <ToggleGroup type="single" variant="outline" value={String(s.sim.speed)} aria-label="Simulation speed"
      onValueChange={(v) => v && ctx.act({ type: 'speed', speed: Number(v) }, `Speed: ${v} simulated min per second`)}>
      {[1, 3, 6].map((v) => <ToggleGroupItem key={v} value={String(v)} className="px-3 font-mono">{v}×</ToggleGroupItem>)}
    </ToggleGroup>
    <Button variant="ghost" onClick={() => ctx.act({ type: 'reset' }, 'Demo city reset to the start of the night')} title="Reset the demo city"><RotateCcw /> Reset</Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline"><Zap className="text-warn" /> Judge scenarios</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-32px))]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Trigger a failure in one click</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SCENARIOS.map((x) => (
          <DropdownMenuItem key={x.id} onSelect={() => onScenario(x.id)} className="items-start gap-3 py-2">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon name={x.icon} className="size-4" /></span>
            <span><b className="block text-[13px] font-semibold">{x.title}</b><span className="font-prose text-xs text-muted-foreground">{x.text}</span></span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </>;
}

function AlertsRail({ s, onJump }) {
  const list = alerts(s);
  // Announce only alerts that are new, not every tick of a countdown.
  const announced = useRef(null);
  const [sr, setSr] = useState('');
  const titles = list.map((a) => a.title).join('\n');
  useEffect(() => {
    const now = titles ? titles.split('\n') : [];
    const fresh = announced.current ? now.filter((t) => !announced.current.has(t)) : [];
    if (fresh.length) setSr(`New alert: ${fresh.join('. ')}`);
    announced.current = new Set(now);
  }, [titles]);

  const ring = { bad: 'border-bad/40 hover:border-bad/70', warn: 'border-warn/45 hover:border-warn/75', info: 'hover:border-primary/50' };
  return (
    <section aria-label="Alerts">
      {list.length ? (
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {list.map((a, i) => (
            <button key={`${a.title}-${i}`} type="button" onClick={() => onJump(a.sec, a.id)}
              className={cn('flex max-w-xs flex-none snap-start items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left shadow-xs transition-colors', ring[a.level])}>
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-md border', TONE[a.level === 'info' ? 'accent' : a.level])}><Icon name={a.icon} className="size-4" /></span>
              <span className="min-w-0">
                <b className="block text-[12.5px] font-semibold">{a.title}</b>
                <span className="line-clamp-2 font-prose text-xs text-muted-foreground">{a.text}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-ok/45 bg-ok/[0.04] px-3 py-2.5 font-prose text-[13.5px] text-ok">
          <Icon name="check" className="size-4" /> All clear: every rider is responding, every site has checked in, no food is near its point of no return.
        </div>
      )}
      <p className="sr-only" aria-live="assertive">{sr}</p>
    </section>
  );
}

function Kpis({ s }) {
  const m = s.metrics;
  const silent = s.riders.filter((r) => r.silent).length;
  const ghosts = s.shelters.filter((x) => !x.confirmed).length;
  const moving = activeTasks(s).filter(isCarrying).reduce((a, t) => a + t.qty, 0);
  return [
    ['ok', 'check', m.delivered, 'units delivered safely'],
    ['rec', 'bike', moving, 'units on the road now'],
    [silent ? 'bad' : 'rec', 'bell', m.ghostReleased, `ghost claims released${silent ? ` · ${silent} silent now` : ''}`],
    [ghosts ? 'warn' : 'rec', 'home', ghosts, 'ghost stations right now'],
    ['rec', 'zap', m.reroutes, 'mid-trip reroutes'],
    [m.wasted ? 'bad' : 'ok', 'alert', m.wasted, 'units wasted'],
  ].map(([c, ic, v, l]) => <Metric key={l} tone={c} icon={ic} value={v} label={l} />);
}

function ImpactTiles({ s }) {
  const m = s.metrics;
  const im = impact(s);
  return [
    ['ok', 'heart', im.people, 'people fed'],
    ['ok', 'check', im.meals, 'meals delivered'],
    ['ok', 'leaf', im.kg, 'kg of food waste avoided'],
    ['rec', 'store', m.servedAtStations, 'units handed out at stations'],
    ['rec', 'bike', m.ghostReleased, 'ghost riders caught'],
    ['warn', 'home', m.ghostStations, 'ghost stations caught'],
    ['rec', 'zap', m.reroutes, 'mid-trip reroutes'],
    ['bad', 'shield', m.spoiledBlocked, 'unsafe handovers blocked'],
    [m.wasted ? 'bad' : 'ok', 'alert', m.wasted, 'units wasted'],
  ].map(([c, ic, v, l]) => <Metric key={l} tone={c} icon={ic} value={v} label={l} />);
}

function Legend() {
  const dot = 'inline-block size-2.5 align-middle mr-1.5';
  const glyph = 'inline-grid size-4 place-items-center align-middle mr-1 rounded-full text-white [&>svg]:size-2.5';
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground max-sm:hidden">
      <span><i className={cn(glyph, 'rounded-[4px] bg-donor')}><Package /></i>Donor</span>
      <span><i className={cn(glyph, 'bg-shelter')}><House /></i>Shelter / camp</span>
      <span><i className={cn(dot, 'rotate-45 rounded-[2px] bg-station')} />Food station</span>
      <span><i className={cn(dot, 'rounded-full border-2 border-dashed border-shelter')} />Unverified</span>
      <span><i className={cn(glyph, 'bg-rider')}><Bike /></i>Bike</span>
      <span><i className={cn(glyph, 'bg-rider')}><Truck /></i>Tempo</span>
    </div>
  );
}

function jobLine(s, r) {
  const t = r.taskId && byId(s.tasks, r.taskId);
  if (!t) return r.status === 'unresponsive' ? 'Silent: excluded from dispatch' : r.standby ? 'Rescue reserve: takes over failed claims' : 'Waiting for a job';
  const d = byId(s.donors, byId(s.batches, t.batchId).donorId);
  const sh = site(s, t.shelterId);
  const u = RULES[t.category].unit;
  if (t.phase === 'to_pickup') return `Heading to ${d.name} for ${t.qty} ${u} → ${sh.name}`;
  if (t.phase === 'loading') return `Loading ${t.qty} ${u} at ${d.name}`;
  return `Carrying ${t.qty} ${u} → ${sh.name} · ETA ${Math.max(1, Math.round(t.eta - s.now))} min`;
}

const STATUS_TONE = { idle: 'ok', busy: 'info', unresponsive: 'bad' };

function Riders({ s, ctx, selected, onSelect }) {
  return (
    <div className="flex flex-col gap-2.5">
      {s.riders.map((r) => {
        const t = r.taskId && byId(s.tasks, r.taskId);
        const n = r.nextTaskId && byId(s.tasks, r.nextTaskId);
        const silence = s.now - r.lastPing;
        const v = VEHICLES[r.vehicle];
        return (
          <article key={r.id} data-entity={r.id}
            className={cn('rounded-lg border bg-card p-3.5 transition-all', r.silent ? CARD_TONE.bad : r.traffic && CARD_TONE.warn, r.id === selected && 'border-primary ring-[3px] ring-primary/20')}>
            <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => onSelect(r.id)} aria-pressed={r.id === selected}>
              <span title={v.label} className={cn('grid size-9 shrink-0 place-items-center rounded-full', r.silent ? 'bg-bad/12 text-bad' : 'bg-rider/12 text-rider')}><Icon name="bike" className="size-[18px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span><b className="font-semibold">{r.name}</b> <span className="text-[12.5px] text-muted-foreground">· {v.label}, {r.capacity} units, {Math.round(r.speed * (r.speedMul ?? 1))} km/h{r.standby ? ' · rescue reserve' : ''}</span></span>
                  <Tone level={STATUS_TONE[r.status]}>{r.status}</Tone>
                </span>
                <span className="block text-[12.5px] text-muted-foreground">{jobLine(s, r)}</span>
                {n && <span className="block text-[12.5px] text-muted-foreground">Next (pre-booked): {n.qty} {RULES[n.category].unit} → {site(s, n.shelterId).name}</span>}
                {r.silent && t && (
                  <span className="mt-2 flex items-center gap-2 text-xs">
                    <span className="font-mono text-bad tabular">silent {silence.toFixed(1)}/{t.holdMin.toFixed(1)} min</span>
                    <Bar className="flex-1" level="bad" pct={(silence / t.holdMin) * 100} />
                  </span>
                )}
              </span>
            </button>
            <div className="mt-3 flex flex-wrap gap-1.5 pl-12">
              <Button size="sm" variant={r.silent ? 'destructive' : 'outline'}
                onClick={() => ctx.act({ type: 'riderSilent', id: r.id, silent: !r.silent }, r.silent ? `${r.name} is back online` : `${r.name} went silent. The silence timer is running.`, 'warn')}>
                {r.silent ? 'Bring back online' : 'Go unresponsive'}
              </Button>
              <Button size="sm" variant={r.traffic ? 'destructive' : 'outline'}
                onClick={() => ctx.act({ type: 'riderTraffic', id: r.id, traffic: !r.traffic }, r.traffic ? `${r.name} is moving freely again` : `${r.name} is stuck in traffic. ETAs re-forecast.`, 'warn')}>
                {r.traffic ? 'Clear traffic' : 'Stuck in traffic'}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PhonePanel({ s, ctx, selected, onSelect }) {
  return (
    <Section icon="phone" title="Volunteer app" aria-label="Volunteer phone preview" action={
      <Select value={selected} onValueChange={onSelect}>
        <SelectTrigger size="sm" aria-label="Rider" className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>{s.riders.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} · {VEHICLES[r.vehicle].label}</SelectItem>)}</SelectContent>
      </Select>
    }>
      <Phone s={s} ctx={ctx} id={selected} />
    </Section>
  );
}

// Always a light "device" screen, whatever the app theme.
function Phone({ s, ctx, id }) {
  useInterval(1000); // status-bar clock keeps ticking while the sim is paused
  const r = byId(s.riders, id);
  if (!r) return null;
  const t = r.taskId && byId(s.tasks, r.taskId);
  const b = t && byId(s.batches, t.batchId);
  const d = b && byId(s.donors, b.donorId);
  const sh = t && site(s, t.shelterId);
  const silence = s.now - r.lastPing;
  const atPickup = t && (t.phase === 'to_pickup' || t.phase === 'queued');
  const step = 'flex items-center gap-2.5 text-[13px]';
  return (
    <div className="mx-auto w-[300px] max-w-full rounded-[40px] bg-[#0e0e0d] p-3 shadow-xl ring-2 ring-[#2b2a28] ring-inset">
      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[30px] bg-[#f7f6f3] text-[#1b1a18]">
        <div className="mx-auto h-6 w-28 rounded-b-2xl bg-[#0e0e0d]" />
        <div className="flex justify-between px-5 pt-1.5 font-mono text-[11px] font-semibold text-[#444]">
          <span>{istShort()}</span><span>{r.silent ? 'No signal' : '4G ▮▮▮'}</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
          <div><div className="text-xs text-[#66615a]">NEXUS Rider · {VEHICLES[r.vehicle].label}</div><h3 className="text-lg font-bold tracking-tight">Hi {r.name}</h3></div>
          {t?.rerouted && s.now - t.rerouted.at < 30 && (
            <div className="rounded-2xl border border-[#f2c46b] bg-[#fff7e6] p-3 text-[12.5px] text-[#6b3d00]">
              <b className="mb-0.5 flex items-center gap-1.5 text-[13.5px]"><Zap className="size-4" /> New drop-off: {sh.name}</b>{t.rerouted.reason}. Follow the new route.
            </div>
          )}
          {r.silent && t && (
            <div className="rounded-2xl border border-[#f0a7a0] bg-[#fdecea] p-3 text-[12.5px] text-[#7a1712]">
              <b className="mb-0.5 block text-[13.5px]">Are you still on it?</b>No signal for {silence.toFixed(1)} min. This job is released in {Math.max(0, t.holdMin - silence).toFixed(1)} min unless you tap below.
            </div>
          )}
          {r.traffic && (
            <div className="rounded-2xl border border-[#f2c46b] bg-[#fff7e6] p-3 text-[12.5px] text-[#6b3d00]">
              <b className="mb-0.5 block text-[13.5px]">Heavy traffic on your route</b>We are re-checking your ETA against the food’s safe time.
            </div>
          )}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#e6e2da] bg-white p-3.5 shadow-sm">
            {!t ? <>
              <b>{r.silent ? 'You are offline' : r.standby ? 'On standby' : 'No job right now'}</b>
              <span className="text-[13px] text-[#66615a]">{r.standby ? 'You will get jobs that another rider dropped.' : 'Stay nearby. A new pickup can come in any minute.'}</span>
            </> : <>
              <div className="flex items-center gap-3">
                <Ring device left={b.expiresAt - s.now} total={batchTotal(b)} size={64} />
                <div className="flex-1"><b className="text-[15px]">{t.qty} {RULES[t.category].unit}</b><div className="text-xs text-[#66615a]">{RULES[t.category].label} · safe time left</div></div>
              </div>
              <div className={cn(step, !atPickup && 'text-[#888]')}><i className="size-2.5 shrink-0 rounded-full bg-[#2563eb]" /><span>{atPickup ? 'Pick up at' : 'Picked up from'} <b>{d.name}</b></span></div>
              <div className={cn(step, atPickup && 'text-[#888]')}><i className="size-2.5 shrink-0 rounded-full bg-[#0f766e]" /><span>Drop at <b>{sh.name}</b> · ETA {Math.max(1, Math.round(t.eta - s.now))} min</span></div>
              {b.notes && <div className="text-xs text-[#66615a]">Note: {b.notes}</div>}
            </>}
          </div>
          <button type="button" onClick={() => ctx.act({ type: 'heartbeat', id: r.id }, `${r.name}: "I'm still on it". Silence timer reset.`)}
            className={cn('mt-auto flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-md transition-transform active:scale-[0.98]', r.silent ? 'bg-[#b91c1c]' : 'bg-[#0f766e]')}>
            <Icon name="heart" className="size-5 animate-beat" /> I'm still on it
          </button>
          <div className="text-center text-[11.5px] text-[#66615a]">{t ? `Silence limit ${t.holdMin.toFixed(1)} min · scales with the food's safe time` : 'Heartbeat keeps your jobs reserved'}</div>
        </div>
      </div>
    </div>
  );
}

function Sites({ s, ctx, hl, onVerify }) {
  const maxPP = Math.max(0.01, ...s.shelters.map((x) => perPerson(s, x) ?? 0));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {s.shelters.map((sh) => {
        const ci = checkInState(s, sh);
        const pp = perPerson(s, sh);
        const toggle = (type, msg) => ctx.act({ type, id: sh.id }, msg, 'warn');
        return (
          <article key={sh.id} data-entity={sh.id}
            className={cn('flex flex-col gap-2.5 rounded-lg border bg-card p-4 transition-all', !sh.open ? CARD_TONE.bad : ci.key === 'ghost' && CARD_TONE.warn, hl(sh.id))}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span><b className="font-semibold">{sh.name}</b> <span className="text-[12.5px] text-muted-foreground">· {sh.kind}</span></span>
              <span className="flex flex-wrap gap-1">
                <Tone level={sh.open ? 'ok' : 'bad'}>{sh.open ? 'open' : 'closed'}</Tone>
                <Tone level={ci.level} title={`Last check-in ${ago(ci.since)}`}>{ci.key === 'ghost' ? `unconfirmed · last seen ${ago(ci.since)}` : ci.key === 'overdue' ? 'check-in due' : 'confirmed'}</Tone>
                <Tone level={sh.verified ? 'accent' : 'warn'} icon="shield">{sh.verified ? 'verified' : sh.verifyRequested ? 'verification requested' : 'unverified'}</Tone>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0">{sh.headcount} people</span>
              <Bar className="flex-1" level="accent" pct={pp == null ? 0 : (pp / maxPP) * 100} />
              <span className="font-mono tabular">{pp == null ? '–' : pp.toFixed(2)} meals/person</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
              {Object.entries(sh.need).map(([c, v]) => {
                const coming = activeTasks(s).filter((t) => t.shelterId === sh.id && t.category === c).reduce((a, t) => a + t.qty, 0);
                return <span key={c}>{RULES[c].unit}: <b className="font-mono tabular">{Math.max(0, v)}</b>{coming > 0 && <span className="text-muted-foreground"> (+{coming} en route)</span>}</span>;
              })}
            </div>
            {!sh.verified
              ? <p className="font-prose text-[12.5px] text-muted-foreground">Served via the nearest food station until verified.</p>
              : sh.verifyReason && <p className="font-prose text-[12.5px] text-muted-foreground">Verified: {sh.verifyReason}</p>}
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(FACILITY_LABEL).map((f) => (
                <button key={f} type="button" aria-pressed={!!sh.has[f]} title={`Toggle ${FACILITY_LABEL[f]}`}
                  onClick={() => ctx.act({ type: 'facility', id: sh.id, facility: f }, `${sh.name}: ${FACILITY_LABEL[f]} ${sh.has[f] ? 'lost' : 'restored'}`, 'warn')}
                  className={cn('rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors hover:bg-muted', sh.has[f] ? 'text-foreground/80' : 'border-bad/30 text-bad line-through')}>
                  {FACILITY_LABEL[f]}
                </button>
              ))}
            </div>
            <div className="mt-auto flex flex-wrap gap-1.5 border-t pt-3">
              {!sh.verified && <Button size="sm" onClick={() => onVerify(sh.id)}><ShieldCheck /> Verify…</Button>}
              {ci.key === 'ghost'
                ? <Button size="sm" variant="outline" onClick={() => ctx.act({ type: 'checkIn', id: sh.id }, `${sh.name} checked in`)}>Mark checked in</Button>
                : <Button size="sm" variant="outline" onClick={() => toggle('ghost', `${sh.name} stopped checking in`)}>Stop check-ins</Button>}
              <Button size="sm" variant="outline" onClick={() => toggle('walkIn', `Walk-ins filled ${sh.name}. Cargo heading there is rerouted.`)}>Walk-in fills demand</Button>
              <Button size="sm" variant={sh.open ? 'outline' : 'destructive'} className={cn(sh.open && 'text-bad hover:text-bad')}
                onClick={() => toggle('open', `${sh.name} ${sh.open ? 'closed' : 'reopened'}`)}>{sh.open ? 'Close site' : 'Reopen'}</Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Stations({ s, ctx, hl }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {s.stations.map((st) => {
        const stock = Object.entries(st.stock).filter(([, n]) => n > 0);
        const coming = activeTasks(s).filter((t) => t.shelterId === st.id).reduce((a, t) => a + t.qty, 0);
        return (
          <article key={st.id} data-entity={st.id} className={cn('flex flex-col gap-2.5 rounded-lg border bg-card p-4 transition-all', !st.open && CARD_TONE.bad, hl(st.id))}>
            <div className="flex items-center justify-between gap-2"><b className="font-semibold">{st.name}</b><Tone level={st.open ? 'station' : 'bad'}>{st.open ? 'open' : 'closed'}</Tone></div>
            <p className="text-[12.5px] text-muted-foreground">{st.hours ?? ''} · {st.helpline}{coming > 0 && ` · +${coming} units en route`}</p>
            {stock.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">
                {stock.map(([c, n]) => (
                  <div key={c} className="rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                    <b className={cn('block font-mono text-base font-bold text-foreground tabular', n < 5 && 'text-warn')}>{Math.floor(n)}</b>{RULES[c].unit}
                  </div>
                ))}
              </div>
            ) : <p className="font-prose text-[12.5px] text-muted-foreground">Shelves empty.</p>}
            <div className="mt-auto pt-1">
              <Button size="sm" variant={st.open ? 'outline' : 'destructive'} className={cn(st.open && 'text-bad hover:text-bad')}
                onClick={() => ctx.act({ type: 'open', id: st.id }, `${st.name} ${st.open ? 'closed' : 'reopened'}`, 'warn')}>{st.open ? 'Close station' : 'Reopen'}</Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function BatchCard({ s, b, hl }) {
  const st = batchStatus(s, b);
  const left = b.expiresAt - s.now;
  const live = !['delivered', 'expired'].includes(st.key);
  const moving = activeTasks(s).filter((t) => t.batchId === b.id).reduce((a, t) => a + t.qty, 0);
  const ponr = b.status === 'available' && b.remaining > 0 ? minutesToNoReturn(s, b) : null;
  const rule = RULES[b.category];
  return (
    <article data-entity={b.id} className={cn('flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-all', ponr != null && ponr < 15 && CARD_TONE.bad, hl?.(b.id))}>
      {live ? <Ring left={left} total={batchTotal(b)} size={52} /> : <StatusDisc level={st.level === 'ok' ? 'ok' : 'bad'} icon={st.level === 'ok' ? 'check' : 'x'} size={52} />}
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="font-semibold">{b.qty} {rule.unit} · {byId(s.donors, b.donorId).name}</b>
          <span className="flex flex-wrap gap-1"><Tone level={TIER_TONE[rule.tier]}>{TIERS[rule.tier].label}</Tone><Tone level={st.level}>{st.label}</Tone></span>
        </div>
        <p className="font-prose text-[12.5px] text-muted-foreground">{st.detail}</p>
        <KV className="mt-1" items={[
          ['Unclaimed', b.remaining],
          ['Moving', moving],
          ['Delivered', b.delivered ?? 0],
          ponr != null && ['Point of no return', ponr > 0 ? `${Math.round(ponr)} min` : 'passed', ponr < 15 && 'text-bad'],
        ]} />
      </div>
    </article>
  );
}

function Batches({ s, hl }) {
  if (!s.batches.length) return <Empty icon="gift" title="No surplus posted yet">Donors post from their dashboard, or post one above on their behalf.</Empty>;
  return <div className="flex flex-col gap-2.5">{[...s.batches].reverse().map((b) => <BatchCard key={b.id} s={s} b={b} hl={hl} />)}</div>;
}

function UrgentBatches({ s, hl }) {
  const live = s.batches.filter((b) => b.expiresAt > s.now && (b.remaining > 0 || activeTasks(s).some((t) => t.batchId === b.id)));
  if (!live.length) return <Empty icon="check" title="Nothing urgent">All posted food is delivered. New posts from donors appear here instantly.</Empty>;
  const rows = live.sort((a, b) => (a.expiresAt - s.now) / batchTotal(a) - (b.expiresAt - s.now) / batchTotal(b)).slice(0, 4);
  return <div className="flex flex-col gap-2.5">{rows.map((b) => <BatchCard key={b.id} s={s} b={b} hl={hl} />)}</div>;
}

function BatchForm({ s, ctx }) {
  const [donorId, setDonorId] = useState(s.donors[0].id);
  const [category, setCategory] = useState(Object.keys(RULES)[0]);
  const [qty, setQty] = useState('120');
  const [shelf, setShelf] = useState(String(RULES[Object.keys(RULES)[0]].safeMin));
  const submit = (e) => {
    e.preventDefault();
    const n = Math.max(1, Math.round(Number(qty) || 0));
    const shelfMin = Math.max(1, Number(shelf) || 0);
    ctx.act({ type: 'addBatch', donorId, category, qty: n, shelfMin }, `Posted ${n} ${RULES[category].unit} for ${fmt(shelfMin)}`);
  };
  return (
    <Section icon="plus" title="Post a batch on a donor's behalf">
      <form onSubmit={submit} noValidate className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_0.7fr_0.7fr_auto]">
        <div className="space-y-1.5"><Label htmlFor="b-donor">Donor</Label>
          <Select value={donorId} onValueChange={setDonorId}><SelectTrigger id="b-donor" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{s.donors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="b-cat">Food type</Label>
          <Select value={category} onValueChange={(k) => { setCategory(k); setShelf(String(RULES[k].safeMin)); }}><SelectTrigger id="b-cat" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(RULES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label} <span className="text-muted-foreground">· {TIERS[v.tier].label}</span></SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="b-qty">Quantity</Label><Input id="b-qty" type="number" min="1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="b-shelf">Safe minutes</Label><Input id="b-shelf" type="number" min="1" inputMode="numeric" value={shelf} onChange={(e) => setShelf(e.target.value)} /></div>
        <Button type="submit"><Plus /> Post batch</Button>
      </form>
    </Section>
  );
}

const LOG_TONE = {
  assign: 'border-l-rider', done: 'border-l-ok', recover: 'border-l-primary bg-primary/[0.07]',
  warn: 'border-l-warn', block: 'border-l-warn', critical: 'border-l-bad bg-bad/[0.07]', event: 'border-l-station',
};
const LOG_MATCH = {
  all: () => true,
  recover: (l) => l.level === 'recover',
  critical: (l) => l.level === 'critical' || l.level === 'warn' || l.level === 'block',
  assign: (l) => l.level === 'assign' || l.level === 'done',
};

function LogList({ s, filter }) {
  const rows = s.log.filter(LOG_MATCH[filter]).slice(0, 120);
  if (!rows.length) return <Empty icon="log" title={filter === 'all' ? 'No decisions yet' : 'Nothing of this kind yet'}>{filter === 'all' ? 'Start the clock and every automated decision appears here with its reason.' : 'Try another filter.'}</Empty>;
  return (
    <ScrollArea className="h-[560px] pr-3">
      <ol className="flex flex-col gap-1 text-[12.5px]">
        {rows.map((l, i) => (
          <li key={`${l.t}-${i}`} className={cn('rounded-r-md border-l-[3px] border-l-border bg-muted/40 px-3 py-2', LOG_TONE[l.level])}>
            <time className="mr-2 font-mono text-[11px] font-semibold text-muted-foreground tabular">{l.at ? ist(l.at) : clock(l.t)}</time>{l.msg}
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}

function VerifyDialog({ s, id, onClose, ctx }) {
  const [reason, setReason] = useState(VERIFY_REASONS[0]);
  const sh = id && site(s, id);
  return (
    <Dialog open={!!sh} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {sh && <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Verify {sh.name}</DialogTitle>
            <DialogDescription>{sh.headcount} people. Verified sites get direct delivery; unverified needs are served through food stations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="v-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="v-reason" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{VERIFY_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => { ctx.act({ type: 'verify', id: sh.id, reason }, `${sh.name} verified: ${reason}`); onClose(); }}><ShieldCheck /> Verify</Button>
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  );
}
