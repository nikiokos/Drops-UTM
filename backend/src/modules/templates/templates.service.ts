import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MissionTemplate, TemplateVariable, MissionBlueprint } from './template.entity';
import { Mission } from '../missions/mission.entity';
import { Waypoint } from '../missions/waypoint.entity';
import { Hub } from '../hubs/hub.entity';

export interface CreateTemplateDto {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  variables?: TemplateVariable[];
  blueprint: MissionBlueprint;
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {
  changelog?: string;
}

export interface InstantiateTemplateDto {
  variableValues: Record<string, unknown>;
  droneId?: string;
  scheduleType?: 'manual' | 'scheduled' | 'event_triggered';
  scheduledAt?: Date;
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(MissionTemplate)
    private templateRepository: Repository<MissionTemplate>,
    @InjectRepository(Mission)
    private missionRepository: Repository<Mission>,
    @InjectRepository(Waypoint)
    private waypointRepository: Repository<Waypoint>,
    @InjectRepository(Hub)
    private hubRepository: Repository<Hub>,
  ) {}

  async create(dto: CreateTemplateDto, userId: string): Promise<MissionTemplate> {
    const template = this.templateRepository.create({
      ...dto,
      version: 1,
      isLatest: true,
      createdBy: userId,
    });

    return this.templateRepository.save(template);
  }

