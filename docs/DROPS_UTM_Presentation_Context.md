# DROPS UTM - Technology Presentation Context

## Executive Summary

**DROPS UTM** (Unmanned Traffic Management) is an enterprise-grade, full-stack platform for managing drone operations across a distributed network of Smart Hubs. It functions as a digital air traffic control system for unmanned aerial vehicles, enabling safe, efficient, and scalable drone operations with real-time monitoring, intelligent fleet management, and automated emergency response.

---

## 1. What is DROPS UTM?

### The Problem
As drone operations scale globally - for deliveries, inspections, surveillance, and logistics - managing multiple drones across multiple locations becomes a critical safety challenge. Traditional air traffic management systems were designed for manned aviation and cannot handle the volume, speed, and autonomy requirements of drone fleets.

### The Solution
DROPS UTM provides a **hub-and-spoke model** where:
- Each physical location (vertiport/hub) operates as a **mini control tower** managing its local airspace
- A **central command center** maintains real-time oversight of all operations across all hubs
- **Automated safety systems** detect conflicts, trigger emergency responses, and optimize fleet distribution
- **Multi-protocol support** enables integration with drones from any manufacturer

### Key Value Propositions
- **Safety-first design**: Conflict detection, emergency response, geofencing
- **Operational efficiency**: Smart fleet assignment, automated rebalancing, mission planning
- **Scalability**: Unlimited hubs, variable drone capacity per location
- **Manufacturer-agnostic**: MAVLink, DJI SDK, and custom API protocols supported
- **Real-time visibility**: Sub-second telemetry streaming across the entire fleet

---

## 2. System Architecture

### Distributed Hub-Tower Model

```
                    +---------------------------+
                    |   Central Command (C3)    |
                    |   Real-time Oversight      |
                    |   Fleet Intelligence       |
                    +---------------------------+
                   /        |        |         \
                  /         |        |          \
    +----------+  +----------+  +----------+  +----------+
    | Hub ATH  |  | Hub SKG  |  | Hub HER  |  | Hub PAT  |
    | Athens   |  | Thessal. |  | Heraklion|  | Patras   |
    | 3 Drones |  | 2 Drones |  | 2 Drones |  | 1 Drone  |
    +----------+  +----------+  +----------+  +----------+
        |              |             |              |
     Airspace       Airspace      Airspace       Airspace
     Control        Control       Control        Control
```

### Core Components
| Component | Purpose |
|-----------|---------|
| **Hub Control System (HCS)** | Local airspace management at each hub |
| **Central Command & Control (C3)** | Master oversight and coordination |
| **Flight Management Service** | Planning, authorization, and scheduling |
| **Real-time Tracking Engine** | Position monitoring and telemetry (10Hz) |
| **Conflict Detection & Resolution** | Automated collision avoidance |
| **Communication Gateway** | Multi-protocol drone integration layer |
| **Weather & Environment Service** | Real-time conditions and flight safety |
| **Emergency Response System** | Automated incident management |
| **Fleet Intelligence** | Predictive analytics and optimization |

### Monorepo Structure
```
Drops-UTM/
├── backend/       NestJS API Server (21 modules, 24 entities)
├── frontend/      Next.js Dashboard (20+ pages, 44 components)
├── shared/        Shared TypeScript types & enums
├── docker/        Docker configurations (Redis, MQTT, PostgreSQL)
└── docs/          Documentation & design plans
```

---

## 3. Technology Stack

### Frontend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Next.js** | React framework with SSR/App Router | 15.1.0 |
| **React** | UI component library | 19.0.0 |
| **TypeScript** | Type-safe development | 5.7.2 |
| **Tailwind CSS** | Utility-first styling | 3.4.17 |
| **Shadcn/ui + Radix UI** | Accessible component library | 1.1+ |
| **Zustand** | Lightweight state management | 5.0.2 |
| **TanStack React Query** | Server state & caching | 5.62.8 |
| **Leaflet + React-Leaflet** | Interactive mapping | 1.9.4 + 5.0.0 |
| **Recharts** | Data visualization / charts | 2.15.0 |
| **Socket.IO Client** | Real-time WebSocket communication | 4.8.1 |
| **Axios** | HTTP client with JWT interceptors | 1.7.9 |
| **Lucide React** | Icon system | - |

