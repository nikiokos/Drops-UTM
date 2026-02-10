# Drops UTM

A comprehensive Drone Fleet Management and Unmanned Traffic Management (UTM) system for real-time monitoring, mission planning, and fleet operations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)

## Features

### Core Capabilities
- **Real-time Telemetry** - Live drone tracking with WebSocket streaming at 10Hz
- **Mission Planning** - Visual waypoint editor with altitude profiles and scheduling
- **Fleet Management** - Multi-drone orchestration with intelligent assignment
- **Conflict Detection** - Automatic collision avoidance and airspace deconfliction
- **Emergency Response** - Automated incident handling with configurable protocols

### Advanced Features
- **Physics-based Simulation** - Test scenarios without real hardware
- **Multi-Protocol Connectivity** - WebSocket, MQTT, MAVLink support
- **Airspace Management** - Geofencing, no-fly zones, and restricted areas
- **Weather Integration** - Real-time conditions affecting flight operations
- **Fleet Intelligence** - Predictive analytics and optimization

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│              Next.js 14 + React + Tailwind                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST + WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                        Backend                               │
│                   NestJS + TypeORM                          │
├─────────────────────────────────────────────────────────────┤
│  Modules: Auth, Hubs, Drones, Missions, Flights, Telemetry  │
│  Emergency, Fleet, Connectivity, Simulation, Weather        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                       Database                               │
│              SQLite (dev) / PostgreSQL (prod)               │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/nikiokos/Drops-UTM.git
cd Drops-UTM

# Install dependencies
npm install

# Start backend (Terminal 1)
cd backend
cp .env.example .env
npm run dev

# Start frontend (Terminal 2)
cd frontend
cp .env.example .env.local
npm run dev
```

### Default Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@drops-utm.com | password123 | Administrator |
| pilot@drops-utm.com | password123 | Pilot |
| operator@drops-utm.com | password123 | Hub Operator |

## API Overview

The backend exposes 147+ REST endpoints across these modules:

| Module | Endpoints | Description |
|--------|-----------|-------------|
| `/auth` | 4 | Authentication & registration |
| `/hubs` | 6 | Hub management |
| `/drones` | 8 | Drone fleet operations |
| `/missions` | 12 | Mission planning & execution |
| `/flights` | 10 | Flight operations |
| `/telemetry` | 6 | Real-time telemetry |
| `/simulation` | 9 | Physics-based simulation |
| `/emergency` | 15 | Incident management |
| `/fleet` | 12 | Fleet orchestration |
| `/connectivity` | 10 | Device connectivity |

Full API documentation available in [docs/USER_MANUAL.md](docs/USER_MANUAL.md).

## WebSocket Events

Real-time updates via Socket.IO:

```typescript
// Connect to WebSocket
const socket = io('http://localhost:3001/ws', {
  auth: { token: 'your-jwt-token' }
});

// Subscribe to drone telemetry
socket.on('telemetry:update', (data) => {
  console.log('Position:', data.latitude, data.longitude);
  console.log('Altitude:', data.altitude);
  console.log('Battery:', data.batteryLevel);
});

// Subscribe to alerts
socket.on('alert:new', (alert) => {
  console.log('Alert:', alert.type, alert.message);
});
```

## Simulation

Test your system with the physics-based drone simulator:

```bash
# Start a simulation session
curl -X POST http://localhost:3001/simulation/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "droneId": "drone-uuid",
    "missionId": "mission-uuid",
    "timeScale": 2.0
  }'

# Inject emergency scenario
curl -X POST http://localhost:3001/simulation/sessions/{id}/inject-scenario \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scenario": "battery_critical"}'
```

Available scenarios: `battery_critical`, `motor_failure`, `gps_loss`, `geofence_breach`, `comm_loss`

## Docker Deployment

```bash
# Build and run all services
docker-compose up -d

# Services:
# - Backend:  http://localhost:3001
# - Frontend: http://localhost:3000
# - Postgres: localhost:5432
# - MQTT:     localhost:1883
```

## Project Structure

```
Drops-UTM/
├── backend/                 # NestJS API server
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/       # JWT authentication
│   │   │   ├── drones/     # Drone management
│   │   │   ├── missions/   # Mission planning
│   │   │   ├── simulation/ # Physics simulation
│   │   │   └── ...
│   │   ├── gateways/       # WebSocket handlers
│   │   └── common/         # Guards, decorators, filters
│   └── data/               # SQLite database
├── frontend/               # Next.js application
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   ├── store/         # Zustand state management
│   │   └── lib/           # Utilities & API client
├── shared/                 # Shared TypeScript types
├── docker/                 # Docker configurations
└── docs/                   # Documentation
```

## Documentation

- [User Manual](docs/USER_MANUAL.md) - Comprehensive guide for all features
- [API Reference](docs/USER_MANUAL.md#16-api-reference) - Complete endpoint documentation
- [Connectivity Design](docs/plans/2026-02-06-drone-connectivity-design.md) - Protocol architecture
- [Emergency Response](docs/plans/2026-02-06-emergency-response-design.md) - Emergency system design

## Tech Stack

**Backend:**
- NestJS 10
- TypeORM
- Socket.IO
- JWT Authentication
- SQLite / PostgreSQL

**Frontend:**
- Next.js 14
- React 18
- Tailwind CSS
- Zustand
- Leaflet Maps

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

---

Built with Claude Code
