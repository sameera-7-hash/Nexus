# RelayFresh: surplus food, delivered safe

RelayFresh connects **food donors** (banquet halls, hostel messes, pharmacies) with **people in need** (night shelters, relief camps, individuals) through **volunteer riders**, live. It treats time, transport capacity, compatibility and human unreliability as live variables. It catches ghosts on both sides, riders who go silent and stations that stop checking in, and it never hands over food past its safe time.

Plain HTML, CSS and vanilla ES modules. No framework, no build step, no backend.

## Run it

```bash
npx serve .            # or: python -m http.server 8000
# open http://localhost:3000 (or :8000)
npm test               # node:test, Node 18+
```

It deploys to Vercel (or any static host) as is: no build command, output directory `.`.

**Live demo across windows.** Open two browser windows. Sign in as a donor in one and as the coordinator in the other. Food the donor posts appears in the control room instantly. Tabs share state through `localStorage` and sync through `BroadcastChannel`. The coordinator tab owns the simulation clock; every other tab renders state and sends actions. Each tab keeps its own sign-in, so the roles can sit side by side.

## Demo accounts (password `demo` for all)

| Role | Email | Linked to |
| --- | --- | --- |
| Donor | `banquet@relayfresh.demo` | Banquet Hall |
| Donor | `hostel@relayfresh.demo` | Hostel Mess |
| Donor | `pharmacy@relayfresh.demo` | City Pharmacy |
| Shelter | `sheltera@relayfresh.demo` | Shelter A |
| Shelter | `campb@relayfresh.demo` | Relief Camp B |
| Shelter | `womenc@relayfresh.demo` | Women & Child C |
| Coordinator | `admin@relayfresh.demo` | Control room |

The login page pre-fills these, and the **Switch demo account** menu in the top bar jumps between roles. **`#/stations` is public**: anyone in need can find food without logging in.

## 2-minute demo script

1. **Two windows.** Window A: coordinator (`#/coordinator`), press **Start**. Window B: Banquet Hall donor.
2. **Post food (B).** *Post food* → *Cooked meals*. Safe time fills in at 90 min (tier **Tight**). Enter 60 → confirm. The batch shows in window A at once, and riders split it by capacity.
3. **Ghost rider (A).** *Judge scenarios → Ghost rider*. The phone preview shows the silence countdown. Either tap **I'm still on it** to save the claim, or let it expire: the claim is auto-released and the rescue rider (Dev) takes it.
4. **Shelter fills mid-trip.** *Judge scenarios → Shelter fills mid-trip*. Cargo on the road is rerouted. The phone shows the new drop-off card, and the alert links to the rider.
5. **Ghost station.** *Judge scenarios → Ghost station*. The site turns amber with "last seen X min ago" and cooked food goes elsewhere. Sign in as that shelter and press **We're open: confirm check-in** to restore it. *We catch ghosts on both sides.*
6. **Tight expiry.** *Judge scenarios → Tight expiry*. 40 meals with 7 safe minutes: no rider can make it, so the batch is flagged and never sent out. Unsafe food never goes out.
7. **Fairness and trust.** *Sites & Stations*: the meals/person bars show no camp is unfairly served. Riverside Families is unverified and served through the nearest food station. **Verify…** with a reason enables direct delivery.
8. **Flash flood** closes two sites and slows every rider. Watch everything re-plan. Then open *Log & Impact*: every decision is listed with its reason.

## What it does

