import { useState } from 'react';
import { Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Callout, Empty, PageHeader, Section, StatusDisc, Tone } from '@/components/app/bits';
import { Pattern } from '@/components/app/art';
import { Icon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { RULES, FACILITY_LABEL, CONFIG, site, perPerson, nearestStation, isCarrying } from '@/engine.js';
import { fmt, ago, safety } from '@/ui/kit.js';
import { incomingTo, reroutedAway, checkInState, batchTotal } from '@/ui/derive.js';
import { StationCards } from './Stations';

export const nav = [
  { id: 'home', label: 'Today', icon: 'home' },
  { id: 'needs', label: 'Needs & facilities', icon: 'users' },
  { id: 'incoming', label: 'Incoming', icon: 'bike' },
  { id: 'food', label: 'Find food', icon: 'store' },
];

const WHY = {
  water: { icon: 'droplet', text: 'Needed to mix infant formula and cook dry rations. Without it we will not send formula or ration kits.' },
  fuel: { icon: 'flame', text: 'Needed to cook dry ration kits. Without it, kits go to a site that can actually cook them.' },
  cold: { icon: 'snow', text: 'Keeps short-life medicine and dairy safe. Without it, they are routed to a site with a fridge.' },
};
const cap = (t) => `${t[0].toUpperCase()}${t.slice(1)}`;

export default function ShelterView({ s, me, section, ctx }) {
  const id = me.entityId;
  const sh = site(s, id);
  const page = 'mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8';
  const two = 'grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]';
  return (
    <div className={page}>
      {section === 'home' && <>
        <PageHeader eyebrow="Receiving site" icon="home" title={me.name} actions={<Verify sh={sh} ctx={ctx} />}>
          Check in every day so riders know you are open. Keep your numbers current and food will find you.
        </PageHeader>
        <CheckIn s={s} sh={sh} ctx={ctx} />
        <div className="flex flex-col gap-2"><Attention s={s} sh={sh} /></div>
        <div className={two}>
          <Section icon="bike" title="Incoming" action={<Button variant="link" size="sm" asChild className="h-auto p-0"><a href="#/shelter/incoming">Full timeline</a></Button>}>
            <Timeline s={s} sh={sh} />
          </Section>
          <Section icon="users" title="Today at a glance"><Glance s={s} sh={sh} /></Section>
        </div>
      </>}
      {section === 'needs' && <>
        <PageHeader eyebrow="Needs & facilities" icon="users" title="Tell us what you need">
          Headcount decides your fair share when food is scarce. Facilities decide what we can safely send you.
        </PageHeader>
        <div className={two}>
          <NeedsForm sh={sh} ctx={ctx} />
          <Section icon="shield" title="Facilities" description="Changes apply instantly"><Facilities sh={sh} ctx={ctx} /></Section>
        </div>
      </>}
      {section === 'incoming' && <>
        <PageHeader eyebrow="Incoming" icon="bike" title="Riders on their way">
          Live ETAs. If something changes (you fill up, a rider is late), the reroute shows here.
        </PageHeader>
        <div className={two}>
          <Section icon="bike" title="On the way"><Timeline s={s} sh={sh} /></Section>
          <Section icon="zap" title="Reroute notices"><Reroutes s={s} sh={sh} /></Section>
        </div>
      </>}
      {section === 'food' && <>
        <PageHeader eyebrow="Find food" icon="store" title={`Food stations near ${me.name}`}>
          Send people here when your own supply runs out. Also public at <a className="font-medium text-primary underline-offset-4 hover:underline" href="#/stations">#/stations</a>, no login needed.
        </PageHeader>
        <StationCards s={s} from={sh} compact />
      </>}
    </div>
  );
}

function Verify({ sh, ctx }) {
  if (sh.verified) return <Tone level="ok" icon="shield">Verified site</Tone>;
  return <>
    <Tone level="warn" icon="shield">{sh.verifyRequested ? 'Verification pending' : 'Not verified'}</Tone>
    {!sh.verifyRequested && (
      <Button variant="outline" size="sm" onClick={() => ctx.act({ type: 'requestVerify', id: sh.id }, 'Verification requested. A coordinator will review it.')}>Request verification</Button>
    )}
  </>;
}

function CheckIn({ s, sh, ctx }) {
  const ci = checkInState(s, sh);
  const left = Math.max(0, Math.round(CONFIG.checkInWindowMin - ci.since));
  const title = { ok: 'You are confirmed open', overdue: 'Please confirm you are open', ghost: 'You are marked unconfirmed' }[ci.key];
  const text = {
    ok: `Riders will bring cooked and fresh food. Next check-in due within ${left} min.`,
    overdue: `It has been ${Math.round(ci.since)} min. Without a check-in in the next ${left} min, cooked food stops coming here.`,
    ghost: 'No check-in for over an hour, so cooked and perishable food is going elsewhere. Check in to get back into rotation.',
  }[ci.key];
  const shell = { ok: 'border-ok/25 bg-gradient-to-br from-ok/[0.07] to-card', overdue: 'border-warn/50 bg-warn/[0.07]', ghost: 'border-bad/50 bg-bad/[0.06]' }[ci.key];
  return (
    <Card aria-label="Daily check-in" className={cn('grain relative overflow-hidden py-5', shell)}>
      <Pattern kind="topo" className={cn('fade-r', { ok: 'text-ok/[0.14]', overdue: 'text-warn/[0.16]', ghost: 'text-bad/[0.14]' }[ci.key])} />
      <CardContent className="relative flex flex-wrap items-center gap-4 px-5 sm:px-6">
        <StatusDisc level={ci.level} icon={ci.key === 'ok' ? 'check' : 'clock'} />
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{title}</h2><Tone level={ci.level}>{ci.label}</Tone></div>
          <p className="font-prose text-sm text-muted-foreground">{text} Last check-in: <b className="font-mono text-foreground">{ago(ci.since)}</b>.</p>
        </div>
        <Button size="lg" className={cn('h-12 px-6 text-base', ci.key !== 'ok' && 'animate-glow')}
          onClick={() => ctx.act({ type: 'checkIn', id: sh.id }, 'Checked in. Riders can see you are open.')}>
          <Check /> We're open: confirm check-in
        </Button>
      </CardContent>
    </Card>
  );
}

function Attention({ s, sh }) {
  const items = [];
  if (!sh.verified) {
    const st = nearestStation(s, sh);
    items.push(['warn', 'shield', 'Your needs are served through the nearest food station until you are verified', st ? `Send people to ${st.name} (${st.helpline}). Nobody is turned away.` : 'Call the city helpline.']);
  }
  if (!sh.open) items.push(['bad', 'alert', 'Site marked closed', 'Nothing will be sent until you reopen.']);
  for (const f of Object.keys(FACILITY_LABEL)) if (!sh.has[f] && Object.keys(sh.need).some((c) => RULES[c].requires.includes(f) && sh.need[c] > 0)) {
    items.push(['warn', WHY[f].icon, `No ${FACILITY_LABEL[f]}: some of your needs cannot be sent`, WHY[f].text]);
  }
  const away = reroutedAway(s, sh.id).filter((t) => s.now - t.rerouted.at < 30);
  if (away.length) items.push(['warn', 'zap', `${away.length} delivery${away.length > 1 ? ' deliveries' : ''} rerouted away from you`, away[0].rerouted.reason]);
  const inc = incomingTo(s, sh.id);
  if (inc.length) items.push(['info', 'bike', `${inc.length} rider${inc.length > 1 ? 's' : ''} on the way`, `First arrives in about ${Math.max(1, Math.round(inc[0].t.eta - s.now))} min with ${inc[0].t.qty} ${RULES[inc[0].t.category].unit}.`]);
  if (!items.length) return <Callout tone="ok" icon="check" title="All set">No riders on the way right now. Keep your needs current and check in daily.</Callout>;
  return items.map(([lvl, ic, t, x], i) => <Callout key={i} tone={lvl} icon={ic} title={t}>{x}</Callout>);
}

function Timeline({ s, sh }) {
  const inc = incomingTo(s, sh.id);
  if (!inc.length) return <Empty icon="bike" title="No riders on the way">When a donor posts food that fits your needs, the rider and ETA appear here instantly.</Empty>;
  return (
    <ol className="flex flex-col">
      {inc.map(({ t, rider, batch, donor }) => {
        const left = batch.expiresAt - s.now;
        const lvl = safety(left, batchTotal(batch)).level;
        const phase = t.phase === 'to_pickup' || t.phase === 'queued' ? `Heading to ${donor.name} to collect` : t.phase === 'loading' ? `Loading at ${donor.name}` : 'Carrying it to you';
        const node = t.rerouted ? 'border-warn' : isCarrying(t) ? 'border-primary' : 'border-rider';
        return (
          <li key={t.id} className="relative pb-5 pl-8 before:absolute before:top-5 before:bottom-0 before:left-[8px] before:w-0.5 before:bg-border last:pb-0 last:before:hidden">
            <span className={cn('absolute top-0.5 left-0 size-[18px] rounded-full border-[3px] bg-card', node)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="font-semibold">{t.qty} {RULES[t.category].unit} · {RULES[t.category].label}</b>
              <Tone level={lvl}>ETA {Math.max(1, Math.round(t.eta - s.now))} min</Tone>
            </div>
            <p className="font-prose text-[12.5px] text-muted-foreground">{rider.name} ({rider.vehicle}) · {phase} · food safe for <span className="font-mono tabular">{fmt(left)}</span></p>
            {t.rerouted && <p className="font-prose text-[12.5px] text-warn">Rerouted here from {t.rerouted.from}: {t.rerouted.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function Glance({ s, sh }) {
  const pp = perPerson(s, sh);
  const needs = Object.entries(sh.need).filter(([, v]) => v > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {[['People', sh.headcount], ['Meals / person', pp == null ? '–' : pp.toFixed(2)], ['Meals received', sh.received.meals ?? 0]].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-muted/40 px-3 py-2.5">
            <b className="block font-mono text-xl font-bold tabular">{v}</b><span className="text-[11.5px] text-muted-foreground">{k}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Open needs</p>
        <div className="flex flex-wrap gap-1.5">
          {needs.length ? needs.map(([c, v]) => <Tone key={c}>{v} {RULES[c].unit}</Tone>) : <span className="font-prose text-[12.5px] text-muted-foreground">No open needs. Update them if that changes.</span>}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Facilities</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(FACILITY_LABEL).map((f) => <Tone key={f} level={sh.has[f] ? 'ok' : 'bad'} icon={WHY[f].icon}>{FACILITY_LABEL[f]}</Tone>)}
        </div>
      </div>
      <Button variant="outline" asChild><a href="#/shelter/needs">Update needs &amp; facilities</a></Button>
    </div>
  );
}

function NeedsForm({ sh, ctx }) {
  // Seeded once from the live site; the coordinator's later edits don't overwrite what is being typed.
  const [headcount, setHeadcount] = useState(String(sh.headcount));
  const [need, setNeed] = useState(() => Object.fromEntries(Object.keys(RULES).map((k) => [k, String(Math.max(0, sh.need[k] ?? 0))])));
  const submit = (e) => {
    e.preventDefault();
    const out = {};
    for (const k of Object.keys(RULES)) {
      const v = Number(need[k]);
      if (v > 0 || (k in sh.need)) out[k] = Math.max(0, v || 0);
    }
    ctx.act({ type: 'updateSite', id: sh.id, headcount: Number(headcount) || 0, need: out }, 'Needs saved. Dispatch is re-planning with your new numbers.');
  };
  return (
    <Section icon="users" title="Headcount & current needs">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="headcount">People staying tonight</Label>
          <Input id="headcount" type="number" min="0" inputMode="numeric" value={headcount} onChange={(e) => setHeadcount(e.target.value)} className="max-w-40" />
        </div>
        <Separator />
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {Object.entries(RULES).map(([k, r]) => (
            <label key={k} className="grid grid-cols-[1fr_96px] items-center gap-2 text-sm">
              <span>{r.label} <span className="text-muted-foreground">({r.unit})</span></span>
              <Input type="number" min="0" inputMode="numeric" value={need[k]} aria-label={`${r.label} needed`} onChange={(e) => setNeed({ ...need, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <Button type="submit" className="self-start"><Save /> Save needs</Button>
      </form>
    </Section>
  );
}

function Facilities({ sh, ctx }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Object.keys(FACILITY_LABEL).map((f) => (
        <label key={f} htmlFor={`fac-${f}`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors hover:bg-muted/40">
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', sh.has[f] ? 'bg-info/10 text-info' : 'bg-muted text-muted-foreground')}><Icon name={WHY[f].icon} className="size-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <b className="block text-sm font-semibold">{cap(FACILITY_LABEL[f])}</b>
            <span className="block font-prose text-[12.5px] text-muted-foreground">{WHY[f].text}</span>
          </span>
          <Switch id={`fac-${f}`} checked={!!sh.has[f]} aria-label={`${FACILITY_LABEL[f]} available`}
            onCheckedChange={(on) => ctx.act({ type: 'facility', id: sh.id, facility: f }, `${cap(FACILITY_LABEL[f])} marked ${on ? 'available' : 'unavailable'}`, on ? 'ok' : 'warn')} />
        </label>
      ))}
    </div>
  );
}

function Reroutes({ s, sh }) {
  const away = reroutedAway(s, sh.id);
  const into = s.tasks.filter((t) => t.rerouted && t.shelterId === sh.id);
  const rows = [
    ...away.map((t) => ({ t, tone: 'warn', title: `${t.qty} ${RULES[t.category].unit} sent elsewhere`, text: `${t.rerouted.reason} → now going to ${site(s, t.shelterId).name}` })),
    ...into.map((t) => ({ t, tone: 'info', title: `${t.qty} ${RULES[t.category].unit} rerouted to you`, text: `From ${t.rerouted.from}: ${t.rerouted.reason}` })),
  ].sort((a, b) => b.t.rerouted.at - a.t.rerouted.at);
  if (!rows.length) return <Empty icon="zap" title="No reroutes">If a rider is redirected to or away from you, the reason shows up here.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <Callout key={`${r.tone}-${r.t.id}`} tone={r.tone} icon="zap" title={r.title} aside={<span className="font-mono text-xs text-muted-foreground tabular">{fmt(r.t.rerouted.at)}</span>}>{r.text}</Callout>
      ))}
    </div>
  );
}
