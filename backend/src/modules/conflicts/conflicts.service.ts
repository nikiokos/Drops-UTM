import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conflict } from './conflict.entity';

@Injectable()
export class ConflictsService {
  constructor(
    @InjectRepository(Conflict)
    private readonly conflictRepository: Repository<Conflict>,
  ) {}

  async findAll(): Promise<Conflict[]> {
    return this.conflictRepository.find({
      relations: ['primaryFlight', 'secondaryFlight', 'hub'],
      order: { detectedAt: 'DESC' },
    });
  }

  async findActive(): Promise<Conflict[]> {
    return this.conflictRepository.find({
      where: [{ status: 'detected' }, { status: 'notified' }, { status: 'resolving' }],
      relations: ['primaryFlight', 'secondaryFlight', 'hub'],
      order: { detectedAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Conflict> {
    const conflict = await this.conflictRepository.findOne({
      where: { id },
      relations: ['primaryFlight', 'secondaryFlight', 'hub'],
    });
    if (!conflict) throw new NotFoundException(`Conflict ${id} not found`);
    return conflict;
  }

  async create(data: Partial<Conflict>): Promise<Conflict> {
    const conflict = this.conflictRepository.create(data);
    return this.conflictRepository.save(conflict);
  }

  async resolve(
    id: string,
    resolution: { strategy: string; actions: Record<string, unknown>; resolvedBy: string },
  ): Promise<Conflict> {
    await this.findById(id);
    await this.conflictRepository.update(id, {
      status: 'resolved',
      resolutionStrategy: resolution.strategy,
      resolutionActions: resolution.actions,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date(),
    } as any);
    return this.findById(id);
  }
}
