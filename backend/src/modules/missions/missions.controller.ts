import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  MissionsService,
  CreateMissionDto,
  UpdateMissionDto,
  CreateWaypointDto,
} from './missions.service';
import { MissionStatus } from './mission.entity';

@ApiTags('Missions')
@ApiBearerAuth()
@Controller('missions')
@UseGuards(JwtAuthGuard)
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new mission' })
  async create(
    @Body() dto: CreateMissionDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.missionsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all missions' })
  async findAll(
    @Query('status') status?: MissionStatus,
    @Query('droneId') droneId?: string,
    @Query('departureHubId') departureHubId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.missionsService.findAll({
      status,
      droneId,
      departureHubId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mission by ID' })
  async findById(@Param('id') id: string) {
    return this.missionsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update mission' })
  async update(@Param('id') id: string, @Body() dto: UpdateMissionDto) {
    return this.missionsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete mission' })
  async delete(@Param('id') id: string) {
    await this.missionsService.delete(id);
    return { message: 'Mission deleted successfully' };
  }

  // Waypoint operations
  @Post(':id/waypoints')
  @ApiOperation({ summary: 'Add waypoint to mission' })
  async addWaypoint(@Param('id') id: string, @Body() dto: CreateWaypointDto) {
    return this.missionsService.addWaypoint(id, dto);
  }

  @Put(':id/waypoints/:waypointId')
  @ApiOperation({ summary: 'Update waypoint' })
  async updateWaypoint(
    @Param('id') id: string,
    @Param('waypointId') waypointId: string,
    @Body() dto: Partial<CreateWaypointDto>,
  ) {
    return this.missionsService.updateWaypoint(id, waypointId, dto);
  }

  @Delete(':id/waypoints/:waypointId')
  @ApiOperation({ summary: 'Delete waypoint' })
  async deleteWaypoint(
    @Param('id') id: string,
    @Param('waypointId') waypointId: string,
  ) {
    await this.missionsService.deleteWaypoint(id, waypointId);
    return { message: 'Waypoint deleted successfully' };
  }

  @Post(':id/waypoints/reorder')
  @ApiOperation({ summary: 'Reorder waypoints' })
  async reorderWaypoints(
    @Param('id') id: string,
    @Body() body: { order: { waypointId: string; sequence: number }[] },
  ) {
    return this.missionsService.reorderWaypoints(id, body.order);
  }

  // Mission lifecycle operations
  @Post(':id/start')
  @ApiOperation({ summary: 'Start mission execution' })
  async start(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.missionsService.start(id, req.user.id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause mission execution' })
  async pause(@Param('id') id: string) {
    return this.missionsService.pause(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume paused mission' })
  async resume(@Param('id') id: string) {
    return this.missionsService.resume(id);
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Schedule mission for execution' })
  async schedule(
    @Param('id') id: string,
    @Body() body: { scheduledAt?: string },
  ) {
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
    return this.missionsService.schedule(id, scheduledAt);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Start mission execution (legacy)' })
  async execute(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.missionsService.execute(id, req.user.id);
  }

  @Post(':id/abort')
  @ApiOperation({ summary: 'Abort mission execution' })
  async abort(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.missionsService.abortExecution(id, body.reason || 'Aborted by operator');
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Get mission execution history' })
  async getExecutions(@Param('id') id: string) {
    return this.missionsService.getExecutions(id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate mission' })
  async duplicate(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.missionsService.duplicate(id, req.user.id);
  }
}
