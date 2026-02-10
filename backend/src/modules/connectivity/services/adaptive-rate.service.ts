import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { WebSocketAdapter } from '../adapters/websocket.adapter';
import { DeviceRegistryService } from './device-registry.service';

export type TelemetryMode = 'idle' | 'normal' | 'enhanced' | 'emergency';

export interface ModeConfig {
  intervalMs: number;
  rateHz: number;
  description: string;
}

const MODE_CONFIGS: Record<TelemetryMode, ModeConfig> = {
  idle: {
    intervalMs: 30000,
    rateHz: 0.033,
    description: 'Drone on ground',
  },
  normal: {
    intervalMs: 2000,
    rateHz: 0.5,
    description: 'Standard flight',
  },
  enhanced: {
    intervalMs: 500,
    rateHz: 2,
    description: 'Near geofence or traffic',
  },
  emergency: {
    intervalMs: 100,
    rateHz: 10,
    description: 'Active incident',
  },
};

interface DeviceTelemetryState {
  deviceId: string;
  droneId: string;
  currentMode: TelemetryMode;
  modeSetAt: Date;
  modeReason: string;
  pendingModeChanges: { mode: TelemetryMode; priority: number }[];
}

@Injectable()
export class AdaptiveRateService implements OnModuleInit {
  private readonly logger = new Logger(AdaptiveRateService.name);
  private deviceStates: Map<string, DeviceTelemetryState> = new Map();

  constructor(
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly deviceRegistry: DeviceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Adaptive rate service initialized');
  }

  getModeConfig(mode: TelemetryMode): ModeConfig {
    return MODE_CONFIGS[mode];
  }

  getAllModeConfigs(): Record<TelemetryMode, ModeConfig> {
    return MODE_CONFIGS;
  }

  getDeviceMode(deviceId: string): TelemetryMode {
    const state = this.deviceStates.get(deviceId);
    return state?.currentMode || 'idle';
  }

  getDeviceState(deviceId: string): DeviceTelemetryState | undefined {
    return this.deviceStates.get(deviceId);
  }

  async setDeviceMode(
    deviceId: string,
    mode: TelemetryMode,
    reason: string,
    priority: number = 0,
  ): Promise<void> {
    let state = this.deviceStates.get(deviceId);

    if (!state) {
      const registration = await this.deviceRegistry.findById(deviceId);
      state = {
        deviceId,
        droneId: registration.droneId,
        currentMode: 'idle',
        modeSetAt: new Date(),
        modeReason: 'initial',
        pendingModeChanges: [],
      };
      this.deviceStates.set(deviceId, state);
    }

    const currentPriority = this.getModePriority(state.currentMode);
    if (priority < currentPriority && mode !== 'emergency') {
      state.pendingModeChanges.push({ mode, priority });
      return;
    }

    if (state.currentMode === mode) {
      return;
    }

    const previousMode = state.currentMode;
    state.currentMode = mode;
    state.modeSetAt = new Date();
    state.modeReason = reason;

    const config = MODE_CONFIGS[mode];

    this.websocketAdapter.emitTelemetryRateChange(deviceId, config.rateHz);

    this.eventEmitter.emit('telemetry.rate_changed', {
      deviceId,
      droneId: state.droneId,
      previousMode,
      currentMode: mode,
      rateHz: config.rateHz,
      reason,
    });

    this.logger.log(
      `Device ${deviceId} telemetry mode: ${previousMode} -> ${mode} (${reason})`,
    );
  }

  async revertToNormalMode(deviceId: string, fromMode: TelemetryMode): Promise<void> {
    const state = this.deviceStates.get(deviceId);
    if (!state) return;

    if (state.currentMode !== fromMode) {
      return;
    }

    const pendingHigherPriority = state.pendingModeChanges.filter(
      (change) => this.getModePriority(change.mode) > this.getModePriority('normal'),
    );

    if (pendingHigherPriority.length > 0) {
      const highest = pendingHigherPriority.reduce((prev, curr) =>
        this.getModePriority(curr.mode) > this.getModePriority(prev.mode) ? curr : prev,
      );
      state.pendingModeChanges = state.pendingModeChanges.filter(
        (c) => c !== highest,
      );
      await this.setDeviceMode(deviceId, highest.mode, 'pending escalation', highest.priority);
    } else {
      await this.setDeviceMode(deviceId, 'normal', 'reverted from ' + fromMode, 0);
    }
  }

