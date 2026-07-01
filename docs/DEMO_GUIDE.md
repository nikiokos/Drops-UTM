# DROPS UTM — Demo & Feature Guide

**Live:** https://utm.drops.eu
**Login:** `operator@drops-utm.com` / `password123`
(other seed users: `admin@drops-utm.com`, `pilot@drops-utm.com` — same password)

---

## 1. What DROPS UTM is (the pitch)

DROPS UTM is a **live Unmanned Traffic Management platform** for coordinating drone
operations over Greek airspace. It fuses **real live data** — manned air traffic
(ADS-B), aviation weather (METAR/SIGMET), NOTAMs, and controlled airspace — with a
full operations stack (flights, missions, hubs, fleet, conflicts, emergencies) and a
layer of **AI agents powered by Claude** that answer questions, predict conflicts
before they happen, and judge whether a drone can safely do a job.

**The one-liner:** *"It doesn't just show you the airspace — it talks to you, predicts
the future, and tells you what a drone can and can't do."*

**Three differentiators to lead with:**
1. **Operations Copilot** — talk to your airspace in plain Greek or English.
2. **Foresight Mode** — see and prevent conflicts *before* they occur.
3. **Mission Feasibility** — instant "can this drone complete this mission on one charge?"

---

## 2. Recommended demo flow (10–12 min, max impact)

Show it as a story: *real → intelligent → predictive → operational.*

### Beat 1 — "This is real, right now" (1 min)
- Log in → land on **Operations Center** (Dashboard).
- Point at the tactical map: **~100+ orange aircraft = real live ADS-B traffic over
  Greece this second.** Hubs (green), drones, airspace zones.
- Top stats: Active Flights, Hubs Online, Fleet, Conflicts.
- *Say:* "Everything on this map is live — real aircraft, real weather, real NOTAMs."

### Beat 2 — "Talk to your airspace" — Operations Copilot (2 min)
- Click the **cyan robot button, bottom-right**.
- Type (Greek or English), e.g.:
  - *"Which drones are available?"*
  - *«ποιες πτήσεις είναι ενεργές τώρα;»*
  - *"Show me the active conflicts"*
- The AI answers with a **grounded table from live data**, and shows a **"tool call"**
  trace (it actually queried the system).
- Bonus: ask it to **propose** an action ("propose authorizing flight DRP-2025-0006")
  → it returns a **Confirm card** — the agent never acts on its own, the human confirms.

