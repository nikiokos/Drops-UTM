import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AirspaceZone } from './airspace-zone.entity';

@Injectable()
export class AirspaceService {
  constructor(
    @InjectRepository(AirspaceZone)
    private readonly zoneRepository: Repository<AirspaceZone>,
  ) {}

  async findAll(): Promise<AirspaceZone[]> {
    return this.zoneRepository.find({ relations: ['hub'] });
  }

  async findById(id: string): Promise<AirspaceZone> {
    const zone = await this.zoneRepository.findOne({ where: { id }, relations: ['hub'] });
    if (!zone) throw new NotFoundException(`Zone ${id} not found`);
    return zone;
  }

  async findByHub(hubId: string): Promise<AirspaceZone[]> {
    return this.zoneRepository.find({ where: { hubId }, relations: ['hub'] });
  }

  async create(data: Partial<AirspaceZone>): Promise<AirspaceZone> {
    const zone = this.zoneRepository.create(data);
    return this.zoneRepository.save(zone);
  }

  async update(id: string, data: Partial<AirspaceZone>): Promise<AirspaceZone> {
    await this.findById(id);
    await this.zoneRepository.update(id, data as any);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.zoneRepository.delete(id);
  }
}
