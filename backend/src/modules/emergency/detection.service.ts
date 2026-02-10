import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmergencyProtocol } from './protocol.entity';
import { EmergencyType, EmergencySeverity } from './incident.entity';

export interface TelemetryData {
  flightId: string;
  droneId: string;
  timestamp: Date;
  position: { lat: number; lng: number; altitude: number };
  batteryLevel: number;
  batteryDischargeRate?: number;
  signalStrength: number;
  gpsHdop?: number;
  gpsSatellites?: number;
  groundSpeed: number;
  heading: number;
  motorRpm?: number[];
  windSpeed?: number;
  visibility?: number;
}

export interface GeofenceData {
  flightId: string;
  droneId: string;
  distanceToBoundary: number;
  isBreached: boolean;
  boundaryName?: string;
}

export interface CollisionData {
  flightId: string;
  droneId: string;
  threatType: 'aircraft' | 'obstacle' | 'drone';
  distance: number;
  bearing: number;
  threatId?: string;
}

export interface EmergencyEvent {
  type: EmergencyType;
  severity: EmergencySeverity;
  droneId: string;
  flightId: string;
  message: string;
  data: Record<string, unknown>;
  detectedAt: Date;
  position?: { lat: number; lng: number; altitude: number };
}

interface DroneMonitorState {
  lastBatteryLevel: number;
  lastBatteryCheck: Date;
  batteryReadings: Array<{ level: number; time: Date }>;
  lastSignalStrength: number;
  signalLostAt?: Date;
  activeEmergencies: Set<EmergencyType>;
}

@Injectable()
export class DetectionService implements OnModuleInit {
  private readonly logger = new Logger(DetectionService.name);
  private droneStates = new Map<string, DroneMonitorState>();
  private protocols: EmergencyProtocol[] = [];

  // Default thresholds (can be overridden by protocols)
  private readonly defaultThresholds = {
    battery: {
      warning: 25,
      critical: 10,
      emergency: 5,
      rapidDischargeWarning: 2, // %/min
      rapidDischargeCritical: 5,
    },
    signal: {
      warning: 50,
      critical: 20,
      lostWarningSeconds: 5,
      lostCriticalSeconds: 15,
    },
    geofence: {
      warningDistance: 100, // meters
    },
    collision: {
      aircraftWarning: 1000, // meters
      aircraftCritical: 500,
      obstacleWarning: 50,
      obstacleCritical: 20,
    },
    weather: {
      windWarningPercent: 70, // % of max drone wind speed
      windCriticalPercent: 90,
      visibilityWarning: 3000, // meters
      visibilityCritical: 1000,
    },
    gps: {
      hdopWarning: 2.0,
      hdopCritical: 5.0,
    },
  };

  constructor(
    @InjectRepository(EmergencyProtocol)
    private protocolRepo: Repository<EmergencyProtocol>,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.loadProtocols();
    this.logger.log('Detection Service initialized');
  }

  private async loadProtocols() {
    this.protocols = await this.protocolRepo.find({ where: { isActive: true } });
    this.logger.log(`Loaded ${this.protocols.length} active emergency protocols`);
  }

  async reloadProtocols() {
    await this.loadProtocols();
  }

  /**
   * Main entry point for telemetry analysis
   */
  analyzeTelemetry(telemetry: TelemetryData): EmergencyEvent[] {
    const events: EmergencyEvent[] = [];
    const state = this.getOrCreateDroneState(telemetry.droneId);

    // Battery monitoring
    const batteryEvents = this.checkBattery(telemetry, state);
    events.push(...batteryEvents);

    // Signal monitoring
    const signalEvents = this.checkSignal(telemetry, state);
    events.push(...signalEvents);

    // GPS monitoring
    const gpsEvents = this.checkGps(telemetry, state);
    events.push(...gpsEvents);

    // Update state for next check
    this.updateDroneState(telemetry, state);

    // Emit events
    for (const event of events) {
      if (!state.activeEmergencies.has(event.type)) {
        state.activeEmergencies.add(event.type);
        this.eventEmitter.emit('emergency.detected', event);
        this.logger.warn(
          `Emergency detected: ${event.type} (${event.severity}) for drone ${event.droneId}`,
        );
      }
    }

    return events;
  }