### Beat 3 — "See the future" — Foresight Mode (3 min) ⭐ the signature moment
- On the dashboard map, top-left HUD: click **Run Demo**.
- Watch: the camera flies to **Rhodes**, two drones' **ghost trails** stretch forward
  in time, a **red pulsing conflict marker** appears with a countdown ("CONFLICT IN
  6:xx"), slider shows "1 conflict".
- ~15–20s later the **Air Traffic Director** panel appears (badge **AI**) with real
  Claude reasoning: *"minimum predicted separation 29 m, breaching both thresholds at
  T+370s…"* and **3 ranked options** (one RECOMMENDED).
- Click the recommended **Confirm** → the conflict clears → **"RESOLVED — separation
  restored"**, 0 conflicts.
- *(Optional, browser mic)*: click **Voice**, say *"do option two"* / *«κάνε το δύο»*.
- *Say:* "We didn't manage an incident — we prevented it six minutes before it existed."

### Beat 4 — "Can this drone even do the job?" — Mission Feasibility (2 min)
- Left sidebar → **Drones → Add Drone**. Fill the new **"Energy & Performance"**
  section (Battery 400 Wh, Hover 260 W, Cruise 210 W, Cruise speed 16 m/s, Health 95%,
  Wind tolerance 12) → Save.
- **Missions → New Mission** → pick that drone + draw a route / pick hubs.
- A **live verdict card** appears: **GO / MARGINAL / NO-GO** with the energy margin, a
  breakdown (Wh usable vs required), live wind, and a **Claude explanation**.
- Make it fail (long route or heavy load) → **NO-GO** with concrete fixes ("reduce
  payload by X kg", "add a charging stop", "use another drone").
- On NO-GO, creating the mission requires a **typed override justification** (logged
  for audit).

### Beat 5 — "…and underneath, it's a full UTM" (2 min)
Sweep the depth so it's clear this isn't a toy:
- **Weather** → per-hub **GO / CAUTION / NO_GO** from live METAR + SIGMET.
- **Airspace** → controlled zones (openAIP) + geofence checks.
- **Conflicts** → detection + resolution workflow.
- **Emergency** → incidents, protocols, blackbox, confirmation modal.
- **Flights / Missions** → planning, authorization, waypoint editor, altitude profile.
- **Developer** portal → manufacturer integration API with API keys.

---

## 3. Feature reference (what each area does)

### Operations Center (Dashboard)
Real-time overview: tactical Leaflet map (hubs, drones, live ADS-B aircraft, airspace
zones, drone zones), fleet/flight/conflict stats, flight log, system diagnostics, and
the emergency banner. Layer toggles: **Live Traffic / Airspace / Drone Zones**.

### Operations Copilot  🧠 (AI — built this session)
Floating chat widget on every dashboard page. A **tool-using Claude agent** that
answers natural-language questions over live data (flights, drones, hubs, fleet,
conflicts, emergencies, weather, NOTAMs, live traffic, briefings). Auto-detects
Greek/English. Can **propose** confirm-gated actions (authorize/abort/resolve/confirm)
— it never executes writes itself. Shows a collapsible tool-call trace.

### Foresight Mode  🔮 (AI — built this session)
Predictive look-ahead layer on the tactical map. Extrapolates drone + live ADS-B
trajectories forward in time, detects **closest-point-of-approach conflicts before they
happen** (thresholds: <150 m horizontal AND <30 m vertical). The **Air Traffic
Director** (Claude) proposes ranked, explainable resolutions (hold / altitude /
lateral); operator confirms by click or **voice** (Web Speech). Ghost trails, pulsing
conflict marker + countdown, cinematic camera fly-to. Demo is a scripted-but-real
scenario over live background; the math and AI are real.

### Mission Feasibility Predictor  🔋 (AI — built this session)
Drones gain an **energy/performance profile** at registration (battery Wh, hover/cruise
power, cruise speed, battery health, wind tolerance). A **physics energy model**
computes usable vs required energy for a mission — corrected for **payload, hover,
live wind, and battery health** — and returns **GO / MARGINAL / NO-GO** with the margin
and concrete solutions. **Claude** writes the human explanation (deterministic fallback
if no key). Wired live into **drone registration** and **mission creation**; NO-GO
requires a logged override reason. Legacy drones without specs still get a
(low-confidence) verdict.

### Flights
Flight lifecycle: plan → authorize → start → complete / abort. Status tracking,
departure/arrival hubs, altitude limits, assigned drone.

### Missions
Mission builder with a **map waypoint editor**, waypoint list, **altitude profile**,
timeline, hover/actions per waypoint (deliver/pickup payload, capture), scheduling
(manual / scheduled / event-triggered). Estimated distance & duration.

### Conflicts
Airspace conflict records (type, severity, involved flights, location, separation) with
a resolution workflow. Foresight feeds the "before it happens" view; this is the
current-conflict ledger.

### Emergency
Incident management (low battery, lost signal, geofence breach, etc.), response
protocols, confirmation modal (human-in-the-loop), blackbox telemetry, root-cause
capture. Pre-flight **AI Authorization Agent** assesses briefings (GO / GO_WITH_
CONDITIONS / NO_GO) with reasons and conditions.

### Weather
Live aviation weather: **METAR / TAF / SIGMET** (NOAA) + Open-Meteo, plus a per-hub
**GO / CAUTION / NO_GO** flight-weather verdict with the driving reasons (wind gusts,
flight category, SIGMET).

### Airspace
Controlled airspace zones (local + **openAIP** live), geofence point/path checks
against zones with severity (critical / warning / info), altitude-overlap awareness.

### Fleet / Hubs / Drones / Connectivity / Control Center
Fleet-state overview (available / in-flight / charging / maintenance), hub management,
drone registry (now with energy specs), device/connectivity registrations, and the
operations control center.

### Developer Portal
Manufacturer integration API secured with API keys — for third-party drone/telemetry
integration.

---

## 4. What's genuinely "live" (for a skeptical audience)

| Data | Source |
|---|---|
| Manned air traffic (ADS-B) | adsb.lol (free, ODbL) — real aircraft over Greece |
| Aviation weather (METAR/TAF/SIGMET) | NOAA Aviation Weather + Open-Meteo |
| NOTAMs | autorouter (OAuth2) — Athinai FIR |
| Controlled airspace | openAIP |
| AI reasoning | Claude (Anthropic) — real, with graceful deterministic fallback |

---

## 5. AI features — how to prove they're real (not canned)

- **Copilot / Foresight / Feasibility** each show a source badge or tool trace. Foresight
  and the Copilot mark **"AI"** and show tool calls; feasibility explanations vary with
  the exact numbers.
- Change an input (different drone, longer route, heavier payload) → the AI's numbers
  and recommendation change accordingly. It's reasoning over the actual geometry/energy,
  not a fixed script.
- If the Anthropic key is ever removed, everything **still works** via deterministic
  fallbacks (verdicts, computed options) — the AI is an explanation/reasoning layer on
  top of solid math, not a single point of failure.

---

## 6. Access, roles, troubleshooting

- **URL:** https://utm.drops.eu — **login:** `operator@drops-utm.com` / `password123`.
- **Roles:** admin / operator / pilot / hub_operator (seed users share the password).
- **If a page looks stale:** hard refresh (Ctrl/Cmd+Shift+R).
- **Foresight AI panel takes ~15–20s** on the first call (one-time model warm-up) — this
  is expected; the ghost trails and conflict appear immediately.
- **Voice** needs a Chromium-based browser and mic permission; the text **Confirm**
  buttons are always the fallback.

---

## 7. Infra (for a technical audience)

- **Frontend:** Next.js 15 (React 19) — `next start` on :3000
- **Backend:** NestJS — `node dist/main` on :3001
- **Process manager:** PM2 (`drops-backend`, `drops-frontend`)
- **Reverse proxy / TLS:** nginx → `utm.drops.eu`
- **DB:** SQLite (TypeORM, auto-migrating schema)
- **Host:** DigitalOcean droplet
- **AI:** Anthropic Claude via server-side key (never exposed to the browser)
