# Emergency Response System Design

**Date:** 2026-02-06
**Status:** Approved

## Overview

A comprehensive Emergency Response System (ERS) for the Drops UTM platform that detects, responds to, and logs drone emergencies in real-time.

### Key Decisions

| Aspect | Decision |
|--------|----------|
| Scope | Comprehensive - technical failures, environmental hazards, airspace conflicts |
| Automation | Configurable - Auto Mode (immediate) or Supervised Mode (operator confirms) |
| Notifications | Flat - all stakeholders notified simultaneously |
| Post-incident | Full Investigation Suite - black box replay, reports, trend analysis |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DETECTION LAYER                              │
│  Monitors telemetry streams for anomalies and threshold breaches │
│  • Battery Monitor    • Signal Monitor    • Geofence Monitor     │
│  • Collision Detector • Weather Monitor   • System Health        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DECISION ENGINE                              │
│  Evaluates severity, selects response protocol                   │
│  • Auto Mode: Execute immediately                                │
│  • Supervised Mode: Queue for operator confirmation              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RESPONSE EXECUTOR                            │
│  Sends commands to drone, triggers notifications                 │
│  • RTH • Emergency Land • Hover • Divert • E-Stop               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BLACK BOX & ANALYSIS                         │
│  Records everything, enables replay and investigation            │
│  • Telemetry Recording • Incident Reports • Trend Dashboard      │
└─────────────────────────────────────────────────────────────────┘
```

All layers communicate via WebSocket events for real-time responsiveness.

---

## Detection Layer

### Emergency Types & Thresholds

| Category | Emergency Type | Warning Threshold | Critical Threshold | Auto Response |
|----------|---------------|-------------------|-------------------|---------------|
| **Battery** | Low battery | < 25% | < 10% | RTH / Emergency Land |
| **Battery** | Rapid discharge | > 2%/min | > 5%/min | RTH |
| **Signal** | Weak signal | < 50% strength | < 20% strength | Climb + RTH |
| **Signal** | Signal lost | 5 sec no contact | 15 sec no contact | Auto-RTH (onboard) |
| **Geofence** | Approaching boundary | < 100m from edge | Breach detected | Hold + Alert / Force RTH |
| **Collision** | Aircraft proximity | < 1km | < 500m | Descend + Hold |
| **Collision** | Obstacle detected | < 50m | < 20m | Stop + Climb |
| **Weather** | Wind speed | > 70% of max | > 90% of max | RTH |
| **Weather** | Visibility | < 3km | < 1km | Land / Hold |
| **System** | Motor anomaly | Vibration spike | Motor failure | Emergency Land |
| **System** | GPS degradation | HDOP > 2.0 | HDOP > 5.0 | Hover + Alert |

### Emergency Event Structure

```typescript
interface EmergencyEvent {
  type: 'battery_low' | 'battery_critical' | 'signal_weak' | 'signal_lost' |
        'geofence_warning' | 'geofence_breach' | 'collision_risk' |
        'weather_adverse' | 'motor_anomaly' | 'gps_degraded';
  severity: 'warning' | 'critical' | 'emergency';
  droneId: string;
  flightId: string;
  data: Record<string, unknown>;
  detectedAt: Date;
}
```

Thresholds are configurable per-drone and per-mission.

---

## Decision Engine

### Emergency Protocol Structure

```typescript
interface EmergencyProtocol {
  id: string;
  name: string;
  triggerConditions: EmergencyType[];
  severity: 'warning' | 'critical' | 'emergency';
  responseAction: 'RTH' | 'LAND' | 'HOVER' | 'DIVERT' | 'DESCEND' | 'ESTOP';
  requiresConfirmation: boolean;  // false in Auto Mode, true in Supervised
  timeoutSeconds: number;         // auto-execute after timeout if no response
  fallbackAction: string;         // if primary fails
}
```

### Mode Behavior

| Mode | Warning | Critical | Emergency |
|------|---------|----------|-----------|
| **Auto** | Log + Alert | Execute immediately | Execute immediately |
| **Supervised** | Log + Alert | Prompt operator (30s timeout) | Execute immediately* |

*Even in Supervised Mode, true emergencies (collision imminent, battery < 5%) execute automatically.

### Response Priority Matrix

When multiple emergencies occur simultaneously:

1. **Collision threats** - highest priority (immediate safety)
2. **System failures** - second (drone may become uncontrollable)
3. **Geofence/Airspace** - third (regulatory compliance)
4. **Battery/Signal** - fourth (time to respond)
5. **Weather** - fifth (usually gradual)

---

## Response Executor

### Command Execution Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   COMMAND    │────▶│   VALIDATE   │────▶│   EXECUTE    │
│   Selected   │     │   Safe to    │     │   Send to    │
│   (e.g. RTH) │     │   execute?   │     │   drone      │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                     │
                            ▼                     ▼
                     ┌──────────────┐     ┌──────────────┐
                     │   FALLBACK   │     │   MONITOR    │
                     │   if unsafe  │     │   execution  │
                     └──────────────┘     └──────────────┘
```

