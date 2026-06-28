import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AirspaceZone } from './airspace-zone.entity';
import { OpenaipService } from '../openaip/openaip.service';
import {
  pointInRing,
  localRing,
  openaipRing,
  openaipLimitToM,
  altitudeOverlaps,
  openaipTypeInfo,
  localSeverity,
  densifyPath,
  type ZoneBreach,
} from './geo.util';

export interface AirspaceCheckPoint {
  lat: number;
  lon: number;
  alt?: number;
}

@Injectable()
export class AirspaceService {
  constructor(
    @InjectRepository(AirspaceZone)
    private readonly zoneRepository: Repository<AirspaceZone>,
    private readonly openaipService: OpenaipService,
  ) {}

  /** Check a single 3D point against local zones + openAIP airspaces. */
  async checkPoint(lat: number, lon: number, alt = 0): Promise<ZoneBreach[]> {
    const [localZones, openaip] = await Promise.all([
      this.zoneRepository.find(),
      this.openaipService.getAirspaces().catch(() => []),
    ]);
    return this.checkPointSync(lat, lon, alt, localZones, openaip as Array<Record<string, unknown>>);
  }

  private checkPointSync(
    lat: number,
    lon: number,
    altM: number,
    localZones: AirspaceZone[],
    openaip: Array<Record<string, unknown>>,
  ): ZoneBreach[] {
    const breaches: ZoneBreach[] = [];
    const point = { lat, lon, altM };

    for (const z of localZones) {
      if (z.status && z.status !== 'active' && z.status !== 'temporary') continue;
      const ring = localRing(z.geometry?.coordinates);
      if (ring.length < 3 || !pointInRing(lat, lon, ring)) continue;
      const floorM = z.altitudeFloor ?? null;
      const ceilingM = z.altitudeCeiling ?? null;
      const overlap = altitudeOverlaps(altM, floorM, ceilingM);
      if (!overlap) continue;
      breaches.push({
        source: 'local',
        zoneId: z.id,
        name: z.name,
        zoneType: z.zoneType,
        floorM,
        ceilingM,
        altitudeOverlap: overlap,
        severity: localSeverity(z.zoneType),
        point,
      });
    }

    for (const a of openaip) {
      const ring = openaipRing(a.geometry as { type?: string; coordinates?: unknown });
      if (ring.length < 3 || !pointInRing(lat, lon, ring)) continue;
      const floorM = openaipLimitToM(a.lowerLimit as { value?: number; unit?: number });
      const ceilingM = openaipLimitToM(a.upperLimit as { value?: number; unit?: number });
      const overlap = altitudeOverlaps(altM, floorM, ceilingM);
      if (!overlap) continue;
      const info = openaipTypeInfo(a.type as number | undefined);
      breaches.push({
        source: 'openaip',
        zoneId: a.id as string,
        name: (a.name as string) || info.label,
        zoneType: info.label,
        floorM,
        ceilingM,
        altitudeOverlap: overlap,
        severity: info.severity,
        point,
      });
    }

    return breaches;
  }

  /** Check a densified path; returns unique breached zones (worst point kept). */
  async checkPath(points: AirspaceCheckPoint[], spacingM = 200) {
    const [localZones, openaip] = await Promise.all([
      this.zoneRepository.find(),
      this.openaipService.getAirspaces().catch(() => []),
    ]);
    const samples = densifyPath(points, spacingM);
    const byZone = new Map<string, ZoneBreach>();
    for (const s of samples) {
      const hits = this.checkPointSync(s.lat, s.lon, s.altM, localZones, openaip as Array<Record<string, unknown>>);
      for (const b of hits) {
        const key = `${b.source}:${b.zoneId ?? b.name}`;
        if (!byZone.has(key)) byZone.set(key, b);
      }
    }
    const breaches = Array.from(byZone.values());
    const order = { critical: 0, warning: 1, info: 2 };
    breaches.sort((a, b) => order[a.severity] - order[b.severity]);
    return {
      sampleCount: samples.length,
      breachCount: breaches.length,
      worstSeverity: breaches[0]?.severity ?? null,
      breaches,
    };
  }

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
