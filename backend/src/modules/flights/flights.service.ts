import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from './flight.entity';

@Injectable()
export class FlightsService {
  constructor(
    @InjectRepository(Flight)
    private readonly flightRepository: Repository<Flight>,
  ) {}

  async findAll(filters?: Record<string, unknown>): Promise<Flight[]> {
    const qb = this.flightRepository
      .createQueryBuilder('flight')
      .leftJoinAndSelect('flight.drone', 'drone')
      .leftJoinAndSelect('flight.pilot', 'pilot')
      .leftJoinAndSelect('flight.departureHub', 'departureHub')
      .leftJoinAndSelect('flight.arrivalHub', 'arrivalHub');

    if (filters?.status) {
      qb.andWhere('flight.status = :status', { status: filters.status });
    }
    if (filters?.droneId) {
      qb.andWhere('flight.droneId = :droneId', { droneId: filters.droneId });
    }
    if (filters?.hubId) {
      qb.andWhere('(flight.departureHubId = :hubId OR flight.arrivalHubId = :hubId)', {
        hubId: filters.hubId,
      });
    }

    return qb.orderBy('flight.plannedDeparture', 'DESC').getMany();
  }

  async findById(id: string): Promise<Flight> {
    const flight = await this.flightRepository.findOne({
      where: { id },
      relations: ['drone', 'pilot', 'departureHub', 'arrivalHub'],
    });
    if (!flight) throw new NotFoundException(`Flight ${id} not found`);
    return flight;
  }

  async create(data: Partial<Flight>): Promise<Flight> {
    const flightNumber = `DRP-${Date.now().toString(36).toUpperCase()}`;
    const flight = this.flightRepository.create({ ...data, flightNumber });
    return this.flightRepository.save(flight);
  }

  async update(id: string, data: Partial<Flight>): Promise<Flight> {
    await this.findById(id);
    await this.flightRepository.update(id, data as any);
    return this.findById(id);
  }

  async updateStatus(id: string, status: string): Promise<Flight> {
    return this.update(id, { status } as Partial<Flight>);
  }

  async findActiveByHub(hubId: string): Promise<Flight[]> {
    return this.flightRepository.find({
      where: [
        { departureHubId: hubId, status: 'active' },
        { arrivalHubId: hubId, status: 'active' },
      ],
      relations: ['drone', 'pilot'],
    });
  }
}
