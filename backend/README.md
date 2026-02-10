# @drops-utm/backend

NestJS backend for the DROPS UTM system.

## Modules

- **Auth** - JWT authentication and authorization
- **Users** - User management
- **Organizations** - Organization management
- **Hubs** - Hub control system management
- **Drones** - Drone fleet management
- **Flights** - Flight planning, authorization, and tracking
- **Telemetry** - Real-time telemetry ingestion and retrieval
- **Conflicts** - Conflict detection and resolution
- **Airspace** - Airspace zone management
- **Weather** - Weather data integration
- **Gateway** - WebSocket real-time communication

## Development

```bash
npm run dev          # Start development server
npm run test         # Run tests
npm run migration:run # Run migrations
npm run seed         # Seed database
```

## API Documentation

Swagger UI available at `http://localhost:3001/api/docs` when running in development mode.
