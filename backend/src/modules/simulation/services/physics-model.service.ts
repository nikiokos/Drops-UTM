import { Injectable } from '@nestjs/common';
import {
  SimulationState,
  SimulationWaypoint,
  DronePhysics,
  DEFAULT_DRONE_PHYSICS,
  FlightPhase,
  SensorNoise,
  DEFAULT_SENSOR_NOISE,
  PhysicsUpdate,
  Position,
  Vector3,
} from '../types/simulation.types';

// Earth radius in meters for coordinate calculations
const EARTH_RADIUS = 6371000;

@Injectable()
export class PhysicsModelService {
  private physics: DronePhysics = DEFAULT_DRONE_PHYSICS;
  private noise: SensorNoise = DEFAULT_SENSOR_NOISE;

  /**
   * Update simulation state based on physics for one tick
   */
  update(
    state: SimulationState,
    waypoints: SimulationWaypoint[],
    dt: number,
  ): PhysicsUpdate {
    const newState = { ...state };
    newState.elapsedTime += dt;

    // Get target position based on current phase
    const target = this.getTargetPosition(state, waypoints);
    const distanceToTarget = target
      ? this.calculateDistance(state.position, target)
      : 0;

    // Update based on flight phase
    switch (state.flightPhase) {
      case 'idle':
        // No movement
        break;

      case 'preflight':
        // Systems check phase - no movement
        break;

      case 'takeoff':
        this.updateTakeoff(newState, dt);
        break;

      case 'climb':
        this.updateClimb(newState, waypoints, dt);
        break;

      case 'cruise':
      case 'waypoint_nav':
        this.updateNavigation(newState, waypoints, dt);
        break;

      case 'approach':
        this.updateApproach(newState, waypoints, dt);
        break;

      case 'landing':
        this.updateLanding(newState, dt);
        break;

      case 'landed':
        this.updateLanded(newState);
        break;

      case 'emergency':
        this.updateEmergency(newState, dt);
        break;
    }

    // Update battery based on flight phase
    this.updateBattery(newState, dt);

    // Check if waypoint reached
    const hasReachedWaypoint =
      target && distanceToTarget < 3 && Math.abs(newState.velocity.z) < 0.5;

    return {
      newState,
      distanceToTarget,
      hasReachedWaypoint: !!hasReachedWaypoint,
    };
  }

  /**
   * Get current target position based on flight phase and waypoints
   */
  private getTargetPosition(
    state: SimulationState,
    waypoints: SimulationWaypoint[],
  ): Position | null {
    if (
      !waypoints ||
      waypoints.length === 0 ||
      state.currentWaypointIndex >= waypoints.length
    ) {
      return null;
    }

    const wp = waypoints[state.currentWaypointIndex];
    return {
      latitude: wp.latitude,
      longitude: wp.longitude,
      altitude: wp.altitude,
    };
  }

  /**
   * Update during takeoff phase - vertical climb to 10m
   */
  private updateTakeoff(state: SimulationState, dt: number): void {
    const targetAltitude = 10;
    const climbRate = 3; // m/s

    // Smooth vertical acceleration
    const targetVz = Math.min(
      climbRate,
      (targetAltitude - state.position.altitude) * 0.5,
    );
    state.velocity.z = this.smoothApproach(
      state.velocity.z,
      targetVz,
      this.physics.maxAcceleration,
      dt,
    );

    // Update altitude
    state.position.altitude += state.velocity.z * dt;

    // Clamp at target
    if (state.position.altitude >= targetAltitude) {
      state.position.altitude = targetAltitude;
      state.velocity.z = 0;
    }
  }

  /**
   * Update during climb to cruise altitude
   */
  private updateClimb(
    state: SimulationState,
    waypoints: SimulationWaypoint[],
    dt: number,
  ): void {
    const target = this.getTargetPosition(state, waypoints);
    if (!target) return;

    const climbRate = 4; // m/s
    const altitudeDiff = target.altitude - state.position.altitude;

    // Vertical movement
    const targetVz =
      Math.sign(altitudeDiff) * Math.min(climbRate, Math.abs(altitudeDiff));
    state.velocity.z = this.smoothApproach(
      state.velocity.z,
      targetVz,
      this.physics.maxAcceleration,
      dt,
    );
    state.position.altitude += state.velocity.z * dt;

    // Also start moving horizontally toward target
    this.updateHorizontalMovement(state, target, dt, 6);
  }

