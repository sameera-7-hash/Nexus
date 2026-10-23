// Demo auth: no backend, fixed accounts. The session is kept per tab (sessionStorage) so a donor tab
// and a coordinator tab can sit side by side; localStorage remembers the last sign-in for new tabs.
const SESSION_KEY = 'nexus:session';

export const ROLES = {
  donor:       { label: 'Donor',            home: '#/donor',       blurb: 'Banquet halls, hostel messes, pharmacies with surplus to give.' },
  shelter:     { label: 'Shelter / Needy',  home: '#/shelter',     blurb: 'Night shelters and relief camps receiving food and aid.' },
  coordinator: { label: 'Coordinator',      home: '#/coordinator', blurb: 'The control room that dispatches riders and handles failures.' },
};

export const ACCOUNTS = [
  { email: 'banquet@nexus.demo',  role: 'donor',       name: 'Banquet Hall',    entityId: 'D1' },
  { email: 'hostel@nexus.demo',   role: 'donor',       name: 'Hostel Mess',     entityId: 'D2' },
  { email: 'pharmacy@nexus.demo', role: 'donor',       name: 'City Pharmacy',   entityId: 'D3' },
  { email: 'sheltera@nexus.demo', role: 'shelter',     name: 'Shelter A',       entityId: 'S1' },
  { email: 'campb@nexus.demo',    role: 'shelter',     name: 'Relief Camp B',   entityId: 'S2' },
  { email: 'womenc@nexus.demo',   role: 'shelter',     name: 'Women & Child C', entityId: 'S3' },
  { email: 'admin@nexus.demo',    role: 'coordinator', name: 'Control Room',    entityId: null },
].map((a) => ({ ...a, password: 'demo' }));

function read(store) {
  try { return JSON.parse(store.getItem(SESSION_KEY)); } catch { return null; }
}
function write(store, value) {
  try { value ? store.setItem(SESSION_KEY, JSON.stringify(value)) : store.removeItem(SESSION_KEY); } catch { /* blocked storage: session lasts until reload */ }
}

let current = null;

export function loadSession() {
  const saved = read(sessionStorage) ?? read(localStorage);
  current = saved && ACCOUNTS.find((a) => a.email === saved.email) ? saved : null;
  return current;
}

export function login(email, password) {
  const acc = ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
  if (!acc || acc.password !== password) return null;
  current = { email: acc.email, role: acc.role, name: acc.name, entityId: acc.entityId };
  write(sessionStorage, current);
  write(localStorage, current);
  return current;
}

export function logout() {
  current = null;
  write(sessionStorage, null);
  write(localStorage, null);
}

export const session = () => current;
