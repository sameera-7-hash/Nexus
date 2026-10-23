# RelayFresh — last-mile control room for perishable aid

Real-time coordination, dispatch and safety enforcement between **donors** (banquet halls, hostel messes, pharmacies), **volunteer riders**, and **receiving sites** (night shelters, relief camps). Time, transport capacity, compatibility and human unreliability are all live variables in the dispatcher.

## The problems it solves

| Ground problem | What RelayFresh does |
| --- | --- |
| 180 meals, 40-meal scooters, a 50-person shelter | **Splits** each batch across riders and sites. A batch never exceeds a rider's capacity, and a site never gets more than its stated need. The most urgent batch (soonest expiry) is dispatched first. |
| Ghost reservations: a rider claims a batch, then goes silent | Every claim carries a **silence limit** that scales with how much safe time the food has left (15% of it, between 2 and 8 min). Miss it and the claim is **auto-released** and re-dispatched. A **rescue-reserve** rider is held back for exactly these cases. |
| Rider stuck in traffic | Arrival is re-forecast every tick. If a pickup can no longer arrive with a 5-minute safety buffer, it is released to a faster rider. |
| Shelter fills up (walk-in donations) while a rider is en route | Each site is reconciled against the cargo heading to it. Surplus cargo is **rerouted mid-trip** to the next feasible site, or to a **community-fridge fallback**. Partial drop-offs work too: deliver what fits, then reroute the rest. |
| Ration kits to a camp with no fuel, formula with no clean water | **Dependency rules** per category (ration kits need water and fuel, infant formula needs water, medicines need cold storage). A site that loses a facility mid-trip triggers a reroute. |
| Food that went past its safe time | **Safety stop**: expired cargo is never handed over, and the rider is told to dispose of it safely. |
| No rider free right now | Riders who are finishing a drop-off nearby get **pre-booked** for the next pickup, so food doesn't wait for an idle rider. |

Every automated decision is written to the **decision log** with its reason: ETA, minutes to spare, and why something was released or rerouted.

## Run it

No build step and no dependencies.

```bash
npx serve .        # or: python3 -m http.server 8000
# open http://localhost:3000 (or :8000)
```

## Test it

```bash
npm test           # node --test, needs Node 18+
```

The test suite replays the judges' scenarios: batch splitting, no over-commit, zero-waste baseline, unresponsive rider, traffic, walk-in fill mid-transit, site closure, fuel and water dependency rules, and expired-food blocking.

## Demo script (≈2 min)

1. **Start** at 3 min/s. Point out that the 180-meal banquet batch is split across several riders and nothing exceeds a site's need.
2. A **Riders** card → *Go unresponsive* on someone heading to a pickup. Within the silence limit, the log shows the claim released and the rescue rider (Dev) taking it.
3. *Stuck in traffic* on a rider heading to Hostel Mess (50-minute food). The claim is released because the forecast arrival is too late.
4. Once a rider is carrying food, click *Walk-in fills demand* on their destination. The cargo is rerouted mid-trip.
5. Click **clean water** on Women & Child C to remove it. Formula and ration kits stop going there.
6. Post a batch with **6 safe minutes**. No rider can make it safely, so it is flagged and never dispatched: unsafe food never goes out.

## Structure

```
index.html        control-room layout
styles.css        light/dark theme
src/engine.js     dispatch + recovery engine (pure functions, no DOM)
src/scenario.js   demo city: donors, sites, riders, batches
src/ui.js         rendering + simulated field events
tests/            node:test suite for every failure mode
```

## Next steps (beyond the 5-hour sprint)

Real GPS and travel-time APIs, rider and shelter mobile apps with push acknowledgement in place of the simulated ping, and a server (WebSocket) so many coordinators share one live state.