### Validation Checks

- Is RTH possible? (enough battery, path clear)
- Is landing safe? (not over water, crowds, restricted area)
- If not safe, select fallback (divert to nearest safe zone)

### Notification Channels

| Channel | Latency | Used For |
|---------|---------|----------|
| WebSocket push | < 100ms | In-app alerts, Control Center |
| Audio alarm | Immediate | Operators on duty |
| SMS | < 5 sec | Off-duty supervisors |
| Email | < 30 sec | Documentation, non-urgent |

### Notification Payload

```typescript
interface EmergencyNotification {
  incidentId: string;
  emergencyType: string;
  severity: string;
  droneId: string;
  flightId: string;
  flightNumber: string;
  position: { lat: number; lng: number };
  actionTaken: string;
  awaitingConfirmation: boolean;
  deepLink: string;
  timestamp: Date;
}
```

---

## Black Box & Investigation Suite

### Black Box Recording

```typescript
interface BlackBoxEntry {
  timestamp: Date;
  flightId: string;
  droneId: string;
  position: { lat: number; lng: number; altitudeMsl: number };
  attitude: { roll: number; pitch: number; yaw: number };
  velocity: { groundSpeed: number; verticalSpeed: number; heading: number };
  systems: { battery: number; signal: number; gpsHdop: number; motorRpm: number[] };
  commands: { received: string | null; executed: string | null };
  emergencyState: { active: boolean; type: string | null; severity: string | null };
}
```

- Recording rate: 1 Hz normal flight, 10 Hz during emergencies

### Incident Report Structure

| Section | Content |
|---------|---------|
| Summary | What happened, when, which drone, outcome |
| Timeline | Second-by-second event sequence |
| Telemetry Snapshot | Key metrics at detection, during response, at resolution |
| Actions Taken | Commands sent, operator confirmations, response times |
| Root Cause Tag | Equipment, Weather, Pilot Error, Software, External, Unknown |
| Attachments | Map screenshot, telemetry graphs |

### Visual Replay Features

- Map shows drone position at each timestamp
- Telemetry gauges replay values
- Event markers for detection, actions, resolution
- Playback speed: 0.25x, 1x, 2x, 4x

---

## Trend Analysis Dashboard

### Metrics & Visualizations

| Metric | Visualization | Insight |
|--------|---------------|---------|
| Incidents over time | Line chart | Safety trend direction |
| Incidents by type | Pie chart | Biggest problem areas |
| Incidents by drone | Bar chart | Problem aircraft identification |
| Incidents by route | Heatmap | Risky corridors |
| Response time | Histogram | Operator performance |
| Resolution success | Gauge | Protocol effectiveness |

### Automated Insights

System flags patterns automatically:
- Drone-specific issues suggesting maintenance
- Geographic clusters suggesting infrastructure gaps
- Shift-based performance variations

### Filters

All views filterable by:
- Date range
- Drone / Fleet
- Emergency type
- Severity
- Route / Hub
- Operator on duty

---

## Implementation Files

### Backend (NestJS)

| File | Purpose |
|------|---------|
| `emergency/emergency.module.ts` | Module registration |
| `emergency/detection.service.ts` | Monitors telemetry, emits emergency events |
| `emergency/decision-engine.service.ts` | Evaluates severity, selects response |
| `emergency/response-executor.service.ts` | Sends commands, triggers notifications |
| `emergency/emergency.controller.ts` | REST endpoints for config, history |
| `emergency/incident.entity.ts` | Incident records |
| `emergency/blackbox.entity.ts` | Telemetry recordings |
| `emergency/protocol.entity.ts` | Configurable response protocols |
| `notifications/notifications.service.ts` | Multi-channel alert dispatch |

### Frontend (Next.js)

| File | Purpose |
|------|---------|
| `app/dashboard/emergency/page.tsx` | Emergency Dashboard (active incidents, mode toggle) |
| `app/dashboard/emergency/incidents/page.tsx` | Incident history list |
| `app/dashboard/emergency/incidents/[id]/page.tsx` | Incident detail + replay |
| `app/dashboard/emergency/trends/page.tsx` | Trend analysis dashboard |
| `components/emergency/incident-replay.tsx` | Visual timeline scrubber |
| `components/emergency/emergency-banner.tsx` | Global alert banner |
| `components/emergency/confirmation-modal.tsx` | Supervised mode prompt |
| `store/emergency.store.ts` | Zustand store for emergency state |

---

## WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `emergency_detected` | Server → Client | EmergencyEvent |
| `emergency_action_required` | Server → Client | Pending confirmation details |
| `emergency_confirm` | Client → Server | { incidentId, approved: boolean } |
| `emergency_resolved` | Server → Client | Resolution details |
| `blackbox_update` | Server → Client | Live telemetry during incident |
