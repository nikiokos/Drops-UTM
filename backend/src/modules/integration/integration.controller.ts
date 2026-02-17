import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyService } from './services/api-key.service';
import { IntegrationService } from './services/integration.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { IntegrationTelemetryDto } from './dto/integration-telemetry.dto';
import { RegisterDroneDto } from './dto/register-drone.dto';

@ApiTags('Integration')
@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly integrationService: IntegrationService,
  ) {}

  // ── Admin endpoints (JWT auth + admin role) ────────────────────────

  @Post('keys')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new API key for manufacturer integration' })
  async createApiKey(@Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.createApiKey(dto);
  }

  @Get('keys')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all API keys' })
  async listApiKeys() {
    return this.apiKeyService.findAll();
  }

  @Post('keys/:id/revoke')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an API key' })
  async revokeApiKey(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.revokeKey(id);
  }

  // ── Integration endpoints (API key auth) ───────────────────────────

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('telemetry')
  @ApiOperation({ summary: 'Submit telemetry data via API key' })
  async submitTelemetry(
    @Body() dto: IntegrationTelemetryDto,
    @Req() req: any,
  ) {
    return this.integrationService.submitTelemetry(dto, req.apiKey);
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('register')
  @ApiOperation({ summary: 'Register a drone via API key' })
  async registerDrone(@Body() dto: RegisterDroneDto, @Req() req: any) {
    return this.integrationService.registerDrone(dto, req.apiKey);
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Get('status')
  @ApiOperation({ summary: 'Get manufacturer integration status' })
  async getStatus(@Req() req: any) {
    return this.integrationService.getStatus(req.apiKey);
  }
}
