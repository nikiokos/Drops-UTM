import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotamService } from './notam.service';

@ApiTags('NOTAM')
@ApiBearerAuth()
@Controller('notam')
export class NotamController {
  constructor(private readonly notamService: NotamService) {}

  @Get()
  @ApiOperation({ summary: 'Active NOTAMs for Greek FIR / aerodromes (autorouter)' })
  @ApiQuery({
    name: 'icaos',
    required: false,
    description: 'Comma-separated ICAO FIR/aerodrome codes (default LGGG)',
  })
  async getNotams(@Query('icaos') icaos?: string) {
    const codes = icaos
      ? icaos
          .split(',')
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean)
      : [NotamService.GREEK_FIR];
    const notams = await this.notamService.getNotams(codes);
    return {
      count: notams.length,
      enabled: this.notamService.hasCredentials(),
      icaos: codes,
      updatedAt: new Date().toISOString(),
      source: 'autorouter.aero',
      notams,
    };
  }
}
