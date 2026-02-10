import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { DeviceRegistryService, RegisterDeviceDto } from './services/device-registry.service';
import { CertificateService, CertificateBundle } from './services/certificate.service';
import { ProtocolGatewayService } from './services/protocol-gateway.service';
import { AdaptiveRateService } from './services/adaptive-rate.service';
import { CommandRouterService } from './services/command-router.service';

@ApiTags('Connectivity')
@ApiBearerAuth()
@Controller('connectivity')
export class ConnectivityController {
  constructor(
    private readonly deviceRegistry: DeviceRegistryService,
    private readonly certificateService: CertificateService,
    private readonly protocolGateway: ProtocolGatewayService,
    private readonly adaptiveRateService: AdaptiveRateService,
    private readonly commandRouterService: CommandRouterService,
  ) {}

  @Post('devices/register')
  @Roles('admin', 'hub_operator')
  @ApiOperation({ summary: 'Register new device' })
  async registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.deviceRegistry.registerDevice(dto);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List all registered devices' })
  async listDevices(@Query('hubId') hubId?: string) {
    if (hubId) {
      return this.deviceRegistry.listActiveDevices(hubId);
    }
    return this.deviceRegistry.listAll();
  }

  @Get('devices/online')
  @ApiOperation({ summary: 'List online devices' })
  async listOnlineDevices() {
    return this.deviceRegistry.listOnlineDevices();
  }

  @Get('devices/:id')
  @ApiOperation({ summary: 'Get device details' })
  async getDevice(@Param('id', ParseUUIDPipe) id: string) {
    const device = await this.deviceRegistry.findById(id);
    const telemetryState = this.adaptiveRateService.getDeviceState(id);

    return {
      ...device,
      telemetryMode: telemetryState?.currentMode || 'idle',
      telemetryModeReason: telemetryState?.modeReason,
    };
  }

  @Post('devices/:id/certificate')
  @Roles('admin', 'hub_operator')
  @ApiOperation({ summary: 'Generate certificate for device' })
  async generateCertificate(@Param('id', ParseUUIDPipe) id: string): Promise<CertificateBundle> {
    return this.certificateService.generateDeviceCertificate(id);
  }

  @Get('devices/:id/certificate')
  @ApiOperation({ summary: 'Download device certificate bundle' })
  async downloadCertificate(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const device = await this.deviceRegistry.findById(id);
    const certificate = await this.certificateService.getCertificateByRegistration(id);

    if (!certificate) {
      res.status(404).json({ message: 'No certificate found for this device' });
      return;
    }

    const bundle = {
      deviceIdentifier: device.deviceIdentifier,
      certificate: certificate.certificatePem,
      fingerprint: certificate.fingerprint,
      commonName: certificate.commonName,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
      caCertificate: this.certificateService.getCACertificate(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${device.deviceIdentifier}-cert.json"`,
    );

    return bundle;
  }

  @Delete('devices/:id/certificate')
  @Roles('admin')
  @ApiOperation({ summary: 'Revoke device certificate' })
  async revokeCertificate(@Param('id', ParseUUIDPipe) id: string) {
    await this.certificateService.revokeCertificatesByRegistration(id);
    await this.deviceRegistry.updateRegistrationStatus(id, 'pending');
    return { message: 'Certificate revoked successfully' };
  }

  @Delete('devices/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Revoke device registration' })
  async revokeDevice(@Param('id', ParseUUIDPipe) id: string) {
    await this.deviceRegistry.revokeRegistration(id);
    return { message: 'Device registration revoked' };
  }

  @Public()
  @Get('ca-certificate')
  @ApiOperation({ summary: 'Download CA certificate (public)' })
  getCACertificate(@Res({ passthrough: true }) res: Response) {
    const caCert = this.certificateService.getCACertificate();

    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', 'attachment; filename="drops-utm-ca.pem"');

    return new StreamableFile(Buffer.from(caCert));
  }

  @Get('protocols/stats')
  @ApiOperation({ summary: 'Get protocol adapter statistics' })
  async getProtocolStats() {
    return {
      adapters: this.protocolGateway.getAdapterStats(),
      connectedDevices: this.protocolGateway.getAllConnectedDevices(),
    };
  }

  @Get('telemetry/modes')
  @ApiOperation({ summary: 'Get telemetry mode configurations' })
  getTelemetryModes() {
    return this.adaptiveRateService.getAllModeConfigs();
  }

  @Get('telemetry/stats')
  @ApiOperation({ summary: 'Get telemetry rate statistics' })
  getTelemetryStats() {
    return this.adaptiveRateService.getStats();
  }

  @Get('commands/stats')
  @ApiOperation({ summary: 'Get command routing statistics' })
  getCommandStats() {
    return this.commandRouterService.getStats();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get connectivity module status' })
  async getStatus() {
    const onlineDevices = await this.deviceRegistry.listOnlineDevices();
    const protocolStats = this.protocolGateway.getAdapterStats();
    const telemetryStats = this.adaptiveRateService.getStats();
    const commandStats = this.commandRouterService.getStats();

    return {
      status: 'operational',
      onlineDevices: onlineDevices.length,
      protocols: protocolStats,
      telemetry: telemetryStats,
      commands: commandStats,
    };
  }
}
