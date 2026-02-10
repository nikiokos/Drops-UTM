import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DroneAlert, AlertType, AlertSeverity } from './alert.entity';
import { EventsGateway } from '../../gateways/events.gateway';

export interface CreateAlertDto {
  droneId: string;
  flightId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(DroneAlert)
    private alertRepository: Repository<DroneAlert>,
    private eventsGateway: EventsGateway,
  ) {}

  async createAlert(dto: CreateAlertDto): Promise<DroneAlert> {
    const alert = this.alertRepository.create({
      droneId: dto.droneId,
      flightId: dto.flightId,
      alertType: dto.alertType,
      severity: dto.severity,
      message: dto.message,
      data: dto.data,
    });

    const savedAlert = await this.alertRepository.save(alert);

    // Emit alert via WebSocket
    this.eventsGateway.emitAlert(dto.droneId, savedAlert as unknown as Record<string, unknown>);

    // Also emit to global emergency channel for critical/emergency alerts
    if (dto.severity === 'critical' || dto.severity === 'emergency') {
      this.eventsGateway.emitEmergency({
        type: 'alert',
        alert: savedAlert,
      });
    }

    return savedAlert;
  }

  async getAll(params?: {
    droneId?: string;
    flightId?: string;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    resolved?: boolean;
    limit?: number;
  }): Promise<DroneAlert[]> {
    const query = this.alertRepository.createQueryBuilder('alert');

    if (params?.droneId) {
      query.andWhere('alert.droneId = :droneId', { droneId: params.droneId });
    }

    if (params?.flightId) {
      query.andWhere('alert.flightId = :flightId', { flightId: params.flightId });
    }

    if (params?.severity) {
      query.andWhere('alert.severity = :severity', { severity: params.severity });
    }

    if (params?.acknowledged !== undefined) {
      query.andWhere('alert.acknowledged = :acknowledged', {
        acknowledged: params.acknowledged,
      });
    }

    if (params?.resolved !== undefined) {
      query.andWhere('alert.resolved = :resolved', { resolved: params.resolved });
    }

    query.orderBy('alert.createdAt', 'DESC');

    if (params?.limit) {
      query.take(params.limit);
    }

    return query.getMany();
  }

  async getActive(): Promise<DroneAlert[]> {
    return this.alertRepository.find({
      where: { acknowledged: false, resolved: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getById(id: string): Promise<DroneAlert> {
    const alert = await this.alertRepository.findOne({ where: { id } });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async acknowledge(id: string, userId: string): Promise<DroneAlert> {
    const alert = await this.getById(id);

    await this.alertRepository.update(id, {
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    });

    const updatedAlert = await this.getById(id);

    this.eventsGateway.emitAlert(alert.droneId, updatedAlert as unknown as Record<string, unknown>);

    return updatedAlert;
  }

  async resolve(id: string, userId: string): Promise<DroneAlert> {
    const alert = await this.getById(id);

    await this.alertRepository.update(id, {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: userId,
      acknowledged: true,
      acknowledgedAt: alert.acknowledgedAt || new Date(),
      acknowledgedBy: alert.acknowledgedBy || userId,
    });

    const updatedAlert = await this.getById(id);

    this.eventsGateway.emitAlert(alert.droneId, updatedAlert as unknown as Record<string, unknown>);

    return updatedAlert;
  }

  async getByDroneId(droneId: string, limit: number = 50): Promise<DroneAlert[]> {
    return this.alertRepository.find({
      where: { droneId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getByFlightId(flightId: string, limit: number = 50): Promise<DroneAlert[]> {
    return this.alertRepository.find({
      where: { flightId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
