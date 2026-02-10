import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Mission } from './mission.entity';
import { MissionExecution, ExecutionStatus, WaypointLog, ExecutionEvent } from './mission-execution.entity';
import { Waypoint } from './waypoint.entity';
import { EventsGateway } from '../../gateways/events.gateway';

@Injectable()
export class MissionExecutorService {
  private readonly logger = new Logger(MissionExecutorService.name);
  private activeExecutions: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(Mission)
    private missionRepository: Repository<Mission>,
    @InjectRepository(MissionExecution)
    private executionRepository: Repository<MissionExecution>,
    @InjectRepository(Waypoint)
    private waypointRepository: Repository<Waypoint>,
    private eventsGateway: EventsGateway,
  ) {}

  // Check for scheduled missions every 30 seconds
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkScheduledMissions(): Promise<void> {
    const now = new Date();

    // Find missions that are scheduled and due
    const dueMissions = await this.missionRepository.find({
      where: {
        status: 'scheduled',
        scheduleType: 'scheduled',
        scheduledAt: LessThanOrEqual(now),
      },
      relations: ['waypoints', 'drone'],
    });

    for (const mission of dueMissions) {
      this.logger.log(`Starting scheduled mission: ${mission.name} (${mission.id})`);
      await this.startExecution(mission);
    }
  }

  async startExecution(mission: Mission): Promise<MissionExecution> {
    // Create execution record
    const execution = this.executionRepository.create({
      missionId: mission.id,
      droneId: mission.droneId,
      status: 'in_progress',
      currentWaypointIndex: 0,
      totalWaypoints: mission.waypoints?.length || 0,
      completedWaypoints: [],
      waypointLogs: [],
      events: [
        {
          timestamp: new Date(),
          type: 'started',
          message: 'Mission execution started',
        },
      ],
      startedAt: new Date(),
      triggerType: 'scheduled',
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Update mission status
    await this.missionRepository.update(mission.id, { status: 'executing' });

    // Emit status update
    this.eventsGateway.emitMissionStatus(mission.id, {
      missionId: mission.id,
      status: 'executing',
      executionId: savedExecution.id,
      progress: 0,
    });

    // Start simulated waypoint progression
    this.simulateWaypointProgression(savedExecution, mission.waypoints || []);

    return savedExecution;
  }

  private async simulateWaypointProgression(
    execution: MissionExecution,
    waypoints: Waypoint[],
  ): Promise<void> {
    if (waypoints.length === 0) {
      await this.completeExecution(execution);
      return;
    }

    // Sort waypoints by sequence
    const sortedWaypoints = [...waypoints].sort((a, b) => a.sequence - b.sequence);

    let currentIndex = 0;
    const progressInterval = setInterval(async () => {
      // Check if execution was aborted
      const currentExecution = await this.executionRepository.findOne({
        where: { id: execution.id },
      });

      if (!currentExecution || currentExecution.status === 'aborted') {
        clearInterval(progressInterval);
        this.activeExecutions.delete(execution.id);
        return;
      }

      const waypoint = sortedWaypoints[currentIndex];

      // Simulate reaching waypoint
      await this.waypointReached(currentExecution, waypoint, currentIndex);

      currentIndex++;

      // Check if mission complete
      if (currentIndex >= sortedWaypoints.length) {
        clearInterval(progressInterval);
        this.activeExecutions.delete(execution.id);
        await this.completeExecution(currentExecution);
      }
    }, 5000); // Progress every 5 seconds for demo

    this.activeExecutions.set(execution.id, progressInterval);
  }

  private async waypointReached(
    execution: MissionExecution,
    waypoint: Waypoint,
    index: number,
  ): Promise<void> {
    // Create waypoint log
    const waypointLog: WaypointLog = {
      waypointId: waypoint.id,
      waypointIndex: index,
      reachedAt: new Date(),
      actionsExecuted: [],
      conditionsTriggered: [],
      telemetrySnapshot: {
        latitude: waypoint.latitude,
        longitude: waypoint.longitude,
        altitude: waypoint.altitude,
        batteryLevel: 85 - index * 3, // Simulated battery drain
        groundSpeed: 45,
      },
    };

    // Execute waypoint actions (simulated)
    if (waypoint.actions && waypoint.actions.length > 0) {
      for (const action of waypoint.actions) {
        waypointLog.actionsExecuted.push(action.type);
        this.logger.log(`Executing action: ${action.type} at waypoint ${index}`);
      }
    }

    // Check conditions (simulated)
    if (waypoint.conditions && waypoint.conditions.length > 0) {
      for (const condition of waypoint.conditions) {
        // Simple battery check simulation
        if (
          condition.type === 'battery_below' &&
          waypointLog.telemetrySnapshot.batteryLevel < (condition.value as number)
        ) {
          waypointLog.conditionsTriggered.push(condition.type);
          this.eventsGateway.emitConditionTriggered(execution.missionId, {
            missionId: execution.missionId,
            waypointId: waypoint.id,
            condition: condition.type,
            action: condition.action,
          });
        }
      }
    }

    waypointLog.departedAt = new Date();

    // Update execution
    const newEvent: ExecutionEvent = {
      timestamp: new Date(),
      type: 'waypoint_reached',
      message: `Reached waypoint ${index + 1}: ${waypoint.name || `WP${index + 1}`}`,
      data: { waypointId: waypoint.id, index },
    };

    execution.currentWaypointIndex = index + 1;
    execution.completedWaypoints = [...(execution.completedWaypoints || []), waypoint.id];
    execution.waypointLogs = [...(execution.waypointLogs || []), waypointLog];
    execution.events = [...(execution.events || []), newEvent];
    await this.executionRepository.save(execution);

    // Emit events
    const progress = Math.round(((index + 1) / execution.totalWaypoints) * 100);

    this.eventsGateway.emitWaypointReached(execution.missionId, {
      missionId: execution.missionId,
      waypointId: waypoint.id,
      waypointIndex: index,
      totalWaypoints: execution.totalWaypoints,
      timestamp: new Date(),
    });

    this.eventsGateway.emitMissionStatus(execution.missionId, {
      missionId: execution.missionId,
      status: 'executing',
      executionId: execution.id,
      progress,
    });
  }

  private async completeExecution(execution: MissionExecution): Promise<void> {
    const completionEvent: ExecutionEvent = {
      timestamp: new Date(),
      type: 'completed',
      message: 'Mission completed successfully',
    };

    execution.status = 'completed';
    execution.completedAt = new Date();
    execution.events = [...(execution.events || []), completionEvent];
    await this.executionRepository.save(execution);

    await this.missionRepository.update(execution.missionId, {
      status: 'completed',
    });

    this.eventsGateway.emitMissionStatus(execution.missionId, {
      missionId: execution.missionId,
      status: 'completed',
      executionId: execution.id,
      progress: 100,
    });

    this.logger.log(`Mission completed: ${execution.missionId}`);
  }

  async pauseExecution(executionId: string): Promise<void> {
    const interval = this.activeExecutions.get(executionId);
    if (interval) {
      clearInterval(interval);
      this.activeExecutions.delete(executionId);
    }

    await this.executionRepository.update(executionId, {
      status: 'paused',
      pausedAt: new Date(),
    });

    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
    });

    if (execution) {
      this.eventsGateway.emitMissionStatus(execution.missionId, {
        missionId: execution.missionId,
        status: 'paused',
        executionId,
      });
    }
  }

  async resumeExecution(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['mission', 'mission.waypoints'],
    });

    if (!execution || execution.status !== 'paused') {
      return;
    }

    await this.executionRepository.update(executionId, {
      status: 'in_progress',
      pausedAt: undefined as unknown as Date,
    });

    // Resume from current waypoint
    const remainingWaypoints = execution.mission.waypoints
      .filter((wp) => !execution.completedWaypoints?.includes(wp.id))
      .sort((a, b) => a.sequence - b.sequence);

    this.simulateWaypointProgression(execution, remainingWaypoints);

    this.eventsGateway.emitMissionStatus(execution.missionId, {
      missionId: execution.missionId,
      status: 'executing',
      executionId,
    });
  }

  async getActiveExecutions(): Promise<MissionExecution[]> {
    return this.executionRepository.find({
      where: { status: In(['pending', 'in_progress', 'paused']) },
      relations: ['mission', 'drone'],
      order: { startedAt: 'DESC' },
    });
  }
}
