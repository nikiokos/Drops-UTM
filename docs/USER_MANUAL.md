# DROPS UTM - User Manual

## Unmanned Traffic Management System

**Version 0.1.0**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [System Architecture](#3-system-architecture)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Hub Management](#5-hub-management)
6. [Drone Fleet Management](#6-drone-fleet-management)
7. [Flight Operations](#7-flight-operations)
8. [Mission Planning](#8-mission-planning)
9. [Real-time Monitoring](#9-real-time-monitoring)
10. [Emergency Response](#10-emergency-response)
11. [Fleet Intelligence](#11-fleet-intelligence)
12. [Device Connectivity](#12-device-connectivity)
13. [Simulation & Testing](#13-simulation--testing)
14. [API Reference](#14-api-reference)
15. [WebSocket Events](#15-websocket-events)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Introduction

### 1.1 Overview

DROPS UTM (Unmanned Traffic Management) is a comprehensive drone fleet management system designed for enterprise-scale drone operations. It provides end-to-end capabilities for:

- **Fleet Management**: Register, track, and manage drone fleets across multiple hubs
- **Mission Planning**: Create, schedule, and execute complex multi-waypoint missions
- **Real-time Monitoring**: Live telemetry, conflict detection, and situational awareness
- **Emergency Response**: Automated incident detection and response protocols
- **Simulation**: Test scenarios without risking actual hardware

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| Multi-Hub Operations | Manage drones across geographically distributed hubs |
| Intelligent Assignment | AI-powered drone-to-mission matching |
| Automated Response | Configurable emergency protocols with auto-execution |
| Real-time Telemetry | 10Hz+ telemetry with adaptive rate management |
| Flight Simulation | Physics-based simulation for testing and training |
| Multi-Protocol Support | WebSocket, MQTT, MAVLink connectivity |

### 1.3 System Requirements

- **Backend Server**: Node.js 18+
- **Database**: SQLite (development) / PostgreSQL (production)
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+
- **Network**: WebSocket support required

---

## 2. Getting Started

### 2.1 Installation

```bash
# Clone the repository
git clone <repository-url>
cd drops-utm

# Install dependencies
npm install

# Start the backend server
cd backend
npm run dev
```

### 2.2 Default Configuration

| Setting | Default Value |
|---------|---------------|
| API Port | 3001 (or APP_PORT env) |
| WebSocket Namespace | /ws |
| JWT Expiry | 24 hours |

### 2.3 First Login

Use the seeded test accounts:

| Email | Password | Role |
|-------|----------|------|
| admin@drops-utm.com | password123 | Administrator |
| pilot@drops-utm.com | password123 | Pilot |
| operator@drops-utm.com | password123 | Hub Operator |

### 2.4 Authentication

All API endpoints (except `/auth/*` and `/health`) require authentication.

```bash
# Login to get access token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@drops-utm.com","password":"password123"}'

# Use token in subsequent requests
curl http://localhost:3001/api/v1/drones \
  -H "Authorization: Bearer <accessToken>"
```

---

## 3. System Architecture

### 3.1 Module Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DROPS UTM SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│  OPERATIONS LAYER                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Hubs    │ │  Drones  │ │  Flights │ │     Missions     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  INTELLIGENCE LAYER                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Fleet   │ │ Conflicts│ │  Alerts  │ │    Emergency     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Telemetry │ │ Airspace │ │ Weather  │ │   Simulation     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  CONNECTIVITY LAYER                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────────┐│
│  │ Commands │ │ Devices  │ │        WebSocket Gateway         ││
│  └──────────┘ └──────────┘ └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
Drone → Telemetry → Conflict Detection → Alerts
                 ↓
         Emergency Detection → Response Protocols → Commands → Drone
```

---

## 4. User Roles & Permissions

### 4.1 Role Definitions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **admin** | System administrator | Full access to all features |
| **hub_operator** | Hub operations manager | Manage hubs, drones, devices |
| **pilot** | Remote pilot | Execute flights, manage missions |

### 4.2 Permission Matrix

| Feature | Admin | Hub Operator | Pilot |
|---------|:-----:|:------------:|:-----:|
| User Management | ✓ | - | - |
| Organization Management | ✓ | - | - |
| Hub CRUD | ✓ | ✓ | Read |
| Drone CRUD | ✓ | ✓ | Read |
| Flight Operations | ✓ | ✓ | ✓ |
| Mission Management | ✓ | ✓ | ✓ |
| Emergency Response | ✓ | ✓ | ✓ |
| Device Management | ✓ | ✓ | - |
| System Configuration | ✓ | - | - |

---

## 5. Hub Management

### 5.1 What is a Hub?

A Hub represents a physical drone operations center - a location where drones are stored, maintained, and dispatched from. Each hub defines:

- Geographic location (coordinates, timezone)
- Airspace boundaries (radius, altitude ceiling/floor)
- Capacity (maximum simultaneous drones)
- Operational status

### 5.2 Creating a Hub

```bash
curl -X POST http://localhost:3001/api/v1/hubs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "NYC-HUB",
    "name": "New York Operations Center",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "airspaceRadius": 5000,
    "airspaceCeiling": 400,
    "airspaceFloor": 0,
    "timezone": "America/New_York",
    "maxSimultaneousDrones": 10,
    "status": "active"
  }'
```

### 5.3 Hub Status Values

| Status | Description |
|--------|-------------|
| `active` | Fully operational |
| `maintenance` | Under maintenance, limited operations |
| `inactive` | Not accepting operations |

### 5.4 Airspace Configuration

- **airspaceRadius**: Operating radius in meters from hub center
- **airspaceCeiling**: Maximum altitude (meters AGL)
- **airspaceFloor**: Minimum altitude (meters AGL)
- **maxSimultaneousDrones**: Capacity limit

---

## 6. Drone Fleet Management

### 6.1 Registering a Drone

```bash
curl -X POST http://localhost:3001/api/v1/drones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "registrationNumber": "DRN-001",
    "manufacturer": "DJI",
    "model": "Matrice 350 RTK",
    "serialNumber": "DJI-M350-001",
    "homeHubId": "<hub-uuid>",
    "maxFlightTime": 55,
    "maxRange": 15000,
    "maxAltitude": 500,
    "maxSpeed": 23,
    "maxPayload": 2.7,
    "communicationProtocol": "dji_sdk"
  }'
```

### 6.2 Drone Status Values

| Status | Description |
|--------|-------------|
| `available` | Ready for mission assignment |
| `in_flight` | Currently executing a flight |
| `charging` | Battery charging |
| `maintenance` | Under maintenance |
| `offline` | Not connected |

### 6.3 Drone Specifications

| Field | Description | Unit |
|-------|-------------|------|
| maxFlightTime | Maximum flight duration | minutes |
| maxRange | Maximum operational range | meters |
| maxAltitude | Maximum altitude capability | meters |
| maxSpeed | Maximum horizontal speed | m/s |
| maxPayload | Maximum payload weight | kg |

### 6.4 Communication Protocols

- `dji_sdk` - DJI SDK integration
- `mavlink` - MAVLink protocol
- `custom_api` - Custom REST/WebSocket API

---

## 7. Flight Operations

### 7.1 Flight Lifecycle

```
planned → authorized → active → completed
                  ↓           ↓
              cancelled    aborted
```

### 7.2 Creating a Flight Plan

```bash
curl -X POST http://localhost:3001/api/v1/flights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "droneId": "<drone-uuid>",
    "departureHubId": "<hub-uuid>",
    "arrivalHubId": "<hub-uuid>",
    "flightType": "delivery",
    "operationMode": "autonomous",
    "plannedDeparture": "2025-01-15T10:00:00Z",
    "plannedArrival": "2025-01-15T11:00:00Z",
    "maxAltitude": 120,
    "minAltitude": 50,
    "missionType": "cargo",
    "payloadWeight": 2.5
  }'
```

### 7.3 Flight Types

| Type | Description |
|------|-------------|
| `delivery` | Cargo/package delivery |
| `inspection` | Infrastructure inspection |
| `surveillance` | Area monitoring |
| `training` | Pilot training flights |
| `test` | Equipment/system testing |

### 7.4 Operation Modes

| Mode | Description |
|------|-------------|
| `autonomous` | Fully automated flight |
| `remote_pilot` | Manual remote control |
| `hybrid` | Mixed automation/manual |

### 7.5 Flight Authorization

```bash
# Request authorization
curl -X POST http://localhost:3001/api/v1/flights/<id>/authorize \
  -H "Authorization: Bearer $TOKEN"

# Start flight (after authorization)
curl -X POST http://localhost:3001/api/v1/flights/<id>/start \
  -H "Authorization: Bearer $TOKEN"

# Complete flight
curl -X POST http://localhost:3001/api/v1/flights/<id>/complete \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. Mission Planning

### 8.1 Mission vs Flight

- **Flight**: A single drone journey from A to B
- **Mission**: A complex operation with multiple waypoints, actions, and conditions

### 8.2 Creating a Mission

```bash
curl -X POST http://localhost:3001/api/v1/missions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Medical Delivery Route A",
    "description": "Hospital supply delivery",
    "departureHubId": "<hub-uuid>",
    "arrivalHubId": "<hub-uuid>",
    "droneId": "<drone-uuid>",
    "waypoints": [
      {
        "sequence": 0,
        "name": "Takeoff",
        "latitude": 37.9838,
        "longitude": 23.7275,
        "altitude": 50
      },
      {
        "sequence": 1,
        "name": "Delivery Point",
        "latitude": 37.9700,
        "longitude": 23.7100,
        "altitude": 30,
        "hoverDuration": 60,
        "actions": [
          {
            "type": "deliver_payload",
            "parameters": {"payload_id": "pkg-001"}
          }
        ]
      },
      {
        "sequence": 2,
        "name": "Return",
        "latitude": 37.9838,
        "longitude": 23.7275,
        "altitude": 50
      }
    ]
  }'
```

### 8.3 Waypoint Actions

| Action Type | Description |
|-------------|-------------|
| `hover` | Hold position for duration |
| `capture_photo` | Take photograph |
| `capture_video` | Record video |
| `deliver_payload` | Release cargo |
| `pickup_payload` | Collect cargo |
| `scan_area` | Survey scan |
| `activate_sensor` | Turn on sensor |
| `deactivate_sensor` | Turn off sensor |

### 8.4 Waypoint Conditions

```json
{
  "conditions": [
    {
      "type": "battery_below",
      "operator": "<",
      "value": 30,
      "action": "rtl",
      "message": "Low battery - returning to launch"
    }
  ]
}
```

| Condition Type | Description |
|----------------|-------------|
| `battery_below` | Battery percentage threshold |
| `battery_above` | Minimum battery required |
| `signal_below` | Signal strength threshold |
| `weather_condition` | Weather-based check |
| `time_elapsed` | Mission duration check |
| `altitude_above` | Altitude limit check |
| `altitude_below` | Minimum altitude check |

### 8.5 Mission Execution

```bash
# Start mission
curl -X POST http://localhost:3001/api/v1/missions/<id>/start \
  -H "Authorization: Bearer $TOKEN"

# Pause mission
curl -X POST http://localhost:3001/api/v1/missions/<id>/pause \
  -H "Authorization: Bearer $TOKEN"

# Resume mission
curl -X POST http://localhost:3001/api/v1/missions/<id>/resume \
  -H "Authorization: Bearer $TOKEN"

# Abort mission
curl -X POST http://localhost:3001/api/v1/missions/<id>/abort \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Weather deterioration"}'
```

### 8.6 Mission Templates

Create reusable mission templates:

```bash
# Create template
curl -X POST http://localhost:3001/api/v1/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard Delivery Route",
    "category": "delivery",
    "description": "Standard delivery mission template",
    "waypoints": [...]
  }'

# Instantiate mission from template
curl -X POST http://localhost:3001/api/v1/templates/<id>/instantiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Delivery to Customer A",
    "droneId": "<drone-uuid>",
    "departureHubId": "<hub-uuid>"
  }'
```

---

## 9. Real-time Monitoring

### 9.1 WebSocket Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/ws', {
  auth: { token: accessToken }
});

// Subscribe to updates
socket.emit('subscribe_drone', { droneId: '<drone-uuid>' });
socket.emit('subscribe_flight', { flightId: '<flight-uuid>' });
socket.emit('subscribe_mission', { missionId: '<mission-uuid>' });
socket.emit('subscribe_emergency');
socket.emit('subscribe_fleet');

// Listen for events
socket.on('telemetry', (data) => console.log('Telemetry:', data));
socket.on('drone_status', (data) => console.log('Status:', data));
socket.on('emergency_detected', (data) => console.log('Emergency:', data));
```

### 9.2 Telemetry Data

```json
{
  "latitude": 37.9838,
  "longitude": 23.7275,
  "altitude": 120,
  "heading": 270,
  "speed": 15.5,
  "batteryLevel": 85,
  "batteryVoltage": 22.8,
  "satellites": 12,
  "signalStrength": 92,
  "flightMode": "AUTO",
  "armed": true
}
```

### 9.3 Conflict Detection

The system automatically detects:

- **Separation violations**: Drones too close to each other
- **Airspace violations**: Entry into restricted zones
- **Geofence breaches**: Crossing operational boundaries
- **Weather conflicts**: Unsafe conditions

```bash
# Get active conflicts
curl http://localhost:3001/api/v1/conflicts/active \
  -H "Authorization: Bearer $TOKEN"

# Resolve a conflict
curl -X POST http://localhost:3001/api/v1/conflicts/<id>/resolve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resolutionStrategy": "Route deviation via corridor ALT-1",
    "actions": ["Rerouted flight to avoid conflict zone"]
  }'
```

### 9.4 Airspace Zones

```bash
# Get zones for a hub
curl http://localhost:3001/api/v1/airspace/zones?hubId=<hub-uuid> \
  -H "Authorization: Bearer $TOKEN"

# Create a temporary restricted zone
curl -X POST http://localhost:3001/api/v1/airspace/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Construction Zone",
    "zoneType": "restricted",
    "status": "temporary",
    "geometry": {
      "coordinates": [
        {"latitude": 37.50, "longitude": 127.02},
        {"latitude": 37.50, "longitude": 127.04},
        {"latitude": 37.49, "longitude": 127.04},
        {"latitude": 37.49, "longitude": 127.02}
      ]
    },
    "altitudeFloor": 0,
    "altitudeCeiling": 150,
    "effectiveStart": "2025-01-15T08:00:00Z",
    "effectiveEnd": "2025-01-15T18:00:00Z"
  }'
```

---

## 10. Emergency Response

### 10.1 Emergency Types

| Type | Severity | Description |
|------|----------|-------------|
| `battery_low` | Warning | Battery below 30% |
| `battery_critical` | Emergency | Battery below 15% |
| `signal_weak` | Warning | Signal degraded |
| `signal_lost` | Critical | No communication |
| `geofence_warning` | Warning | Approaching boundary |
| `geofence_breach` | Critical | Crossed boundary |
| `motor_anomaly` | Warning | Abnormal vibration |
| `motor_failure` | Emergency | Motor malfunction |
| `gps_degraded` | Warning | Poor GPS accuracy |
| `gps_lost` | Critical | No GPS signal |
| `collision_aircraft` | Emergency | Manned aircraft nearby |
| `collision_obstacle` | Critical | Obstacle detected |

### 10.2 Response Actions

| Action | Description |
|--------|-------------|
| `RTH` | Return to home/launch point |
| `LAND` | Land immediately |
| `HOVER` | Hold current position |
| `DIVERT` | Fly to alternate location |
| `DESCEND` | Reduce altitude |
| `CLIMB` | Increase altitude |
| `ESTOP` | Emergency stop (cut motors) |

### 10.3 Emergency Protocols

Protocols define automated responses:

```bash
# View all protocols
curl http://localhost:3001/api/v1/emergency/protocols \
  -H "Authorization: Bearer $TOKEN"

# Update a protocol
curl -X PUT http://localhost:3001/api/v1/emergency/protocols/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requiresConfirmation": false,
    "autoExecuteOnTimeout": true,
    "confirmationTimeoutSeconds": 30
  }'
```

### 10.4 Operating Modes

| Mode | Description |
|------|-------------|
| `auto` | Automatic response execution |
| `supervised` | Requires operator confirmation |

```bash
# Set emergency mode
curl -X PUT http://localhost:3001/api/v1/emergency/config/mode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "supervised"}'
```

### 10.5 Handling Incidents

```bash
# Get pending confirmations
curl http://localhost:3001/api/v1/emergency/incidents/pending \
  -H "Authorization: Bearer $TOKEN"

# Confirm an action
curl -X POST http://localhost:3001/api/v1/emergency/incidents/<id>/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}'

# Reject and specify alternative
curl -X POST http://localhost:3001/api/v1/emergency/incidents/<id>/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": false,
    "alternativeAction": "HOVER"
  }'
```

### 10.6 Post-Incident Analysis

```bash
# Get incident blackbox data
curl http://localhost:3001/api/v1/emergency/incidents/<id>/blackbox \
  -H "Authorization: Bearer $TOKEN"

# Update root cause analysis
curl -X PUT http://localhost:3001/api/v1/emergency/incidents/<id>/root-cause \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rootCause": "weather",
    "rootCauseNotes": "Unexpected wind gusts exceeded limits",
    "lessonsLearned": "Improve weather monitoring frequency"
  }'
```

---

## 11. Fleet Intelligence

### 11.1 Fleet Overview

```bash
curl http://localhost:3001/api/v1/fleet/overview \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "totalDrones": 15,
  "availableDrones": 8,
  "inFlightDrones": 4,
  "chargingDrones": 2,
  "maintenanceDrones": 1,
  "activeMissions": 4,
  "pendingMissions": 12,
  "fleetHealth": 0.87
}
```

### 11.2 Intelligent Drone Assignment

The system scores drones based on multiple factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Proximity | 25% | Distance to mission start |
| Battery | 25% | Available charge |
| Capability | 20% | Meets mission requirements |
| Utilization | 15% | Current workload balance |
| Maintenance | 15% | Time since last service |

```bash
# Auto-assign drone to mission
curl -X POST http://localhost:3001/api/v1/fleet/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "missionId": "<mission-uuid>",
    "preferredHubId": "<hub-uuid>"
  }'