  /**
   * Update during waypoint navigation
   */
  private updateNavigation(
    state: SimulationState,
    waypoints: SimulationWaypoint[],
    dt: number,
  ): void {
    const target = this.getTargetPosition(state, waypoints);
    if (!target) return;

    const cruiseSpeed = 12; // m/s

    // Move toward waypoint
    this.updateHorizontalMovement(state, target, dt, cruiseSpeed);

    // Adjust altitude to match waypoint
    const altitudeDiff = target.altitude - state.position.altitude;
    if (Math.abs(altitudeDiff) > 0.5) {
      const targetVz =
        Math.sign(altitudeDiff) *
        Math.min(this.physics.maxVerticalSpeed, Math.abs(altitudeDiff));
      state.velocity.z = this.smoothApproach(
        state.velocity.z,
        targetVz,
        this.physics.maxAcceleration,
        dt,
      );
      state.position.altitude += state.velocity.z * dt;
    } else {
      state.velocity.z = 0;
    }
  }

  /**
   * Update horizontal position toward target
   */
  private updateHorizontalMovement(
    state: SimulationState,
    target: Position,
    dt: number,
    targetSpeed: number,
  ): void {
    // Calculate bearing and distance to target
    const bearing = this.calculateBearing(state.position, target);
    const distance = this.calculateDistance(state.position, target);

    // Smooth heading rotation
    state.heading = this.smoothRotation(
      state.heading,
      bearing,
      this.physics.turnRate,
      dt,
    );

    // Calculate deceleration distance for smooth approach
    const currentSpeed = Math.sqrt(
      state.velocity.x ** 2 + state.velocity.y ** 2,
    );
    const decelerationDistance =
      (currentSpeed ** 2) / (2 * this.physics.maxDeceleration);

    // Adjust target speed based on distance (decelerate when approaching)
    let adjustedTargetSpeed = targetSpeed;
    if (distance < decelerationDistance + 5) {
      adjustedTargetSpeed = Math.max(1, (distance / decelerationDistance) * targetSpeed);
    }

    // Calculate target velocity components
    const headingRad = (state.heading * Math.PI) / 180;
    const targetVx = Math.sin(headingRad) * adjustedTargetSpeed;
    const targetVy = Math.cos(headingRad) * adjustedTargetSpeed;

    // Smooth acceleration
    const accel =
      distance < decelerationDistance
        ? this.physics.maxDeceleration
        : this.physics.maxAcceleration;
    state.velocity.x = this.smoothApproach(state.velocity.x, targetVx, accel, dt);
    state.velocity.y = this.smoothApproach(state.velocity.y, targetVy, accel, dt);

    // Update position
    const newPosition = this.movePosition(state.position, state.velocity, dt);
    state.position.latitude = newPosition.latitude;
    state.position.longitude = newPosition.longitude;
  }

  /**
   * Update during approach phase
   */
  private updateApproach(
    state: SimulationState,
    waypoints: SimulationWaypoint[],
    dt: number,
  ): void {
    const target = this.getTargetPosition(state, waypoints);
    if (!target) return;

    // Slow approach speed
    this.updateHorizontalMovement(state, target, dt, 2);

    // Descend toward landing altitude (10m for landing preparation)
    const landingAltitude = 10;
    const altitudeDiff = landingAltitude - state.position.altitude;
    const targetVz =
      Math.sign(altitudeDiff) * Math.min(2, Math.abs(altitudeDiff) * 0.3);
    state.velocity.z = this.smoothApproach(
      state.velocity.z,
      targetVz,
      this.physics.maxAcceleration,
      dt,
    );
    state.position.altitude += state.velocity.z * dt;
  }

