import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BriefingService } from './briefing.service';

@ApiTags('Briefing')
@ApiBearerAuth()
@Controller('briefing')
export class BriefingController {
  constructor(private readonly briefingService: BriefingService) {}

  @Get('flight/:id')
  @ApiOperation({ summary: 'Consolidated pre-flight briefing (weather + airspace + traffic + NOTAM)' })
  getFlightBriefing(@Param('id', ParseUUIDPipe) id: string) {
    return this.briefingService.getFlightBriefing(id);
  }

  @Get('flight/:id/assess')
  @ApiOperation({ summary: 'AI authorization assessment (Claude reasons over the briefing)' })
  assessFlight(@Param('id', ParseUUIDPipe) id: string) {
    return this.briefingService.assessFlight(id);
  }
}
