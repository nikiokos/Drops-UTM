import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drone } from './drone.entity';

@Injectable()
export class DronesService {
  constructor(
    @InjectRepository(Drone)
    private readonly droneRepository: Repository<Drone>,
  ) {}

  async findAll(): Promise<Drone[]> {
    return this.droneRepository.find({ relations: ['homeHub', 'currentHub', 'owner'] });
  }

  async findById(id: string): Promise<Drone> {
    const drone = await this.droneRepository.findOne({
      where: { id },
      relations: ['homeHub', 'currentHub', 'owner'],
    });
    if (!drone) throw new NotFoundException(`Drone ${id} not found`);
    return drone;
  }

  async create(data: Partial<Drone>): Promise<Drone> {
    const drone = this.droneRepository.create(data);
    return this.droneRepository.save(drone);
  }

  async update(id: string, data: Partial<Drone>): Promise<Drone> {
    await this.findById(id);
    await this.droneRepository.update(id, data as any);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.droneRepository.update(id, { status: 'retired' } as any);
  }

  async findByHub(hubId: string): Promise<Drone[]> {
    return this.droneRepository.find({ where: { currentHubId: hubId } });
  }
}
