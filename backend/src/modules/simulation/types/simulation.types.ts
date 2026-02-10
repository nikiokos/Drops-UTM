/**
 * Simulation Types
 * Type definitions for the drone simulation module
 */

// ============================================================================
// Physical Constants
// ============================================================================

export interface DronePhysics {
  maxSpeed: number; // 15 m/s horizontal
  maxVerticalSpeed: number; // 5 m/s
  maxAcceleration: number; // 4 m/s²
  maxDeceleration: number; // 6 m/s² (can brake faster)
  turnRate: number; // 45 deg/s
  hoverDrainRate: number; // 15% per 10 min (in %/second)
  cruiseDrainRate: number; // 20% per 10 min (in %/second)
  climbDrainRate: number; // 30% per 10 min (in %/second)
}

export const DEFAULT_DRONE_PHYSICS: DronePhysics = {
  maxSpeed: 15, // m/s
  maxVerticalSpeed: 5, // m/s
  maxAcceleration: 4, // m/s²
  maxDeceleration: 6, // m/s²
  turnRate: 45, // deg/s
  hoverDrainRate: 15 / 600, // % per second (15% / 10min)
  cruiseDrainRate: 20 / 600, // % per second
  climbDrainRate: 30 / 600, // % per second
};

// ============================================================================
// Flight State Machine
// ============================================================================

export type FlightPhase =
  | 'idle'
  | 'preflight'
  | 'takeoff'
  | 'climb'
  | 'cruise'
  | 'waypoint_nav'
  | 'approach'
  | 'landing'
  | 'landed'
  | 'emergency';

export interface FlightPhaseConfig {
  phase: FlightPhase;
  targetAltitude?: number; // meters
  targetSpeed?: number; // m/s
  duration?: number; // seconds (for preflight delay)
}

export const FLIGHT_PHASE_DEFAULTS: Record<FlightPhase, FlightPhaseConfig> = {
  idle: { phase: 'idle' },
  preflight: { phase: 'preflight', duration: 3 },
  takeoff: { phase: 'takeoff', targetAltitude: 10, targetSpeed: 3 },
  climb: { phase: 'climb', targetSpeed: 4 },
  cruise: { phase: 'cruise', targetSpeed: 12 },
  waypoint_nav: { phase: 'waypoint_nav', targetSpeed: 12 },
  approach: { phase: 'approach', targetSpeed: 2 },
  landing: { phase: 'landing', targetSpeed: 1 },
  landed: { phase: 'landed' },
  emergency: { phase: 'emergency' },
};

// ============================================================================
// Simulation State
// ============================================================================

export interface Vector3 {
  x: number; // East (longitude direction)
  y: number; // North (latitude direction)
  z: number; // Up (altitude)
}

export interface Position {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface SimulationState {
  position: Position;
  velocity: Vector3;
  heading: number; // degrees (0-360)
  batteryLevel: number; // percentage (0-100)
  flightPhase: FlightPhase;
  currentWaypointIndex: number;
  elapsedTime: number; // seconds since simulation start
  phaseStartTime: number; // seconds when current phase started
  isArmed: boolean;
  gpsAccuracy: number; // meters
  satellites: number;
  signalStrength: number; // percentage
  motorsHealthy: boolean;
  hasGpsLock: boolean;
  lastKnownPosition?: Position; // for GPS loss scenario
}

export const INITIAL_SIMULATION_STATE: SimulationState = {
  position: { latitude: 0, longitude: 0, altitude: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  heading: 0,
  batteryLevel: 100,
  flightPhase: 'idle',
  currentWaypointIndex: 0,
  elapsedTime: 0,
  phaseStartTime: 0,
  isArmed: false,
  gpsAccuracy: 1.5,
  satellites: 12,
  signalStrength: 95,
  motorsHealthy: true,
  hasGpsLock: true,
};

// ============================================================================
// Waypoint Navigation
// ============================================================================

export interface SimulationWaypoint {
  latitude: number;
  longitude: number;
  altitude: number;
  speed?: number; // optional speed override
  holdTime?: number; // seconds to hover at waypoint
  sequence: number;
}

// ============================================================================
// Emergency Scenarios
// ============================================================================

export type EmergencyScenarioType =
  | 'normal'
  | 'battery_critical'
  | 'motor_failure'
  | 'gps_loss'
  | 'geofence_breach'
  | 'comm_loss';

export type ScenarioTriggerType = 'time' | 'waypoint' | 'battery' | 'position';

export interface ScenarioTrigger {
  type: ScenarioTriggerType;
  value: number | Position; // time in seconds, waypoint index, battery %, or position
}

export interface ScenarioConfig {
  scenario: EmergencyScenarioType;
  trigger?: ScenarioTrigger;
  severity?: 'mild' | 'moderate' | 'severe';
  duration?: number; // for comm_loss: how long to lose connection
  driftRate?: number; // for motor_failure: drift rate
}

export const SCENARIO_DESCRIPTIONS: Record<EmergencyScenarioType, string> = {
  normal: 'Normal flight operation',
  battery_critical: 'Battery drops rapidly, forcing return-to-home',
  motor_failure: 'Motor malfunction causing erratic movement',
  gps_loss: 'GPS signal lost, position drift occurs',
  geofence_breach: 'Drone approaches/crosses geofence boundary',
  comm_loss: 'Communication temporarily lost',
};

// ============================================================================
// Telemetry Output
// ============================================================================

export interface SimulatedTelemetry {
  droneId: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  speed: number;
  batteryLevel: number;
  batteryVoltage: number;
  satellites: number;
  signalStrength: number;
  flightMode: string;
  armed: boolean;
  gpsAccuracy: number;
  verticalSpeed: number;
  custom?: {
    simulationId: string;
    flightPhase: FlightPhase;
    currentWaypoint: number;
    totalWaypoints: number;
    elapsedTime: number;
    isSimulated: boolean;
  };
}

// ============================================================================
// Session Management
// ============================================================================

export type SimulationSessionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

export interface StartSimulationDto {
  droneId: string;
  missionId?: string;
  manualWaypoints?: SimulationWaypoint[];
  scenario?: EmergencyScenarioType;
  scenarioConfig?: ScenarioConfig;
  timeScale?: number;
  startPosition?: Position;
}

export interface UpdateTimeScaleDto {
  timeScale: number;
}

export interface InjectScenarioDto {
  scenario: EmergencyScenarioType;
  config?: Partial<ScenarioConfig>;
}

// ============================================================================
// Sensor Noise Configuration
// ============================================================================

export interface SensorNoise {
  positionStdDev: number; // meters (GPS accuracy)
  altitudeStdDev: number; // meters (barometer)
  headingStdDev: number; // degrees (compass)
  speedStdDev: number; // m/s
}

export const DEFAULT_SENSOR_NOISE: SensorNoise = {
  positionStdDev: 0.5, // ±0.5m GPS accuracy
  altitudeStdDev: 0.3, // ±0.3m barometer
  headingStdDev: 1, // ±1° compass
  speedStdDev: 0.1, // ±0.1 m/s
};

// ============================================================================
// Geofence
// ============================================================================

export interface GeofenceBoundary {
  type: 'circle' | 'polygon';
  center?: Position; // for circle
  radius?: number; // meters, for circle
  vertices?: Position[]; // for polygon
}

// ============================================================================
// Physics Helpers
// ============================================================================

export interface PhysicsUpdate {
  newState: SimulationState;
  distanceToTarget: number;
  hasReachedWaypoint: boolean;
}
