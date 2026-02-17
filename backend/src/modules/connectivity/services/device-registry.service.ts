import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeviceRegistration,
  DeviceType,
  RegistrationStatus,
  ConnectionStatus,
} from '../entities/device-registration.entity';
import { Drone } from '../../drones/drone.entity';

export interface RegisterDeviceDto {
  deviceType: DeviceType;
  droneId?: string;
  hubId?: string;
  supportedProtocols: string[];
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DeviceRegistryService {
  constructor(
    @InjectRepository(DeviceRegistration)
    private readonly registrationRepository: Repository<DeviceRegistration>,
    @InjectRepository(Drone)
    private readonly droneRepository: Repository<Drone>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async registerDevice(dto: RegisterDeviceDto): Promise<DeviceRegistration> {
    let deviceIdentifier: string;

    if (dto.deviceType === 'drone') {
      if (!dto.droneId) {
        throw new BadRequestException('droneId is required for drone devices');
      }
      const drone = await this.droneRepository.findOne({ where: { id: dto.droneId } });
      if (!drone) {
        throw new NotFoundException(`Drone ${dto.droneId} not found`);
      }
      deviceIdentifier = `drone-${drone.registrationNumber}`;

      const existing = await this.registrationRepository.findOne({
        where: { deviceIdentifier },
      });
      if (existing && existing.registrationStatus !== 'revoked') {
        // Return existing active registration instead of erroring
        return existing;
      }
      if (existing && existing.registrationStatus === 'revoked') {
        // Re-activate revoked registration
        existing.registrationStatus = 'pending';
        existing.connectionStatus = 'offline';
        existing.supportedProtocols = dto.supportedProtocols;
        return this.registrationRepository.save(existing);
      }
    } else if (dto.deviceType === 'gateway') {
      if (!dto.hubId) {
        throw new BadRequestException('hubId is required for gateway devices');
      }
      deviceIdentifier = `gateway-${dto.hubId}`;

      const existing = await this.registrationRepository.findOne({
        where: { deviceIdentifier },
      });
      if (existing && existing.registrationStatus !== 'revoked') {
        // Return existing active registration instead of erroring
        return existing;
      }
      if (existing && existing.registrationStatus === 'revoked') {
        // Re-activate revoked registration
        existing.registrationStatus = 'pending';
        existing.connectionStatus = 'offline';
        existing.supportedProtocols = dto.supportedProtocols;
        return this.registrationRepository.save(existing);
      }
    } else {
      deviceIdentifier = `gcs-${Date.now()}`;
    }

    const registration = this.registrationRepository.create({
      deviceType: dto.deviceType,
      droneId: dto.droneId,
      hubId: dto.hubId,
      deviceIdentifier,
      supportedProtocols: dto.supportedProtocols,
      registrationStatus: 'pending',
      connectionStatus: 'offline',
      metadata: dto.metadata,
    });

    const saved = await this.registrationRepository.save(registration);
    this.eventEmitter.emit('device.registered', saved);
    return saved;
  }

  async findById(id: string): Promise<DeviceRegistration> {
    const registration = await this.registrationRepository.findOne({
      where: { id },
      relations: ['drone', 'hub'],
    });
    if (!registration) {
      throw new NotFoundException(`Device registration ${id} not found`);
    }
    return registration;
  }

  async findByIdentifier(deviceIdentifier: string): Promise<DeviceRegistration | null> {
    return this.registrationRepository.findOne({
      where: { deviceIdentifier },
      relations: ['drone', 'hub'],
    });
  }

  async findByDroneId(droneId: string): Promise<DeviceRegistration | null> {
    return this.registrationRepository.findOne({
      where: { droneId },
      relations: ['drone', 'hub'],
    });
  }

  async findBySocketId(socketId: string): Promise<DeviceRegistration | null> {
    return this.registrationRepository.findOne({
      where: { socketId },
      relations: ['drone', 'hub'],
    });
  }

  async updateConnectionStatus(
    id: string,
    status: ConnectionStatus,
    socketId?: string,
  ): Promise<DeviceRegistration> {
    const registration = await this.findById(id);
    registration.connectionStatus = status;
    if (socketId !== undefined) {
      registration.socketId = socketId;
    }
    if (status === 'online') {
      registration.lastSeenAt = new Date();
    }
    const updated = await this.registrationRepository.save(registration);

    this.eventEmitter.emit('device.connection_status_changed', {
      deviceId: id,
      deviceIdentifier: registration.deviceIdentifier,
      droneId: registration.droneId,
      status,
    });

    return updated;
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.registrationRepository.update(id, {
      lastSeenAt: new Date(),
    });
  }

  async updateRegistrationStatus(
    id: string,
    status: RegistrationStatus,
  ): Promise<DeviceRegistration> {
    const registration = await this.findById(id);
    registration.registrationStatus = status;
    return this.registrationRepository.save(registration);
  }

  async listActiveDevices(hubId?: string): Promise<DeviceRegistration[]> {
    const query = this.registrationRepository
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.drone', 'drone')
      .leftJoinAndSelect('device.hub', 'hub')
      .where('device.registrationStatus = :status', { status: 'active' });

    if (hubId) {
      query.andWhere('device.hubId = :hubId', { hubId });
    }

    return query.getMany();
  }

  async listOnlineDevices(): Promise<DeviceRegistration[]> {
    return this.registrationRepository.find({
      where: { connectionStatus: 'online' },
      relations: ['drone', 'hub'],
    });
  }

  async listAll(): Promise<DeviceRegistration[]> {
    return this.registrationRepository.find({
      relations: ['drone', 'hub'],
      order: { createdAt: 'DESC' },
    });
  }

  async revokeRegistration(id: string): Promise<void> {
    const registration = await this.findById(id);
    registration.registrationStatus = 'revoked';
    registration.connectionStatus = 'offline';
    registration.socketId = '';
    await this.registrationRepository.save(registration);

    this.eventEmitter.emit('device.revoked', {
      deviceId: id,
      deviceIdentifier: registration.deviceIdentifier,
    });
  }

  async isDeviceOnline(deviceId: string): Promise<boolean> {
    const registration = await this.registrationRepository.findOne({
      where: { id: deviceId },
    });
    return registration?.connectionStatus === 'online';
  }
}
