// Public "Find food near you" page: no login, for individuals in need. StationCards is reused in the shelter dashboard.
import { useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Empty, PageHeader, Tone } from '@/components/app/bits';
import { Pattern, RoleScene } from '@/components/app/art';
import { CARD_TONE } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { RULES } from '@/engine.js';
import { stationsNear } from '@/ui/derive.js';

// Rough walking time on the city grid (5 km/h).
const walk = (km) => `${Math.max(1, Math.round((km / 5) * 60))} min walk`;

export function StationCards({ s, from, compact = false }) {
  const list = stationsNear(s, from);
  if (!list.length) return <Empty icon="store" title="No food stations listed yet">Call the city helpline below and someone will direct you.</Empty>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.map(({ st, km }, i) => {
        const stock = Object.entries(st.stock).filter(([, n]) => n > 0);
        const tel = st.helpline.replace(/[^+\d]/g, '');
        return (
          <Card key={st.id} aria-label={st.name} className={cn('gap-3 py-5', !st.open && CARD_TONE.bad)}>
            <CardContent className="flex h-full flex-col gap-3 px-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="font-semibold">{st.name}</b>
                    {i === 0 && from && st.open && <Tone level="accent">Nearest</Tone>}
                  </div>
                  <p className="text-[12.5px] text-muted-foreground">{st.hours ?? ''}{km != null && ` · ${km.toFixed(1)} km · ${walk(km)}`}</p>
                </div>
                <Tone level={st.open ? 'ok' : 'bad'}>{st.open ? 'Open now' : 'Closed'}</Tone>
              </div>
              {stock.length ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1.5">
                  {stock.map(([cat, n]) => (
                    <div key={cat} className="rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                      <b className={cn('block font-mono text-base font-bold text-foreground tabular', n < 5 && 'text-warn')}>{Math.floor(n)}</b>
                      {RULES[cat].unit} · {RULES[cat].label.toLowerCase()}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-prose text-[12.5px] text-muted-foreground">Shelves are empty right now. New stock is on the way. Call to check before you travel.</p>
              )}
              {!compact && <p className="font-prose text-[12.5px] text-muted-foreground">Free for anyone. No ID or registration needed.</p>}
              <Button asChild variant={st.open ? 'default' : 'outline'} className="mt-auto">
                <a href={`tel:${tel}`}><Phone /> Call {st.helpline}</a>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function StationsView({ s, me }) {
  const [near, setNear] = useState('');
  const [kind, id] = near.split(':');
  const from = !kind ? null : (kind === 'd' ? s.donors : [...s.shelters, ...s.stations]).find((x) => x.id === id) ?? null;
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Card className="grain relative overflow-hidden border-primary/20 bg-gradient-to-br from-accent via-card to-card py-7">
        <div aria-hidden="true" className="absolute -top-24 -right-24 size-72 rounded-full bg-station/10 blur-3xl" />
        <Pattern kind="topo" className="fade-r text-station/[0.13]" />
        <div className="absolute inset-y-0 right-0 hidden w-[38%] items-center justify-center md:flex">
          <RoleScene role="station" className="h-44 w-full max-w-sm rounded-2xl border bg-card shadow-lg" />
        </div>
        <CardContent className="relative space-y-5 px-6 md:pr-[42%]">
          <PageHeader plain eyebrow="Public food stations" icon="store" title="Find food near you">
            Free food, no questions asked. Stock updates live as riders drop off donations. Tap a number to call the station before you go.
          </PageHeader>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="near" className="flex items-center gap-1.5"><MapPin className="size-3.5" /> I am near</Label>
            <Select value={near} onValueChange={setNear}>
              <SelectTrigger id="near" className="w-full bg-card"><SelectValue placeholder="Choose a landmark…" /></SelectTrigger>
              <SelectContent>
                <SelectGroup><SelectLabel>Shelters &amp; camps</SelectLabel>{s.shelters.map((x) => <SelectItem key={x.id} value={`s:${x.id}`}>{x.name}</SelectItem>)}</SelectGroup>
                <SelectGroup><SelectLabel>Landmarks</SelectLabel>{s.donors.map((x) => <SelectItem key={x.id} value={`d:${x.id}`}>{x.name}</SelectItem>)}</SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <section aria-labelledby="st-h"><h2 id="st-h" className="sr-only">Stations</h2><StationCards s={s} from={from} /></section>
      <Card className="py-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 px-6">
          <div>
            <h2 className="text-base font-semibold">City food helpline</h2>
            <p className="font-prose text-sm text-muted-foreground">24 hours. We will tell you where food is available tonight. (Demo numbers throughout: they do not connect to a real line.)</p>
          </div>
          <Button asChild size="lg"><a href="tel:+910000011000"><Phone /> Call +91 00000 11000</a></Button>
        </CardContent>
      </Card>
      {!me && <p className="font-prose text-sm text-muted-foreground">Run a shelter or have food to give? <a className="font-medium text-primary underline-offset-4 hover:underline" href="#/login">Sign in</a>.</p>}
    </div>
  );
}
