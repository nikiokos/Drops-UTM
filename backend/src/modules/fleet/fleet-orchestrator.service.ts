import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FleetAssignment, ScoringWeights, AlternativeDrone } from './fleet-assignment.entity';
import { RebalancingTask, RebalancingTrigger } from './rebalancing-task.entity';
import { FleetConfiguration, FleetThresholds, DEFAULT_PRESETS } from './fleet-config.entity';
import { ScoringEngineService, MissionRequirements, ScoredDrone } from './scoring-engine.service';
import { FleetStateService, HubFleetStatus } from './fleet-state.service';
import { Drone } from '../drones/drone.entity';
import { Mission } from '../missions/mission.entity';
import { Hub } from '../hubs/hub.entity';

export interface AssignmentResult {
  success: boolean;
  assignment?: FleetAssignment;
  selectedDrone?: Drone;
  alternatives: AlternativeDrone[];
  reason?: string;
}

export interface RebalancingRecommendation {
  sourceHub: HubFleetStatus;
  targetHub: HubFleetStatus;
  recommendedDrone: Drone;
  trigger: RebalancingTrigger;
  priority: number;
  reason: string;
}

@Injectable()
export class FleetOrchestratorService {
  private readonly logger = new Logger(FleetOrchestratorService.name);
  private activeConfig: FleetConfiguration | null = null;

  constructor(
    @InjectRepository(FleetAssignment)
    private assignmentRepository: Repository<FleetAssignment>,
    @InjectRepository(RebalancingTask)
    private rebalancingRepository: Repository<RebalancingTask>,
    @InjectRepository(FleetConfiguration)
    private configRepository: Repository<FleetConfiguration>,
    @InjectRepository(Mission)
    private missionRepository: Repository<Mission>,
    @InjectRepository(Hub)
    private hubRepository: Repository<Hub>,
    private scoringEngine: ScoringEngineService,
    private fleetState: FleetStateService,
  ) {
    this.loadActiveConfig();
  }

  async loadActiveConfig(): Promise<FleetConfiguration> {
    let config = await this.configRepository.findOne({ where: { isActive: true } });

    if (!config) {
      // Create default Balanced Mode config
      const defaultPreset = DEFAULT_PRESETS.find((p) => p.name === 'Balanced Mode');
      if (defaultPreset) {
        config = this.configRepository.create({
          ...defaultPreset,
          isActive: true,
        });
        config = await this.configRepository.save(config);
        this.logger.log('Created default Balanced Mode configuration');
      } else {
        throw new Error('No active fleet configuration found and default preset unavailable');
      }
    }

    this.activeConfig = config;

    // Update scoring engine with fleet average
    const overview = await this.fleetState.getFleetOverview();
    this.scoringEngine.updateFleetAverageHours(overview.averageFlightHours);

    return config;
  }

  async getActiveConfig(): Promise<FleetConfiguration> {
    if (!this.activeConfig) {
      return this.loadActiveConfig();
    }
    return this.activeConfig;
  }

  async setActiveConfig(configId: string): Promise<FleetConfiguration> {
    // Deactivate current config
    await this.configRepository.update({}, { isActive: false });

    // Activate new config
    await this.configRepository.update(configId, { isActive: true });

    return this.loadActiveConfig();
  }

  async assignDroneToMission(
    mission: Mission,
    operatorOverride?: string,
  ): Promise<AssignmentResult> {
    const config = await this.getActiveConfig();
    const weights = config.weights;

    // Build requirements from mission
    const departureHub = await this.hubRepository.findOne({
      where: { id: mission.departureHubId },
    });

    if (!departureHub) {
      return {
        success: false,
        alternatives: [],
        reason: 'Departure hub not found',
      };
    }

    const requirements: MissionRequirements = {
      departureHubId: mission.departureHubId,
      departureLocation: departureHub.location,
      estimatedDistance: mission.estimatedDistance,
      estimatedDuration: mission.estimatedDuration,
    };

    // Get all available drones
    const availableDrones = await this.fleetState.getAvailableDrones();
    const drones = availableDrones
      .filter((d) => d.status === 'available' && !d.currentMissionId)
      .map((d) => d.drone);

    if (drones.length === 0) {
      return {
        success: false,
        alternatives: [],
        reason: 'No available drones in the fleet',
      };
    }

    // Score all drones
    const scoredDrones = this.scoringEngine.scoreDrones(drones, requirements, weights);

    // Filter eligible drones
    const eligibleDrones = scoredDrones.filter((sd) => sd.eligible);

    if (eligibleDrones.length === 0) {
      return {
        success: false,
        alternatives: this.scoringEngine.formatAlternatives(scoredDrones, 5),
        reason: 'No eligible drones found. ' + (scoredDrones[0]?.ineligibilityReason || ''),
      };
    }

    // Select best drone (or operator override)
    let selectedDrone: ScoredDrone;
    if (operatorOverride) {
      const overrideDrone = eligibleDrones.find((sd) => sd.drone.id === operatorOverride);
      if (!overrideDrone) {
        return {
          success: false,
          alternatives: this.scoringEngine.formatAlternatives(eligibleDrones, 5),
          reason: 'Operator-selected drone is not eligible',
        };
      }
      selectedDrone = overrideDrone;
    } else {
      selectedDrone = eligibleDrones[0];
    }

    // Create assignment record
    const assignment = this.assignmentRepository.create({
      missionId: mission.id,
      droneId: selectedDrone.drone.id,
      scores: selectedDrone.scores,
      weights,
      finalScore: selectedDrone.finalScore,
      status: 'pending',
      assignedBy: operatorOverride ? 'operator' : 'system',
      alternativeDrones: this.scoringEngine.formatAlternatives(
        eligibleDrones.filter((sd) => sd.drone.id !== selectedDrone.drone.id),
        4,
      ),
      assignedAt: new Date(),
    });

    await this.assignmentRepository.save(assignment);

    this.logger.log(
      `Assigned drone ${selectedDrone.drone.registrationNumber} to mission ${mission.id} ` +
        `with score ${selectedDrone.finalScore}`,
    );

    return {
      success: true,
      assignment,
      selectedDrone: selectedDrone.drone,
      alternatives: assignment.alternativeDrones,
    };
  }