```

### 11.3 Fleet Rebalancing

Move drones between hubs to optimize coverage:

```bash
# Analyze rebalancing needs
curl http://localhost:3001/api/v1/fleet/rebalancing/analyze \
  -H "Authorization: Bearer $TOKEN"

# Create rebalancing task
curl -X POST http://localhost:3001/api/v1/fleet/rebalancing \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceHubId": "<hub-uuid>",
    "targetHubId": "<hub-uuid>",
    "droneId": "<drone-uuid>",
    "priority": 2,
    "trigger": "manual"
  }'

# Approve and execute
curl -X POST http://localhost:3001/api/v1/fleet/rebalancing/<id>/approve \
  -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3001/api/v1/fleet/rebalancing/<id>/execute \
  -H "Authorization: Bearer $TOKEN"
```

### 11.4 Fleet Configuration

```bash
# Get current configuration
curl http://localhost:3001/api/v1/fleet/config \
  -H "Authorization: Bearer $TOKEN"

# Create custom configuration
curl -X POST http://localhost:3001/api/v1/fleet/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rush Hour Mode",
    "scoringWeights": {
      "proximity": 0.35,
      "battery": 0.25,
      "capability": 0.15,
      "utilization": 0.15,
      "maintenance": 0.10
    }
  }'