### Three role dashboards
- **Donor** (`#/donor`): a 3-step post flow. The food type sets the tier and safe time (editable), then quantity, a photo placeholder and pickup notes, then a confirm step that explains how the food will be routed. *My donations* shows live status (Waiting / Rider assigned / Picked up / Rerouted / Delivered to X / Expired), a spoilage countdown ring, the rider and the site. An impact card shows meals delivered, people fed and kg of waste avoided.
- **Shelter / Needy** (`#/shelter`): a daily **check-in** button that pulses when overdue, a verification badge with *Request verification*, a headcount and needs editor, facility toggles that explain why each matters, an incoming timeline with ETAs and reroute notices, and *Find food near you*.
- **Coordinator** (`#/coordinator`): five sections: Live Ops (map, alerts, KPIs, volunteer phone), Riders, Sites & Stations, Batches, Log & Impact. The **alerts rail** covers ghost riders, ghost stations, food near its point of no return, reroutes and floods, and each alert jumps to its entity. A **Judge scenarios** menu runs each failure in one click. The **volunteer phone preview** shows the selected rider's job, spoilage ring, reroute card and the *I'm still on it* heartbeat.
- **Public food stations** (`#/stations`, no login): nearest stations, live stock and tap-to-call. The phone numbers are demo numbers that do not connect.

### Dispatch engine (`src/engine.js`, pure functions)
| Problem on the ground | What the engine does |
| --- | --- |
| 180 meals, 40-meal scooters, a 50-person shelter | **Splits** batches across riders and sites. Never exceeds rider capacity or a site's stated need. Most urgent batch first. |
| Ghost reservations (rider claims, goes silent) | A **silence limit** scales with the food's safe time (15%, 2–8 min). The claim auto-releases to a **rescue-reserve** rider. The heartbeat resets the timer. |
| Rider stuck in traffic | Arrival is re-forecast every tick. A pickup that can't arrive with a 5-min buffer is released. |
| Shelter fills, closes or loses water mid-trip | Sites are reconciled against cargo heading to them every tick, and cargo is **rerouted on the road**. Partial drop-offs work. |
| Perishability | **Tiers**: *Tight* (cooked, under 2 h) goes only to confirmed sites reachable in time. *Perishable* (bread, fruit, dairy, 8–9 h) goes to camps or stations. *Shelf-stable* fills stated needs, and the rest restocks stations. |
| Ghost stations | Sites must **check in**. A site silent for more than 60 sim-min is UNCONFIRMED: no tight or perishable food, and cargo already heading there is rerouted. |
| False claims capturing deliveries | **Verified** sites get direct delivery. **Unverified** needs are served through public food stations, so nobody is turned away. |
| Not enough food | **Fair share**: when supply < demand, food is split by headcount (water-filling), not nearest-first. Feasibility and expiry checks still apply. |
| Ration kits with no fuel, formula with no water | **Dependency rules** per category. Stations hand out sealed goods, so only storage rules (cold) apply there. |
| Food past its safe time | **Safety stop**: never handed over; the rider is told to dispose of it safely. |
| Mixed fleet | **Vehicles**: cycle (15 units, 12 km/h), scooter (40, 20 km/h), auto-rickshaw (100, 18 km/h). |

Every automated decision goes to the **decision log** with its reason.

## Structure

```
index.html            app shell (top bar, sidebar / bottom tabs, toasts)
styles.css            design tokens, light + dark, components, responsive
src/engine.js         dispatch + recovery engine (pure, no DOM)
src/scenario.js       demo city: donors, sites, stations, riders, batches
src/actions.js        one reducer for every change: (state, action) -> state
src/store.js          cross-tab live state: localStorage + BroadcastChannel, clock leader
src/auth.js           demo accounts and per-tab sessions
src/app.js            hash router, role guards, shell, delegated events
src/ui/               kit (icons, rings, toasts), derive (selectors), alerts (+ judge scenarios)
src/views/            login, donor, shelter, coordinator, stations
tests/                node:test: 10 original scenarios + 16 for the new features
```

## Design notes

- **Food-safety colours everywhere:** green = safe, amber = under 50% of safe time left, red = under 25% or expired.
- Inter for the UI, JetBrains Mono for timers and numbers. Fonts load non-blocking, so the app starts instantly on bad wifi.
- Light and dark modes (system preference plus a toggle). Keyboard focus rings, labelled inputs, and a screen-reader announcer for new alerts. Animation respects `prefers-reduced-motion`.
- Responsive down to 375 px. The sidebar becomes a bottom tab bar.

## Next steps

Real GPS and travel-time APIs, rider and shelter mobile apps with push acknowledgements, real authentication and a server (WebSocket) so coordinators in different places share one live state.
