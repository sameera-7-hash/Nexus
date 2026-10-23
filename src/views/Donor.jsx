import { useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Callout, Empty, KV, PageHeader, Ring, Section, StatusDisc, TIER_TONE, Tone } from '@/components/app/bits';
import { Pattern } from '@/components/app/art';
import { Icon } from '@/lib/icons';
import { CARD_TONE } from '@/lib/tone';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { RULES, TIERS } from '@/engine.js';
import { fmt } from '@/ui/kit.js';
import { batchStatus, batchTotal, impact } from '@/ui/derive.js';

export const nav = [
  { id: 'home', label: 'Overview', icon: 'home' },
  { id: 'post', label: 'Post food', icon: 'plus' },
  { id: 'donations', label: 'My donations', icon: 'list' },
  { id: 'impact', label: 'Impact', icon: 'heart' },
];

const ROUTING = {
  TIGHT: 'Goes only to verified sites that have checked in recently and that a rider can reach before it spoils.',
  PERISHABLE: 'Goes to relief camps and public food stations, where it is handed out the same day.',
  SHELF_STABLE: 'Fills stated needs at verified sites first; the rest restocks public food stations.',
};
const UNITS = { min: 1, h: 60, d: 1440 };

function splitTime(min) {
  if (min % 1440 === 0) return { value: min / 1440, unit: 'd' };
  if (min >= 180 && min % 60 === 0) return { value: min / 60, unit: 'h' };
  return { value: min, unit: 'min' };
}

const PostButton = ({ children = 'Post food', ...props }) => (
  <Button asChild {...props}><a href="#/donor/post"><Plus /> {children}</a></Button>
);

export default function DonorView({ s, me, section, ctx }) {
  const mine = s.batches.filter((b) => b.donorId === me.entityId);
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {section === 'home' && <>
        <PageHeader eyebrow="Donor" icon="gift" title={me.name} actions={<PostButton size="lg">Post surplus food</PostButton>}>
          Post surplus the moment you know you have it. Every minute of safe time counts.
        </PageHeader>
        <section aria-labelledby="attn-h" className="flex flex-col gap-2"><h2 id="attn-h" className="sr-only">Needs your attention</h2><Attention s={s} mine={mine} /></section>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <Section icon="list" title="Live donations" action={<Button variant="link" size="sm" asChild className="h-auto p-0"><a href="#/donor/donations">See all</a></Button>}>
            <Donations s={s} mine={mine} limit={4} />
          </Section>
          <Section icon="heart" title="Your impact"><ImpactTiles s={s} donorId={me.entityId} /></Section>
        </div>
      </>}
      {section === 'post' && <>
        <PageHeader eyebrow="Post surplus food" icon="plus" title="What do you have to give?">
          Three quick steps. The safe time fills in from the food type, and riders are dispatched the moment you confirm.
        </PageHeader>
        <PostFlow me={me} ctx={ctx} />
      </>}
      {section === 'donations' && <>
        <PageHeader eyebrow="My donations" icon="list" title="Where your food is right now" actions={<PostButton />}>
          Live status, the time it has left, and which rider and site got it.
        </PageHeader>
        <Section><Donations s={s} mine={mine} limit={99} /></Section>
      </>}
      {section === 'impact' && <>
        <PageHeader eyebrow="Impact" icon="heart" title="What your surplus became">
          Counted only when a rider hands food over inside its safe time.
        </PageHeader>
        <Section><ImpactTiles s={s} donorId={me.entityId} /></Section>
        <Section icon="map" title="Where it went"><Where s={s} mine={mine} /></Section>
      </>}
    </div>
  );
}