```

---

## 12. Device Connectivity

### 12.1 Registering Devices

```bash
# Register a new device
curl -X POST http://localhost:3001/api/v1/connectivity/devices/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIdentifier": "DRONE-001",
    "droneId": "<drone-uuid>",
    "hubId": "<hub-uuid>",
    "protocol": "websocket"
  }'
```

### 12.2 Certificate Authentication

```bash
# Generate device certificate
curl -X POST http://localhost:3001/api/v1/connectivity/devices/<id>/certificate \
  -H "Authorization: Bearer $TOKEN"

# Download certificate bundle
curl http://localhost:3001/api/v1/connectivity/devices/<id>/certificate \
  -H "Authorization: Bearer $TOKEN" \
  --output device-cert.zip

# Get CA certificate (public)
curl http://localhost:3001/api/v1/connectivity/ca-certificate \
  --output ca-cert.pem
```

### 12.3 Device Connection (WebSocket)

```javascript
// Device-side connection
const socket = io('http://localhost:3001/ws');

// Authenticate with certificate
socket.emit('device_connect', {
  authMethod: 'certificate',
  certificateFingerprint: '<fingerprint>'
});

// Or authenticate with token
socket.emit('device_connect', {
  deviceIdentifier: 'DRONE-001',
  authMethod: 'token',
  token: '<device-token>'
});