  /**
   * Analyze geofence data
   */
  analyzeGeofence(data: GeofenceData): EmergencyEvent | null {
    const state = this.getOrCreateDroneState(data.droneId);

    if (data.isBreached) {
      const event: EmergencyEvent = {
        type: 'geofence_breach',
        severity: 'critical',
        droneId: data.droneId,
        flightId: data.flightId,
        message: `Geofence breach detected${data.boundaryName ? ` at ${data.boundaryName}` : ''}`,
        data: { distanceToBoundary: data.distanceToBoundary, boundaryName: data.boundaryName },
        detectedAt: new Date(),
      };

      if (!state.activeEmergencies.has(event.type)) {
        state.activeEmergencies.add(event.type);
        this.eventEmitter.emit('emergency.detected', event);
      }
      return event;
    }

    if (data.distanceToBoundary < this.defaultThresholds.geofence.warningDistance) {
      const event: EmergencyEvent = {
        type: 'geofence_warning',
        severity: 'warning',
        droneId: data.droneId,
        flightId: data.flightId,
        message: `Approaching geofence boundary (${Math.round(data.distanceToBoundary)}m)`,
        data: { distanceToBoundary: data.distanceToBoundary, boundaryName: data.boundaryName },
        detectedAt: new Date(),
      };

      if (!state.activeEmergencies.has(event.type)) {
        state.activeEmergencies.add(event.type);
        this.eventEmitter.emit('emergency.detected', event);
      }
      return event;
    }

    // Clear geofence warnings if back in safe zone
    state.activeEmergencies.delete('geofence_warning');
    state.activeEmergencies.delete('geofence_breach');
    return null;
  }

  /**
   * Analyze collision threats
   */
  analyzeCollision(data: CollisionData): EmergencyEvent | null {
    const state = this.getOrCreateDroneState(data.droneId);
    const thresholds = this.defaultThresholds.collision;

    let type: EmergencyType;
    let severity: EmergencySeverity;
    let message: string;

    if (data.threatType === 'aircraft') {
      if (data.distance < thresholds.aircraftCritical) {
        type = 'collision_aircraft';
        severity = 'emergency';
        message = `AIRCRAFT PROXIMITY ALERT: ${Math.round(data.distance)}m`;
      } else if (data.distance < thresholds.aircraftWarning) {
        type = 'collision_aircraft';
        severity = 'critical';
        message = `Aircraft detected at ${Math.round(data.distance)}m`;
      } else {
        return null;
      }
    } else if (data.threatType === 'obstacle') {
      if (data.distance < thresholds.obstacleCritical) {
        type = 'collision_obstacle';
        severity = 'emergency';
        message = `OBSTACLE COLLISION IMMINENT: ${Math.round(data.distance)}m`;
      } else if (data.distance < thresholds.obstacleWarning) {
        type = 'collision_obstacle';
        severity = 'critical';
        message = `Obstacle detected at ${Math.round(data.distance)}m`;
      } else {
        return null;
      }
    } else {
      return null;
    }

    const event: EmergencyEvent = {
      type,
      severity,
      droneId: data.droneId,
      flightId: data.flightId,
      message,
      data: { distance: data.distance, bearing: data.bearing, threatType: data.threatType },
      detectedAt: new Date(),
    };

    if (!state.activeEmergencies.has(event.type)) {
      state.activeEmergencies.add(event.type);
      this.eventEmitter.emit('emergency.detected', event);
    }

    return event;
  }

  /**
   * Clear an emergency when resolved
   */
  clearEmergency(droneId: string, type: EmergencyType) {
    const state = this.droneStates.get(droneId);
    if (state) {
      state.activeEmergencies.delete(type);
      this.logger.log(`Cleared ${type} emergency for drone ${droneId}`);
    }
  }

  /**
   * Clear all emergencies for a drone (e.g., flight ended)
   */
  clearAllEmergencies(droneId: string) {
    const state = this.droneStates.get(droneId);
    if (state) {
      state.activeEmergencies.clear();
    }
  }

  /**
   * Get active emergencies for a drone
   */
  getActiveEmergencies(droneId: string): EmergencyType[] {
    const state = this.droneStates.get(droneId);
    return state ? Array.from(state.activeEmergencies) : [];
  }

  // ============ Private Methods ============

  private getOrCreateDroneState(droneId: string): DroneMonitorState {
    let state = this.droneStates.get(droneId);
    if (!state) {
      state = {
        lastBatteryLevel: 100,
        lastBatteryCheck: new Date(),
        batteryReadings: [],
        lastSignalStrength: 100,
        activeEmergencies: new Set(),
      };
      this.droneStates.set(droneId, state);
    }
    return state;
  }

  private updateDroneState(telemetry: TelemetryData, state: DroneMonitorState) {
    // Update battery tracking
    state.batteryReadings.push({ level: telemetry.batteryLevel, time: telemetry.timestamp });
    // Keep only last 60 readings (1 minute at 1Hz)
    if (state.batteryReadings.length > 60) {
      state.batteryReadings.shift();
    }
    state.lastBatteryLevel = telemetry.batteryLevel;
    state.lastBatteryCheck = telemetry.timestamp;

    // Update signal tracking
    state.lastSignalStrength = telemetry.signalStrength;
    if (telemetry.signalStrength > 20) {
      state.signalLostAt = undefined;
    }
  }

