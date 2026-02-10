import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightTelemetry } from './telemetry.entity';

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(FlightTelemetry)
    private readonly telemetryRepository: Repository<FlightTelemetry>,
  ) {}

  async ingest(data: Partial<FlightTelemetry>): Promise<FlightTelemetry> {
    const telemetry = this.telemetryRepository.create({
      ...data,
      time: data.time || new Date(),
    });
    return this.telemetryRepository.save(telemetry);
  }

  async getLatest(flightId: string): Promise<FlightTelemetry | null> {
    return this.telemetryRepository.findOne({
      where: { flightId },
      order: { time: 'DESC' },
    });
  }

  async getByFlight(flightId: string, from?: Date, to?: Date): Promise<FlightTelemetry[]> {
    const qb = this.telemetryRepository
      .createQueryBuilder('t')
      .where('t.flight_id = :flightId', { flightId })
      .orderBy('t.time', 'ASC');

    if (from) qb.andWhere('t.time >= :from', { from });
    if (to) qb.andWhere('t.time <= :to', { to });

    return qb.getMany();
  }

  async getByDrone(droneId: string): Promise<FlightTelemetry | null> {
    return this.telemetryRepository.findOne({
      where: { droneId },
      order: { time: 'DESC' },
    });
  }
}
