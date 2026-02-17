import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Drone } from '../../drones/drone.entity';
import { DeviceRegistryService } from '../../connectivity/services/device-registry.service';
import { ApiKey } from '../entities/api-key.entity';
import { IntegrationTelemetryDto } from '../dto/integration-telemetry.dto';
import { RegisterDroneDto } from '../dto/register-drone.dto';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    @InjectRepository(Drone)
    private readonly droneRepository: Repository<Drone>,
    private readonly deviceRegistry: DeviceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async submitTelemetry(
    dto: IntegrationTelemetryDto,
    apiKey: ApiKey,
  ): Promise<{ success: boolean; droneId: string; deviceId: string }> {
    // Find drone by registration number
    let drone = await this.droneRepository.findOne({
      where: { registrationNumber: dto.droneId },
    });

    // Auto-create drone if not found
    if (!drone) {
      this.logger.log(
        `Auto-creating drone with registration number ${dto.droneId} for manufacturer ${apiKey.manufacturerName}`,
      );
      drone = this.droneRepository.create({
        registrationNumber: dto.droneId,
        manufacturer: apiKey.manufacturerName,
        model: 'Unknown',
        status: 'available',
      });
      drone = await this.droneRepository.save(drone);
    }

    // Find or create device registration
    const registration = await this.deviceRegistry.registerDevice({
      deviceType: 'drone',
      droneId: drone.id,
      supportedProtocols: ['rest'],
    });

    // Activate pending registrations
    if (registration.registrationStatus === 'pending') {
      await this.deviceRegistry.updateRegistrationStatus(
        registration.id,
        'active',
      );
    }

    // Build telemetry payload
    const payload = {
      latitude: dto.latitude,
      longitude: dto.longitude,
      altitude: dto.altitude,
      heading: dto.heading,
      speed: dto.speed,
      batteryLevel: dto.batteryLevel,
      batteryVoltage: dto.batteryVoltage,
      satellites: dto.satellites,
      signalStrength: dto.signalStrength,
      flightMode: dto.flightMode,
      armed: dto.armed,
      custom: dto.custom,
    };

    // Emit telemetry event
    this.eventEmitter.emit('telemetry.received', {
      droneId: drone.id,
      deviceIdentifier: registration.deviceIdentifier,
      payload,
      timestamp: new Date(),
      source: 'direct',
      protocol: 'rest',
    });

    // Update last seen
    await this.deviceRegistry.updateLastSeen(registration.id);

    return {
      success: true,
      droneId: drone.id,
      deviceId: registration.id,
    };
  }

  async registerDrone(
    dto: RegisterDroneDto,
    apiKey: ApiKey,
  ): Promise<Drone> {
    // Check if drone already exists
    const existing = await this.droneRepository.findOne({
      where: { registrationNumber: dto.registrationNumber },
    });
    if (existing) {
      throw new BadRequestException(
        `Drone with registration number ${dto.registrationNumber} already exists`,
      );
    }

    // Create drone
    const drone = this.droneRepository.create({
      registrationNumber: dto.registrationNumber,
      manufacturer: dto.manufacturer,
      model: dto.model,
      serialNumber: dto.serialNumber,
      maxFlightTime: dto.maxFlightTime,
      maxRange: dto.maxRange,
      maxAltitude: dto.maxAltitude,
      maxSpeed: dto.maxSpeed,
      communicationProtocol: 'rest_api',
      status: 'available',
    });
    const savedDrone = await this.droneRepository.save(drone);

    // Auto-register device
    await this.deviceRegistry.registerDevice({
      deviceType: 'drone',
      droneId: savedDrone.id,
      supportedProtocols: ['rest'],
    });

    this.logger.log(
      `Drone ${savedDrone.registrationNumber} registered via integration API by ${apiKey.manufacturerName}`,
    );

    return savedDrone;
  }

  async getStatus(
    apiKey: ApiKey,
  ): Promise<{
    manufacturer: string;
    drones: Array<{
      id: string;
      registrationNumber: string;
      model: string;
      status: string;
      connectionStatus: string;
      lastSeen: Date | null;
    }>;
  }> {
    const drones = await this.droneRepository.find({
      where: { manufacturer: apiKey.manufacturerName },
    });

    const dronesWithStatus = await Promise.all(
      drones.map(async (drone) => {
        const registration = await this.deviceRegistry.findByDroneId(drone.id);
        return {
          id: drone.id,
          registrationNumber: drone.registrationNumber,
          model: drone.model,
          status: drone.status,
          connectionStatus: registration?.connectionStatus || 'offline',
          lastSeen: registration?.lastSeenAt || null,
        };
      }),
    );

    return {
      manufacturer: apiKey.manufacturerName,
      drones: dronesWithStatus,
    };
  }
}