  private getModePriority(mode: TelemetryMode): number {
    const priorities: Record<TelemetryMode, number> = {
      idle: 0,
      normal: 1,
      enhanced: 2,
      emergency: 3,
    };
    return priorities[mode];
  }

  @OnEvent('flight.started')
  async handleFlightStarted(payload: { droneId: string }): Promise<void> {
    const registration = await this.deviceRegistry.findByDroneId(payload.droneId);
    if (!registration) return;

    await this.setDeviceMode(registration.id, 'normal', 'flight started', 1);
  }

  @OnEvent('flight.ended')
  async handleFlightEnded(payload: { droneId: string }): Promise<void> {
    const registration = await this.deviceRegistry.findByDroneId(payload.droneId);
    if (!registration) return;

    await this.setDeviceMode(registration.id, 'idle', 'flight ended', 0);
  }

  @OnEvent('emergency.detected')
  async handleEmergencyDetected(payload: { droneId: string; incidentId: string }): Promise<void> {
    const registration = await this.deviceRegistry.findByDroneId(payload.droneId);
    if (!registration) return;

    await this.setDeviceMode(
      registration.id,
      'emergency',
      `emergency incident ${payload.incidentId}`,
      3,
    );
  }

  @OnEvent('emergency.resolved')
  async handleEmergencyResolved(payload: { droneId: string }): Promise<void> {
    const registration = await this.deviceRegistry.findByDroneId(payload.droneId);
    if (!registration) return;

    await this.revertToNormalMode(registration.id, 'emergency');
  }

  @OnEvent('geofence.approaching')
  async handleGeofenceApproaching(payload: {
    droneId: string;
    geofenceId: string;
    distance: number;
  }): Promise<void> {
    const registration = await this.deviceRegistry.findByDroneId(payload.droneId);
    if (!registration) return;

    await this.setDeviceMode(
      registration.id,
      'enhanced',
      `approaching geofence ${payload.geofenceId}`,
      2,
    );
  }

  @OnEvent('geofence.cleared')
  async handleGeofenceCleared(payload: { droneId: string }): Promise<void> {
    const registration = await this.deviceRegistry.findByDroneId(payload.droneId);
    if (!registration) return;

    await this.revertToNormalMode(registration.id, 'enhanced');
  }

  @OnEvent('traffic.conflict_detected')
  async handleTrafficConflict(payload: {
    droneId: string;
    conflictId: string;
  }): Promise<void> {
    const registration = await this.deviceRegistry.findByDroneId(payload.droneId);
    if (!registration) return;

    await this.setDeviceMode(
      registration.id,
      'enhanced',
      `traffic conflict ${payload.conflictId}`,
      2,
    );
  }

  @OnEvent('traffic.conflict_resolved')
  async handleTrafficConflictResolved(payload: { droneId: string }): Promise<void> {
    const registration = await this.deviceRegistry.findByDroneId(payload.droneId);
    if (!registration) return;

    await this.revertToNormalMode(registration.id, 'enhanced');
  }

  @OnEvent('device.connected')
  async handleDeviceConnected(payload: { deviceId: string; droneId?: string }): Promise<void> {
    if (!payload.droneId) return;

    this.deviceStates.set(payload.deviceId, {
      deviceId: payload.deviceId,
      droneId: payload.droneId,
      currentMode: 'idle',
      modeSetAt: new Date(),
      modeReason: 'device connected',
      pendingModeChanges: [],
    });
  }

  @OnEvent('device.disconnected')
  handleDeviceDisconnected(payload: { deviceId: string }): void {
    this.deviceStates.delete(payload.deviceId);
  }

  getStats(): {
    totalDevices: number;
    byMode: Record<TelemetryMode, number>;
  } {
    const byMode: Record<TelemetryMode, number> = {
      idle: 0,
      normal: 0,
      enhanced: 0,
      emergency: 0,
    };

    for (const state of this.deviceStates.values()) {
      byMode[state.currentMode]++;
    }

    return {
      totalDevices: this.deviceStates.size,
      byMode,
    };
  }
}
