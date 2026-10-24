// Hash router, role guards and the app shell. Views live in src/views/.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Topbar, SideNav, BottomNav } from '@/components/app/shell';
import { Pattern } from '@/components/app/art';
import { useSim } from '@/hooks/use-sim';
import { useRoute, go } from '@/hooks/use-route';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { act, setLeadership } from '@/store.js';
import { ROLES, login, logout, session } from '@/auth.js';
import { alerts } from '@/ui/alerts.js';
import * as Login from '@/views/Login';
import * as Donor from '@/views/Donor';
import * as Shelter from '@/views/Shelter';
import * as Coordinator from '@/views/Coordinator';
import * as Stations from '@/views/Stations';

const PAGES = {
  login:       { view: Login,       role: null, bare: true },
  stations:    { view: Stations,    role: null },
  donor:       { view: Donor,       role: 'donor' },
  shelter:     { view: Shelter,     role: 'shelter' },
  coordinator: { view: Coordinator, role: 'coordinator' },
};

// Send an action to whichever tab owns the clock, with a toast so every action gets feedback.
function send(action, message, level = 'ok') {
  act(action);
  if (message) notify(message, level);
}

export default function App() {
  const { page, section } = useRoute();
  const [me, setMe] = useState(session);
  const s = useSim();
  const { dark, toggle } = useTheme();
  const main = useRef(null);
  const def = PAGES[page];

  let redirect = null;
  if (!def) redirect = me ? ROLES[me.role].home : '#/login';
  else if (def.role && !me) redirect = '#/login';
  else if (def.role && me.role !== def.role) redirect = ROLES[me.role].home;

  useEffect(() => {
    if (!redirect) return;
    if (def?.role && me && me.role !== def.role) {
      notify(`${ROLES[def.role].label} pages need a ${ROLES[def.role].label.toLowerCase()} account. Taking you to your dashboard.`, 'warn');
    }
    go(redirect);
  }, [redirect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every open tab offers to run the clock; the first one holds it and the rest follow its broadcasts.
  useEffect(() => { setLeadership(true); }, []);

  const nav = def?.view.nav ?? [];
  const sec = nav.some((n) => n.id === section) ? section : nav[0]?.id ?? '';

  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [page, sec]);

  const ctx = useMemo(() => ({
    act: send,
    go,
    signIn(email, password) {
      const who = login(email, password);
      if (!who) return false;
      setMe(who);
      notify(`Welcome, ${who.name}`);
      go(ROLES[who.role].home);
      return true;
    },
  }), []);
  const switchTo = (email) => {
    const who = login(email, 'demo');
    setMe(who);
    notify(`Signed in as ${who.name} (${ROLES[who.role].label})`);
    go(ROLES[who.role].home);
  };
  const signOut = () => { logout(); setMe(null); notify('Signed out'); go('#/login'); };

  // Red-alert count on the coordinator's Live Ops tab.
  const badges = page === 'coordinator' && s ? { ops: alerts(s).filter((a) => a.level === 'bad').length } : {};
  const View = def?.view.default;

  return (
    <div className="min-h-svh">
      <a href="#view" className="absolute -left-[999px] top-2 z-50 rounded-md bg-card px-3 py-2 shadow focus:left-2">Skip to content</a>
      <Topbar s={s} me={me} bare={def?.bare} dark={dark} onTheme={toggle} onSwitch={switchTo} onLogout={signOut} />
      {!def?.bare && (
        // Faint dot field and brand glow behind every dashboard, fading out down the page.
        <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-16 -z-10 h-[480px]">
          <Pattern kind="dots" className="fade-b text-foreground/[0.07]" />
          <div className="absolute inset-0 bg-[radial-gradient(50rem_20rem_at_70%_0%,color-mix(in_oklab,var(--primary)_9%,transparent),transparent)]" />
        </div>
      )}
      {!redirect && nav.length > 0 && <SideNav page={page} nav={nav} section={sec} badges={badges} me={me} />}
      <main id="view" ref={main} tabIndex={-1}
        className={cn('outline-none', nav.length > 0 && 'lg:pl-60 max-lg:pb-20')}>
        {!redirect && View && s && (
          <View key={`${page}/${me?.email ?? ''}`} s={s} me={me} section={sec} ctx={ctx} />
        )}
      </main>
      {!redirect && nav.length > 0 && <BottomNav page={page} nav={nav} section={sec} badges={badges} />}
      <Toaster position="bottom-right" dark={dark} offset={nav.length ? { bottom: 16 } : undefined} mobileOffset={nav.length ? { bottom: 84 } : undefined} />
    </div>
  );
}
