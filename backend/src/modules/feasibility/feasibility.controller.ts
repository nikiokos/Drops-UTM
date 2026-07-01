import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeasibilityService } from './feasibility.service';

@ApiTags('Feasibility')
@ApiBearerAuth()
@Controller('feasibility')
export class FeasibilityController {
  constructor(private readonly feasibility: FeasibilityService) {}

  @Post('check')
  @ApiOperation({ summary: 'Predict whether a drone can complete a mission on one charge' })
  async check(
    @Body()
    body: {
      droneId: string;
      missionId?: string;
      distanceM?: number;
      hoverTimeS?: number;
      departureHubId?: string;
      payloadKg?: number;
    },
  ) {
    return this.feasibility.check(body);
  }
}