### Backend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **NestJS** | Scalable server framework | 10.4.15 |
| **TypeORM** | Database ORM | 0.3.20 |
| **PostgreSQL** | Production database | - |
| **SQLite** | Development database | - |
| **Redis (ioredis)** | Caching & pub/sub | 5.4.2 |
| **Socket.IO** | WebSocket gateway | 4.8.1 |
| **Passport + JWT** | Authentication | 10.2.0 |
| **Helmet** | HTTP security headers | 8.0.0 |
| **Swagger** | API documentation | 8.1.0 |
| **class-validator** | Request validation | 0.14.1 |

### Communication Protocols
| Protocol | Use Case |
|----------|----------|
| **WebSocket (Socket.IO)** | Real-time telemetry, status updates, alerts |
| **REST API** | CRUD operations, flight management |
| **MQTT** | IoT-grade drone communication |
| **MAVLink** | ArduPilot/PX4 autopilot integration |
| **DJI SDK** | DJI fleet integration |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Docker + Docker Compose** | Containerization |
| **Node.js 20+** | Runtime |
| **npm Workspaces** | Monorepo management |
| **Jest** | Testing framework |
| **ESLint + Prettier** | Code quality |

---

## 4. Key Features (Presentation Slides)

### Slide: Real-time Operations Dashboard
- **Tactical Map**: Live drone positions, flight paths, hub locations, airspace zones
- **Statistics Widgets**: Active flights, online hubs, fleet count, conflict alerts
- **Flight Log**: Real-time activity feed
- **System Diagnostics**: Health checks and connectivity
- **Theme**: Dark and light mode with radar-sweep animation

### Slide: Flight Management
- **Flight Lifecycle**: Planned -> Authorized -> Active -> Completed
- **Flight Types**: Delivery, Inspection, Surveillance, Training, Test
- **Operation Modes**: Autonomous, Remote Pilot, Hybrid
- **Real-time Tracking**: Position, altitude, speed, battery, heading
- **Authorization Workflow**: Approval before flight execution

### Slide: Mission Planning & Automation
- **Visual Waypoint Editor**: Coordinate-based mission design with altitude profiles
- **Waypoint Actions**: Photo capture, video recording, survey scanning
- **Conditional Execution**: Altitude-based, distance-based triggers
- **Scheduling**: Manual, scheduled, or event-triggered missions
- **Templates**: Reusable mission templates with versioning
- **Custom Altitude Profile Chart**: SVG-based visualization of flight altitude

### Slide: Fleet Intelligence
- **Smart Drone Assignment**: Multi-criteria scoring (proximity, battery, capability, utilization, maintenance)
- **Fleet Rebalancing**: Automatic drone redistribution between hubs
- **Configuration Modes**:
  - Efficiency Mode: Maximize mission throughput
  - Balanced Mode: Balanced approach to all factors
  - Fleet Health Mode: Prioritize drone longevity
- **Hub Capacity Monitoring**: Visual utilization bars per hub
- **Predictive Load Balancing**: Anticipate demand and reposition proactively

### Slide: Emergency Response System
- **Dual-Mode Operation**:
  - **Auto Mode**: System executes responses immediately
  - **Supervised Mode**: Operator confirms critical actions
- **15+ Emergency Types**: Battery low, signal lost, collision, weather, motor failure, GPS degradation, geofence breach...
- **Response Actions**: Return to Home (RTH), Land, Hover, Divert, Emergency Stop
- **Escalation Chain**: Auto-detect -> Confirm -> Execute -> Log -> Investigate
- **Incident Investigation**: Timeline, blackbox data, root cause analysis, lessons learned
- **Emergency Protocols**: Configurable rules with fallback actions and timeouts

### Slide: Conflict Detection & Resolution
- **Automated Detection**: Real-time monitoring of drone-to-drone separation
- **Severity Classification**: Low, Medium, High, Critical
- **Conflict Types**: Collision risk, airspace violation, separation minimum, weather, equipment failure
- **Resolution Workflow**: Detect -> Assess -> Resolve -> Document
- **False Alarm Tracking**: Reduce noise from non-threats

### Slide: Airspace Management
- **Zone Types**: Controlled, Restricted, Prohibited, Warning, Corridor
- **3D Boundaries**: Altitude floor and ceiling per zone
- **Visual Overlay**: Map polygons and circles for geofences
- **Priority System**: Numeric priority for conflict resolution
- **Dynamic Status**: Active vs. temporary zones

