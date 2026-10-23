// App chrome: top bar (brand, live clock, account switcher, theme), sidebar on desktop, bottom tabs on mobile.
import { ChevronsUpDown, LogOut, Moon, Store, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pattern } from '@/components/app/art';
import { Icon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { useInterval } from '@/hooks/use-sim';
import { ROLES, ACCOUNTS } from '@/auth.js';
import { isLeader, leaderAlive } from '@/store.js';
import { clock } from '@/ui/kit.js';

const ROLE_TEXT = { donor: 'text-donor', shelter: 'text-shelter', coordinator: 'text-info' };
const ROLE_BG = { donor: 'bg-donor/12 text-donor', shelter: 'bg-shelter/12 text-shelter', coordinator: 'bg-info/12 text-info' };

export function Logo({ className }) {
  return (
    <span aria-hidden="true" className={cn('size-8 shrink-0 rounded-full shadow-sm ring-2 ring-background', className)}
      style={{ background: 'conic-gradient(from 180deg, #34d399 0 50%, #0f766e 50% 100%)' }} />
  );
}

function SimStatus({ s }) {
  useInterval(1000); // leader heartbeat is wall-clock based
  const live = isLeader() || leaderAlive();
  const status = !live ? 'offline' : s.sim.running ? 'live' : 'paused';
  const label = { live: 'Live', paused: 'Paused', offline: 'Clock offline' }[status];
  const tone = { live: 'border-ok/30 bg-ok/10 text-ok', paused: 'border-warn/30 bg-warn/10 text-warn', offline: 'text-muted-foreground' }[status];
  return (
    <div className="flex items-center gap-2" title={status === 'offline' ? 'The simulation clock runs in the coordinator tab. Open it to move riders.' : ''}>
      <Badge variant="outline" className={cn('gap-1.5 rounded-full px-2.5', tone)}>
        <i className={cn('size-2 rounded-full bg-current', status === 'live' && 'animate-pulse-dot')} />
        <span className="max-sm:sr-only">{label}</span>
      </Badge>
      <span className="font-mono text-[13px] font-bold text-foreground/80 tabular">{clock(s.now)}</span>
    </div>
  );
}

function Account({ me, onSwitch, onLogout }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2.5 px-2" aria-label="Account and demo account switcher">
          <span className={cn('grid size-8 place-items-center rounded-full text-sm font-bold', ROLE_BG[me.role])}>{me.name[0]}</span>
          <span className="hidden flex-col items-start leading-tight md:flex">
            <b className="text-[13px] font-semibold">{me.name}</b>
            <span className={cn('text-[10.5px] font-bold uppercase tracking-wider', ROLE_TEXT[me.role])}>{ROLES[me.role].label}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Switch demo account</DropdownMenuLabel>
        {Object.entries(ROLES).map(([role, r]) => (
          <DropdownMenuGroup key={role}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={cn('text-[10.5px] font-bold uppercase tracking-wider', ROLE_TEXT[role])}>{r.label}</DropdownMenuLabel>
            {ACCOUNTS.filter((a) => a.role === role).map((a) => (
              <DropdownMenuItem key={a.email} disabled={a.email === me.email} onSelect={() => onSwitch(a.email)}>
                <span className={cn('grid size-6 place-items-center rounded-full text-[11px] font-bold', ROLE_BG[role])}>{a.name[0]}</span>
                <span className="flex-1">{a.name}</span>
                {a.email === me.email && <span className="text-xs text-muted-foreground">current</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onLogout}><LogOut /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ s, me, bare, dark, onTheme, onSwitch, onLogout }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-lg sm:gap-4 sm:px-6">
      <a href="#/" className="flex items-center gap-2.5 rounded-md" aria-label="NEXUS home">
        <Logo />
        <span className="flex flex-col leading-tight max-[400px]:hidden">
          <b className="text-base font-bold tracking-tight">NEXUS</b>
          <small className="font-prose text-[11.5px] text-muted-foreground italic max-sm:hidden">Every Meal. Every Route. Every Life Matters.</small>
        </span>
      </a>
      {!bare && s && <div className="sm:ml-2"><SimStatus s={s} /></div>}
      <div className="ml-auto flex items-center gap-1.5">
        {me ? (
          <Account me={me} onSwitch={onSwitch} onLogout={onLogout} />
        ) : (
          <>
            <Button variant="ghost" asChild><a href="#/stations"><Store /><span className="max-sm:hidden">Find food</span></a></Button>
            <Button asChild><a href="#/login">Sign in</a></Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={onTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {dark ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  );
}

const href = (page, nav, id) => `#/${page}${id === nav[0].id ? '' : `/${id}`}`;

export function SideNav({ page, nav, section, badges = {}, me }) {
  return (
    <nav aria-label="Main" className="fixed inset-y-0 top-16 left-0 z-20 hidden w-60 flex-col border-r bg-card/60 px-3 py-4 lg:flex">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ROLES[me?.role]?.label ?? 'Menu'}</p>
      <div className="flex flex-col gap-0.5">
        {nav.map((n) => {
          const active = n.id === section;
          return (
            <a key={n.id} href={href(page, nav, n.id)} aria-current={active ? 'page' : undefined}
              className={cn('group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                active && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground')}>
              {active && <span className="absolute inset-y-2 -left-3 w-[3px] rounded-r bg-primary" />}
              <Icon name={n.icon} className="size-[18px]" />
              <span className="flex-1">{n.label}</span>
              {badges[n.id] > 0 && <Badge className="h-5 min-w-5 rounded-full bg-bad px-1.5 font-mono text-[11px] text-white">{badges[n.id]}</Badge>}
            </a>
          );
        })}
      </div>
      <a href="#/stations" className="group grain relative mt-auto overflow-hidden rounded-xl border bg-gradient-to-br from-station/10 to-card p-3.5 font-prose text-xs text-muted-foreground transition-all hover:border-station/40 hover:shadow-md">
        <Pattern kind="topo" className="text-station/[0.14]" />
        <span className="relative mb-2.5 grid size-9 place-items-center rounded-xl bg-card text-station shadow-sm ring-1 ring-border transition-transform group-hover:-rotate-6"><Store className="size-[18px]" /></span>
        <span className="relative block"><b className="block font-sans text-[13px] font-semibold text-foreground">Public food stations</b>Anyone in need can find food here, no login.</span>
      </a>
    </nav>
  );
}

export function BottomNav({ page, nav, section, badges = {} }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-background/90 px-1.5 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden">
      {nav.map((n) => {
        const active = n.id === section;
        return (
          <a key={n.id} href={href(page, nav, n.id)} aria-current={active ? 'page' : undefined}
            className={cn('relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 text-[10.5px] font-medium text-muted-foreground',
              active && 'text-primary')}>
            {active && <span className="absolute -top-1 inset-x-1/4 h-[3px] rounded-b bg-primary" />}
            <Icon name={n.icon} className="size-5" />
            <span className="max-w-full truncate">{n.label}</span>
            {badges[n.id] > 0 && <span className="absolute top-0.5 right-[18%] grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 font-mono text-[9.5px] font-bold text-white">{badges[n.id]}</span>}
          </a>
        );
      })}
    </nav>
  );
}
