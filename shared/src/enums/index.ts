export enum HubStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline',
}

export enum DroneStatus {
  AVAILABLE = 'available',
  IN_FLIGHT = 'in_flight',
  CHARGING = 'charging',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
}

export enum FlightStatus {
  PLANNED = 'planned',
  AUTHORIZED = 'authorized',
  PRE_FLIGHT = 'pre_flight',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EMERGENCY = 'emergency',
}

export enum FlightType {
  DELIVERY = 'delivery',
  INSPECTION = 'inspection',
  SURVEILLANCE = 'surveillance',
  TRAINING = 'training',
  TEST = 'test',
}

export enum OperationMode {
  AUTONOMOUS = 'autonomous',
  REMOTE_PILOT = 'remote_pilot',
  HYBRID = 'hybrid',
}

export enum AuthorizationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ConflictType {
  COLLISION_RISK = 'collision_risk',
  AIRSPACE_VIOLATION = 'airspace_violation',
  SEPARATION_MINIMUM = 'separation_minimum',
  WEATHER = 'weather',
  EQUIPMENT_FAILURE = 'equipment_failure',
}

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ConflictStatus {
  DETECTED = 'detected',
  NOTIFIED = 'notified',
  RESOLVING = 'resolving',
  RESOLVED = 'resolved',
  FALSE_ALARM = 'false_alarm',
}

export enum ZoneType {
  CONTROLLED = 'controlled',
  RESTRICTED = 'restricted',
  PROHIBITED = 'prohibited',
  WARNING = 'warning',
  CORRIDOR = 'corridor',
}

export enum ZoneStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TEMPORARY = 'temporary',
}

export enum UserRole {
  ADMIN = 'admin',
  HUB_OPERATOR = 'hub_operator',
  PILOT = 'pilot',
  OBSERVER = 'observer',
  REGULATORY = 'regulatory',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum OrganizationType {
  OPERATOR = 'operator',
  PARTNER = 'partner',
  REGULATORY = 'regulatory',
  SERVICE_PROVIDER = 'service_provider',
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export enum CommunicationProtocol {
  MAVLINK = 'mavlink',
  DJI_SDK = 'dji_sdk',
  CUSTOM_API = 'custom_api',
}

export enum RiskAssessment {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum FlightCategory {
  VFR = 'VFR',
  MVFR = 'MVFR',
  IFR = 'IFR',
  LIFR = 'LIFR',
}

export enum LogEventType {
  STATUS_CHANGE = 'status_change',
  COMMAND = 'command',
  ALERT = 'alert',
  COMMUNICATION = 'communication',
  MODE_CHANGE = 'mode_change',
  EMERGENCY_TAKEOVER = 'emergency_takeover',
}

export enum WebSocketEvent {
  SUBSCRIBE_FLIGHT = 'subscribe_flight',
  SUBSCRIBE_HUB = 'subscribe_hub',
  SUBSCRIBE_DRONE = 'subscribe_drone',
  DRONE_COMMAND = 'drone_command',
  HEARTBEAT = 'heartbeat',
  FLIGHT_UPDATE = 'flight_update',
  TELEMETRY = 'telemetry',
  CONFLICT_DETECTED = 'conflict_detected',
  WEATHER_ALERT = 'weather_alert',
  EMERGENCY = 'emergency',
  HUB_STATUS = 'hub_status',
  DRONE_STATUS = 'drone_status',
}