### Slide: Weather Integration
- **Real-time Data**: Open-Meteo API with per-hub monitoring
- **Flight Category Assessment**: VFR, MVFR, IFR, LIFR
- **Metrics**: Temperature, wind speed/direction, visibility, humidity, pressure, cloud cover
- **Safety Decision Support**: Automated flight condition warnings
- **Auto-refresh**: Every 60 seconds

### Slide: Real-time Control Center
- **Live Tactical Map**: Drone positions with heading and telemetry overlay
- **Telemetry Gauges**: Circular SVG displays for altitude, speed, battery, heading
- **Command Panel**: Takeoff, Land, Return to Home, Hover, Emergency Stop
- **Command Queue**: Priority-based delivery (Critical > High > Normal > Low)
- **Alert Panel**: Real-time alerts with acknowledgment workflow

### Slide: Device Connectivity & Multi-Protocol Support
- **Device Registration**: Drones, Gateways, Ground Control Stations
- **Certificate Management**: X.509 PKI for secure device authentication
- **Adaptive Telemetry Modes**:
  - Idle: Power save mode
  - Normal: Standard 10Hz rate
  - Enhanced: 30Hz during critical operations
  - Emergency: Maximum frequency
- **Protocol Support**: WebSocket, MAVLink, DJI SDK, REST API
- **Connection Monitoring**: Real-time online/offline status

---

## 5. Data Architecture

### Domain Model (Core Entities)

```
Organization
  └── Users (admin, hub_operator, pilot, observer, regulatory)
  └── Hubs (vertiports with airspace definitions)
       └── Drones (registered fleet per hub)
            └── Device Registrations (certificates, protocols)
            └── Flights (planned and active operations)
                 └── Telemetry (real-time position/sensor data)
                 └── Commands (control instructions)
                 └── Alerts (operational warnings)
       └── Airspace Zones (geofences and restrictions)
       └── Weather Data (per-hub conditions)
  └── Missions (automated waypoint-based operations)
       └── Waypoints (coordinates, actions, conditions)
       └── Mission Executions (tracking per run)
       └── Templates (reusable mission patterns)
  └── Conflicts (airspace violation detection)
  └── Emergency Incidents (safety events)
       └── Protocols (response rules)
       └── Blackbox Data (flight recorder)
  └── Fleet Management
       └── Assignments (smart drone selection)
       └── Rebalancing Tasks (redistribution)
```

### Key Enumerations
| Entity | Values |
|--------|--------|
| **Hub Status** | active, maintenance, offline |
| **Drone Status** | available, in_flight, charging, maintenance, retired |
| **Flight Status** | planned, authorized, pre_flight, active, completed, cancelled, emergency |
| **Flight Type** | delivery, inspection, surveillance, training, test |
| **Zone Type** | controlled, restricted, prohibited, warning, corridor |
| **Emergency Type** | battery_low, signal_lost, collision, weather, motor_failure, GPS_lost, geofence_breach... |
| **Response Action** | RTH, LAND, HOVER, DIVERT, DESCEND, CLIMB, ESTOP, NONE |
| **User Role** | admin, hub_operator, pilot, observer, regulatory |

### Real-time Data Flow

```
Drone (MAVLink/DJI/API)
  |
  v
Backend Gateway (Socket.IO + MQTT)
  |
  ├── Telemetry Store (position, battery, speed)
  ├── Conflict Engine (separation monitoring)
  ├── Emergency Detector (threshold checks)
  └── Command Router (priority queue)
  |
  v
Frontend WebSocket Client
  |
  ├── Zustand Stores (client state)
  ├── Map Visualization (Leaflet markers)
  ├── Telemetry Gauges (SVG rendering)
  └── Alert Notifications (toast/banner)
```

---

## 6. Security Architecture

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | JWT Bearer tokens with refresh |
| **Authorization** | Role-based access control (5 roles) |
| **API Security** | Helmet HTTP headers, CORS, input validation |
| **Device Auth** | X.509 certificate-based PKI |
| **Data Validation** | class-validator on all API inputs |
| **Token Management** | Auto-refresh, auto-logout on expiry |

---

## 7. User Workflows

### Flight Operations
```
Create Flight -> Authorize -> Start -> Monitor (real-time) -> Complete/Abort
                                          |
                                    Emergency? -> Auto/Manual Response -> Investigate
```

### Emergency Response
```
Incident Detected -> Classify Severity -> [Auto Mode: Execute | Supervised: Confirm]
     -> Execute Response Action -> Log Timeline -> Root Cause Analysis -> Lessons Learned
```

