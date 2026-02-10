-- DROPS UTM Database Initialization
-- This script runs on first database creation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================
-- Organizations
-- ============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'operator',
    description TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address JSONB,
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Users
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'operator',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    organization_id UUID REFERENCES organizations(id),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);

-- ============================================
-- Hubs
-- ============================================
CREATE TABLE hubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    location JSONB NOT NULL,
    coverage_radius_km DECIMAL(10,2) NOT NULL DEFAULT 50,
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    capabilities JSONB DEFAULT '{}',
    configuration JSONB DEFAULT '{}',
    organization_id UUID REFERENCES organizations(id),
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hubs_code ON hubs(code);
CREATE INDEX idx_hubs_status ON hubs(status);
CREATE INDEX idx_hubs_organization ON hubs(organization_id);

-- ============================================
-- Drones
-- ============================================
CREATE TABLE drones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    model VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'registered',
    max_altitude_m DECIMAL(10,2),
    max_speed_ms DECIMAL(10,2),
    max_flight_time_min INTEGER,
    weight_kg DECIMAL(10,2),
    capabilities JSONB DEFAULT '{}',
    organization_id UUID REFERENCES organizations(id),
    home_hub_id UUID REFERENCES hubs(id),
    last_telemetry TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drones_serial ON drones(serial_number);
CREATE INDEX idx_drones_status ON drones(status);
CREATE INDEX idx_drones_organization ON drones(organization_id);
CREATE INDEX idx_drones_hub ON drones(home_hub_id);

-- ============================================
-- Flights
-- ============================================
CREATE TABLE flights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_number VARCHAR(20) NOT NULL UNIQUE,
    drone_id UUID NOT NULL REFERENCES drones(id),
    pilot_id UUID NOT NULL REFERENCES users(id),
    hub_id UUID NOT NULL REFERENCES hubs(id),
    status VARCHAR(20) NOT NULL DEFAULT 'planned',
    flight_type VARCHAR(20) NOT NULL DEFAULT 'standard',
    priority INTEGER NOT NULL DEFAULT 5,
    planned_departure TIMESTAMPTZ,
    planned_arrival TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    route JSONB,
    planned_altitude_m DECIMAL(10,2),
    authorization_status VARCHAR(20) DEFAULT 'pending',
    authorization_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flights_number ON flights(flight_number);
CREATE INDEX idx_flights_status ON flights(status);
CREATE INDEX idx_flights_drone ON flights(drone_id);
CREATE INDEX idx_flights_pilot ON flights(pilot_id);
CREATE INDEX idx_flights_hub ON flights(hub_id);
CREATE INDEX idx_flights_departure ON flights(planned_departure);

-- ============================================
-- Telemetry (TimescaleDB hypertable)
-- ============================================
CREATE TABLE telemetry (
    time TIMESTAMPTZ NOT NULL,
    flight_id UUID NOT NULL REFERENCES flights(id),
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    altitude_m DECIMAL(10,2) NOT NULL,
    speed_ms DECIMAL(10,2),
    heading DECIMAL(5,1),
    battery_percent DECIMAL(5,2),
    satellites INTEGER,
    signal_strength DECIMAL(5,2),
    metadata JSONB DEFAULT '{}'
);

SELECT create_hypertable('telemetry', 'time');

CREATE INDEX idx_telemetry_flight ON telemetry(flight_id, time DESC);

-- ============================================
-- Conflicts
-- ============================================
CREATE TABLE conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    status VARCHAR(20) NOT NULL DEFAULT 'detected',
    flight1_id UUID NOT NULL REFERENCES flights(id),
    flight2_id UUID REFERENCES flights(id),
    hub_id UUID REFERENCES hubs(id),
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    location JSONB,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conflicts_status ON conflicts(status);
CREATE INDEX idx_conflicts_severity ON conflicts(severity);
CREATE INDEX idx_conflicts_flight1 ON conflicts(flight1_id);
CREATE INDEX idx_conflicts_flight2 ON conflicts(flight2_id);
CREATE INDEX idx_conflicts_hub ON conflicts(hub_id);

-- ============================================
-- Airspace Zones
-- ============================================
CREATE TABLE airspace_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    geometry JSONB NOT NULL,
    min_altitude_m DECIMAL(10,2) DEFAULT 0,
    max_altitude_m DECIMAL(10,2) DEFAULT 120,
    restrictions JSONB DEFAULT '{}',
    schedule JSONB,
    hub_id UUID REFERENCES hubs(id),
    effective_from TIMESTAMPTZ,
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_airspace_type ON airspace_zones(type);
CREATE INDEX idx_airspace_status ON airspace_zones(status);
CREATE INDEX idx_airspace_hub ON airspace_zones(hub_id);

-- ============================================
-- Weather Data (TimescaleDB hypertable)
-- ============================================
CREATE TABLE weather_data (
    time TIMESTAMPTZ NOT NULL,
    hub_id UUID REFERENCES hubs(id),
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    temperature_c DECIMAL(5,1),
    humidity_percent DECIMAL(5,1),
    wind_speed_ms DECIMAL(5,1),
    wind_direction DECIMAL(5,1),
    visibility_km DECIMAL(5,1),
    pressure_hpa DECIMAL(6,1),
    conditions VARCHAR(50),
    alerts JSONB DEFAULT '[]'
);

SELECT create_hypertable('weather_data', 'time');

CREATE INDEX idx_weather_hub ON weather_data(hub_id, time DESC);

-- ============================================
-- Seed: Default admin user (password: admin123)
-- ============================================
INSERT INTO organizations (id, name, type, description) VALUES
    ('00000000-0000-0000-0000-000000000001', 'DROPS Admin', 'authority', 'System administration organization');

INSERT INTO users (id, email, password_hash, first_name, last_name, role, organization_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@drops-utm.local', '$2b$10$rQZHEMUoKrqjMxVKqgBpCOXXeOJlhFp0q.fGdMCfVpJ0Xk5KJBWC6', 'System', 'Admin', 'admin', '00000000-0000-0000-0000-000000000001');
