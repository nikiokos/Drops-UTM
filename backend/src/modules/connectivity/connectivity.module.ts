import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceRegistration } from './entities/device-registration.entity';
import { DeviceCertificate } from './entities/device-certificate.entity';
import { DeviceRegistryService } from './services/device-registry.service';
import { CertificateService } from './services/certificate.service';
import { ProtocolGatewayService } from './services/protocol-gateway.service';
import { MessageNormalizerService } from './services/message-normalizer.service';
import { AdaptiveRateService } from './services/adaptive-rate.service';
import { CommandRouterService } from './services/command-router.service';
import { WebSocketAdapter } from './adapters/websocket.adapter';
import { ConnectivityController } from './connectivity.controller';
import { GatewayModule } from '../../gateways/gateway.module';
import { DronesModule } from '../drones/drones.module';
import { CommandsModule } from '../commands/commands.module';
import { Drone } from '../drones/drone.entity';
import { DroneCommand } from '../commands/command.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceRegistration,
      DeviceCertificate,
      Drone,
      DroneCommand,
    ]),
    forwardRef(() => GatewayModule),
    forwardRef(() => DronesModule),
    forwardRef(() => CommandsModule),
  ],
  providers: [
    DeviceRegistryService,
    CertificateService,
    ProtocolGatewayService,
    MessageNormalizerService,
    AdaptiveRateService,
    CommandRouterService,
    WebSocketAdapter,
  ],
  controllers: [ConnectivityController],
  exports: [
    DeviceRegistryService,
    CertificateService,
    ProtocolGatewayService,
    MessageNormalizerService,
    AdaptiveRateService,
    CommandRouterService,
    WebSocketAdapter,
  ],
})
export class ConnectivityModule {}