### Fleet Rebalancing
```
Analyze Hub Capacity -> Identify Imbalance -> Generate Recommendation
     -> Operator Approval -> Create Repositioning Mission -> Execute -> Complete
```

### Mission Lifecycle
```
Design Waypoints -> Configure Actions/Conditions -> Assign Drone -> Schedule
     -> Execute -> Track Progress -> Log Results -> Analyze
```

---

## 8. Development & Deployment

### Development Setup
```bash
npm install                 # Install all workspace dependencies
npm run docker:up           # Start Redis + MQTT
npm run db:migrate          # Run database migrations
npm run db:seed             # Seed development data
npm run dev                 # Frontend (port 3005) + Backend (port 3001)
```

### Seed Data (Development)
- **5 Hubs**: Athens, Thessaloniki, Heraklion, Patras, Rhodes
- **8 Drones**: DJI Matrice 350, Wingcopter W198, Ehang EH216-S, Joby S4, DJI FlyCart 30, Volocopter VoloDrone, Skydio X10, Zipline P2
- **8 Flights**: Various states and mission types
- **5 Airspace Zones**: Airport CTR, restricted areas, corridors, no-fly zones
- **6 Emergency Protocols**: Battery, signal, geofence, proximity, GPS
- **7+ Emergency Incidents**: Mix of resolved and active for demonstration

### API Documentation
- **Swagger UI** available at `/api/docs`
- **147+ REST endpoints** across 18 feature modules
- **WebSocket events** for real-time subscriptions

---

## 9. Project Statistics

| Metric | Count |
|--------|-------|
| **Backend Modules** | 21 |
| **Database Entities** | 24 |
| **REST Endpoints** | 147+ |
| **Frontend Pages** | 20+ |
| **React Components** | 44 |
| **Zustand Stores** | 11 |
| **API Client Functions** | 791 lines |
| **Shared Type Files** | 10+ |
| **Configuration Files** | 19 |

---

## 10. Competitive Differentiators

1. **Hub-Centric Architecture**: Each hub is an autonomous control tower, not just a point on a map
2. **Dual-Mode Emergency Response**: Auto and supervised modes for different operational contexts
3. **Smart Fleet Intelligence**: AI-driven assignment and predictive rebalancing
4. **Manufacturer-Agnostic**: Multi-protocol support (MAVLink, DJI, Custom)
5. **Adaptive Telemetry**: Dynamic data rates based on flight conditions (10Hz to 30Hz+)
6. **Certificate-Based Device Auth**: Enterprise-grade X.509 PKI for drone authentication
7. **Full Incident Lifecycle**: Detection -> Response -> Investigation -> Lessons Learned
8. **Open Architecture**: TypeScript monorepo with shared types between frontend/backend
9. **Real-time at Scale**: WebSocket + MQTT for sub-second updates across the fleet
10. **Comprehensive Safety Stack**: Conflict detection + geofencing + weather + emergency response

---

## 11. Future Roadmap (from Architecture Document)

- **Mobile Apps**: Flutter-based pilot/operator apps
- **3D Airspace Visualization**: Mapbox GL JS or Cesium for volumetric airspace
- **GraphQL API**: Complex query support alongside REST
- **Kubernetes Deployment**: Production-grade orchestration
- **Advanced Analytics**: D3.js visualizations, predictive models
- **Regulatory Compliance**: CAA/EU reporting module
- **STANAG 4586**: NATO interoperability standard (optional)
- **Message Queues**: RabbitMQ/Kafka for inter-service communication

---

## 12. Presentation Talking Points

### For Technical Audiences
- Full TypeScript monorepo with shared types = zero type drift between frontend and backend
- NestJS modular architecture enables independent scaling of each feature module
- Socket.IO rooms + Zustand stores enable targeted real-time updates per entity
- Certificate-based device authentication follows IoT security best practices
- Physics-based simulation module for testing without real hardware

### For Business Audiences
- Hub-and-spoke model mirrors real-world logistics networks
- Automated emergency response reduces operator workload and response times
- Fleet intelligence optimizes drone utilization and reduces operational costs
- Multi-manufacturer support avoids vendor lock-in
- Role-based access enables regulatory oversight without operational interference

### For Investor Audiences
- Enterprise SaaS model with per-hub licensing potential
- Scalable from 5 to 500+ hubs with the same architecture
- Addresses a growing $XX billion drone operations market
- Safety-first approach meets regulatory requirements globally
- Open architecture allows rapid integration with new drone platforms
