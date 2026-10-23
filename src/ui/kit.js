// Small shared UI helpers: escaping, formatting, icons, safety colours, rings, toasts.
export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const byId = (list, id) => list.find((x) => x.id === id);

// mm:ss for short spans, "5h 20m" / "3d 4h" for long ones.
export function fmt(min) {
  const m = Math.max(0, min);
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 120) return `${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`;
  return `${String(Math.floor(m)).padStart(2, '0')}:${String(Math.floor((m % 1) * 60)).padStart(2, '0')}`;
}
export const clock = (min) => `T+${fmt(min)}`;
export const ago = (min) => (min < 1 ? 'just now' : min < 120 ? `${Math.round(min)} min ago` : `${Math.round(min / 60)} h ago`);

// Food-safety colour language, used everywhere: green safe, amber < 50 % of safe time left, red < 25 % or expired.
export function safety(left, total) {
  const pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return { pct, level: left <= 0 || pct < 0.25 ? 'bad' : pct < 0.5 ? 'warn' : 'ok' };
}

export function ring(left, total, size = 56) {
  const { pct, level } = safety(left, total);
  const r = 22;
  const c = 2 * Math.PI * r;
  return `<span class="ring ${level}" style="--size:${size}px" role="img" aria-label="${left > 0 ? `${fmt(left)} of safe time left` : 'Expired'}">
    <svg viewBox="0 0 52 52"><circle class="ring-track" cx="26" cy="26" r="${r}"/><circle class="ring-val" cx="26" cy="26" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(2)}"/></svg>
    <b>${left > 0 ? fmt(left) : 'EXP'}</b></span>`;
}

const PATHS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  map: '<path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11z"/><path d="M5 13v7h14v-7"/>',
  bike: '<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17l4-8h6l3 8M9.5 9L12 17h3"/>',
  log: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  heart: '<path d="M12 20s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.5-8 11-8 11z"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l7-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-3-2 2-3 4-3 7a6 6 0 0 0 6 6z"/>',
  snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>',
  gift: '<path d="M4 11h16v10H4zM2 7h20v4H2zM12 7v14"/><path d="M12 7C10 3 6 4 7.5 6.5 8.5 7 12 7 12 7zM12 7c2-4 6-3 4.5-.5-1 .5-4.5.5-4.5.5z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] ?? ''}</svg>`;

// Replace innerHTML only when it changed, and keep keyboard focus on the same control across re-renders.
const cache = new WeakMap();
export function setHTML(el, html) {
  if (!el || cache.get(el) === html) return;
  const active = document.activeElement;
  const key = active && el.contains(active) ? active.dataset.key : null;
  el.innerHTML = html;
  cache.set(el, html);
  if (key) el.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
}

export function toast(msg, level = 'ok') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${level}`;
  el.innerHTML = `${icon(level === 'bad' ? 'alert' : level === 'warn' ? 'bell' : 'check')}<span>${esc(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

export const empty = (ic, title, text, action = '') =>
  `<div class="empty">${icon(ic)}<b>${esc(title)}</b><p>${esc(text)}</p>${action}</div>`;