// Send telemetry
socket.emit('device_telemetry', {
  latitude: 37.9838,
  longitude: 23.7275,
  altitude: 120,
  heading: 270,
  speed: 15.5,
  batteryLevel: 85
});

// Receive commands
socket.on('device_command', (command) => {
  console.log('Command received:', command);
  // Execute command...
  socket.emit('device_command_ack', {
    commandId: command.commandId,
    status: 'completed'
  });
});
```

### 12.4 Sending Commands

```bash
# Send command to drone
curl -X POST http://localhost:3001/api/v1/drones/<droneId>/commands \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commandType": "rtl",
    "priority": 1,
    "timeoutMs": 5000
  }'

# Command types: takeoff, land, rtl, emergency_stop, pause, hover, resume
```

---

## 13. Simulation & Testing

### 13.1 Overview

The simulation module allows testing of drone operations without real hardware. It provides:

- Physics-based flight simulation
- Realistic telemetry generation
- Emergency scenario injection
- Time-scale control

### 13.2 Starting a Simulation

```bash
# With manual waypoints
curl -X POST http://localhost:3001/api/v1/simulation/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "droneId": "<drone-uuid>",
    "manualWaypoints": [
      {"latitude": 37.9838, "longitude": 23.7275, "altitude": 50, "sequence": 0},
      {"latitude": 37.9700, "longitude": 23.7100, "altitude": 80, "sequence": 1},
      {"latitude": 37.9600, "longitude": 23.6900, "altitude": 50, "sequence": 2}
    ],
    "timeScale": 3.0
  }'

