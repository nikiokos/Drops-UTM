import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
} from '@nestjs/common';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
import { FleetOrchestratorService, AssignmentResult, RebalancingRecommendation } from './fleet-orchestrator.service';
import { FleetStateService, FleetOverview, HubFleetStatus } from './fleet-state.service';
import { FleetAssignment } from './fleet-assignment.entity';
import { RebalancingTask } from './rebalancing-task.entity';
import { FleetConfiguration, ScoringWeights, FleetThresholds } from './fleet-config.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from '../missions/mission.entity';

// DTOs
class AssignDroneDto {
  missionId: string;
  operatorOverride?: string;
}

class RejectAssignmentDto {
  reason: string;
  alternativeDroneId?: string;
}

class ApproveRebalancingDto {
  operatorId: string;
}

class CreateRebalancingDto {
  sourceHubId: string;
  targetHubId: string;
  droneId: string;
  autoApprove?: boolean;
}

class UpdateConfigDto {
  name?: string;
  description?: string;
  weights?: ScoringWeights;
  thresholds?: FleetThresholds;
}

class CreateConfigDto {
  name: string;
  description?: string;
  weights: ScoringWeights;
  thresholds: FleetThresholds;
}

@Controller('fleet')
export class FleetController {
  constructor(
    private readonly orchestrator: FleetOrchestratorService,
    private readonly fleetState: FleetStateService,
    @InjectRepository(Mission)
    private missionRepository: Repository<Mission>,
    @InjectRepository(FleetConfiguration)
    private configRepository: Repository<FleetConfiguration>,
    @InjectRepository(RebalancingTask)
    private rebalancingRepository: Repository<RebalancingTask>,
  ) {}

  // =====================
  // Fleet State Endpoints
  // =====================

  @Get('overview')
  async getFleetOverview(): Promise<FleetOverview> {
    return this.fleetState.getFleetOverview();
  }

  @Get('hubs/:hubId/status')
  async getHubStatus(@Param('hubId') hubId: string): Promise<HubFleetStatus> {
    const status = await this.fleetState.getHubStatus(hubId);
    if (!status) {
      throw new HttpException('Hub not found', HttpStatus.NOT_FOUND);
    }
    return status;
  }

  @Get('hubs/:hubId/drones')
  async getDronesAtHub(@Param('hubId') hubId: string) {
    return this.fleetState.getDronesAtHub(hubId);
  }

  @Get('available')
  async getAvailableDrones(@Query('hubId') hubId?: string) {
    return this.fleetState.getAvailableDrones(hubId);
  }

  // =======================
  // Assignment Endpoints
  // =======================

  @Post('assign')
  async assignDrone(@Body() dto: AssignDroneDto): Promise<AssignmentResult> {
    const mission = await this.missionRepository.findOne({
      where: { id: dto.missionId },
    });

    if (!mission) {
      throw new HttpException('Mission not found', HttpStatus.NOT_FOUND);
    }

    return this.orchestrator.assignDroneToMission(mission, dto.operatorOverride);
  }

