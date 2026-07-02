# DROPS UTM — Demo & Feature Guide

**Live:** https://utm.drops.eu
**Login (see everything):** `admin@drops-utm.com` / `password123`
Other seed users (fewer menu items — see roles below): `operator@drops-utm.com` (hub operator), `pilot@drops-utm.com`.

> ⚠️ **To demo ALL 14 sections, log in as `admin`.** The sidebar is role-gated:
> **Fleet** and **Connectivity** need admin/hub-operator; **Developer** and **Settings**
> are admin-only. An operator/pilot login hides those.

---

## 1. What DROPS UTM is (the pitch)

DROPS UTM is a **live Unmanned Traffic Management platform** for coordinating drone
operations over Greek airspace. It fuses **real live data** — manned air traffic
(ADS-B), aviation weather (METAR/SIGMET), NOTAMs, and controlled airspace — with a full
operations stack (flights, missions, hubs, fleet, conflicts, emergencies, telemetry,
command & control) and **four AI agents powered by Claude** that answer questions,
predict conflicts before they happen, judge mission feasibility, and authorize flights.

**One-liner:** *"It doesn't just show you the airspace — it talks to you, predicts the
future, tells you what a drone can and can't do, and clears flights to fly."*

**Four AI capabilities (the differentiators):**
1. **Operations Copilot** — talk to your airspace in Greek or English.
2. **Foresight Mode** — see and prevent conflicts *before* they occur.
3. **Mission Feasibility** — instant "can this drone complete this mission on one charge?"
4. **Pre-Flight Authorization Agent** — AI GO / GO-WITH-CONDITIONS / NO-GO on a full briefing.

---

## 2. Recommended demo flow (12–15 min) — real → intelligent → predictive → operational

### Beat 1 — "This is real, right now" (1 min)
Log in (admin) → **Operations Center**. The tactical map shows **~100+ orange aircraft =
real live ADS-B traffic over Greece this second**, plus hubs, drones, airspace and drone
zones. Top stats: Active Flights / Hubs Online / Fleet / Conflicts. Layer toggles: Live
Traffic / Airspace / Drone Zones.

### Beat 2 — "Talk to your airspace" — Operations Copilot (2 min) 🧠
Cyan **robot button, bottom-right**. Ask (GR/EN): *"which drones are available?"*,
*«ποιες πτήσεις είναι ενεργές;»*, *"show me the active conflicts"*. It answers with a
**grounded table + a tool-call trace**. Then: *"propose authorizing flight DRP-2025-0006"*
→ a **Confirm card** (the agent proposes, the human confirms — it never writes on its own).

### Beat 3 — "See the future" — Foresight Mode (3 min) ⭐
Map HUD (top-left) → **Run Demo**. Camera flies to **Rhodes**, **ghost trails** stretch
forward, a **red pulsing conflict** with a countdown appears. ~15–20s later the **Air
Traffic Director [AI]** panel shows real Claude reasoning + **3 ranked options**; click
the RECOMMENDED **Confirm** → **"RESOLVED"**. (Optional: **Voice** → *«κάνε το δύο»*.)

### Beat 4 — "Can this drone even do the job?" — Mission Feasibility (2 min) 🔋
**Drones → Add Drone** → fill **Energy & Performance** → Save. **Missions → New Mission**
→ pick that drone + a route → a **live GO / MARGINAL / NO-GO card** with margin, Wh
usable-vs-required, live wind, a Claude explanation, and fixes. NO-GO requires a **typed
override justification** (logged).

### Beat 5 — "Clear it to fly" — Pre-Flight Authorization (2 min) ✅
**Flights** → open a flight → **Pre-Flight Briefing**. It composes weather + airspace +
live traffic + NOTAM into a **GREEN / AMBER / RED** verdict, and the **AI agent** returns
**GO / GO-WITH-CONDITIONS / NO-GO** with blocking reasons and conditions.

### Beat 6 — "…and underneath, a full UTM" (3–4 min)
Sweep the remaining sections (below) so it's clear this is a complete operational
platform: Control Center, Emergency, Fleet, Connectivity, Conflicts, Weather, Airspace,
Hubs, Developer, Settings.

---

## 3. Every section — what it does (all 14 sidebar items, in order)

### 1. Dashboard — Operations Center
Real-time command picture: tactical Leaflet map (hubs, drones, **live ADS-B aircraft**,
airspace zones, drone zones), fleet/flight/conflict stat cards, flight log, system
diagnostics, and the emergency banner. Layer toggles for Live Traffic / Airspace / Drone
Zones. **Hosts the Foresight HUD and the Operations Copilot widget.**

### 2. Control Center
Real-time **drone command & control**. Send operational commands to drones and view
command history/acknowledgements — the "hands-on-the-stick" operations console.

### 3. Emergency — Emergency Response
End-to-end incident handling: detects emergencies (low battery, lost signal, geofence
breach, motor/GPS/comm loss), applies **response protocols**, and routes urgent ones
through a **human confirmation modal** (approve/reject a recommended action). Includes
**blackbox** telemetry capture and **root-cause** recording for after-action review.

### 4. Fleet — Fleet Intelligence  *(admin / hub-operator)*
Fleet-wide state and analytics across hubs: how many drones are available / in-flight /
charging / in maintenance, with breakdowns by hub. Tabbed intelligence view over the
whole fleet.

### 5. Connectivity — Device Connectivity  *(admin / hub-operator)*
Device and communication-protocol registrations and live connection status (which drones
are linked, over which protocol). Tabbed overview of connectivity health.

