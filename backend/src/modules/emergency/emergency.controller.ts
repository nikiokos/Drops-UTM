import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not, IsNull } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EmergencyIncident, EmergencySeverity, EmergencyType } from './incident.entity';
import { BlackboxEntry } from './blackbox.entity';
import { EmergencyProtocol, EmergencyConfig } from './protocol.entity';
import { DecisionEngineService, OperationMode } from './decision-engine.service';
import { DetectionService } from './detection.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string };
}

@Controller('emergency')
@UseGuards(JwtAuthGuard)
export class EmergencyController {
  constructor(
    @InjectRepository(EmergencyIncident)
    private incidentRepo: Repository<EmergencyIncident>,
    @InjectRepository(BlackboxEntry)
    private blackboxRepo: Repository<BlackboxEntry>,
    @InjectRepository(EmergencyProtocol)
    private protocolRepo: Repository<EmergencyProtocol>,
    @InjectRepository(EmergencyConfig)
    private configRepo: Repository<EmergencyConfig>,
    private decisionEngine: DecisionEngineService,
    private detectionService: DetectionService,
  ) {}

  // ============ Incidents ============

  @Get('incidents')
  async getIncidents(
    @Query('status') status?: string,
    @Query('severity') severity?: EmergencySeverity,
    @Query('type') type?: EmergencyType,
    @Query('droneId') droneId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = In(status.split(','));
    }
    if (severity) {
      where.severity = severity;
    }
    if (type) {
      where.emergencyType = type;
    }
    if (droneId) {
      where.droneId = droneId;
    }
    if (from && to) {
      where.detectedAt = Between(new Date(from), new Date(to));
    }

    const [incidents, total] = await this.incidentRepo.findAndCount({
      where,
      order: { detectedAt: 'DESC' },
      take: parseInt(limit),
      skip: parseInt(offset),
      relations: ['drone', 'flight'],
    });

