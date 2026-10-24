import { useEffect, useState } from 'react';
import { ArrowRight, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeroPreview, HowItWorks, Pattern, RoleScene } from '@/components/app/art';
import { Icon } from '@/lib/icons';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { ROLES, ACCOUNTS } from '@/auth.js';

const CARD = {
  donor:       { icon: 'gift', who: 'Restaurants, banquet halls, hostel messes and pharmacies with surplus to give.', accent: 'bg-donor', disc: 'bg-donor/12 text-donor', btn: 'bg-donor hover:bg-donor/90' },
  shelter:     { icon: 'home', who: 'Night shelters, relief camps and anyone receiving food or aid.', accent: 'bg-shelter', disc: 'bg-shelter/12 text-shelter', btn: 'bg-shelter hover:bg-shelter/90' },
  coordinator: { icon: 'map',  who: 'The control room that dispatches riders and fixes failures live.', accent: 'bg-info', disc: 'bg-info/12 text-info', btn: 'bg-info hover:bg-info/90' },
};
const STATS = [['zap', 'Live dispatch', 'Riders split batches by capacity'], ['bike', 'Ghost riders', 'Silent claims auto-release'], ['shield', 'Safety stop', 'No food past its safe time']];

function RoleCard({ role, ctx }) {
  const accounts = ACCOUNTS.filter((a) => a.role === role);
  const [email, setEmail] = useState(accounts[0].email);
  const [password, setPassword] = useState('demo');
  const c = CARD[role];
  const r = ROLES[role];
  const submit = (e) => {
    e.preventDefault();
    if (!ctx.signIn(email, password)) notify('That email and password don’t match a demo account. The password is “demo”.', 'bad');
  };
  return (
    <form onSubmit={submit} noValidate className="group">
      <Card className="relative h-full gap-5 overflow-hidden pt-0 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-focus-within:shadow-xl">
        <RoleScene role={role} className="border-b" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className={cn('grid size-7 place-items-center rounded-md', c.disc)}><Icon name={c.icon} className="size-4" /></span>{r.label}
          </CardTitle>
          <CardDescription className="min-h-10">{c.who}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`email-${role}`}>Email</Label>
            {accounts.length > 1 ? (
              <Select value={email} onValueChange={setEmail}>
                <SelectTrigger id={`email-${role}`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.email} value={a.email}>
                      <span className="font-medium">{a.name}</span><span className="text-muted-foreground">{a.email}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id={`email-${role}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`pw-${role}`}>Password</Label>
            <Input id={`pw-${role}`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
        </CardContent>
        <CardFooter className="mt-auto">
          <Button type="submit" className={cn('w-full text-white dark:text-neutral-950', c.btn)}>Sign in as {r.label.split(' ')[0]} <ArrowRight /></Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default function LoginView({ me, page, ctx }) {
  // #/login (the top bar's "Sign in") lands on the role cards; the App scrolls to the top first, so wait a frame.
  useEffect(() => {
    if (page !== 'login') return;
    const id = requestAnimationFrame(() => document.getElementById('roles')?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(id);
  }, [page]);
  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_10%_-10%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent),radial-gradient(40rem_24rem_at_100%_0%,color-mix(in_oklab,var(--donor)_10%,transparent),transparent)]" />
      <Pattern kind="topo" className="-z-10 h-[760px] fade-b text-primary/[0.09]" />
      <Pattern kind="dots" className="-z-10 h-[520px] fade-b text-foreground/[0.07]" />
      <section className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Badge variant="outline" className="gap-1.5 rounded-full border-primary/25 bg-card/70 px-3 py-1 text-primary shadow-xs backdrop-blur">
            <Icon name="zap" className="size-3.5" /> Live demo · no sign-up
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-[52px] sm:leading-[1.05]">
            Surplus food reaches people{' '}
            <span className="font-serif text-[1.12em] font-normal tracking-normal text-primary italic">before</span> it spoils.
          </h1>
          <p className="max-w-2xl font-prose text-[17px] leading-relaxed text-muted-foreground sm:text-[19px]">
            NEXUS links food donors, volunteer riders and receiving sites in real time. It catches ghost riders and ghost stations,
            splits food fairly, and never hands over food past its safe time.
          </p>
          <div className="flex flex-wrap gap-2">
            {STATS.map(([ic, t, x]) => (
              <span key={t} className="flex items-center gap-2 rounded-full border bg-card/70 py-1.5 pr-3.5 pl-1.5 text-[13px] shadow-xs backdrop-blur">
                <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary"><Icon name={ic} className="size-3.5" /></span>
                <b className="font-semibold">{t}</b><span className="font-prose text-muted-foreground max-sm:hidden">{x}</span>
              </span>
            ))}
          </div>
          {me ? (
            <Button asChild size="lg" className="self-start"><a href={ROLES[me.role].home}>Continue to your dashboard as {me.name} <ArrowRight /></a></Button>
          ) : (
            <Button asChild size="lg" className="self-start"><a href="#/login">Choose your role <ArrowRight /></a></Button>
          )}
          <p className="flex items-start gap-2 rounded-lg border border-dashed bg-card/60 px-3.5 py-2.5 font-prose text-[13.5px] text-muted-foreground">
            <Icon name="users" className="mt-0.5 size-4 shrink-0" />
            <span>Tip for judges: sign in as a donor in one window and the coordinator in another, then post food and watch it appear live.</span>
          </p>
        </div>
        <div className="max-lg:hidden"><HeroPreview /></div>
        </div>
        <section aria-labelledby="how-h" className="grain relative overflow-hidden rounded-2xl border bg-card/70 px-6 py-8 shadow-xs backdrop-blur sm:px-10">
          <Pattern kind="diagonal" className="fade-r text-foreground/[0.035]" />
          <h2 id="how-h" className="relative mb-7 text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">How it works</h2>
          <div className="relative"><HowItWorks /></div>
        </section>
        <div id="roles" className="scroll-mt-20">
          <h2 className="mb-1 text-2xl font-bold tracking-tight">Choose your <span className="font-serif text-[1.15em] font-normal text-primary italic">role</span></h2>
          <p className="mb-5 font-prose text-[15px] text-muted-foreground">Demo accounts are pre-filled. Every password is “demo”.</p>
        <div className="grid gap-5 md:grid-cols-3">
          {Object.keys(ROLES).map((role) => <RoleCard key={role} role={role} ctx={ctx} />)}
        </div>
        </div>
        <a href="#/stations" className="inline-flex items-center gap-2 self-start rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline">
          <Store className="size-4" /> Need food now? Find a food station near you. No login needed. <ArrowRight className="size-4" />
        </a>
      </section>
    </div>
  );
}
