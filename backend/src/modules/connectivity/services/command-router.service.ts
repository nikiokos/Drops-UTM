import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ProtocolGatewayService } from './protocol-gateway.service';
import { DeviceRegistryService } from './device-registry.service';
import { DroneCommand, CommandStatus } from '../../commands/command.entity';
import { EventsGateway } from '../../../gateways/events.gateway';
import { OutboundCommand, CommandAckPayload } from '../adapters/protocol-adapter.interface';

export type CommandPriority = 0 | 1 | 2 | 3;

interface PriorityConfig {
  timeout: number;
  maxRetries: number;
  commands: string[];
}

const PRIORITY_CONFIGS: Record<CommandPriority, PriorityConfig> = {
  0: {
    timeout: 500,
    maxRetries: 3,
    commands: ['emergency_stop', 'land_now'],
  },
  1: {
    timeout: 1000,
    maxRetries: 2,
    commands: ['rtl', 'hover', 'pause'],
  },
  2: {
    timeout: 2000,
    maxRetries: 2,
    commands: ['takeoff', 'land', 'goto', 'set_altitude', 'resume'],
  },
  3: {
    timeout: 5000,
    maxRetries: 1,
    commands: ['update_mission', 'set_home', 'configure'],
  },
};

interface PendingCommand {
  command: DroneCommand;
  outbound: OutboundCommand;
  deviceId: string;
  sentAt: Date;
  retryCount: number;
  timeoutHandle: NodeJS.Timeout;
}

@Injectable()
export class CommandRouterService implements OnModuleInit {
  private readonly logger = new Logger(CommandRouterService.name);
  private pendingCommands: Map<string, PendingCommand> = new Map();

  constructor(
    @InjectRepository(DroneCommand)
    private readonly commandRepository: Repository<DroneCommand>,
    private readonly protocolGateway: ProtocolGatewayService,
    private readonly deviceRegistry: DeviceRegistryService,
    private readonly eventsGateway: EventsGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    this.protocolGateway.onMessage((msg) => {
      if (msg.type === 'command_ack') {
        this.handleCommandAck(msg.droneId, msg.payload as CommandAckPayload);
      }
    });

    this.logger.log('Command router service initialized');
  }

  getPriorityForCommand(commandType: string): CommandPriority {
    for (const [priority, config] of Object.entries(PRIORITY_CONFIGS)) {
      if (config.commands.includes(commandType.toLowerCase())) {
        return parseInt(priority) as CommandPriority;
      }
    }
    return 2;
  }

  async routeCommand(command: DroneCommand): Promise<{
    routed: boolean;
    simulated: boolean;
    error?: string;
  }> {
    const registration = await this.deviceRegistry.findByDroneId(command.droneId);

    if (!registration) {
      this.logger.debug(`No device registration for drone ${command.droneId}, simulating`);
      return { routed: false, simulated: true };
    }

    const isOnline = await this.deviceRegistry.isDeviceOnline(registration.id);

    if (!isOnline) {
      this.logger.debug(`Device ${registration.deviceIdentifier} offline, simulating`);
      return { routed: false, simulated: true };
    }

    const priority = this.getPriorityForCommand(command.commandType);
    const config = PRIORITY_CONFIGS[priority];

    const outbound: OutboundCommand = {
      commandId: command.id,
      commandType: command.commandType,
      parameters: command.parameters as Record<string, unknown>,
      priority,
      timeout: config.timeout,
    };

    const result = await this.protocolGateway.sendCommand(registration.id, outbound);

    if (!result.sent) {
      this.logger.warn(`Failed to send command ${command.id}: ${result.error}`);
      return { routed: false, simulated: true, error: result.error };
    }

    await this.commandRepository.update(command.id, {
      status: 'sent',
    });

    this.eventsGateway.emitCommandStatus(command.droneId, {
      commandId: command.id,
      status: 'sent',
      commandType: command.commandType,
      message: `Command sent via ${result.adapter}`,
    });

    const timeoutHandle = setTimeout(() => {
      this.handleCommandTimeout(command.id);
    }, config.timeout);

    this.pendingCommands.set(command.id, {
      command,
      outbound,
      deviceId: registration.id,
      sentAt: new Date(),
      retryCount: 0,
      timeoutHandle,
    });

    return { routed: true, simulated: false };
  }

