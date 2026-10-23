import { ROLES, ACCOUNTS } from '../auth.js';
import { esc, icon, toast } from '../ui/kit.js';

const CARD = {
  donor:       { icon: 'gift',   who: 'Restaurants, banquet halls, hostel messes and pharmacies with surplus to give.' },
  shelter:     { icon: 'home',   who: 'Night shelters, relief camps and anyone receiving food or aid.' },
  coordinator: { icon: 'map',    who: 'The control room that dispatches riders and fixes failures live.' },
};

export function mount(root, ctx) {
  root.innerHTML = `
    <section class="login">
      <div class="login-hero">
        <span class="eyebrow">${icon('zap')} Live demo · no sign-up</span>
        <h1>Surplus food reaches people <em>before</em> it spoils.</h1>
        <p>RelayFresh links food donors, volunteer riders and receiving sites in real time. It catches ghost riders and ghost stations, splits food fairly, and never hands over food past its safe time.</p>
        <p class="tip">${icon('users')} <span>Tip for judges: sign in as a donor in one window and the coordinator in another, then post food and watch it appear live.</span></p>
      </div>
      <div class="role-grid">
        ${Object.entries(ROLES).map(([role, r]) => {
          const accounts = ACCOUNTS.filter((a) => a.role === role);
          return `
          <form class="role-card ${role}" data-role="${role}" novalidate>
            <div class="role-icon">${icon(CARD[role].icon)}</div>
            <h2>${esc(r.label)}</h2>
            <p>${esc(CARD[role].who)}</p>
            <label class="field"><span>Email</span>
              ${accounts.length > 1
                ? `<select name="email">${accounts.map((a) => `<option value="${a.email}">${esc(a.email)} · ${esc(a.name)}</option>`).join('')}</select>`
                : `<input name="email" type="email" value="${accounts[0].email}" autocomplete="username" />`}
            </label>
            <label class="field"><span>Password</span><input name="password" type="password" value="demo" autocomplete="current-password" /></label>
            <button class="btn primary block" type="submit">Sign in as ${esc(r.label.split(' ')[0])}</button>
          </form>`;
        }).join('')}
      </div>
      <a class="public-link" href="#/stations">${icon('store')} Need food now? Find a food station near you. No login needed.</a>
    </section>`;

  root.querySelectorAll('form.role-card').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(f);
    if (!ctx.signIn(String(data.get('email')), String(data.get('password')))) toast('That email and password don’t match a demo account. The password is “demo”.', 'bad');
  }));
  return {};
}
