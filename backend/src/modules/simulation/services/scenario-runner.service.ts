import { Injectable, Logger } from '@nestjs/common';
import {
  SimulationState,
  EmergencyScenarioType,
  ScenarioConfig,
  ScenarioTrigger,
  Position,
  GeofenceBoundary,
  SCENARIO_DESCRIPTIONS,
} from '../types/simulation.types';
import { SimulationSession } from '../entities/simulation-session.entity';

export interface ScenarioEvent {
  type: 'scenario_triggered' | 'scenario_effect' | 'scenario_resolved';
  scenario: EmergencyScenarioType;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  data?: Record<string, unknown>;
}

@Injectable()
export class ScenarioRunnerService {
  private readonly logger = new Logger(ScenarioRunnerService.name);

  // Track active scenarios per session
  private activeScenarios: Map<
    string,
    {
      scenario: EmergencyScenarioType;
      triggeredAt: number;
      config: ScenarioConfig;
    }
  > = new Map();

  // Optional geofence for geofence_breach scenario
  private geofences: Map<string, GeofenceBoundary> = new Map();

  /**
   * Check if any scenario triggers should fire
   */
  checkTriggers(
    session: SimulationSession,
    state: SimulationState,
  ): ScenarioEvent | null {
    // If already running a scenario, check for effects/resolution
    if (this.activeScenarios.has(session.id)) {
      return this.checkActiveScenario(session, state);
    }

    // Check if configured scenario should trigger
    if (
      session.scenario !== 'normal' &&
      session.scenarioConfig?.trigger
    ) {
      const shouldTrigger = this.evaluateTrigger(
        session.scenarioConfig.trigger,
        state,
      );

      if (shouldTrigger) {
        return this.triggerScenario(session, state);
      }
    }

    // Check for automatic geofence breach
    if (session.scenario === 'geofence_breach') {
      const geofence = this.geofences.get(session.id);
      if (geofence && this.isNearGeofence(state.position, geofence)) {
        return this.triggerScenario(session, state);
      }
    }

    // Check for automatic low battery trigger
    if (session.scenario === 'battery_critical' && !session.scenarioConfig?.trigger) {
      if (state.batteryLevel < 25) {
        return this.triggerScenario(session, state);
      }
    }

    return null;
  }

  /**
   * Evaluate if trigger condition is met
   */
  private evaluateTrigger(
    trigger: ScenarioTrigger,
    state: SimulationState,
  ): boolean {
    switch (trigger.type) {
      case 'time':
        return state.elapsedTime >= (trigger.value as number);

      case 'waypoint':
        return state.currentWaypointIndex >= (trigger.value as number);

      case 'battery':
        return state.batteryLevel <= (trigger.value as number);

      case 'position':
        // Check if within 50m of trigger position
        const triggerPos = trigger.value as Position;
        const distance = this.calculateDistance(state.position, triggerPos);
        return distance < 50;

      default:
        return false;
    }
  }

  /**
   * Trigger a scenario and return the event
   */
  private triggerScenario(
    session: SimulationSession,
    state: SimulationState,
  ): ScenarioEvent {
    const config = session.scenarioConfig || {
      scenario: session.scenario,
      severity: 'moderate',
    };

    this.activeScenarios.set(session.id, {
      scenario: session.scenario,
      triggeredAt: state.elapsedTime,
      config,
    });

    this.logger.warn(
      `Scenario triggered: ${session.scenario} for session ${session.id}`,
    );

    return {
      type: 'scenario_triggered',
      scenario: session.scenario,
      message: this.getTriggerMessage(session.scenario),
      severity: this.getSeverity(session.scenario),
      data: {
        sessionId: session.id,
        droneId: session.droneId,
        elapsedTime: state.elapsedTime,
        position: state.position,
        batteryLevel: state.batteryLevel,
      },
    };
  }

  /**
   * Check active scenario for effects or resolution
   */
  private checkActiveScenario(
    session: SimulationSession,
    state: SimulationState,
  ): ScenarioEvent | null {
    const active = this.activeScenarios.get(session.id);
    if (!active) return null;

    const elapsed = state.elapsedTime - active.triggeredAt;

    // Check for resolution conditions
    switch (active.scenario) {
      case 'comm_loss':
        const duration = active.config.duration || 30; // default 30 seconds
        if (elapsed >= duration) {
          this.activeScenarios.delete(session.id);
          return {
            type: 'scenario_resolved',
            scenario: active.scenario,
            message: 'Communication restored',
            severity: 'info',
            data: { sessionId: session.id, droneId: session.droneId },
          };
        }
        break;

      case 'gps_loss':
        // GPS might come back after 60 seconds
        if (elapsed >= 60 && Math.random() < 0.1) {
          this.activeScenarios.delete(session.id);
          return {
            type: 'scenario_resolved',
            scenario: active.scenario,
            message: 'GPS signal reacquired',
            severity: 'info',
            data: { sessionId: session.id, droneId: session.droneId },
          };
        }
        break;
    }

    return null;
  }

