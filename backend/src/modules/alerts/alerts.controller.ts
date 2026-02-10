import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AlertsService } from './alerts.service';
import { AlertSeverity } from './alert.entity';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async getAll(
    @Query('droneId') droneId?: string,
    @Query('flightId') flightId?: string,
    @Query('severity') severity?: AlertSeverity,
    @Query('acknowledged') acknowledged?: string,
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
  ) {
    return this.alertsService.getAll({
      droneId,
      flightId,
      severity,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('active')
  async getActive() {
    return this.alertsService.getActive();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.alertsService.getById(id);
  }

  @Post(':id/acknowledge')
  async acknowledge(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.alertsService.acknowledge(id, req.user.id);
  }

  @Post(':id/resolve')
  async resolve(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.alertsService.resolve(id, req.user.id);
  }
}