# With existing mission
curl -X POST http://localhost:3001/api/v1/simulation/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "droneId": "<drone-uuid>",
    "missionId": "<mission-uuid>",
    "timeScale": 5.0
  }'
```

### 13.3 Emergency Scenarios

```bash
# Start with emergency scenario
curl -X POST http://localhost:3001/api/v1/simulation/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "droneId": "<drone-uuid>",
    "manualWaypoints": [...],
    "scenario": "battery_critical",
    "scenarioConfig": {
      "trigger": {
        "type": "time",
        "value": 30
      }
    }
  }'

# Inject scenario mid-flight
curl -X POST http://localhost:3001/api/v1/simulation/sessions/<id>/inject-scenario \
  -H "Content-Type: application/json" \
  -d '{"scenario": "motor_failure"}'
```

### 13.4 Available Scenarios

| Scenario | Description |
|----------|-------------|
| `normal` | Normal flight operation |
| `battery_critical` | Rapid battery drain |
| `motor_failure` | Erratic movement, forced landing |
| `gps_loss` | Position drift |
| `geofence_breach` | Boundary warning |
| `comm_loss` | Telemetry stops temporarily |

### 13.5 Controlling Simulations

```bash
# Pause
curl -X PATCH http://localhost:3001/api/v1/simulation/sessions/<id>/pause