  /**
   * Update during landing phase
   */
  private updateLanding(state: SimulationState, dt: number): void {
    // Slow descent
    const targetVz = -1; // m/s descent rate
    state.velocity.z = this.smoothApproach(
      state.velocity.z,
      targetVz,
      this.physics.maxAcceleration,
      dt,
    );

    // Stop horizontal movement
    state.velocity.x = this.smoothApproach(
      state.velocity.x,
      0,
      this.physics.maxDeceleration,
      dt,
    );
    state.velocity.y = this.smoothApproach(
      state.velocity.y,
      0,
      this.physics.maxDeceleration,
      dt,
    );

    state.position.altitude += state.velocity.z * dt;

    // Touch down
    if (state.position.altitude <= 0) {
      state.position.altitude = 0;
      state.velocity = { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * Update when landed
   */
  private updateLanded(state: SimulationState): void {
    state.velocity = { x: 0, y: 0, z: 0 };
    state.position.altitude = 0;
    state.isArmed = false;
  }

  /**
   * Update during emergency (erratic movement for motor failure, etc.)
   */
  private updateEmergency(state: SimulationState, dt: number): void {
    // Add some erratic drift
    const drift = 0.5;
    state.velocity.x += (Math.random() - 0.5) * drift;
    state.velocity.y += (Math.random() - 0.5) * drift;

    // Slow descent
    state.velocity.z = Math.max(state.velocity.z - 0.2 * dt, -2);

    // Update position
    const newPosition = this.movePosition(state.position, state.velocity, dt);
    state.position.latitude = newPosition.latitude;
    state.position.longitude = newPosition.longitude;
    state.position.altitude = Math.max(0, state.position.altitude + state.velocity.z * dt);

    // Random heading wobble
    state.heading += (Math.random() - 0.5) * 10 * dt;
    state.heading = ((state.heading % 360) + 360) % 360;
  }

  /**
   * Update battery level based on flight phase
   */
  private updateBattery(state: SimulationState, dt: number): void {
    let drainRate: number;

    switch (state.flightPhase) {
      case 'idle':
      case 'preflight':
      case 'landed':
        drainRate = 0.01 / 60; // Minimal drain when on ground (0.01% per minute)
        break;
      case 'takeoff':
      case 'climb':
        drainRate = this.physics.climbDrainRate;
        break;
      case 'landing':
      case 'approach':
        drainRate = this.physics.hoverDrainRate;
        break;
      case 'emergency':
        drainRate = this.physics.climbDrainRate * 1.5; // Higher drain during emergency
        break;
      default:
        drainRate = this.physics.cruiseDrainRate;
    }

    state.batteryLevel = Math.max(0, state.batteryLevel - drainRate * dt);
  }

  /**
   * Add sensor noise to telemetry values
   */
  addSensorNoise(state: SimulationState): SimulationState {
    const noisy = { ...state, position: { ...state.position } };

    // Position noise (GPS)
    noisy.position.latitude += this.gaussianRandom() * (this.noise.positionStdDev / EARTH_RADIUS) * (180 / Math.PI);
    noisy.position.longitude +=
      (this.gaussianRandom() * (this.noise.positionStdDev / EARTH_RADIUS) * (180 / Math.PI)) /
      Math.cos((state.position.latitude * Math.PI) / 180);

    // Altitude noise (barometer)
    noisy.position.altitude += this.gaussianRandom() * this.noise.altitudeStdDev;

    // Heading noise (compass)
    noisy.heading += this.gaussianRandom() * this.noise.headingStdDev;
    noisy.heading = ((noisy.heading % 360) + 360) % 360;

    return noisy;
  }

  /**
   * Calculate current speed from velocity
   */
  calculateSpeed(velocity: Vector3): number {
    const horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    const noisySpeed = horizontalSpeed + this.gaussianRandom() * this.noise.speedStdDev;
    return Math.max(0, noisySpeed);
  }

  /**
   * Calculate vertical speed from velocity
   */
  calculateVerticalSpeed(velocity: Vector3): number {
    return velocity.z + this.gaussianRandom() * this.noise.speedStdDev;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Smooth value approach with acceleration limit
   */
  private smoothApproach(
    current: number,
    target: number,
    maxChange: number,
    dt: number,
  ): number {
    const diff = target - current;
    const maxDelta = maxChange * dt;
    if (Math.abs(diff) <= maxDelta) {
      return target;
    }
    return current + Math.sign(diff) * maxDelta;
  }

  /**
   * Smooth angle rotation toward target (handles wraparound)
   */
  private smoothRotation(
    current: number,
    target: number,
    maxRate: number,
    dt: number,
  ): number {
    let diff = target - current;
    // Normalize to -180 to 180
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    const maxDelta = maxRate * dt;
    if (Math.abs(diff) <= maxDelta) {
      return target;
    }

    const newAngle = current + Math.sign(diff) * maxDelta;
    return ((newAngle % 360) + 360) % 360;
  }

  /**
   * Calculate bearing from position to target (degrees)
   */
  private calculateBearing(from: Position, to: Position): number {
    const lat1 = (from.latitude * Math.PI) / 180;
    const lat2 = (to.latitude * Math.PI) / 180;
    const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return ((bearing % 360) + 360) % 360;
  }

  /**
   * Calculate distance between two positions (meters)
   */
  calculateDistance(from: Position, to: Position): number {
    const lat1 = (from.latitude * Math.PI) / 180;
    const lat2 = (to.latitude * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const horizontalDistance = EARTH_RADIUS * c;
    const altitudeDiff = to.altitude - from.altitude;

    return Math.sqrt(horizontalDistance ** 2 + altitudeDiff ** 2);
  }

  /**
   * Move position by velocity vector
   */
  private movePosition(
    position: Position,
    velocity: Vector3,
    dt: number,
  ): Position {
    // Convert velocity (m/s) to lat/lon changes
    const dLat = (velocity.y * dt) / EARTH_RADIUS * (180 / Math.PI);
    const dLon =
      ((velocity.x * dt) / EARTH_RADIUS) *
      (180 / Math.PI) /
      Math.cos((position.latitude * Math.PI) / 180);

    return {
      latitude: position.latitude + dLat,
      longitude: position.longitude + dLon,
      altitude: position.altitude,
    };
  }

  /**
   * Generate gaussian random number (Box-Muller transform)
   */
  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Determine next flight phase based on current state
   */
  determineNextPhase(
    currentPhase: FlightPhase,
    state: SimulationState,
    waypoints: SimulationWaypoint[],
    hasReachedWaypoint: boolean,
  ): FlightPhase {
    const phaseTime = state.elapsedTime - state.phaseStartTime;

    switch (currentPhase) {
      case 'idle':
        return 'idle'; // Stays idle until externally started

      case 'preflight':
        if (phaseTime >= 3) {
          return 'takeoff';
        }
        return 'preflight';

      case 'takeoff':
        if (state.position.altitude >= 9.9) {
          return 'climb';
        }
        return 'takeoff';

      case 'climb':
        if (waypoints && waypoints.length > 0) {
          const target = waypoints[state.currentWaypointIndex];
          if (Math.abs(state.position.altitude - target.altitude) < 1) {
            return 'waypoint_nav';
          }
        }
        return 'climb';

      case 'cruise':
      case 'waypoint_nav':
        if (hasReachedWaypoint) {
          if (state.currentWaypointIndex >= waypoints.length - 1) {
            return 'approach';
          }
          // Will advance to next waypoint in engine
        }
        return 'waypoint_nav';

      case 'approach':
        if (
          state.position.altitude < 12 &&
          Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2) < 3
        ) {
          return 'landing';
        }
        return 'approach';

      case 'landing':
        if (state.position.altitude <= 0) {
          return 'landed';
        }
        return 'landing';

      case 'landed':
        return 'landed';

      case 'emergency':
        if (state.position.altitude <= 0) {
          return 'landed';
        }
        return 'emergency';

      default:
        return currentPhase;
    }
  }
}
