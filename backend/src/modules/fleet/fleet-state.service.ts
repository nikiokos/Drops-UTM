import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drone } from '../drones/drone.entity';
import { Hub } from '../hubs/hub.entity';
import { Mission } from '../missions/mission.entity';

export interface HubFleetStatus {
  hubId: string;
  hubName: string;
  totalDrones: number;
  availableDrones: number;
  busyDrones: number;
  chargingDrones: number;
  maintenanceDrones: number;
  droneIds: string[];
  capacityUtilization: number;
  lastUpdated: Date;
}

export interface FleetOverview {
  totalDrones: number;
  availableDrones: number;
  busyDrones: number;
  chargingDrones: number;
  maintenanceDrones: number;
  offlineDrones: number;
  activeMissions: number;
  pendingMissions: number;
  hubStatuses: HubFleetStatus[];
  fleetHealth: number;
  averageFlightHours: number;
}

export interface DroneAvailability {
  drone: Drone;
  status: string;
  currentHubId: string | null;
  currentMissionId: string | null;
  estimatedAvailableAt: Date | null;
}

@Injectable()
export class FleetStateService {
  private hubStatusCache: Map<string, HubFleetStatus> = new Map();
  private lastCacheUpdate: Date = new Date(0);
  private readonly CACHE_TTL_MS = 5000; // 5 seconds

  constructor(
    @InjectRepository(Drone)
    private dronesRepository: Repository<Drone>,
    @InjectRepository(Hub)
    private hubsRepository: Repository<Hub>,
    @InjectRepository(Mission)
    private missionsRepository: Repository<Mission>,
  ) {}

  async getFleetOverview(): Promise<FleetOverview> {
    const [drones, hubs, activeMissions, pendingMissions] = await Promise.all([
      this.dronesRepository.find({ relations: ['currentHub'] }),
      this.hubsRepository.find(),
      this.missionsRepository.count({ where: { status: 'executing' } }),
      this.missionsRepository.count({ where: { status: 'scheduled' } }),
    ]);

    const statusCounts = this.countDronesByStatus(drones);
    const hubStatuses = await this.getHubStatuses(drones, hubs);
    const averageFlightHours = this.calculateAverageFlightHours(drones);
    const fleetHealth = this.calculateFleetHealth(drones);

    return {
      totalDrones: drones.length,
      availableDrones: statusCounts.available,
      busyDrones: statusCounts.busy,
      chargingDrones: statusCounts.charging,
      maintenanceDrones: statusCounts.maintenance,
      offlineDrones: statusCounts.offline,
      activeMissions,
      pendingMissions,
      hubStatuses,
      fleetHealth,
      averageFlightHours,
    };
  }

  async getHubStatus(hubId: string): Promise<HubFleetStatus | null> {
    const hub = await this.hubsRepository.findOne({ where: { id: hubId } });
    if (!hub) return null;

    const drones = await this.dronesRepository.find({
      where: { currentHubId: hubId },
    });

    return this.buildHubStatus(hub, drones);
  }

  async getDronesAtHub(hubId: string): Promise<Drone[]> {
    return this.dronesRepository.find({
      where: { currentHubId: hubId },
      relations: ['currentHub', 'homeHub'],
    });
  }

  async getAvailableDrones(hubId?: string): Promise<DroneAvailability[]> {
    const queryBuilder = this.dronesRepository
      .createQueryBuilder('drone')
      .leftJoinAndSelect('drone.currentHub', 'currentHub')
      .leftJoinAndSelect('drone.homeHub', 'homeHub');

    if (hubId) {
      queryBuilder.where('drone.currentHubId = :hubId', { hubId });
    }

    const drones = await queryBuilder.getMany();

    // Get active missions to check drone assignments
    const activeMissions = await this.missionsRepository.find({
      where: [{ status: 'executing' }, { status: 'scheduled' }],
    });

    const droneToMission = new Map<string, Mission>();
    activeMissions.forEach((mission) => {
      if (mission.droneId) {
        droneToMission.set(mission.droneId, mission);
      }
    });

    return drones.map((drone) => {
      const activeMission = droneToMission.get(drone.id);
      return {
        drone,
        status: drone.status,
        currentHubId: drone.currentHubId,
        currentMissionId: activeMission?.id || null,
        estimatedAvailableAt: activeMission
          ? this.estimateCompletionTime(activeMission)
          : null,
      };
    });
  }

  async getHubsNeedingDrones(minDrones: number): Promise<HubFleetStatus[]> {
    const overview = await this.getFleetOverview();
    return overview.hubStatuses.filter((hub) => hub.availableDrones < minDrones);
  }