  /**
   * Apply scenario effects to state
   */
  applyScenarioEffects(
    sessionId: string,
    state: SimulationState,
    dt: number,
  ): SimulationState {
    const active = this.activeScenarios.get(sessionId);
    if (!active) return state;

    const newState = { ...state };

    switch (active.scenario) {
      case 'battery_critical':
        // Rapid battery drain
        newState.batteryLevel = Math.max(
          0,
          newState.batteryLevel - 0.5 * dt, // 0.5% per second extra drain
        );
        break;

      case 'motor_failure':
        // Erratic movement and degraded control
        newState.motorsHealthy = false;
        const drift = active.config.driftRate || 0.3;
        newState.velocity.x += (Math.random() - 0.5) * drift;
        newState.velocity.y += (Math.random() - 0.5) * drift;
        // Slight descent
        newState.velocity.z = Math.min(newState.velocity.z, -0.5);
        break;

      case 'gps_loss':
        // Lose GPS lock, position drifts from last known
        if (!newState.lastKnownPosition) {
          newState.lastKnownPosition = { ...newState.position };
        }
        newState.hasGpsLock = false;
        newState.satellites = 0;
        newState.gpsAccuracy = 50; // Very poor accuracy
        // Position drifts randomly
        newState.position.latitude +=
          ((Math.random() - 0.5) * 0.00001) * dt;
        newState.position.longitude +=
          ((Math.random() - 0.5) * 0.00001) * dt;
        break;

      case 'geofence_breach':
        // Just track the breach, actual handling is external
        break;

      case 'comm_loss':
        // Signal drops
        newState.signalStrength = 0;
        break;
    }

    return newState;
  }

  /**
   * Inject a scenario mid-flight
   */
  injectScenario(
    sessionId: string,
    scenario: EmergencyScenarioType,
    config: Partial<ScenarioConfig>,
    currentTime: number,
  ): ScenarioEvent {
    const fullConfig: ScenarioConfig = {
      scenario,
      severity: config.severity || 'moderate',
      duration: config.duration,
      driftRate: config.driftRate,
    };

    this.activeScenarios.set(sessionId, {
      scenario,
      triggeredAt: currentTime,
      config: fullConfig,
    });

    this.logger.warn(`Scenario injected: ${scenario} for session ${sessionId}`);

    return {
      type: 'scenario_triggered',
      scenario,
      message: this.getTriggerMessage(scenario),
      severity: this.getSeverity(scenario),
      data: { sessionId, injected: true },
    };
  }

  /**
   * Check if scenario requires RTH (return to home)
   */
  requiresRTH(sessionId: string): boolean {
    const active = this.activeScenarios.get(sessionId);
    if (!active) return false;

    return (
      active.scenario === 'battery_critical' ||
      active.scenario === 'motor_failure'
    );
  }

  /**
   * Check if scenario requires emergency landing
   */
  requiresEmergencyLanding(sessionId: string, state: SimulationState): boolean {
    const active = this.activeScenarios.get(sessionId);
    if (!active) return false;

    // Motor failure with very low altitude
    if (active.scenario === 'motor_failure' && state.batteryLevel < 10) {
      return true;
    }

    // Critical battery
    if (active.scenario === 'battery_critical' && state.batteryLevel < 5) {
      return true;
    }

    return false;
  }

  /**
   * Check if comm loss is active (for suppressing telemetry)
   */
  isCommLossActive(sessionId: string): boolean {
    const active = this.activeScenarios.get(sessionId);
    return active?.scenario === 'comm_loss';
  }

  /**
   * Set geofence for a session
   */
  setGeofence(sessionId: string, boundary: GeofenceBoundary): void {
    this.geofences.set(sessionId, boundary);
  }

  /**
   * Clear scenario state for session
   */
  clearSession(sessionId: string): void {
    this.activeScenarios.delete(sessionId);
    this.geofences.delete(sessionId);
  }

  /**
   * Get active scenario for session
   */
  getActiveScenario(sessionId: string): EmergencyScenarioType | null {
    return this.activeScenarios.get(sessionId)?.scenario || null;
  }

  /**
   * Get all available scenarios with descriptions
   */
  getAvailableScenarios(): Array<{
    type: EmergencyScenarioType;
    description: string;
  }> {
    return Object.entries(SCENARIO_DESCRIPTIONS).map(([type, description]) => ({
      type: type as EmergencyScenarioType,
      description,
    }));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getTriggerMessage(scenario: EmergencyScenarioType): string {
    switch (scenario) {
      case 'battery_critical':
        return 'Critical battery level detected - initiating RTH';
      case 'motor_failure':
        return 'Motor malfunction detected - flight unstable';
      case 'gps_loss':
        return 'GPS signal lost - holding last known position';
      case 'geofence_breach':
        return 'Geofence boundary approached - warning';
      case 'comm_loss':
        return 'Communication link lost';
      default:
        return 'Emergency scenario triggered';
    }
  }

  private getSeverity(
    scenario: EmergencyScenarioType,
  ): 'info' | 'warning' | 'critical' {
    switch (scenario) {
      case 'battery_critical':
      case 'motor_failure':
        return 'critical';
      case 'gps_loss':
      case 'geofence_breach':
        return 'warning';
      case 'comm_loss':
        return 'warning';
      default:
        return 'info';
    }
  }

  private isNearGeofence(position: Position, boundary: GeofenceBoundary): boolean {
    if (boundary.type === 'circle' && boundary.center && boundary.radius) {
      const distance = this.calculateDistance(position, boundary.center);
      return distance >= boundary.radius * 0.9; // Within 10% of boundary
    }
    // Polygon check would go here
    return false;
  }

  private calculateDistance(from: Position, to: Position): number {
    const R = 6371000; // Earth radius in meters
    const lat1 = (from.latitude * Math.PI) / 180;
    const lat2 = (to.latitude * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