  private checkBattery(telemetry: TelemetryData, state: DroneMonitorState): EmergencyEvent[] {
    const events: EmergencyEvent[] = [];
    const thresholds = this.defaultThresholds.battery;
    const level = telemetry.batteryLevel;

    // Check absolute levels
    if (level <= thresholds.emergency) {
      events.push(this.createEvent(
        'battery_critical',
        'emergency',
        telemetry,
        `CRITICAL: Battery at ${level}%! Immediate landing required.`,
        { batteryLevel: level },
      ));
    } else if (level <= thresholds.critical) {
      events.push(this.createEvent(
        'battery_critical',
        'critical',
        telemetry,
        `Battery critical at ${level}%. Return to base recommended.`,
        { batteryLevel: level },
      ));
    } else if (level <= thresholds.warning) {
      events.push(this.createEvent(
        'battery_low',
        'warning',
        telemetry,
        `Battery low at ${level}%. Consider returning to base.`,
        { batteryLevel: level },
      ));
    }

    // Check discharge rate
    const dischargeRate = this.calculateDischargeRate(state);
    if (dischargeRate !== null) {
      if (dischargeRate >= thresholds.rapidDischargeCritical) {
        events.push(this.createEvent(
          'battery_rapid_discharge',
          'critical',
          telemetry,
          `Rapid battery discharge: ${dischargeRate.toFixed(1)}%/min`,
          { dischargeRate, batteryLevel: level },
        ));
      } else if (dischargeRate >= thresholds.rapidDischargeWarning) {
        events.push(this.createEvent(
          'battery_rapid_discharge',
          'warning',
          telemetry,
          `Elevated battery discharge: ${dischargeRate.toFixed(1)}%/min`,
          { dischargeRate, batteryLevel: level },
        ));
      }
    }

    return events;
  }

  private checkSignal(telemetry: TelemetryData, state: DroneMonitorState): EmergencyEvent[] {
    const events: EmergencyEvent[] = [];
    const thresholds = this.defaultThresholds.signal;
    const strength = telemetry.signalStrength;

    if (strength <= thresholds.critical) {
      // Track signal lost duration
      if (!state.signalLostAt) {
        state.signalLostAt = telemetry.timestamp;
      }

      const lostDuration = (telemetry.timestamp.getTime() - state.signalLostAt.getTime()) / 1000;

      if (lostDuration >= thresholds.lostCriticalSeconds) {
        events.push(this.createEvent(
          'signal_lost',
          'critical',
          telemetry,
          `Signal lost for ${Math.round(lostDuration)} seconds`,
          { signalStrength: strength, lostDuration },
        ));
      } else if (lostDuration >= thresholds.lostWarningSeconds) {
        events.push(this.createEvent(
          'signal_lost',
          'warning',
          telemetry,
          `Signal degraded for ${Math.round(lostDuration)} seconds`,
          { signalStrength: strength, lostDuration },
        ));
      }
    } else if (strength <= thresholds.warning) {
      events.push(this.createEvent(
        'signal_weak',
        'warning',
        telemetry,
        `Weak signal: ${strength}%`,
        { signalStrength: strength },
      ));
    }

    return events;
  }

  private checkGps(telemetry: TelemetryData, state: DroneMonitorState): EmergencyEvent[] {
    const events: EmergencyEvent[] = [];
    const thresholds = this.defaultThresholds.gps;

    if (telemetry.gpsHdop !== undefined) {
      if (telemetry.gpsHdop >= thresholds.hdopCritical) {
        events.push(this.createEvent(
          'gps_degraded',
          'critical',
          telemetry,
          `GPS severely degraded (HDOP: ${telemetry.gpsHdop.toFixed(1)})`,
          { hdop: telemetry.gpsHdop, satellites: telemetry.gpsSatellites },
        ));
      } else if (telemetry.gpsHdop >= thresholds.hdopWarning) {
        events.push(this.createEvent(
          'gps_degraded',
          'warning',
          telemetry,
          `GPS accuracy degraded (HDOP: ${telemetry.gpsHdop.toFixed(1)})`,
          { hdop: telemetry.gpsHdop, satellites: telemetry.gpsSatellites },
        ));
      }
    }

    return events;
  }

  private calculateDischargeRate(state: DroneMonitorState): number | null {
    if (state.batteryReadings.length < 10) return null;

    const recent = state.batteryReadings.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const levelDiff = oldest.level - newest.level;
    const timeDiff = (newest.time.getTime() - oldest.time.getTime()) / 60000; // minutes

    if (timeDiff < 0.1) return null;
    return levelDiff / timeDiff; // %/min
  }

  private createEvent(
    type: EmergencyType,
    severity: EmergencySeverity,
    telemetry: TelemetryData,
    message: string,
    data: Record<string, unknown>,
  ): EmergencyEvent {
    return {
      type,
      severity,
      droneId: telemetry.droneId,
      flightId: telemetry.flightId,
      message,
      data,
      detectedAt: new Date(),
      position: telemetry.position,
    };
  }
}