### 6. Missions
Mission planning & building: an interactive **map waypoint editor**, waypoint list,
**altitude profile**, timeline, per-waypoint actions (hover, deliver/pickup payload,
capture) and conditions, plus scheduling (manual / scheduled / event-triggered) with
estimated distance & duration. **Shows the live Mission Feasibility card** when a drone
is assigned.

### 7. Flights
Flight lifecycle: plan → **authorize** → start → complete / abort, with status, hubs,
altitude limits and assigned drone. Entry point to the **Pre-Flight Briefing** + AI
authorization verdict.

### 8. Drones
Drone registry / fleet management: register and manage drones with full specs — and now
the **Energy & Performance profile** (battery Wh, hover/cruise power, cruise speed,
battery health, wind tolerance) that powers Mission Feasibility.

### 9. Hubs
Hub (vertiport/base) management: locations, codes, status, and the drones based at each.
Hubs anchor departures/arrivals and per-hub weather.

### 10. Airspace
Controlled airspace: zones from **openAIP** (live) + locally defined zones, rendered on a
map, with **geofence checks** (point/path) that flag breaches by severity (critical /
warning / info) with altitude-overlap awareness.

### 11. Conflicts
The conflict ledger: airspace conflicts (type, severity, the two flights, location,
separation distance) and a **resolution workflow**. (Foresight predicts conflicts *before*
they occur; this manages current/known ones.)

### 12. Weather
Live aviation weather: **METAR / TAF / SIGMET** (NOAA) plus Open-Meteo hub conditions,
and a per-hub **GO / CAUTION / NO_GO** flight-weather verdict with the driving reasons
(wind, gusts, flight category, active SIGMET).

### 13. Developer — Developer Portal  *(admin)*
Manufacturer/third-party integration API secured with **API keys**: **Submit Telemetry**
(position/status; auto-registers unknown drones), **Register Drone** (pre-register with
specs), **Get Status** (drones for your key). This is how external fleets plug in.

### 14. Settings  *(admin)*
Operator profile and access configuration.

---

## 4. The AI layer — all four agents (all Claude-powered, all with safe fallbacks)

### A. Operations Copilot  🧠
Floating chat on every dashboard page. A **tool-using Claude agent** that answers
natural-language questions over live data (flights, drones, hubs, fleet, conflicts,
emergencies, weather, NOTAMs, live traffic, briefings), auto-detects Greek/English, shows
a **tool-call trace**, and can **propose confirm-gated actions** (authorize / abort /
resolve / confirm) — it never executes writes itself.

### B. Foresight Mode  🔮
Predictive look-ahead on the map. Extrapolates drone + live ADS-B trajectories forward,
detects **closest-point-of-approach conflicts before they happen** (<150 m horizontal AND
<30 m vertical). The **Air Traffic Director** (Claude) proposes ranked, explainable
resolutions (hold / altitude / lateral); operator confirms by click or **voice**. Ghost
trails, pulsing conflict + countdown, cinematic camera.

### C. Mission Feasibility  🔋
A **physics energy model** (battery vs. required Wh, corrected for payload, hover, live
wind, battery health) yields **GO / MARGINAL / NO-GO** with the margin and concrete fixes;
**Claude** writes the human explanation. Wired into drone registration and mission
creation; NO-GO needs a logged override.

### D. Pre-Flight Authorization Agent  ✅
The original safety agent. It composes a full **briefing** (weather + airspace + live
traffic + NOTAM → **GREEN / AMBER / RED**) and Claude returns an authorization decision —
**GO / GO-WITH-CONDITIONS / NO-GO** — with blocking reasons and operating conditions.

**All four degrade gracefully:** if the Anthropic key is unavailable, every agent falls
back to deterministic verdicts/options/explanations — the AI is a reasoning/explanation
layer on top of solid math, never a single point of failure.

---

## 5. What's genuinely "live" (for a skeptical audience)

| Data | Source |
|---|---|
| Manned air traffic (ADS-B) | adsb.lol (free, ODbL) — real aircraft over Greece |
| Aviation weather (METAR/TAF/SIGMET) | NOAA Aviation Weather + Open-Meteo |
| NOTAMs | autorouter (OAuth2) — Athinai FIR |
| Controlled airspace | openAIP |
| AI reasoning | Claude (Anthropic), server-side |

**Prove the AI is real:** change an input (different drone, longer route, heavier payload)
→ the numbers and recommendation change with the actual geometry/energy. Foresight and the
Copilot show an **"AI"** badge and tool calls; explanations vary with the exact figures.

---

## 6. Access, roles, troubleshooting

- **URL:** https://utm.drops.eu · **admin login:** `admin@drops-utm.com` / `password123`.
- **Roles & menu:** admin sees all 14; hub-operator hides Developer/Settings; pilot also
  hides Fleet/Connectivity.
- **Stale page?** Hard refresh (Ctrl/Cmd+Shift+R).
- **Foresight AI panel takes ~15–20s** on the first call (model warm-up) — ghost trails and
  the conflict appear immediately.
- **Voice** needs Chrome/Edge + mic permission; the text **Confirm** buttons are the
  fallback.

---

## 7. Infrastructure (for a technical audience)

- **Frontend:** Next.js 15 (React 19) — `next start` :3000
- **Backend:** NestJS — `node dist/main` :3001
- **Process manager:** PM2 (`drops-backend`, `drops-frontend`)
- **Reverse proxy / TLS:** nginx → `utm.drops.eu`
- **DB:** SQLite (TypeORM, auto-migrating schema)
- **Host:** DigitalOcean droplet
- **AI:** Anthropic Claude via a server-side key (never exposed to the browser)