  async findAll(params?: {
    category?: string;
    isPublished?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: MissionTemplate[]; total: number }> {
    const query = this.templateRepository
      .createQueryBuilder('template')
      .where('template.isLatest = :isLatest', { isLatest: true })
      .orderBy('template.createdAt', 'DESC');

    if (params?.category) {
      query.andWhere('template.category = :category', { category: params.category });
    }

    if (params?.isPublished !== undefined) {
      query.andWhere('template.isPublished = :isPublished', {
        isPublished: params.isPublished,
      });
    }

    if (params?.search) {
      query.andWhere(
        '(template.name LIKE :search OR template.description LIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    const total = await query.getCount();

    if (params?.offset) {
      query.skip(params.offset);
    }
    if (params?.limit) {
      query.take(params.limit);
    }

    const data = await query.getMany();
    return { data, total };
  }

  async findById(id: string): Promise<MissionTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id, isLatest: true },
      relations: ['creator'],
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async findVersions(id: string): Promise<MissionTemplate[]> {
    // First find the latest version to get the chain
    const latest = await this.findById(id);

    const versions: MissionTemplate[] = [latest];
    let currentId = latest.previousVersionId;

    while (currentId) {
      const previousVersion = await this.templateRepository.findOne({
        where: { id: currentId },
      });
      if (previousVersion) {
        versions.push(previousVersion);
        currentId = previousVersion.previousVersionId;
      } else {
        break;
      }
    }

    return versions;
  }

  async findVersion(id: string, version: number): Promise<MissionTemplate> {
    // Find the specific version by traversing the chain
    const versions = await this.findVersions(id);
    const targetVersion = versions.find((v) => v.version === version);

    if (!targetVersion) {
      throw new NotFoundException(`Version ${version} not found`);
    }

    return targetVersion;
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    userId: string,
  ): Promise<MissionTemplate> {
    const existing = await this.findById(id);

    // Mark existing as not latest
    await this.templateRepository.update(existing.id, { isLatest: false });

    // Create new version
    const newVersion = this.templateRepository.create({
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description,
      category: dto.category ?? existing.category,
      tags: dto.tags ?? existing.tags,
      variables: dto.variables ?? existing.variables,
      blueprint: dto.blueprint ?? existing.blueprint,
      version: existing.version + 1,
      isLatest: true,
      previousVersionId: existing.id,
      changelog: dto.changelog,
      usageCount: existing.usageCount,
      isPublished: existing.isPublished,
      publishedAt: existing.publishedAt,
      createdBy: userId,
    });

    return this.templateRepository.save(newVersion);
  }

  async publish(id: string): Promise<MissionTemplate> {
    const template = await this.findById(id);

    await this.templateRepository.update(template.id, {
      isPublished: true,
      publishedAt: new Date(),
    });

    return this.findById(id);
  }

  async unpublish(id: string): Promise<MissionTemplate> {
    const template = await this.findById(id);

    await this.templateRepository.update(template.id, {
      isPublished: false,
      publishedAt: undefined as unknown as Date,
    });

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const template = await this.findById(id);

    if (template.usageCount > 0) {
      throw new BadRequestException(
        'Cannot delete template that has been used to create missions',
      );
    }

    // Delete all versions
    const versions = await this.findVersions(id);
    await this.templateRepository.remove(versions);
  }

  async instantiate(
    id: string,
    dto: InstantiateTemplateDto,
    userId: string,
  ): Promise<Mission> {
    const template = await this.findById(id);

    // Validate required variables
    if (template.variables) {
      for (const variable of template.variables) {
        if (variable.required && dto.variableValues[variable.key] === undefined) {
          throw new BadRequestException(`Required variable missing: ${variable.key}`);
        }
      }
    }

    // Resolve variable references in blueprint
    const resolvedBlueprint = await this.resolveBlueprint(
      template.blueprint,
      dto.variableValues,
    );

    // Determine departure and arrival hubs
    let departureHubId: string | undefined;
    let arrivalHubId: string | undefined;

    if (dto.variableValues.departure_hub) {
      departureHubId = dto.variableValues.departure_hub as string;
    }
    if (dto.variableValues.arrival_hub) {
      arrivalHubId = dto.variableValues.arrival_hub as string;
    }

    // If no hub variables, try to infer from first/last waypoints
    if (!departureHubId && resolvedBlueprint.waypoints.length > 0) {
      const firstWp = resolvedBlueprint.waypoints[0];
      const nearestHub = await this.findNearestHub(
        firstWp.latitude as number,
        firstWp.longitude as number,
      );
      if (nearestHub) departureHubId = nearestHub.id;
    }

    if (!departureHubId) {
      throw new BadRequestException('Could not determine departure hub');
    }

    // Create mission from template
    const newMission = this.missionRepository.create({
      name: `${template.name} - ${new Date().toLocaleDateString()}`,
      description: template.description,
      status: 'draft',
      droneId: dto.droneId,
      departureHubId,
      arrivalHubId,
      scheduleType: dto.scheduleType || template.blueprint.defaultScheduleType,
      scheduledAt: dto.scheduledAt,
      triggerConditions: template.blueprint.defaultTriggerConditions,
      templateId: template.id,
      templateVersion: template.version,
      estimatedDuration: template.blueprint.estimatedDuration,
      estimatedDistance: template.blueprint.estimatedDistance,
      createdBy: userId,
    });

    const savedMission = await this.missionRepository.save(newMission);

    // Create waypoints
    for (const wpBlueprint of resolvedBlueprint.waypoints) {
      await this.waypointRepository.save(
        this.waypointRepository.create({
          missionId: savedMission.id,
          sequence: wpBlueprint.sequence,
          name: wpBlueprint.name,
          latitude: wpBlueprint.latitude as number,
          longitude: wpBlueprint.longitude as number,
          altitude: wpBlueprint.altitude as number,
          speedToWaypoint: wpBlueprint.speedToWaypoint as number | undefined,
          headingAtWaypoint: wpBlueprint.headingAtWaypoint,
          turnRadius: wpBlueprint.turnRadius,
          actions: wpBlueprint.actions,
          conditions: wpBlueprint.conditions,
          hoverDuration: wpBlueprint.hoverDuration,
          waitForConfirmation: wpBlueprint.waitForConfirmation,
        }),
      );
    }

    // Increment usage count
    await this.templateRepository.update(template.id, {
      usageCount: template.usageCount + 1,
    });

    const result = await this.missionRepository.findOne({
      where: { id: savedMission.id },
      relations: ['waypoints', 'drone', 'departureHub', 'arrivalHub'],
    });

    return result!;
  }

  private async resolveBlueprint(
    blueprint: MissionBlueprint,
    variableValues: Record<string, unknown>,
  ): Promise<MissionBlueprint> {
    const resolved = JSON.parse(JSON.stringify(blueprint)) as MissionBlueprint;

    for (const waypoint of resolved.waypoints) {
      // Resolve variable references (format: "${variable_name}")
      if (typeof waypoint.latitude === 'string' && waypoint.latitude.startsWith('${')) {
        const varName = waypoint.latitude.slice(2, -1);
        const coords = variableValues[varName] as { latitude: number; longitude: number };
        if (coords) {
          waypoint.latitude = coords.latitude;
          waypoint.longitude = coords.longitude;
        }
      }

      if (typeof waypoint.altitude === 'string' && waypoint.altitude.startsWith('${')) {
        const varName = waypoint.altitude.slice(2, -1);
        waypoint.altitude = variableValues[varName] as number;
      }

      if (
        typeof waypoint.speedToWaypoint === 'string' &&
        waypoint.speedToWaypoint.startsWith('${')
      ) {
        const varName = waypoint.speedToWaypoint.slice(2, -1);
        waypoint.speedToWaypoint = variableValues[varName] as number;
      }
    }

    return resolved;
  }

  private async findNearestHub(lat: number, lon: number): Promise<Hub | null> {
    const hubs = await this.hubRepository.find({ where: { status: 'active' } });

    let nearest: Hub | null = null;
    let minDistance = Infinity;

    for (const hub of hubs) {
      const hubLoc = hub.location as { latitude: number; longitude: number };
      if (!hubLoc) continue;

      const distance = this.calculateDistance(lat, lon, hubLoc.latitude, hubLoc.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = hub;
      }
    }

    return nearest;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