    return { data: incidents, total, limit: parseInt(limit), offset: parseInt(offset) };
  }

  @Get('incidents/active')
  async getActiveIncidents() {
    const incidents = await this.incidentRepo.find({
      where: [
        { status: 'active' },
        { status: 'pending_confirmation' },
        { status: 'executing' },
      ],
      order: { detectedAt: 'DESC' },
      relations: ['drone', 'flight'],
    });

    return incidents;
  }

  @Get('incidents/pending')
  async getPendingConfirmations() {
    return this.decisionEngine.getPendingConfirmations();
  }

  @Get('incidents/:id')
  async getIncident(@Param('id') id: string) {
    const incident = await this.incidentRepo.findOne({
      where: { id },
      relations: ['drone', 'flight'],
    });

    if (!incident) {
      throw new Error('Incident not found');
    }

    return incident;
  }

  @Post('incidents/:id/confirm')
  async confirmIncident(
    @Param('id') id: string,
    @Body() body: { approved: boolean },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.decisionEngine.confirmAction(id, body.approved, req.user.sub);
  }

  @Put('incidents/:id/root-cause')
  async updateRootCause(
    @Param('id') id: string,
    @Body() body: { rootCause: string; notes?: string; lessonsLearned?: string },
  ) {
    const incident = await this.incidentRepo.findOne({ where: { id } });
    if (!incident) {
      throw new Error('Incident not found');
    }

    incident.rootCause = body.rootCause as EmergencyIncident['rootCause'];
    if (body.notes !== undefined) {
      incident.rootCauseNotes = body.notes;
    }
    if (body.lessonsLearned !== undefined) {
      incident.lessonsLearned = body.lessonsLearned;
    }

    return this.incidentRepo.save(incident);
  }

  // ============ Blackbox ============

  @Get('incidents/:id/blackbox')
  async getBlackboxData(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: Record<string, unknown> = { incidentId: id };

    if (from && to) {
      where.timestamp = Between(new Date(from), new Date(to));
    }

    const entries = await this.blackboxRepo.find({
      where,
      order: { timestamp: 'ASC' },
    });

    return entries;
  }

  @Get('blackbox/flight/:flightId')
  async getFlightBlackbox(
    @Param('flightId') flightId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit = '1000',
  ) {
    const where: Record<string, unknown> = { flightId };

    if (from && to) {
      where.timestamp = Between(new Date(from), new Date(to));
    }

    const entries = await this.blackboxRepo.find({
      where,
      order: { timestamp: 'ASC' },
      take: parseInt(limit),
    });

    return entries;
  }

  // ============ Protocols ============

  @Get('protocols')
  async getProtocols(@Query('active') active?: string) {
    const where: Record<string, unknown> = {};
    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    return this.protocolRepo.find({
      where,
      order: { priority: 'ASC', emergencyType: 'ASC' },
    });
  }

  @Get('protocols/:id')
  async getProtocol(@Param('id') id: string) {
    return this.protocolRepo.findOne({ where: { id } });
  }

  @Put('protocols/:id')
  async updateProtocol(
    @Param('id') id: string,
    @Body() body: Partial<EmergencyProtocol>,
  ) {
    const protocol = await this.protocolRepo.findOne({ where: { id } });
    if (!protocol) {
      throw new Error('Protocol not found');
    }

    // Prevent modifying system defaults core fields
    if (protocol.isSystemDefault) {
      delete body.emergencyType;
      delete body.responseAction;
    }

    Object.assign(protocol, body);
    const saved = await this.protocolRepo.save(protocol);

    // Reload protocols in services
    await this.decisionEngine.reloadProtocols();
    await this.detectionService.reloadProtocols();

    return saved;
  }

  @Post('protocols')
  async createProtocol(@Body() body: Partial<EmergencyProtocol>) {
    const protocol = this.protocolRepo.create({
      ...body,
      isSystemDefault: false,
    });

    const saved = await this.protocolRepo.save(protocol);
    await this.decisionEngine.reloadProtocols();
    await this.detectionService.reloadProtocols();

    return saved;
  }

  // ============ Configuration ============

  @Get('config')
  async getConfig() {
    const mode = this.decisionEngine.getMode();
    const configs = await this.configRepo.find();

    return {
      mode,
      configs: configs.reduce((acc, c) => {
        acc[c.key] = c.value;
        return acc;
      }, {} as Record<string, unknown>),
    };
  }

  @Put('config/mode')
  async setMode(@Body() body: { mode: OperationMode }) {
    await this.decisionEngine.setMode(body.mode);
    return { mode: body.mode };
  }

  @Put('config/:key')
  async setConfig(
    @Param('key') key: string,
    @Body() body: { value: unknown; description?: string },
  ) {
    const existing = await this.configRepo.findOne({ where: { key } });
    if (existing) {
      existing.value = body.value;
      if (body.description) {
        existing.description = body.description;
      }
      return this.configRepo.save(existing);
    }

    const config = this.configRepo.create({
      key,
      value: body.value,
      description: body.description,
    });
    return this.configRepo.save(config);
  }

  // ============ Statistics ============

  @Get('stats')
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dateFilter = from && to
      ? { detectedAt: Between(new Date(from), new Date(to)) }
      : {};

    // Count by status
    const statusCounts = await this.incidentRepo
      .createQueryBuilder('incident')
      .select('incident.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(dateFilter)
      .groupBy('incident.status')
      .getRawMany();

    // Count by type
    const typeCounts = await this.incidentRepo
      .createQueryBuilder('incident')
      .select('incident.emergencyType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where(dateFilter)
      .groupBy('incident.emergencyType')
      .getRawMany();

    // Count by severity
    const severityCounts = await this.incidentRepo
      .createQueryBuilder('incident')
      .select('incident.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where(dateFilter)
      .groupBy('incident.severity')
      .getRawMany();

    // Count by drone
    const droneCounts = await this.incidentRepo
      .createQueryBuilder('incident')
      .select('incident.droneId', 'droneId')
      .addSelect('COUNT(*)', 'count')
      .where(dateFilter)
      .groupBy('incident.droneId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Average response time (SQLite compatible)
    const avgResponseTime = await this.incidentRepo
      .createQueryBuilder('incident')
      .select('AVG((julianday(incident.action_started_at) - julianday(incident.detected_at)) * 86400)', 'avgSeconds')
      .where({ ...dateFilter, actionStartedAt: Not(IsNull()) })
      .getRawOne();

    // Resolution success rate
    const resolutionStats = await this.incidentRepo
      .createQueryBuilder('incident')
      .select('incident.actionSuccess', 'success')
      .addSelect('COUNT(*)', 'count')
      .where({ ...dateFilter, status: 'resolved' })
      .groupBy('incident.actionSuccess')
      .getRawMany();

    return {
      byStatus: statusCounts,
      byType: typeCounts,
      bySeverity: severityCounts,
      byDrone: droneCounts,
      avgResponseTimeSeconds: avgResponseTime?.avgSeconds || 0,
      resolutionStats,
    };
  }

  @Get('stats/trends')
  async getTrends(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('interval') interval: 'day' | 'week' | 'month' = 'day',
  ) {
    // SQLite date formatting
    const dateFormat = interval === 'day' ? '%Y-%m-%d' : interval === 'week' ? '%Y-%W' : '%Y-%m';

    const trends = await this.incidentRepo
      .createQueryBuilder('incident')
      .select(`strftime('${dateFormat}', incident.detected_at)`, 'period')
      .addSelect('COUNT(*)', 'total')
      .addSelect("SUM(CASE WHEN incident.severity = 'warning' THEN 1 ELSE 0 END)", 'warnings')
      .addSelect("SUM(CASE WHEN incident.severity = 'critical' THEN 1 ELSE 0 END)", 'critical')
      .addSelect("SUM(CASE WHEN incident.severity = 'emergency' THEN 1 ELSE 0 END)", 'emergencies')
      .where('incident.detected_at BETWEEN :from AND :to', { from, to })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    return trends;
  }
}
