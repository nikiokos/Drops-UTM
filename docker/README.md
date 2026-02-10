# DROPS UTM - Docker Configuration

Docker configurations for containerized deployment of the DROPS UTM system.

## Files

| File | Description |
|------|-------------|
| `Dockerfile.backend` | Multi-stage build for NestJS backend |
| `Dockerfile.frontend` | Multi-stage build for Next.js frontend |
| `nginx/nginx.conf` | Nginx reverse proxy configuration |
| `postgres/init.sql` | PostgreSQL initialization with full schema |
| `mosquitto/mosquitto.conf` | Eclipse Mosquitto MQTT broker config |

## Development

For local development, use docker-compose from the project root:

```bash
# Start infrastructure services only (DB, Redis, MQTT)
docker compose up -d

# Start everything including app containers
docker compose --profile full up -d
```

## Database

The `postgres/init.sql` script runs automatically on first database creation and:

- Enables `uuid-ossp`, `postgis`, and `timescaledb` extensions
- Creates all tables with indexes
- Sets up TimescaleDB hypertables for `telemetry` and `weather_data`
- Seeds a default admin user (`admin@drops-utm.local` / `admin123`)

## Nginx

The nginx reverse proxy handles:

- `/` - Frontend (Next.js on port 3000)
- `/api/` - Backend API (NestJS on port 3001)
- `/ws/` - WebSocket connections with upgrade support
- `/api/docs` - Swagger documentation

## Mosquitto MQTT

MQTT broker for drone telemetry communication:

- **Port 1883**: MQTT protocol
- **Port 9001**: WebSocket protocol
- Anonymous access enabled (configure authentication for production)

## Production Notes

- Update `mosquitto.conf` to disable anonymous access
- Configure SSL/TLS certificates for nginx
- Set proper resource limits in docker-compose
- Use Docker secrets for sensitive environment variables
