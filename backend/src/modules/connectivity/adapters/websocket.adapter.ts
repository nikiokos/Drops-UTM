import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IProtocolAdapter,
  DroneMessage,
  OutboundCommand,
  TelemetryPayload,
  CommandAckPayload,
} from './protocol-adapter.interface';
import { EventsGateway } from '../../../gateways/events.gateway';
import { DeviceRegistryService } from '../services/device-registry.service';
import { CertificateService } from '../services/certificate.service';

interface DeviceConnection {
  deviceId: string;
  deviceIdentifier: string;
  droneId: string | null;
  socketId: string;
  connectedAt: Date;
}

@Injectable()
export class WebSocketAdapter implements IProtocolAdapter, OnModuleInit {
  readonly protocolName = 'websocket' as const;
  private readonly logger = new Logger(WebSocketAdapter.name);
  private messageCallback: ((msg: DroneMessage) => void) | null = null;
  private connectedDevices: Map<string, DeviceConnection> = new Map();
  private socketToDevice: Map<string, string> = new Map();

  constructor(
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
    private readonly deviceRegistry: DeviceRegistryService,
    private readonly certificateService: CertificateService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.eventsGateway.setWebSocketAdapter(this);
    this.logger.log('WebSocket adapter registered with gateway');
  }

  async initialize(): Promise<void> {
    this.logger.log('WebSocket adapter initialized');
  }

  async shutdown(): Promise<void> {
    this.connectedDevices.clear();
    this.socketToDevice.clear();
    this.logger.log('WebSocket adapter shutdown');
  }

  onMessage(callback: (msg: DroneMessage) => void): void {
    this.messageCallback = callback;
  }

  async handleDeviceConnect(
    socketId: string,
    data: {
      deviceIdentifier?: string;
      authMethod: 'certificate' | 'token';
      certificateFingerprint?: string;
      token?: string;
    },
  ): Promise<{ success: boolean; error?: string; deviceId?: string }> {
    try {
      let registration;

      if (data.authMethod === 'certificate' && data.certificateFingerprint) {
        const validation = await this.certificateService.validateCertificateByFingerprint(
          data.certificateFingerprint,
        );

        if (!validation.valid) {
          return { success: false, error: validation.error };
        }

        registration = validation.registration;
      } else if (data.authMethod === 'token' && data.deviceIdentifier) {
        const found = await this.deviceRegistry.findByIdentifier(data.deviceIdentifier);

        if (!found) {
          return { success: false, error: 'Device not registered' };
        }

        if (found.registrationStatus !== 'active') {
          return { success: false, error: 'Device registration is not active' };
        }
        registration = found;
      } else {
        return { success: false, error: 'Invalid authentication method' };
      }

      if (!registration) {
        return { success: false, error: 'Registration not found' };
      }

      const existingSocket = registration.socketId;
      if (existingSocket && existingSocket !== socketId) {
        this.disconnectDevice(existingSocket, 'replaced');
      }

      await this.deviceRegistry.updateConnectionStatus(
        registration.id,
        'online',
        socketId,
      );

      const connection: DeviceConnection = {
        deviceId: registration.id,
        deviceIdentifier: registration.deviceIdentifier,
        droneId: registration.droneId,
        socketId,
        connectedAt: new Date(),
      };

      this.connectedDevices.set(registration.id, connection);
      this.socketToDevice.set(socketId, registration.id);

      this.eventEmitter.emit('device.connected', {
        deviceId: registration.id,
        deviceIdentifier: registration.deviceIdentifier,
        droneId: registration.droneId,
        protocol: 'websocket',
      });

      this.logger.log(
        `Device connected: ${registration.deviceIdentifier} (socket: ${socketId})`,
      );

      return { success: true, deviceId: registration.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Device connection failed: ${message}`);
      return { success: false, error: 'Connection failed' };
    }
  }

  async handleDeviceDisconnect(socketId: string): Promise<void> {
    const deviceId = this.socketToDevice.get(socketId);
    if (!deviceId) return;

    const connection = this.connectedDevices.get(deviceId);
    if (!connection) return;

    await this.deviceRegistry.updateConnectionStatus(deviceId, 'offline', undefined);

    this.connectedDevices.delete(deviceId);
    this.socketToDevice.delete(socketId);

    this.eventEmitter.emit('device.disconnected', {
      deviceId,
      deviceIdentifier: connection.deviceIdentifier,
      droneId: connection.droneId,
    });

    this.logger.log(
      `Device disconnected: ${connection.deviceIdentifier} (socket: ${socketId})`,
    );
  }

  async handleDeviceTelemetry(
    socketId: string,
    payload: TelemetryPayload,
  ): Promise<void> {
    const deviceId = this.socketToDevice.get(socketId);
    if (!deviceId) {
      this.logger.warn(`Telemetry from unknown socket: ${socketId}`);
      return;
    }

    const connection = this.connectedDevices.get(deviceId);
    if (!connection || !connection.droneId) return;

    await this.deviceRegistry.updateLastSeen(deviceId);

    const message: DroneMessage = {
      droneId: connection.droneId,
      deviceIdentifier: connection.deviceIdentifier,
      timestamp: new Date(),
      source: 'direct',
      protocol: 'websocket',
      type: 'telemetry',
      payload,
    };

    if (this.messageCallback) {
      this.messageCallback(message);
    }
  }

  async handleDeviceCommandAck(
    socketId: string,
    payload: CommandAckPayload,
  ): Promise<void> {
    const deviceId = this.socketToDevice.get(socketId);
    if (!deviceId) return;

    const connection = this.connectedDevices.get(deviceId);
    if (!connection || !connection.droneId) return;

    const message: DroneMessage = {
      droneId: connection.droneId,
      deviceIdentifier: connection.deviceIdentifier,
      timestamp: new Date(),
      source: 'direct',
      protocol: 'websocket',
      type: 'command_ack',
      payload,
    };

    if (this.messageCallback) {
      this.messageCallback(message);
    }
  }

  async sendCommand(deviceId: string, cmd: OutboundCommand): Promise<boolean> {
    const connection = this.connectedDevices.get(deviceId);
    if (!connection) {
      this.logger.warn(`Cannot send command to disconnected device: ${deviceId}`);
      return false;
    }

    try {
      this.eventsGateway.server
        .to(connection.socketId)
        .emit('device_command', cmd);

      this.logger.debug(
        `Command sent to ${connection.deviceIdentifier}: ${cmd.commandType}`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send command: ${message}`);
      return false;
    }
  }

  emitTelemetryRateChange(deviceId: string, rateHz: number): void {
    const connection = this.connectedDevices.get(deviceId);
    if (!connection) return;

    this.eventsGateway.server
      .to(connection.socketId)
      .emit('telemetry_rate_change', { rateHz });
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.connectedDevices.has(deviceId);
  }

  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  getConnectionBySocketId(socketId: string): DeviceConnection | undefined {
    const deviceId = this.socketToDevice.get(socketId);
    if (!deviceId) return undefined;
    return this.connectedDevices.get(deviceId);
  }

  getConnectionByDroneId(droneId: string): DeviceConnection | undefined {
    for (const connection of this.connectedDevices.values()) {
      if (connection.droneId === droneId) {
        return connection;
      }
    }
    return undefined;
  }

  private disconnectDevice(socketId: string, reason: string): void {
    const socket = this.eventsGateway.server.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('device_disconnect', { reason });
      socket.disconnect(true);
    }
  }
}
