import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConflictsService } from './conflicts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Conflicts')
@ApiBearerAuth()
@Controller('conflicts')
export class ConflictsController {
  constructor(private readonly conflictsService: ConflictsService) {}

  @Get()
  @ApiOperation({ summary: 'List all conflicts' })
  findAll() {
    return this.conflictsService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active conflicts' })
  findActive() {
    return this.conflictsService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conflict details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.conflictsService.findById(id);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve conflict' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { strategy: string; actions: Record<string, unknown> },
    @CurrentUser('id') userId: string,
  ) {
    return this.conflictsService.resolve(id, { ...body, resolvedBy: userId });
  }
}