function Attention({ s, mine }) {
  const items = [];
  for (const b of mine) {
    const st = batchStatus(s, b);
    const left = b.expiresAt - s.now;
    const r = RULES[b.category];
    if (st.key === 'waiting' && left > 0) items.push(['bad', 'alert', `${b.remaining} ${r.unit} still waiting for a rider`, `${fmt(left)} of safe time left. The dispatcher is retrying every tick; keep the food covered and ready.`]);
    else if (st.key === 'assigned') items.push(['info', 'bike', `${st.riders.join(', ')} on the way to collect ${r.label.toLowerCase()}`, 'Have it packed and at the pickup point.']);
    else if (st.key === 'rerouted') items.push(['warn', 'zap', 'A delivery was rerouted', st.detail]);
  }
  if (!items.length) {
    return mine.length
      ? <Callout tone="ok" icon="check" title="Nothing needs you right now">All your food is moving or delivered.</Callout>
      : <Callout tone="info" icon="gift" title="Have surplus tonight?" action={<PostButton />}>Post it in under a minute; riders are dispatched instantly.</Callout>;
  }
  return items.slice(0, 3).map(([lvl, ic, title, text], i) => <Callout key={i} tone={lvl} icon={ic} title={title}>{text}</Callout>);
}

const ORDER = { waiting: 0, assigned: 1, picked: 2, rerouted: 1, delivered: 3, expired: 4 };

