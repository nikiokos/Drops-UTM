import { Injectable, Logger } from '@nestjs/common';
import {
  DroneMessage,
  TelemetryPayload,
  StatusPayload,
  EventPayload,
  CommandAckPayload,
  ProtocolType,
  MessageSource,
} from '../adapters/protocol-adapter.interface';

interface RawMavLinkTelemetry {
  lat: number;
  lon: number;
  alt: number;
  hdg: number;
  groundspeed: number;
  battery_remaining: number;
  voltage_battery?: number;
  satellites_visible?: number;
  rssi?: number;
  custom_mode?: number;
  base_mode?: number;
}

interface RawMqttTelemetry {
  position: {
    latitude: number;
    longitude: number;
    altitude_m: number;
  };
  attitude: {
    heading_deg: number;
  };
  velocity: {
    ground_speed_mps: number;
  };
  power: {
    battery_percent: number;
    voltage_v?: number;
  };
  gps?: {
    satellites: number;
    fix_type: number;
  };
  signal?: {
    rssi_dbm: number;
  };
}

@Injectable()
export class MessageNormalizerService {
  private readonly logger = new Logger(MessageNormalizerService.name);

  normalizeTelemetry(
    protocol: ProtocolType,
    rawData: unknown,
  ): TelemetryPayload | null {
    try {
      switch (protocol) {
        case 'websocket':
          return this.normalizeWebSocketTelemetry(rawData);
        case 'mavlink':
          return this.normalizeMavLinkTelemetry(rawData as RawMavLinkTelemetry);
        case 'mqtt':
          return this.normalizeMqttTelemetry(rawData as RawMqttTelemetry);
        case 'rest':
          return this.normalizeRestTelemetry(rawData);
        default:
          this.logger.warn(`Unknown protocol: ${protocol}`);
          return null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to normalize telemetry: ${message}`);
      return null;
    }
  }

  private normalizeWebSocketTelemetry(rawData: unknown): TelemetryPayload {
    const data = rawData as TelemetryPayload;
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude,
      heading: data.heading,
      speed: data.speed,
      batteryLevel: data.batteryLevel,
      batteryVoltage: data.batteryVoltage,
      satellites: data.satellites,
      signalStrength: data.signalStrength,
      flightMode: data.flightMode,
      armed: data.armed,
      custom: data.custom,
    };
  }

  private normalizeMavLinkTelemetry(data: RawMavLinkTelemetry): TelemetryPayload {
    return {
      latitude: data.lat / 1e7,
      longitude: data.lon / 1e7,
      altitude: data.alt / 1000,
      heading: data.hdg / 100,
      speed: data.groundspeed,
      batteryLevel: data.battery_remaining,
      batteryVoltage: data.voltage_battery ? data.voltage_battery / 1000 : undefined,
      satellites: data.satellites_visible,
      signalStrength: data.rssi,
      flightMode: this.mavlinkModeToString(data.custom_mode, data.base_mode),
      armed: data.base_mode ? (data.base_mode & 128) !== 0 : undefined,
    };
  }

  private mavlinkModeToString(customMode?: number, baseMode?: number): string | undefined {
    if (customMode === undefined) return undefined;
    const modes: Record<number, string> = {
      0: 'STABILIZE',
      2: 'ALT_HOLD',
      3: 'AUTO',
      4: 'GUIDED',
      5: 'LOITER',
      6: 'RTL',
      9: 'LAND',
      16: 'POSHOLD',
    };
    return modes[customMode] || `MODE_${customMode}`;
  }

  private normalizeMqttTelemetry(data: RawMqttTelemetry): TelemetryPayload {
    return {
      latitude: data.position.latitude,
      longitude: data.position.longitude,
      altitude: data.position.altitude_m,
      heading: data.attitude.heading_deg,
      speed: data.velocity.ground_speed_mps,
      batteryLevel: data.power.battery_percent,
      batteryVoltage: data.power.voltage_v,
      satellites: data.gps?.satellites,
      signalStrength: data.signal?.rssi_dbm,
    };
  }

  private normalizeRestTelemetry(rawData: unknown): TelemetryPayload {
    return this.normalizeWebSocketTelemetry(rawData);
  }

  normalizeCommandAck(
    protocol: ProtocolType,
    rawData: unknown,
  ): CommandAckPayload | null {
    try {
      const data = rawData as Record<string, unknown>;

      switch (protocol) {
        case 'mavlink':
          return this.normalizeMavLinkCommandAck(data);
        default:
          return {
            commandId: data.commandId as string,
            status: data.status as CommandAckPayload['status'],
            message: data.message as string | undefined,
            result: data.result as Record<string, unknown> | undefined,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to normalize command ack: ${message}`);
      return null;
    }
  }

  private normalizeMavLinkCommandAck(data: Record<string, unknown>): CommandAckPayload {
    const mavResult = data.result as number;
    const statusMap: Record<number, CommandAckPayload['status']> = {
      0: 'completed',
      1: 'failed',
      2: 'failed',
      3: 'failed',
      4: 'executing',
      5: 'received',
    };

    return {
      commandId: data.commandId as string,
      status: statusMap[mavResult] || 'failed',
      message: data.message as string | undefined,
      result: { mavResult },
    };
  }

  createDroneMessage(
    droneId: string,
    deviceIdentifier: string,
    source: MessageSource,
    protocol: ProtocolType,
    type: 'telemetry',
    payload: TelemetryPayload,
  ): DroneMessage;
  createDroneMessage(
    droneId: string,
    deviceIdentifier: string,
    source: MessageSource,
    protocol: ProtocolType,
    type: 'status',
    payload: StatusPayload,
  ): DroneMessage;
  createDroneMessage(
    droneId: string,
    deviceIdentifier: string,
    source: MessageSource,
    protocol: ProtocolType,
    type: 'event',
    payload: EventPayload,
  ): DroneMessage;
  createDroneMessage(
    droneId: string,
    deviceIdentifier: string,
    source: MessageSource,
    protocol: ProtocolType,
    type: 'command_ack',
    payload: CommandAckPayload,
  ): DroneMessage;
  createDroneMessage(
    droneId: string,
    deviceIdentifier: string,
    source: MessageSource,
    protocol: ProtocolType,
    type: DroneMessage['type'],
    payload: DroneMessage['payload'],
  ): DroneMessage {
    return {
      droneId,
      deviceIdentifier,
      timestamp: new Date(),
      source,
      protocol,
      type,
      payload,
    };
  }

  validateTelemetryPayload(payload: TelemetryPayload): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (typeof payload.latitude !== 'number' || payload.latitude < -90 || payload.latitude > 90) {
      errors.push('Invalid latitude');
    }

    if (typeof payload.longitude !== 'number' || payload.longitude < -180 || payload.longitude > 180) {
      errors.push('Invalid longitude');
    }

    if (typeof payload.altitude !== 'number') {
      errors.push('Missing altitude');
    }

    if (typeof payload.heading !== 'number' || payload.heading < 0 || payload.heading > 360) {
      errors.push('Invalid heading');
    }

    if (typeof payload.speed !== 'number' || payload.speed < 0) {
      errors.push('Invalid speed');
    }

    if (typeof payload.batteryLevel !== 'number' || payload.batteryLevel < 0 || payload.batteryLevel > 100) {
      errors.push('Invalid battery level');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