  private async handleCommandAck(droneId: string, ack: CommandAckPayload): Promise<void> {
    const pending = this.pendingCommands.get(ack.commandId);

    if (!pending) {
      this.logger.debug(`Received ACK for unknown command ${ack.commandId}`);
      return;
    }

    clearTimeout(pending.timeoutHandle);

    let commandStatus: CommandStatus;
    switch (ack.status) {
      case 'received':
        commandStatus = 'acknowledged';
        break;
      case 'executing':
        commandStatus = 'executing';
        break;
      case 'completed':
        commandStatus = 'completed';
        this.pendingCommands.delete(ack.commandId);
        break;
      case 'failed':
        commandStatus = 'failed';
        this.pendingCommands.delete(ack.commandId);
        break;
      default:
        commandStatus = 'acknowledged';
    }

    const updateData: Partial<DroneCommand> = {
      status: commandStatus,
    };

    if (ack.status === 'received' || ack.status === 'executing') {
      updateData.acknowledgedAt = new Date();
    }

    if (ack.status === 'completed') {
      updateData.completedAt = new Date();
    }

    if (ack.status === 'failed' && ack.message) {
      updateData.errorMessage = ack.message;
    }

    await this.commandRepository.update(ack.commandId, updateData as any);

    this.eventsGateway.emitCommandStatus(droneId, {
      commandId: ack.commandId,
      status: commandStatus,
      commandType: pending.command.commandType,
      message: ack.message || `Command ${commandStatus}`,
    });

    this.eventEmitter.emit('command.ack_received', {
      commandId: ack.commandId,
      droneId,
      status: commandStatus,
      ackStatus: ack.status,
    });

    this.logger.debug(`Command ${ack.commandId} status: ${commandStatus}`);
  }

  private async handleCommandTimeout(commandId: string): Promise<void> {
    const pending = this.pendingCommands.get(commandId);
    if (!pending) return;

    const priority = this.getPriorityForCommand(pending.command.commandType);
    const config = PRIORITY_CONFIGS[priority];

    if (pending.retryCount < config.maxRetries) {
      pending.retryCount++;
      this.logger.warn(
        `Command ${commandId} timeout, retry ${pending.retryCount}/${config.maxRetries}`,
      );

      const result = await this.protocolGateway.sendCommand(
        pending.deviceId,
        pending.outbound,
      );

      if (result.sent) {
        pending.sentAt = new Date();
        pending.timeoutHandle = setTimeout(() => {
          this.handleCommandTimeout(commandId);
        }, config.timeout);
        return;
      }
    }

    this.pendingCommands.delete(commandId);

    await this.commandRepository.update(commandId, {
      status: 'failed',
      errorMessage: 'Command timed out after retries',
    });

    this.eventsGateway.emitCommandStatus(pending.command.droneId, {
      commandId,
      status: 'failed',
      commandType: pending.command.commandType,
      message: 'Command timed out',
    });

    this.eventEmitter.emit('command.timeout', {
      commandId,
      droneId: pending.command.droneId,
      commandType: pending.command.commandType,
      retryCount: pending.retryCount,
    });

    this.logger.error(`Command ${commandId} failed after ${pending.retryCount} retries`);
  }

  cancelPendingCommand(commandId: string): boolean {
    const pending = this.pendingCommands.get(commandId);
    if (!pending) return false;

    clearTimeout(pending.timeoutHandle);
    this.pendingCommands.delete(commandId);

    this.commandRepository.update(commandId, {
      status: 'cancelled',
    });

    return true;
  }

  getPendingCommandsForDrone(droneId: string): PendingCommand[] {
    const commands: PendingCommand[] = [];
    for (const pending of this.pendingCommands.values()) {
      if (pending.command.droneId === droneId) {
        commands.push(pending);
      }
    }
    return commands;
  }

  getStats(): {
    pendingCount: number;
    byPriority: Record<CommandPriority, number>;
  } {
    const byPriority: Record<CommandPriority, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    for (const pending of this.pendingCommands.values()) {
      const priority = pending.outbound.priority as CommandPriority;
      byPriority[priority]++;
    }

    return {
      pendingCount: this.pendingCommands.size,
      byPriority,
    };
  }

  @OnEvent('device.disconnected')
  async handleDeviceDisconnected(payload: { deviceId: string; droneId?: string }): Promise<void> {
    if (!payload.droneId) return;

    const droneCommands = this.getPendingCommandsForDrone(payload.droneId);
    for (const pending of droneCommands) {
      clearTimeout(pending.timeoutHandle);
      this.pendingCommands.delete(pending.command.id);

      await this.commandRepository.update(pending.command.id, {
        status: 'failed',
        errorMessage: 'Device disconnected',
      });

      this.eventsGateway.emitCommandStatus(payload.droneId, {
        commandId: pending.command.id,
        status: 'failed',
        commandType: pending.command.commandType,
        message: 'Device disconnected',
      });
    }

    if (droneCommands.length > 0) {
      this.logger.warn(
        `Cancelled ${droneCommands.length} pending commands for disconnected drone ${payload.droneId}`,
      );
    }
  }
}