function Donations({ s, mine, limit }) {
  if (!mine.length) {
    return <Empty icon="gift" title="No surplus posted yet" action={<PostButton>Post your first batch</PostButton>}>Post your first batch: pick the food type and the safe time fills in for you.</Empty>;
  }
  const rows = mine.map((b) => ({ b, st: batchStatus(s, b) }))
    .sort((x, y) => ORDER[x.st.key] - ORDER[y.st.key] || y.b.postedAt - x.b.postedAt)
    .slice(0, limit);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(({ b, st }) => {
        const r = RULES[b.category];
        const left = b.expiresAt - s.now;
        const live = !['delivered', 'expired'].includes(st.key);
        return (
          <article key={b.id} className={cn('flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-colors', st.key === 'waiting' && left < batchTotal(b) * 0.25 && CARD_TONE.bad)}>
            {live ? <Ring left={left} total={batchTotal(b)} /> : <StatusDisc level={st.level === 'ok' ? 'ok' : 'bad'} icon={st.level === 'ok' ? 'check' : 'x'} />}
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="font-semibold">{b.qty} {r.unit} · {r.label}</b>
                <Tone level={st.level}>{st.label}</Tone>
              </div>
              <p className="mt-0.5 font-prose text-[13px] text-foreground/80">{st.detail}</p>
              <KV className="mt-1.5" items={[
                ['Tier', TIERS[r.tier].label],
                st.riders.length && ['Rider', st.riders.join(', ')],
                ['Delivered', `${b.delivered ?? 0}/${b.qty}`],
              ]} />
              {b.notes && <p className="mt-1 font-prose text-xs text-muted-foreground">Notes: {b.notes}</p>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ImpactTiles({ s, donorId }) {
  const m = impact(s, donorId);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[[m.meals, 'meals delivered', 'check'], [m.people, 'people fed', 'heart'], [m.kg, 'kg of food waste avoided', 'leaf']].map(([v, l, ic]) => (
        <div key={l} className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-accent/60 to-card p-4">
          <Pattern kind="dots" className="fade-r text-primary/[0.14]" />
          <Icon name={ic} aria-hidden="true" strokeWidth={1.5} className="absolute -right-2 -bottom-3 size-16 text-primary/10" />
          <b className="relative block font-mono text-3xl leading-tight font-bold tracking-tight text-primary tabular">{v}</b>
          <span className="relative text-[12.5px] text-muted-foreground">{l}</span>
        </div>
      ))}
    </div>
  );
}

function Where({ s, mine }) {
  const tally = {};
  for (const b of mine) for (const [id, n] of Object.entries(b.deliveredTo ?? {})) {
    const key = `${id}:${b.category}`;
    tally[key] = (tally[key] || 0) + n;
  }
  const rows = Object.entries(tally);
  if (!rows.length) return <Empty icon="map" title="Nothing delivered yet">Once a rider hands your food over, the receiving site shows up here.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map(([key, n]) => {
        const [id, cat] = key.split(':');
        const sh = s.shelters.find((x) => x.id === id) ?? s.stations.find((x) => x.id === id);
        return (
          <div key={key} className="flex items-center justify-between gap-2 rounded-lg border px-4 py-3">
            <span className="flex items-center gap-2 font-semibold">{sh.name} <Tone level={sh.kind === 'station' ? 'station' : 'accent'}>{sh.kind}</Tone></span>
            <span className="font-mono text-sm tabular">{n} {RULES[cat].unit}</span>
          </div>
        );
      })}
    </div>
  );
}

const STEPS = ['Food type', 'Quantity & pickup', 'Confirm'];

const newItem = (k) => ({ qty: '60', safe: splitTime(RULES[k].safeMin) });
const minutesOf = (item) => Number(item.safe.value) * UNITS[item.safe.unit];

// A donor often has several kinds of surplus at once (meals + bread + milk). Each selected food type
// keeps its own quantity and safe time and becomes its own batch, so each is routed by its own tier.
function PostFlow({ me, ctx }) {
  const first = Object.keys(RULES)[0];
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState([first]);
  const [items, setItems] = useState(() => ({ [first]: newItem(first) }));
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState('');

  const toggle = (k) => {
    if (selected.includes(k)) { setSelected(selected.filter((x) => x !== k)); return; }
    setSelected([...selected, k]);
    if (!items[k]) setItems({ ...items, [k]: newItem(k) });
  };
  const update = (k, patch) => setItems({ ...items, [k]: { ...items[k], ...patch } });

  const submit = (e) => {
    e.preventDefault();
    if (step === 1 && !selected.length) { notify('Pick at least one food type.', 'bad'); return; }
    if (step === 2) {
      for (const k of selected) {
        if (!(Number(items[k].qty) >= 1)) { notify(`Enter how much ${RULES[k].label.toLowerCase()} you have (at least 1).`, 'bad'); document.getElementById(`qty-${k}`)?.focus(); return; }
        if (!(minutesOf(items[k]) >= 1)) { notify(`Enter how long the ${RULES[k].label.toLowerCase()} stays safe.`, 'bad'); document.getElementById(`safe-${k}`)?.focus(); return; }
      }
    }
    if (step < 3) { setStep(step + 1); return; }
    for (const k of selected) {
      ctx.act({ type: 'addBatch', donorId: me.entityId, category: k, qty: Math.round(Number(items[k].qty)), shelfMin: minutesOf(items[k]), notes: notes.trim() || undefined, photo: photo || undefined });
    }
    const summary = selected.map((k) => `${Math.round(Number(items[k].qty))} ${RULES[k].unit} of ${RULES[k].label.toLowerCase()}`).join(', ');
    notify(`Posted ${summary}. Dispatching riders now.`);
    ctx.go('#/donor/donations');
  };

  return (
    <Card className="py-6">
      <CardContent className="px-5 sm:px-6">
        <form onSubmit={submit} noValidate>
          <ol aria-label="Steps" className="mb-6 flex gap-2">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const state = n === step ? 'on' : n < step ? 'done' : '';
              return (
                <li key={label} aria-current={state === 'on' ? 'step' : undefined}
                  className={cn('flex flex-1 items-center gap-2 border-b-[3px] pb-2.5 text-[13px] font-semibold text-muted-foreground transition-colors',
                    state === 'on' && 'border-primary text-primary', state === 'done' && 'border-primary/40 text-foreground/80')}>
                  <b className={cn('grid size-6 place-items-center rounded-full bg-muted font-mono text-[11px]', state && 'bg-primary text-primary-foreground')}>
                    {state === 'done' ? <Check className="size-3.5" /> : n}
                  </b>
                  <span className="max-sm:hidden">{label}</span>
                </li>
              );
            })}
          </ol>

          {step === 1 && (
            <fieldset>
              <legend className="mb-3 font-prose text-sm text-muted-foreground">
                Pick everything you have. <span className="font-sans font-semibold text-foreground">{selected.length} selected</span>
              </legend>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
                {Object.entries(RULES).map(([k, rule]) => (
                  <Label key={k} htmlFor={`cat-${k}`}
                    className={cn('relative flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border p-3.5 font-normal transition-all hover:border-primary/50 hover:bg-accent/40',
                      'has-checked:border-primary has-checked:bg-accent has-checked:ring-2 has-checked:ring-primary/25 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50')}>
                    <input id={`cat-${k}`} type="checkbox" className="peer sr-only" checked={selected.includes(k)} onChange={() => toggle(k)} />
                    <span aria-hidden="true" className="absolute top-3.5 right-3.5 grid size-4 place-items-center rounded-lg border border-input shadow-xs transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground [&>svg]:hidden peer-checked:[&>svg]:block">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <b className="pr-6 text-sm font-semibold">{rule.label}</b>
                    <Tone level={TIER_TONE[rule.tier]}>{TIERS[rule.tier].label}</Tone>
                    <span className="text-xs text-muted-foreground">Safe for ~{fmt(rule.safeMin)}{rule.requires.length ? ` · needs ${rule.requires.join(' + ')}` : ''}</span>
                  </Label>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="flex flex-col gap-5">
              <legend className="sr-only">Quantity and pickup</legend>
              <div className="flex flex-col gap-3">
                {selected.map((k, i) => {
                  const rule = RULES[k];
                  const item = items[k];
                  return (
                    <div key={k} className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                        <b className="text-sm font-semibold">{rule.label}</b>
                        <Tone level={TIER_TONE[rule.tier]}>{TIERS[rule.tier].label}</Tone>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`qty-${k}`}>Quantity <span className="font-normal text-muted-foreground">in {rule.unit}</span></Label>
                        <Input id={`qty-${k}`} type="number" min="1" step="1" inputMode="numeric" value={item.qty} onChange={(e) => update(k, { qty: e.target.value })} autoFocus={i === 0} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`safe-${k}`}>Safe time left <span className="font-normal text-muted-foreground">pre-filled from the food type</span></Label>
                        <div className="flex gap-2">
                          <Input id={`safe-${k}`} type="number" min="1" step="any" value={item.safe.value} onChange={(e) => update(k, { safe: { ...item.safe, value: e.target.value } })} />
                          <Select value={item.safe.unit} onValueChange={(unit) => update(k, { safe: { ...item.safe, unit } })}>
                            <SelectTrigger aria-label={`${rule.label} safe time unit`} className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="min">minutes</SelectItem><SelectItem value="h">hours</SelectItem><SelectItem value="d">days</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className={cn('flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary',
                photo && 'border-solid border-ok/60 bg-ok/5 text-ok')}>
                {photo ? <Check className="size-5" /> : <Camera className="size-5" />}
                <span className="font-prose">{photo ? `Photo attached: ${photo}` : 'Add a photo (optional). It helps riders find the right boxes.'}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const n = e.target.files?.[0]?.name ?? ''; setPhoto(n); if (n) notify('Photo attached'); }} />
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Pickup notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Back gate, ask for Ravi. Food is in 6 steel containers." />
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend className="sr-only">Confirm</legend>
              <ul className="flex flex-col divide-y rounded-lg border bg-muted/30 text-sm">
                {selected.map((k) => {
                  const rule = RULES[k];
                  const mins = minutesOf(items[k]);
                  return (
                    <li key={k} className="flex flex-col gap-1 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">{Math.round(Number(items[k].qty))} {rule.unit} · {rule.label} <Tone level={TIER_TONE[rule.tier]}>{TIERS[rule.tier].label}</Tone></span>
                        <span className="font-mono font-semibold tabular">safe for {fmt(mins)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {ROUTING[rule.tier]}{mins < 20 ? ' With this little safe time, riders may not reach anyone safely; if so it is flagged and never sent out.' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-lg border bg-muted/30 p-4 text-sm">
                <dt className="text-muted-foreground">Pickup</dt><dd className="font-semibold">{me.name}</dd>
                {notes.trim() && <><dt className="text-muted-foreground">Notes</dt><dd className="font-semibold">{notes.trim()}</dd></>}
                <dt className="text-muted-foreground">Photo</dt><dd className="font-semibold">{photo || 'None'}</dd>
              </dl>
              <Callout className="mt-4" tone="info" icon="shield" title="How it will be routed">
                Each food type is posted as its own batch, so riders, sites and safe-time checks are handled separately for each.
              </Callout>
            </fieldset>
          )}

          <div className="mt-6 flex justify-between gap-2 border-t pt-5">
            <Button type="button" variant="ghost" className={cn(step === 1 && 'invisible')} onClick={() => setStep(Math.max(1, step - 1))}><ArrowLeft /> Back</Button>
            <Button type="submit" size="lg" disabled={!selected.length}>{step === 3 ? <>Post {selected.length > 1 ? `${selected.length} batches` : ''} and dispatch riders <Send /></> : <>Continue <ArrowRight /></>}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
