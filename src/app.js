// Hash router + app shell (top bar, sidebar / bottom tabs, toasts). Views live in src/views/.
import { initStore, getState, subscribe, act, setLeadership, leaderAlive, isLeader } from './store.js';
import { ROLES, ACCOUNTS, loadSession, login, logout, session } from './auth.js';
import { $, esc, icon, clock, setHTML, toast } from './ui/kit.js';
import * as loginView from './views/login.js';
import * as donorView from './views/donor.js';
import * as shelterView from './views/shelter.js';
import * as coordView from './views/coordinator.js';
import * as stationsView from './views/stations.js';

const PAGES = {
  login:       { view: loginView,    role: null,          bare: true },
  stations:    { view: stationsView, role: null,          public: true },
  donor:       { view: donorView,    role: 'donor' },
  shelter:     { view: shelterView,  role: 'shelter' },
  coordinator: { view: coordView,    role: 'coordinator' },
};

let mounted = null; // { page, section, view, instance }

function parse() {
  const [page = '', section = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { page, section };
}

function go(hash) { if (location.hash !== hash) location.hash = hash; else route(); }

function route() {
  const { page, section } = parse();
  const me = session();
  const def = PAGES[page];
  if (!def) return go(me ? ROLES[me.role].home : '#/login');
  if (def.role && !me) return go('#/login');
  if (def.role && me.role !== def.role) {
    toast(`${ROLES[def.role].label} pages need a ${ROLES[def.role].label.toLowerCase()} account. Taking you to your dashboard.`, 'warn');
    return go(ROLES[me.role].home);
  }
  setLeadership(page === 'coordinator');
  const nav = def.view.nav ?? [];
  const sec = nav.some((n) => n.id === section) ? section : nav[0]?.id ?? '';
  if (!mounted || mounted.page !== page || mounted.section !== sec || mounted.email !== me?.email) mount(page, sec, def);
  renderChrome();
}

function mount(page, section, def) {
  mounted?.instance?.destroy?.();
  const root = $('#view');
  root.innerHTML = '';
  document.body.classList.toggle('bare', !!def.bare);
  document.body.classList.toggle('public', !!def.public && !session());
  const ctx = { session: session(), section, act: send, go, signIn, state: getState };
  mounted = { page, section, email: session()?.email, view: def.view, instance: def.view.mount(root, ctx) };
  mounted.instance?.update?.(getState());
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Send an action to whichever tab owns the clock, with a toast so every action gets feedback.
function send(action, message, level = 'ok') {
  act(action);
  if (message) toast(message, level);
}

function renderChrome() {
  const me = session();
  const def = PAGES[parse().page];
  const nav = def?.view.nav ?? [];
  const base = `#/${mounted?.page}`;
  const navItems = nav.map((n) => `
    <a href="${base}${n.id === nav[0].id ? '' : `/${n.id}`}" class="nav-item ${mounted?.section === n.id ? 'active' : ''}" ${mounted?.section === n.id ? 'aria-current="page"' : ''}>
      ${icon(n.icon)}<span>${esc(n.label)}</span>
    </a>`).join('');
  setHTML($('#sidebar'), nav.length ? `<div class="nav-list">${navItems}</div>` : '');
  document.body.classList.toggle('no-nav', !nav.length);

  const who = me
    ? `<div class="who">
        <span class="avatar" aria-hidden="true">${esc(me.name[0])}</span>
        <span class="who-text"><b>${esc(me.name)}</b><span class="role-chip ${me.role}">${esc(ROLES[me.role].label)}</span></span>
      </div>
      <label class="switcher"><span class="sr-only">Switch demo account</span>
        <select id="switch-account" data-key="switch">
          <option value="">Switch demo account…</option>
          ${Object.entries(ROLES).map(([role, r]) => `<optgroup label="${esc(r.label)}">${ACCOUNTS.filter((a) => a.role === role).map((a) => `<option value="${a.email}" ${a.email === me.email ? 'disabled' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`).join('')}
        </select>
      </label>
      <button class="btn ghost icon-btn" data-global="logout" title="Log out">${icon('logout')}<span class="hide-sm">Logout</span></button>`
    : `<a class="btn ghost" href="#/stations">${icon('store')}<span class="hide-sm">Find food</span></a><a class="btn primary" href="#/login">Sign in</a>`;
  setHTML($('#account'), who);
  renderClock();
}

function renderClock() {
  const s = getState();
  if (!s) return;
  const live = isLeader() || leaderAlive();
  const status = !live ? 'offline' : s.sim.running ? 'live' : 'paused';
  const label = { live: 'Live', paused: 'Paused', offline: 'Clock offline' }[status];
  const title = status === 'offline' ? 'The simulation clock runs in the coordinator tab. Open it to move riders.' : '';
  setHTML($('#sim-status'), `<span class="pill ${status}" title="${title}"><i></i>${label}</span><span class="mono">${clock(s.now)}</span>`);
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  $('#theme').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#theme').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

// ---------- Delegated events ----------
// Live panels re-render several times a second, so mouse/touch actions fire on pointerdown (a click can be
// lost if the button is replaced between press and release). Keyboard activation arrives as click with detail 0.
function handleAct(e) {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (e.type === 'pointerdown' && (e.button !== 0 || el.matches('a, input, select, label'))) return;
  if (e.type === 'click' && e.detail !== 0 && !el.matches('a, input, select, label')) return;
  if (e.type === 'pointerdown') e.preventDefault();
  mounted?.instance?.onAct?.(el.dataset.act, el.dataset, el);
}
document.addEventListener('pointerdown', handleAct);
document.addEventListener('click', handleAct);

document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-global]');
  if (!g) return;
  if (g.dataset.global === 'logout') { logout(); toast('Signed out'); go('#/login'); }
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'switch-account' || !e.target.value) return;
  const me = login(e.target.value, 'demo');
  toast(`Signed in as ${me.name} (${ROLES[me.role].label})`);
  go(ROLES[me.role].home);
});

export function signIn(email, password) {
  const me = login(email, password);
  if (!me) return false;
  toast(`Welcome, ${me.name}`);
  go(ROLES[me.role].home);
  return true;
}

// ---------- Boot ----------
initStore();
loadSession();
let theme = null;
try { theme = localStorage.getItem('rf:theme'); } catch { /* ignore */ }
applyTheme(theme);
$('#theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('rf:theme', theme); } catch { /* ignore */ }
  applyTheme(theme);
});

// Coalesce updates to one render per frame. Background tabs get no animation frames, so use a timer there.
let frame = 0;
subscribe(() => {
  if (frame) return;
  const draw = () => { frame = 0; mounted?.instance?.update?.(getState()); renderClock(); };
  frame = document.hidden ? setTimeout(draw, 50) : requestAnimationFrame(draw);
});
setInterval(renderClock, 1000);
window.addEventListener('hashchange', route);
route();
