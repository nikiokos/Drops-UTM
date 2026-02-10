# Drone Connectivity Architecture Design

## Overview

This document describes the architecture for connecting real drones to the DROPS UTM system, supporting multiple drone types, connection methods, and protocols.

## Requirements

- **Drone Types**: Commercial (DJI, Skydio), DIY (ArduPilot, PX4), Enterprise (Wingcopter, Matternet)
- **Connectivity**: Direct cellular, Edge gateways, Ground control stations
- **Protocols**: WebSocket, MQTT, MAVLink, REST APIs
- **Security**: mTLS for devices, JWT fallback for pilots
- **Telemetry**: Adaptive frequency (30s idle → 100ms emergency)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DROPS UTM CLOUD                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PROTOCOL GATEWAY SERVICE                      │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │   │
│  │  │ WebSocket │  │   MQTT    │  │  MAVLink  │  │   REST    │    │   │
│  │  │  Adapter  │  │  Adapter  │  │  Adapter  │  │  Adapter  │    │   │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘    │   │
│  │        └──────────────┴──────────────┴──────────────┘           │   │
│  │                           ▼                                      │   │
│  │              ┌─────────────────────────┐                        │   │
│  │              │  Normalized Telemetry   │                        │   │
│  │              │       Message Bus       │                        │   │
│  │              └───────────┬─────────────┘                        │   │
│  └──────────────────────────┼──────────────────────────────────────┘   │
│                             ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Existing UTM Services (Telemetry, Emergency, Conflicts, etc.)   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ mTLS               │ mTLS               │ JWT
    Direct Drone         Edge Gateway         Ground Station
```

## Protocol Adapters

### WebSocket Adapter
- Primary for browser-based GCS and modern drones
- Bidirectional, real-time commands and telemetry
- Extends existing Socket.io gateway

### MQTT Adapter
- Lightweight pub/sub for IoT-style drones
- Topics: `drone/{id}/telemetry`, `drone/{id}/command`, `drone/{id}/status`
- QoS levels: 0 for telemetry, 1 for commands

### MAVLink Adapter
- Native protocol for ArduPilot/PX4 drones
- UDP listener for direct connections
- Translates MAVLink messages to internal format

### REST Adapter
- For enterprise drones with cloud APIs
- Polling or webhook-based telemetry ingestion
- OAuth2 for third-party API authentication

## Normalized Message Format

```typescript
interface DroneMessage {
  droneId: string;
  timestamp: Date;
  source: 'direct' | 'gateway' | 'gcs';
  protocol: 'websocket' | 'mqtt' | 'mavlink' | 'rest';
  type: 'telemetry' | 'status' | 'event' | 'command_ack';
  payload: TelemetryData | StatusData | EventData;
}
```

## Authentication

### Device Registration Flow
1. Operator registers drone in UTM admin portal
2. UTM creates device record and generates certificate
3. Operator downloads certificate and provisions drone
4. Drone connects with mTLS certificate
5. UTM validates certificate and establishes session

### mTLS Certificates
- UTM acts as Certificate Authority (CA)
- Each drone gets unique client certificate
- Common Name: `drone-{registration_number}`
- Custom extensions: `droneId`, `hubId`, `capabilities`
- 1-year expiry with renewal mechanism

### JWT Fallback (for GCS)
```typescript
interface DroneSessionToken {
  sub: string;        // pilot user ID
  droneId: string;    // drone being controlled
  scope: 'monitor' | 'control' | 'emergency';
  hubId?: string;
  exp: number;        // 1 hour expiry
}
```

## Adaptive Telemetry

| Mode | Frequency | Trigger |
|------|-----------|---------|
| Idle | 30 sec | Drone on ground |
| Normal | 2 sec | Standard flight |
| Enhanced | 500ms | Near geofence, traffic nearby |
| Emergency | 100ms | Active incident, low battery |

Mode transitions are calculated by UTM and pushed to drone/gateway.

## Edge Gateway

Local device that aggregates multiple drones:

- **Offline resilience**: Continues monitoring if UTM disconnects
- **Telemetry aggregation**: Batches updates from multiple drones
- **Local command relay**: Low-latency forwarding
- **Pre-configured emergency actions**: RTH/land if UTM offline

## Command & Control

### Command Priorities
| Priority | Commands | Timeout |
|----------|----------|---------|
| P0 | ESTOP, LAND_NOW | 100-500ms |
| P1 | RTH, HOVER | 1s |
| P2 | GOTO, SET_ALTITUDE | 2s |
| P3 | UPDATE_MISSION, SET_TELEMETRY_MODE | 5s |

### Acknowledgment Flow
1. UTM sends command with unique ID
2. Gateway forwards to drone
3. Drone executes and sends ACK
4. Gateway relays ACK to UTM
5. UTM logs result

Retry logic with configurable max retries and fallback commands.

## Implementation Files

### New Files
```
backend/src/modules/connectivity/
├── connectivity.module.ts
├── protocol-gateway.service.ts
├── adapters/
│   ├── websocket.adapter.ts
│   ├── mqtt.adapter.ts
│   ├── mavlink.adapter.ts
│   └── rest.adapter.ts
├── auth/
│   ├── device-certificate.service.ts
│   ├── device-token.service.ts
│   └── device-registry.service.ts
├── telemetry/
│   ├── adaptive-rate.service.ts
│   └── message-normalizer.service.ts
├── commands/
│   ├── command-router.service.ts
│   └── command-queue.service.ts
└── entities/
    ├── device-registration.entity.ts
    └── device-certificate.entity.ts
```

### Modified Files
- `app.module.ts` - Import ConnectivityModule
- `telemetry.service.ts` - Real vs simulated source check
- `events.gateway.ts` - Device connections
- `drone.entity.ts` - Connection status fields
- `flights.service.ts` - Real telemetry updates

## Implementation Order

1. Device registration & certificate management
2. WebSocket adapter (extend existing)
3. Message normalizer & telemetry integration
4. Command router with acknowledgment
5. MQTT adapter
6. MAVLink adapter
7. Edge gateway protocol
8. REST adapter for enterprise APIs