  async getHubsWithExcessDrones(minReserve: number): Promise<HubFleetStatus[]> {
    const overview = await this.getFleetOverview();
    return overview.hubStatuses.filter(
      (hub) => hub.availableDrones > minReserve + 1,
    );
  }

  async getDroneById(droneId: string): Promise<Drone | null> {
    return this.dronesRepository.findOne({
      where: { id: droneId },
      relations: ['currentHub', 'homeHub'],
    });
  }

  async updateDroneLocation(droneId: string, hubId: string | null): Promise<void> {
    await this.dronesRepository.update(droneId, { currentHubId: hubId as string });
    this.invalidateCache();
  }

  async updateDroneStatus(droneId: string, status: string): Promise<void> {
    await this.dronesRepository.update(droneId, { status });
    this.invalidateCache();
  }

  private async getHubStatuses(
    drones: Drone[],
    hubs: Hub[],
  ): Promise<HubFleetStatus[]> {
    const dronesByHub = this.groupDronesByHub(drones);

    return hubs.map((hub) => {
      const hubDrones = dronesByHub.get(hub.id) || [];
      return this.buildHubStatus(hub, hubDrones);
    });
  }

  private buildHubStatus(hub: Hub, drones: Drone[]): HubFleetStatus {
    const statusCounts = this.countDronesByStatus(drones);
    const capacityUtilization =
      hub.maxSimultaneousDrones > 0
        ? (drones.length / hub.maxSimultaneousDrones) * 100
        : 0;

    return {
      hubId: hub.id,
      hubName: hub.name,
      totalDrones: drones.length,
      availableDrones: statusCounts.available,
      busyDrones: statusCounts.busy,
      chargingDrones: statusCounts.charging,
      maintenanceDrones: statusCounts.maintenance,
      droneIds: drones.map((d) => d.id),
      capacityUtilization: Math.round(capacityUtilization * 100) / 100,
      lastUpdated: new Date(),
    };
  }

  private countDronesByStatus(drones: Drone[]): Record<string, number> {
    const counts = {
      available: 0,
      busy: 0,
      charging: 0,
      maintenance: 0,
      offline: 0,
    };

    drones.forEach((drone) => {
      switch (drone.status) {
        case 'available':
          counts.available++;
          break;
        case 'flying':
        case 'executing':
        case 'busy':
          counts.busy++;
          break;
        case 'charging':
          counts.charging++;
          break;
        case 'maintenance':
          counts.maintenance++;
          break;
        default:
          counts.offline++;
      }
    });

    return counts;
  }

  private groupDronesByHub(drones: Drone[]): Map<string, Drone[]> {
    const grouped = new Map<string, Drone[]>();

    drones.forEach((drone) => {
      if (drone.currentHubId) {
        const hubDrones = grouped.get(drone.currentHubId) || [];
        hubDrones.push(drone);
        grouped.set(drone.currentHubId, hubDrones);
      }
    });

    return grouped;
  }

  private calculateAverageFlightHours(drones: Drone[]): number {
    if (drones.length === 0) return 0;
    const totalHours = drones.reduce((sum, d) => sum + (d.totalFlightHours || 0), 0);
    return Math.round((totalHours / drones.length) * 100) / 100;
  }

  private calculateFleetHealth(drones: Drone[]): number {
    if (drones.length === 0) return 100;

    let healthScore = 0;
    drones.forEach((drone) => {
      let droneHealth = 100;

      // Deduct for maintenance status
      if (drone.status === 'maintenance') {
        droneHealth -= 50;
      }

      // Deduct for overdue maintenance
      if (drone.nextMaintenance && new Date(drone.nextMaintenance) < new Date()) {
        droneHealth -= 30;
      }

      // Deduct for high flight hours (relative to 500 hour benchmark)
      const hoursRatio = (drone.totalFlightHours || 0) / 500;
      if (hoursRatio > 1) {
        droneHealth -= Math.min(20, (hoursRatio - 1) * 20);
      }

      healthScore += Math.max(0, droneHealth);
    });

    return Math.round(healthScore / drones.length);
  }

  private estimateCompletionTime(mission: Mission): Date | null {
    if (mission.status === 'scheduled' && mission.scheduledAt) {
      const startTime = new Date(mission.scheduledAt);
      const duration = mission.estimatedDuration || 1800; // Default 30 min
      return new Date(startTime.getTime() + duration * 1000);
    }

    if (mission.status === 'executing') {
      // Estimate based on creation time + duration
      const duration = mission.estimatedDuration || 1800;
      return new Date(new Date(mission.createdAt).getTime() + duration * 1000);
    }

    return null;
  }

  private invalidateCache(): void {
    this.hubStatusCache.clear();
    this.lastCacheUpdate = new Date(0);
  }
}
