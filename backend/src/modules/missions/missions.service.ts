import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission, MissionStatus, ScheduleType, TriggerCondition } from './mission.entity';
import { Waypoint, WaypointAction, WaypointCondition } from './waypoint.entity';
import { MissionExecution } from './mission-execution.entity';
import { EventsGateway } from '../../gateways/events.gateway';

export interface CreateMissionDto {
  name: string;
  description?: string;
  droneId?: string;
  departureHubId: string;
  arrivalHubId?: string;
  scheduleType?: ScheduleType;
  scheduledAt?: Date;
  recurringPattern?: string;
  triggerConditions?: TriggerCondition[];
  templateId?: string;
  templateVersion?: number;
}

export interface CreateWaypointDto {
  sequence: number;
  name?: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speedToWaypoint?: number;
  headingAtWaypoint?: number;
  turnRadius?: number;
  actions?: WaypointAction[];
  conditions?: WaypointCondition[];
  hoverDuration?: number;
  waitForConfirmation?: boolean;
}

export interface UpdateMissionDto extends Partial<CreateMissionDto> {
  status?: MissionStatus;
}

@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission)
    private missionRepository: Repository<Mission>,
    @InjectRepository(Waypoint)
    private waypointRepository: Repository<Waypoint>,
    @InjectRepository(MissionExecution)
    private executionRepository: Repository<MissionExecution>,
    private eventsGateway: EventsGateway,
  ) {}

  async create(dto: CreateMissionDto, userId: string): Promise<Mission> {
    const mission = this.missionRepository.create({
      ...dto,
      status: 'draft',
      createdBy: userId,
    });

    return this.missionRepository.save(mission);
  }

  async findAll(params?: {
    status?: MissionStatus;
    droneId?: string;
    departureHubId?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Mission[]; total: number }> {
    const query = this.missionRepository
      .createQueryBuilder('mission')
      .leftJoinAndSelect('mission.waypoints', 'waypoints')
      .leftJoinAndSelect('mission.drone', 'drone')
      .leftJoinAndSelect('mission.departureHub', 'departureHub')
      .leftJoinAndSelect('mission.arrivalHub', 'arrivalHub')
      .orderBy('mission.createdAt', 'DESC');

    if (params?.status) {
      query.andWhere('mission.status = :status', { status: params.status });
    }
    if (params?.droneId) {
      query.andWhere('mission.droneId = :droneId', { droneId: params.droneId });
    }
    if (params?.departureHubId) {
      query.andWhere('mission.departureHubId = :departureHubId', {
        departureHubId: params.departureHubId,
      });
    }
    if (params?.createdBy) {
      query.andWhere('mission.createdBy = :createdBy', {
        createdBy: params.createdBy,
      });
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

  async findById(id: string): Promise<Mission> {
    const mission = await this.missionRepository.findOne({
      where: { id },
      relations: ['waypoints', 'drone', 'departureHub', 'arrivalHub', 'creator'],
    });

    if (!mission) {
      throw new NotFoundException('Mission not found');
    }

    // Sort waypoints by sequence
    if (mission.waypoints) {
      mission.waypoints.sort((a, b) => a.sequence - b.sequence);
    }

    return mission;
  }

  async update(id: string, dto: UpdateMissionDto): Promise<Mission> {
    const mission = await this.findById(id);

    // Validate status transitions
    if (dto.status && !this.isValidStatusTransition(mission.status, dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${mission.status} to ${dto.status}`,
      );
    }

    Object.assign(mission, dto);
    return this.missionRepository.save(mission);
  }

  async delete(id: string): Promise<void> {
    const mission = await this.findById(id);

    if (mission.status === 'executing') {
      throw new BadRequestException('Cannot delete a mission that is currently executing');
    }

    await this.missionRepository.remove(mission);
  }

  // Waypoint operations
  async addWaypoint(missionId: string, dto: CreateWaypointDto): Promise<Waypoint> {
    const mission = await this.findById(missionId);

    if (mission.status !== 'draft') {
      throw new BadRequestException('Can only add waypoints to draft missions');
    }

    const waypoint = this.waypointRepository.create({
      ...dto,
      missionId,
    });

    const saved = await this.waypointRepository.save(waypoint);
    await this.recalculateEstimates(missionId);
    return saved;
  }

  async updateWaypoint(
    missionId: string,
    waypointId: string,
    dto: Partial<CreateWaypointDto>,
  ): Promise<Waypoint> {
    const mission = await this.findById(missionId);

    if (mission.status !== 'draft') {
      throw new BadRequestException('Can only update waypoints in draft missions');
    }

    const waypoint = await this.waypointRepository.findOne({
      where: { id: waypointId, missionId },
    });

    if (!waypoint) {
      throw new NotFoundException('Waypoint not found');
    }

    Object.assign(waypoint, dto);
    const saved = await this.waypointRepository.save(waypoint);
    await this.recalculateEstimates(missionId);
    return saved;
  }

  async deleteWaypoint(missionId: string, waypointId: string): Promise<void> {
    const mission = await this.findById(missionId);

    if (mission.status !== 'draft') {
      throw new BadRequestException('Can only delete waypoints from draft missions');
    }

    const waypoint = await this.waypointRepository.findOne({
      where: { id: waypointId, missionId },
    });

    if (!waypoint) {
      throw new NotFoundException('Waypoint not found');
    }

    await this.waypointRepository.remove(waypoint);
    await this.resequenceWaypoints(missionId);
    await this.recalculateEstimates(missionId);
  }

  async reorderWaypoints(
    missionId: string,
    waypointOrder: { waypointId: string; sequence: number }[],
  ): Promise<Waypoint[]> {
    const mission = await this.findById(missionId);

    if (mission.status !== 'draft') {
      throw new BadRequestException('Can only reorder waypoints in draft missions');
    }

    for (const item of waypointOrder) {
      await this.waypointRepository.update(item.waypointId, {
        sequence: item.sequence,
      });
    }

    await this.recalculateEstimates(missionId);
    const updated = await this.findById(missionId);
    return updated.waypoints;
  }

  // Mission lifecycle
  async start(missionId: string, userId: string): Promise<MissionExecution> {
    const mission = await this.findById(missionId);

    // Allow starting from draft, ready, or scheduled status
    if (!['draft', 'ready', 'scheduled'].includes(mission.status)) {
      throw new BadRequestException('Mission cannot be started from current status');
    }

    if (!mission.droneId) {
      throw new BadRequestException('Mission must have a drone assigned');
    }

    if (!mission.waypoints || mission.waypoints.length === 0) {
      throw new BadRequestException('Mission must have at least one waypoint');
    }

    // Create execution record
    const execution = this.executionRepository.create({
      missionId,
      droneId: mission.droneId,
      status: 'in_progress',
      currentWaypointIndex: 0,
      totalWaypoints: mission.waypoints.length,
      completedWaypoints: [],
      waypointLogs: [],
      events: [
        {
          timestamp: new Date(),
          type: 'started',
          message: 'Mission execution started',
        },
      ],
      initiatedBy: userId,
      triggerType: 'manual',
      startedAt: new Date(),
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Update mission status
    await this.missionRepository.update(missionId, { status: 'executing' });

    // Emit WebSocket event
    this.eventsGateway.emitMissionStatus(missionId, {
      missionId,
      status: 'executing',
      executionId: savedExecution.id,
      progress: 0,
    });

    return savedExecution;
  }

  async pause(missionId: string): Promise<MissionExecution> {
    const mission = await this.findById(missionId);

    if (mission.status !== 'executing') {
      throw new BadRequestException('Mission is not currently executing');
    }

    const execution = await this.executionRepository.findOne({
      where: { missionId, status: 'in_progress' },
      order: { createdAt: 'DESC' },
    });

    if (!execution) {
      throw new NotFoundException('No active execution found');
    }

    execution.status = 'paused';
    execution.pausedAt = new Date();
    execution.events.push({
      timestamp: new Date(),
      type: 'paused',
      message: 'Mission paused by operator',
    });

    await this.executionRepository.save(execution);
    await this.missionRepository.update(missionId, { status: 'paused' as MissionStatus });

    this.eventsGateway.emitMissionStatus(missionId, {
      missionId,
      status: 'paused',
      executionId: execution.id,
    });

    return execution;
  }

  async resume(missionId: string): Promise<MissionExecution> {
    const mission = await this.missionRepository.findOne({
      where: { id: missionId },
    });

    if (!mission) {
      throw new NotFoundException('Mission not found');
    }

    const execution = await this.executionRepository.findOne({
      where: { missionId, status: 'paused' },
      order: { createdAt: 'DESC' },
    });

    if (!execution) {
      throw new NotFoundException('No paused execution found');
    }

    execution.status = 'in_progress';
    execution.pausedAt = undefined as unknown as Date;
    execution.events.push({
      timestamp: new Date(),
      type: 'resumed',
      message: 'Mission resumed by operator',
    });

    await this.executionRepository.save(execution);
    await this.missionRepository.update(missionId, { status: 'executing' });

    this.eventsGateway.emitMissionStatus(missionId, {
      missionId,
      status: 'executing',
      executionId: execution.id,
    });

    return execution;
  }

  async schedule(missionId: string, scheduledAt?: Date): Promise<Mission> {
    const mission = await this.findById(missionId);

    if (!['draft', 'ready'].includes(mission.status)) {
      throw new BadRequestException('Mission cannot be scheduled from current status');
    }

    if (!mission.droneId) {
      throw new BadRequestException('Mission must have a drone assigned');
    }

    if (!mission.waypoints || mission.waypoints.length === 0) {
      throw new BadRequestException('Mission must have at least one waypoint');
    }

    await this.missionRepository.update(missionId, {
      status: 'scheduled',
      scheduleType: scheduledAt ? 'scheduled' : 'manual',
      scheduledAt: scheduledAt || undefined,
    });

    return this.findById(missionId);
  }

  // Mission execution (legacy - use start instead)
  async execute(missionId: string, userId: string): Promise<MissionExecution> {
    const mission = await this.findById(missionId);

    if (mission.status !== 'ready' && mission.status !== 'scheduled') {
      throw new BadRequestException('Mission must be ready or scheduled to execute');
    }

    if (!mission.droneId) {
      throw new BadRequestException('Mission must have a drone assigned');
    }

    if (!mission.waypoints || mission.waypoints.length === 0) {
      throw new BadRequestException('Mission must have at least one waypoint');
    }

    // Create execution record
    const execution = this.executionRepository.create({
      missionId,
      droneId: mission.droneId,
      status: 'pending',
      currentWaypointIndex: 0,
      totalWaypoints: mission.waypoints.length,
      completedWaypoints: [],
      waypointLogs: [],
      events: [
        {
          timestamp: new Date(),
          type: 'started',
          message: 'Mission execution initiated',
        },
      ],
      initiatedBy: userId,
      triggerType: 'manual',
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Update mission status
    await this.missionRepository.update(missionId, { status: 'executing' });

    // Emit WebSocket event
    this.eventsGateway.emitMissionStatus(missionId, {
      missionId,
      status: 'executing',
      executionId: savedExecution.id,
      progress: 0,
    });

    return savedExecution;
  }

  async abortExecution(missionId: string, reason: string): Promise<MissionExecution> {
    const mission = await this.findById(missionId);

    if (mission.status !== 'executing') {
      throw new BadRequestException('Mission is not currently executing');
    }

    const execution = await this.executionRepository.findOne({
      where: { missionId, status: 'in_progress' },
      order: { createdAt: 'DESC' },
    });

    if (!execution) {
      throw new NotFoundException('No active execution found');
    }

    execution.status = 'aborted';
    execution.abortReason = reason;
    execution.completedAt = new Date();
    execution.events.push({
      timestamp: new Date(),
      type: 'aborted',
      message: `Mission aborted: ${reason}`,
    });

    await this.executionRepository.save(execution);
    await this.missionRepository.update(missionId, { status: 'cancelled' });

    this.eventsGateway.emitMissionStatus(missionId, {
      missionId,
      status: 'aborted',
      reason,
    });

    return execution;
  }

  async getExecutions(missionId: string): Promise<MissionExecution[]> {
    return this.executionRepository.find({
      where: { missionId },
      order: { createdAt: 'DESC' },
    });
  }

  async duplicate(missionId: string, userId: string): Promise<Mission> {
    const original = await this.findById(missionId);

    const duplicate = this.missionRepository.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      droneId: original.droneId,
      departureHubId: original.departureHubId,
      arrivalHubId: original.arrivalHubId,
      scheduleType: 'manual',
      triggerConditions: original.triggerConditions,
      estimatedDuration: original.estimatedDuration,
      estimatedDistance: original.estimatedDistance,
      status: 'draft',
      createdBy: userId,
    });

    const saved = await this.missionRepository.save(duplicate);

    // Duplicate waypoints
    for (const wp of original.waypoints) {
      await this.waypointRepository.save(
        this.waypointRepository.create({
          missionId: saved.id,
          sequence: wp.sequence,
          name: wp.name,
          latitude: wp.latitude,
          longitude: wp.longitude,
          altitude: wp.altitude,
          speedToWaypoint: wp.speedToWaypoint,
          headingAtWaypoint: wp.headingAtWaypoint,
          turnRadius: wp.turnRadius,
          actions: wp.actions,
          conditions: wp.conditions,
          hoverDuration: wp.hoverDuration,
          waitForConfirmation: wp.waitForConfirmation,
        }),
      );
    }

    return this.findById(saved.id);
  }

  // Helper methods
  private isValidStatusTransition(from: MissionStatus, to: MissionStatus): boolean {
    const transitions: Record<MissionStatus, MissionStatus[]> = {
      draft: ['ready', 'scheduled', 'executing', 'cancelled'],
      ready: ['scheduled', 'executing', 'draft', 'cancelled'],
      scheduled: ['executing', 'ready', 'cancelled'],
      executing: ['paused', 'completed', 'aborted', 'cancelled', 'failed'],
      paused: ['executing', 'aborted', 'cancelled'],
      completed: [],
      aborted: ['draft'],
      cancelled: ['draft'],
      failed: ['draft'],
    };

    return transitions[from]?.includes(to) ?? false;
  }

  private async resequenceWaypoints(missionId: string): Promise<void> {
    const waypoints = await this.waypointRepository.find({
      where: { missionId },
      order: { sequence: 'ASC' },
    });

    for (let i = 0; i < waypoints.length; i++) {
      if (waypoints[i].sequence !== i) {
        await this.waypointRepository.update(waypoints[i].id, { sequence: i });
      }
    }
  }

  private async recalculateEstimates(missionId: string): Promise<void> {
    const mission = await this.findById(missionId);

    if (!mission.waypoints || mission.waypoints.length === 0) {
      await this.missionRepository.update(missionId, {
        estimatedDuration: 0,
        estimatedDistance: 0,
      });
      return;
    }

    let totalDistance = 0;
    const avgSpeed = 45; // km/h default

    // Calculate distance between waypoints
    for (let i = 0; i < mission.waypoints.length - 1; i++) {
      const wp1 = mission.waypoints[i];
      const wp2 = mission.waypoints[i + 1];
      totalDistance += this.calculateDistance(
        wp1.latitude,
        wp1.longitude,
        wp2.latitude,
        wp2.longitude,
      );
    }

    // Estimate duration (distance/speed + hover times)
    const flightTime = (totalDistance / 1000 / avgSpeed) * 3600; // seconds
    const hoverTime = mission.waypoints.reduce(
      (sum, wp) => sum + (wp.hoverDuration || 0),
      0,
    );

    await this.missionRepository.update(missionId, {
      estimatedDistance: Math.round(totalDistance),
      estimatedDuration: Math.round(flightTime + hoverTime),
    });
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    // Haversine formula
    const R = 6371000; // Earth's radius in meters
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