  async acceptAssignment(assignmentId: string): Promise<FleetAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    assignment.status = 'accepted';
    await this.assignmentRepository.save(assignment);

    // Update drone status
    await this.fleetState.updateDroneStatus(assignment.droneId, 'busy');

    // Update mission with assigned drone
    await this.missionRepository.update(assignment.missionId, {
      droneId: assignment.droneId,
    });

    return assignment;
  }

  async rejectAssignment(
    assignmentId: string,
    reason: string,
    alternativeDroneId?: string,
  ): Promise<FleetAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    assignment.status = 'rejected';
    assignment.rejectionReason = reason;
    await this.assignmentRepository.save(assignment);

    // If alternative provided, create new assignment
    if (alternativeDroneId) {
      const mission = await this.missionRepository.findOne({
        where: { id: assignment.missionId },
      });
      if (mission) {
        const result = await this.assignDroneToMission(mission, alternativeDroneId);
        if (result.assignment) {
          return result.assignment;
        }
      }
    }

    return assignment;
  }

  async analyzeRebalancingNeeds(): Promise<RebalancingRecommendation[]> {
    const config = await this.getActiveConfig();
    const thresholds = config.thresholds;
    const recommendations: RebalancingRecommendation[] = [];

    // Check if we're in quiet hours
    if (thresholds.quietHoursOnly && this.isQuietHours(thresholds)) {
      return [];
    }

    // Get hub statuses
    const [hubsNeedingDrones, hubsWithExcess] = await Promise.all([
      this.fleetState.getHubsNeedingDrones(thresholds.minDronesPerHub),
      this.fleetState.getHubsWithExcessDrones(thresholds.minDonorReserve),
    ]);

    // Check concurrent reposition limit
    const activeRepositions = await this.rebalancingRepository.count({
      where: { status: 'in_progress' },
    });

    if (activeRepositions >= thresholds.maxConcurrentRepositions) {
      this.logger.debug(
        `Max concurrent repositions reached (${activeRepositions}/${thresholds.maxConcurrentRepositions})`,
      );
      return [];
    }

    // Match hubs needing drones with hubs that have excess
    for (const needyHub of hubsNeedingDrones) {
      for (const donorHub of hubsWithExcess) {
        if (needyHub.hubId === donorHub.hubId) continue;

        // Find best drone from donor hub
        const donorDrones = await this.fleetState.getDronesAtHub(donorHub.hubId);
        const availableDonorDrones = donorDrones.filter((d) => d.status === 'available');

        if (availableDonorDrones.length <= thresholds.minDonorReserve) {
          continue; // Would leave donor hub understaffed
        }

        // Score drones for reposition suitability
        const scoredDrones = this.scoreDronesForReposition(availableDonorDrones, thresholds);
        if (scoredDrones.length === 0) continue;

        const bestDrone = scoredDrones[0];
        const priority = this.calculateRebalancingPriority(needyHub, donorHub);

        recommendations.push({
          sourceHub: donorHub,
          targetHub: needyHub,
          recommendedDrone: bestDrone,
          trigger: 'threshold_breach',
          priority,
          reason: `Hub ${needyHub.hubName} has ${needyHub.availableDrones} drones ` +
            `(minimum: ${thresholds.minDronesPerHub})`,
        });
      }
    }

    // Sort by priority
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  async createRebalancingTask(
    recommendation: RebalancingRecommendation,
    autoApprove: boolean = false,
  ): Promise<RebalancingTask> {
    const config = await this.getActiveConfig();

    const task = this.rebalancingRepository.create({
      sourceHubId: recommendation.sourceHub.hubId,
      targetHubId: recommendation.targetHub.hubId,
      droneId: recommendation.recommendedDrone.id,
      trigger: recommendation.trigger,
      rule: {
        type: 'min_drones',
        condition: recommendation.reason,
        threshold: config.thresholds.minDronesPerHub,
        actualValue: recommendation.targetHub.availableDrones,
      },
      status: autoApprove ? 'approved' : 'pending',
      priority: recommendation.priority,
      approvedAt: autoApprove ? new Date() : undefined,
      approvedBy: autoApprove ? 'system' : undefined,
    });

    return this.rebalancingRepository.save(task);
  }

  async approveRebalancingTask(taskId: string, operatorId: string): Promise<RebalancingTask> {
    const task = await this.rebalancingRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error('Rebalancing task not found');
    }

    if (task.status !== 'pending') {
      throw new Error(`Cannot approve task in ${task.status} status`);
    }

    task.status = 'approved';
    task.approvedBy = operatorId;
    task.approvedAt = new Date();

    return this.rebalancingRepository.save(task);
  }

  async executeRebalancingTask(taskId: string): Promise<RebalancingTask> {
    const task = await this.rebalancingRepository.findOne({
      where: { id: taskId },
      relations: ['sourceHub', 'targetHub', 'drone'],
    });

    if (!task) {
      throw new Error('Rebalancing task not found');
    }

    if (task.status !== 'approved') {
      throw new Error(`Cannot execute task in ${task.status} status`);
    }

    // Create repositioning mission
    const repositionMission = this.missionRepository.create({
      name: `Reposition: ${task.drone?.registrationNumber || task.droneId}`,
      description: `Fleet rebalancing from ${task.sourceHub?.name} to ${task.targetHub?.name}`,
      departureHubId: task.sourceHubId,
      arrivalHubId: task.targetHubId,
      droneId: task.droneId,
      status: 'scheduled',
      scheduleType: 'manual',
      createdBy: 'fleet-orchestrator',
    });

    const savedMission = await this.missionRepository.save(repositionMission);

    // Update task
    task.status = 'in_progress';
    task.repositioningMissionId = savedMission.id;
    task.startedAt = new Date();

    // Update drone status
    await this.fleetState.updateDroneStatus(task.droneId, 'repositioning');

    return this.rebalancingRepository.save(task);
  }

  async cancelRebalancingTask(taskId: string, reason: string): Promise<RebalancingTask> {
    const task = await this.rebalancingRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error('Rebalancing task not found');
    }

    if (['completed', 'cancelled', 'failed'].includes(task.status)) {
      throw new Error(`Cannot cancel task in ${task.status} status`);
    }

    task.status = 'cancelled';
    task.cancelledReason = reason;

    return this.rebalancingRepository.save(task);
  }

  async completeRebalancingTask(taskId: string): Promise<RebalancingTask> {
    const task = await this.rebalancingRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error('Rebalancing task not found');
    }

    task.status = 'completed';
    task.completedAt = new Date();

    // Update drone location
    await this.fleetState.updateDroneLocation(task.droneId, task.targetHubId);
    await this.fleetState.updateDroneStatus(task.droneId, 'available');

    return this.rebalancingRepository.save(task);
  }

  async getAssignmentHistory(missionId: string): Promise<FleetAssignment[]> {
    return this.assignmentRepository.find({
      where: { missionId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingRebalancingTasks(): Promise<RebalancingTask[]> {
    return this.rebalancingRepository.find({
      where: { status: 'pending' },
      relations: ['sourceHub', 'targetHub', 'drone'],
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async getActiveRebalancingTasks(): Promise<RebalancingTask[]> {
    return this.rebalancingRepository.find({
      where: [{ status: 'approved' }, { status: 'in_progress' }],
      relations: ['sourceHub', 'targetHub', 'drone', 'repositioningMission'],
      order: { priority: 'DESC' },
    });
  }

  private scoreDronesForReposition(drones: Drone[], thresholds: FleetThresholds): Drone[] {
    return drones
      .filter((drone) => {
        // Check minimum battery for reposition
        // In production, this would come from telemetry
        // For now, assume available drones have sufficient battery
        return drone.status === 'available';
      })
      .sort((a, b) => {
        // Prefer drones with lower utilization
        const aHours = a.totalFlightHours || 0;
        const bHours = b.totalFlightHours || 0;
        return aHours - bHours;
      });
  }

  private calculateRebalancingPriority(needyHub: HubFleetStatus, donorHub: HubFleetStatus): number {
    // Higher priority for more critical shortages
    let priority = 0;

    // Severity of shortage
    if (needyHub.availableDrones === 0) {
      priority += 100; // Critical - no drones
    } else if (needyHub.availableDrones === 1) {
      priority += 50; // Urgent - only one drone
    } else {
      priority += 25; // Normal rebalancing
    }

    // Availability at donor
    if (donorHub.availableDrones > 5) {
      priority += 10; // Plenty of drones to spare
    }

    return priority;
  }

  private isQuietHours(thresholds: FleetThresholds): boolean {
    if (!thresholds.quietHoursStart || !thresholds.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();

    if (thresholds.quietHoursStart < thresholds.quietHoursEnd) {
      // Simple range (e.g., 9-17)
      return currentHour >= thresholds.quietHoursStart && currentHour < thresholds.quietHoursEnd;
    } else {
      // Overnight range (e.g., 22-6)
      return currentHour >= thresholds.quietHoursStart || currentHour < thresholds.quietHoursEnd;
    }
  }
}
