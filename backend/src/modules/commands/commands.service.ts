import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DroneCommand, CommandType, CommandStatus } from './command.entity';
import { EventsGateway } from '../../gateways/events.gateway';

export interface SendCommandDto {
  commandType: CommandType;
  flightId?: string;
  parameters?: Record<string, unknown>;
}

// Simulation timing configuration (in milliseconds)
const COMMAND_TIMING: Record<CommandType, { ack: number; execute: number; complete: number }> = {
  takeoff: { ack: 500, execute: 3000, complete: 15000 },
  land: { ack: 500, execute: 2000, complete: 20000 },
  rtl: { ack: 500, execute: 1000, complete: 30000 },
  emergency_stop: { ack: 100, execute: 100, complete: 500 },
  pause: { ack: 200, execute: 500, complete: 1000 },
  hover: { ack: 200, execute: 500, complete: 1000 },
  resume: { ack: 200, execute: 500, complete: 1000 },
};

@Injectable()
export class CommandsService {
  constructor(
    @InjectRepository(DroneCommand)
    private commandRepository: Repository<DroneCommand>,
    private eventsGateway: EventsGateway,
  ) {}

  async sendCommand(
    droneId: string,
    dto: SendCommandDto,
    userId: string,
  ): Promise<DroneCommand> {
    // Create command record
    const command = this.commandRepository.create({
      droneId,
      flightId: dto.flightId,
      commandType: dto.commandType,
      parameters: dto.parameters,
      status: 'pending',
      issuedBy: userId,
      issuedAt: new Date(),
    });

    const savedCommand = await this.commandRepository.save(command);

    // Emit initial status
    this.eventsGateway.emitCommandStatus(droneId, {
      commandId: savedCommand.id,
      status: 'pending',
      commandType: savedCommand.commandType,
      message: 'Command queued',
    });

    // Start simulation
    this.simulateExecution(savedCommand);

    return savedCommand;
  }

  private async simulateExecution(command: DroneCommand): Promise<void> {
    const timing = COMMAND_TIMING[command.commandType];

    // Simulate sending and acknowledgment
    await this.delay(timing.ack);
    await this.updateStatus(command, 'acknowledged');

    // Simulate execution start
    await this.delay(timing.execute);
    await this.updateStatus(command, 'executing');

    // Simulate completion
    await this.delay(timing.complete);
    await this.updateStatus(command, 'completed');
  }

  private async updateStatus(command: DroneCommand, status: CommandStatus): Promise<void> {
    const updates: {
      status: CommandStatus;
      acknowledgedAt?: Date;
      completedAt?: Date;
    } = { status };

    if (status === 'acknowledged') {
      updates.acknowledgedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }

    await this.commandRepository.update(command.id, updates);

    const statusMessages: Record<CommandStatus, string> = {
      pending: 'Command queued',
      sent: 'Command sent to drone',
      acknowledged: 'Command acknowledged by drone',
      executing: `Executing ${command.commandType}`,
      completed: `${command.commandType} completed successfully`,
      failed: `${command.commandType} failed`,
      cancelled: 'Command cancelled',
    };

    this.eventsGateway.emitCommandStatus(command.droneId, {
      commandId: command.id,
      status,
      commandType: command.commandType,
      message: statusMessages[status],
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getHistory(droneId: string, limit: number = 50): Promise<DroneCommand[]> {
    return this.commandRepository.find({
      where: { droneId },
      order: { issuedAt: 'DESC' },
      take: limit,
    });
  }

  async getById(droneId: string, commandId: string): Promise<DroneCommand> {
    const command = await this.commandRepository.findOne({
      where: { id: commandId, droneId },
    });

    if (!command) {
      throw new NotFoundException('Command not found');
    }

    return command;
  }

  async cancelCommand(droneId: string, commandId: string): Promise<DroneCommand> {
    const command = await this.getById(droneId, commandId);

    if (command.status !== 'pending' && command.status !== 'sent') {
      throw new BadRequestException('Cannot cancel command that is already being executed');
    }

    await this.commandRepository.update(command.id, {
      status: 'cancelled',
      completedAt: new Date(),
    });

    this.eventsGateway.emitCommandStatus(droneId, {
      commandId: command.id,
      status: 'cancelled',
      commandType: command.commandType,
      message: 'Command cancelled by operator',
    });

    return this.getById(droneId, commandId);
  }

  async getByFlightId(flightId: string, limit: number = 50): Promise<DroneCommand[]> {
    return this.commandRepository.find({
      where: { flightId },
      order: { issuedAt: 'DESC' },
      take: limit,
    });
  }
}
