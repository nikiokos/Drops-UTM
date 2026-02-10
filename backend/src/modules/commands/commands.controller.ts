import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CommandsService, SendCommandDto } from './commands.service';

@Controller('drones/:droneId/commands')
@UseGuards(JwtAuthGuard)
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  @Post()
  async sendCommand(
    @Param('droneId') droneId: string,
    @Body() dto: SendCommandDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.commandsService.sendCommand(droneId, dto, req.user.id);
  }

  @Get()
  async getHistory(
    @Param('droneId') droneId: string,
    @Query('limit') limit?: string,
  ) {
    return this.commandsService.getHistory(droneId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get(':commandId')
  async getById(
    @Param('droneId') droneId: string,
    @Param('commandId') commandId: string,
  ) {
    return this.commandsService.getById(droneId, commandId);
  }

  @Post(':commandId/cancel')
  async cancelCommand(
    @Param('droneId') droneId: string,
    @Param('commandId') commandId: string,
  ) {
    return this.commandsService.cancelCommand(droneId, commandId);
  }
}
