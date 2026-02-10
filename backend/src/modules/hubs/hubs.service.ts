import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from './hub.entity';

@Injectable()
export class HubsService {
  constructor(
    @InjectRepository(Hub)
    private readonly hubRepository: Repository<Hub>,
  ) {}

  async findAll(): Promise<Hub[]> {
    return this.hubRepository.find();
  }

  async findById(id: string): Promise<Hub> {
    const hub = await this.hubRepository.findOne({ where: { id } });
    if (!hub) throw new NotFoundException(`Hub ${id} not found`);
    return hub;
  }

  async create(data: Partial<Hub>): Promise<Hub> {
    const hub = this.hubRepository.create(data);
    return this.hubRepository.save(hub);
  }

  async update(id: string, data: Partial<Hub>): Promise<Hub> {
    await this.findById(id);
    await this.hubRepository.update(id, data as any);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.hubRepository.update(id, { status: 'offline' } as any);
  }
}