# Resume
curl -X PATCH http://localhost:3001/api/v1/simulation/sessions/<id>/resume

# Change speed (0.1x to 10x)
curl -X PATCH http://localhost:3001/api/v1/simulation/sessions/<id>/time-scale \
  -H "Content-Type: application/json" \
  -d '{"timeScale": 10.0}'

# Stop
curl -X POST http://localhost:3001/api/v1/simulation/sessions/<id>/stop
```

### 13.6 Flight Phases

Simulated flights progress through these phases:

```
idle → preflight → takeoff → climb → waypoint_nav → approach → landing → landed
                                          ↓
                                      emergency
```

---

## 14. API Reference

### 14.1 Base URL

```
http://localhost:3001/api/v1
```

### 14.2 Authentication

All endpoints (except auth and health) require:
```
Authorization: Bearer <accessToken>
```

### 14.3 Endpoint Summary

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | `/auth/login`, `/auth/register` | Authentication |
| Users | `/users/*` | User management |
| Organizations | `/organizations/*` | Organization management |
| Hubs | `/hubs/*` | Hub CRUD |
| Drones | `/drones/*` | Drone fleet management |
| Flights | `/flights/*` | Flight operations |
| Missions | `/missions/*` | Mission planning |
| Templates | `/templates/*` | Mission templates |
| Telemetry | `/telemetry/*` | Telemetry data |
| Airspace | `/airspace/*` | Zone management |
| Weather | `/weather/*` | Weather data |
| Conflicts | `/conflicts/*` | Conflict detection |
| Alerts | `/alerts/*` | Alert management |
| Emergency | `/emergency/*` | Emergency response |
| Fleet | `/fleet/*` | Fleet intelligence |
| Connectivity | `/connectivity/*` | Device management |
| Commands | `/drones/:id/commands/*` | Drone commands |
| Simulation | `/simulation/*` | Flight simulation |
| Health | `/health` | Service health |

### 14.4 Swagger Documentation

Access interactive API documentation at:
```
http://localhost:3001/api/docs
```

---

## 15. WebSocket Events

### 15.1 Connection

```javascript
const socket = io('http://localhost:3001/ws');
```

### 15.2 Subscription Events

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe_drone` | `{droneId}` | Drone updates |
| `subscribe_flight` | `{flightId}` | Flight updates |
| `subscribe_mission` | `{missionId}` | Mission updates |
| `subscribe_hub` | `{hubId}` | Hub updates |
| `subscribe_fleet` | - | Fleet-wide updates |
| `subscribe_emergency` | - | Emergency alerts |

### 15.3 Broadcast Events

| Event | Description |
|-------|-------------|
| `telemetry` | Real-time drone telemetry |
| `drone_status` | Drone state changes |
| `drone_alert` | Drone alerts |
| `flight_update` | Flight state changes |
| `mission_status` | Mission lifecycle |
| `waypoint_reached` | Waypoint completion |
| `emergency_detected` | Emergency triggered |
| `emergency_action_required` | Confirmation needed |
| `emergency_resolved` | Incident closed |
| `fleet_overview` | Fleet statistics |
| `assignment_update` | Drone assignments |
| `conflict_detected` | Conflict alert |

---

## 16. Troubleshooting

### 16.1 Common Issues

#### Authentication Failed
```
{"message":"Unauthorized","statusCode":401}
```
**Solution**: Token expired. Re-login to get a new token.

#### Drone Already Has Active Simulation
```
{"message":"Drone already has an active simulation","statusCode":400}
```
**Solution**: Stop or delete the existing simulation first.

#### Mission Required Fields
```
{"message":"Internal server error","statusCode":500}
```
**Solution**: Ensure `departureHubId` is provided when creating missions.

### 16.2 Health Check

```bash
curl http://localhost:3001/health
```

### 16.3 Logs

Check server logs for detailed error information:
```bash
npm run dev  # Development mode with verbose logging
```

### 16.4 Database Reset

```bash
# Delete SQLite database and restart
rm backend/data/drops-utm.db
npm run dev
npm run seed  # Re-seed data
```

---

## Appendix A: Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | 3001 | API server port |
| `JWT_SECRET` | - | JWT signing secret |
| `DATABASE_PATH` | data/drops-utm.db | SQLite database path |
| `WS_CORS_ORIGIN` | http://localhost:3005 | WebSocket CORS origin |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **AGL** | Above Ground Level |
| **MSL** | Mean Sea Level |
| **RTH** | Return To Home |
| **RTL** | Return To Launch |
| **ESTOP** | Emergency Stop |
| **Geofence** | Virtual boundary for drone operations |
| **Waypoint** | GPS coordinate in a flight path |
| **Hub** | Drone operations center |
| **Telemetry** | Real-time drone data transmission |

---

**Document Version**: 1.0
**Last Updated**: February 2025
**DROPS UTM System**: Version 0.1.0