  @Post('assignments/:id/accept')
  async acceptAssignment(@Param('id') id: string): Promise<FleetAssignment> {
    try {
      return await this.orchestrator.acceptAssignment(id);
    } catch (error) {
      throw new HttpException(getErrorMessage(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Post('assignments/:id/reject')
  async rejectAssignment(
    @Param('id') id: string,
    @Body() dto: RejectAssignmentDto,
  ): Promise<FleetAssignment> {
    try {
      return await this.orchestrator.rejectAssignment(id, dto.reason, dto.alternativeDroneId);
    } catch (error) {
      throw new HttpException(getErrorMessage(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('assignments/mission/:missionId')
  async getAssignmentHistory(@Param('missionId') missionId: string): Promise<FleetAssignment[]> {
    return this.orchestrator.getAssignmentHistory(missionId);
  }

  // =======================
  // Rebalancing Endpoints
  // =======================

  @Get('rebalancing/analyze')
  async analyzeRebalancing(): Promise<RebalancingRecommendation[]> {
    return this.orchestrator.analyzeRebalancingNeeds();
  }

  @Get('rebalancing/pending')
  async getPendingRebalancing(): Promise<RebalancingTask[]> {
    return this.orchestrator.getPendingRebalancingTasks();
  }

  @Get('rebalancing/active')
  async getActiveRebalancing(): Promise<RebalancingTask[]> {
    return this.orchestrator.getActiveRebalancingTasks();
  }

  @Get('rebalancing/history')
  async getRebalancingHistory(
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ): Promise<RebalancingTask[]> {
    return this.rebalancingRepository.find({
      relations: ['sourceHub', 'targetHub', 'drone'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  @Post('rebalancing')
  async createRebalancingTask(@Body() dto: CreateRebalancingDto): Promise<RebalancingTask> {
    // Create a recommendation object from the DTO
    const [sourceHub, targetHub] = await Promise.all([
      this.fleetState.getHubStatus(dto.sourceHubId),
      this.fleetState.getHubStatus(dto.targetHubId),
    ]);

    if (!sourceHub || !targetHub) {
      throw new HttpException('Source or target hub not found', HttpStatus.NOT_FOUND);
    }

    const drone = await this.fleetState.getDroneById(dto.droneId);
    if (!drone) {
      throw new HttpException('Drone not found', HttpStatus.NOT_FOUND);
    }

    const recommendation: RebalancingRecommendation = {
      sourceHub,
      targetHub,
      recommendedDrone: drone,
      trigger: 'manual',
      priority: 50,
      reason: `Manual rebalancing request from ${sourceHub.hubName} to ${targetHub.hubName}`,
    };

    return this.orchestrator.createRebalancingTask(recommendation, dto.autoApprove);
  }

  @Post('rebalancing/:id/approve')
  async approveRebalancing(
    @Param('id') id: string,
    @Body() dto: ApproveRebalancingDto,
  ): Promise<RebalancingTask> {
    try {
      return await this.orchestrator.approveRebalancingTask(id, dto.operatorId);
    } catch (error) {
      throw new HttpException(getErrorMessage(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Post('rebalancing/:id/execute')
  async executeRebalancing(@Param('id') id: string): Promise<RebalancingTask> {
    try {
      return await this.orchestrator.executeRebalancingTask(id);
    } catch (error) {
      throw new HttpException(getErrorMessage(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Post('rebalancing/:id/cancel')
  async cancelRebalancing(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<RebalancingTask> {
    try {
      return await this.orchestrator.cancelRebalancingTask(id, reason || 'Cancelled by operator');
    } catch (error) {
      throw new HttpException(getErrorMessage(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Post('rebalancing/:id/complete')
  async completeRebalancing(@Param('id') id: string): Promise<RebalancingTask> {
    try {
      return await this.orchestrator.completeRebalancingTask(id);
    } catch (error) {
      throw new HttpException(getErrorMessage(error), HttpStatus.BAD_REQUEST);
    }
  }

  // =======================
  // Configuration Endpoints
  // =======================

  @Get('config')
  async getActiveConfig(): Promise<FleetConfiguration> {
    return this.orchestrator.getActiveConfig();
  }

  @Get('config/all')
  async getAllConfigs(): Promise<FleetConfiguration[]> {
    return this.configRepository.find({
      order: { isActive: 'DESC', isPreset: 'DESC', name: 'ASC' },
    });
  }

  @Get('config/:id')
  async getConfig(@Param('id') id: string): Promise<FleetConfiguration> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new HttpException('Configuration not found', HttpStatus.NOT_FOUND);
    }
    return config;
  }

  @Post('config')
  async createConfig(@Body() dto: CreateConfigDto): Promise<FleetConfiguration> {
    const config = this.configRepository.create({
      name: dto.name,
      description: dto.description,
      weights: dto.weights,
      thresholds: dto.thresholds,
      isPreset: false,
      isActive: false,
    });
    return this.configRepository.save(config);
  }

  @Put('config/:id')
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateConfigDto,
  ): Promise<FleetConfiguration> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new HttpException('Configuration not found', HttpStatus.NOT_FOUND);
    }

    if (config.isPreset) {
      throw new HttpException('Cannot modify preset configurations', HttpStatus.FORBIDDEN);
    }

    if (dto.name) config.name = dto.name;
    if (dto.description !== undefined) config.description = dto.description;
    if (dto.weights) config.weights = dto.weights;
    if (dto.thresholds) config.thresholds = dto.thresholds;

    return this.configRepository.save(config);
  }

  @Post('config/:id/activate')
  async activateConfig(@Param('id') id: string): Promise<FleetConfiguration> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new HttpException('Configuration not found', HttpStatus.NOT_FOUND);
    }

    return this.orchestrator.setActiveConfig(id);
  }
}
