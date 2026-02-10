import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IProtocolAdapter,
  DroneMessage,
  OutboundCommand,
  TelemetryPayload,
} from '../adapters/protocol-adapter.interface';
import { WebSocketAdapter } from '../adapters/websocket.adapter';
import { MessageNormalizerService } from './message-normalizer.service';

@Injectable()
export class ProtocolGatewayService implements OnModuleInit {
  private readonly logger = new Logger(ProtocolGatewayService.name);
  private adapters: Map<string, IProtocolAdapter> = new Map();
  private messageHandlers: ((msg: DroneMessage) => void)[] = [];

  constructor(
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly messageNormalizer: MessageNormalizerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerAdapter(this.websocketAdapter);
    this.logger.log('Protocol gateway initialized');
  }

  async registerAdapter(adapter: IProtocolAdapter): Promise<void> {
    await adapter.initialize();

    adapter.onMessage((msg: DroneMessage) => {
      this.handleIncomingMessage(msg);
    });

    this.adapters.set(adapter.protocolName, adapter);
    this.logger.log(`Registered adapter: ${adapter.protocolName}`);
  }

  onMessage(handler: (msg: DroneMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  private handleIncomingMessage(msg: DroneMessage): void {
    const validation = this.validateMessage(msg);
    if (!validation.valid) {
      this.logger.warn(`Invalid message from ${msg.deviceIdentifier}: ${validation.errors.join(', ')}`);
      return;
    }

    for (const handler of this.messageHandlers) {
      try {
        handler(msg);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Message handler error: ${message}`);
      }
    }

    this.eventEmitter.emit(`drone.message.${msg.type}`, msg);

    if (msg.type === 'telemetry') {
      this.eventEmitter.emit('telemetry.received', {
        droneId: msg.droneId,
        payload: msg.payload as TelemetryPayload,
        timestamp: msg.timestamp,
        source: msg.source,
        protocol: msg.protocol,
      });
    }
  }

  private validateMessage(msg: DroneMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!msg.droneId) {
      errors.push('Missing droneId');
    }

    if (!msg.deviceIdentifier) {
      errors.push('Missing deviceIdentifier');
    }

    if (!msg.timestamp) {
      errors.push('Missing timestamp');
    }

    if (!msg.type) {
      errors.push('Missing type');
    }

    if (!msg.payload) {
      errors.push('Missing payload');
    }

    if (msg.type === 'telemetry') {
      const telemetryValidation = this.messageNormalizer.validateTelemetryPayload(
        msg.payload as TelemetryPayload,
      );
      if (!telemetryValidation.valid) {
        errors.push(...telemetryValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async sendCommand(
    deviceId: string,
    command: OutboundCommand,
  ): Promise<{ sent: boolean; adapter?: string; error?: string }> {
    for (const [name, adapter] of this.adapters) {
      if (adapter.isDeviceConnected(deviceId)) {
        const sent = await adapter.sendCommand(deviceId, command);
        if (sent) {
          this.logger.debug(
            `Command ${command.commandId} sent via ${name} to device ${deviceId}`,
          );
          return { sent: true, adapter: name };
        }
      }
    }

    this.logger.warn(`No connected adapter found for device ${deviceId}`);
    return { sent: false, error: 'Device not connected to any protocol' };
  }

  isDeviceConnected(deviceId: string): boolean {
    for (const adapter of this.adapters.values()) {
      if (adapter.isDeviceConnected(deviceId)) {
        return true;
      }
    }
    return false;
  }

  getDeviceProtocol(deviceId: string): string | null {
    for (const [name, adapter] of this.adapters) {
      if (adapter.isDeviceConnected(deviceId)) {
        return name;
      }
    }
    return null;
  }

  getAllConnectedDevices(): { deviceId: string; protocol: string }[] {
    const devices: { deviceId: string; protocol: string }[] = [];

    for (const [name, adapter] of this.adapters) {
      for (const deviceId of adapter.getConnectedDevices()) {
        devices.push({ deviceId, protocol: name });
      }
    }

    return devices;
  }

  getAdapterStats(): Record<string, { connected: number }> {
    const stats: Record<string, { connected: number }> = {};

    for (const [name, adapter] of this.adapters) {
      stats[name] = {
        connected: adapter.getConnectedDevices().length,
      };
    }

    return stats;
  }

  async shutdown(): Promise<void> {
    for (const [name, adapter] of this.adapters) {
      try {
        await adapter.shutdown();
        this.logger.log(`Adapter ${name} shutdown complete`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Error shutting down adapter ${name}: ${message}`);
      }
    }
    this.adapters.clear();
  }
}
