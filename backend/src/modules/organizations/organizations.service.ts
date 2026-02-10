import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
  ) {}

  async findAll(): Promise<Organization[]> {
    return this.orgRepository.find();
  }

  async findById(id: string): Promise<Organization> {
    const org = await this.orgRepository.findOne({ where: { id } });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async create(data: Partial<Organization>): Promise<Organization> {
    const org = this.orgRepository.create(data);
    return this.orgRepository.save(org);
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    await this.findById(id);
    await this.orgRepository.update(id, data as any);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.orgRepository.update(id, { status: 'inactive' } as any);
  }
}
