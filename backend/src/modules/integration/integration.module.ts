import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { Drone } from '../drones/drone.entity';
import { ApiKeyService } from './services/api-key.service';
import { IntegrationService } from './services/integration.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IntegrationController } from './integration.controller';
import { ConnectivityModule } from '../connectivity/connectivity.module';
import { DronesModule } from '../drones/drones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, Drone]),
    forwardRef(() => ConnectivityModule),
    forwardRef(() => DronesModule),
  ],
  providers: [ApiKeyService, IntegrationService, ApiKeyGuard],
  controllers: [IntegrationController],
  exports: [ApiKeyService],
})
export class IntegrationModule {}
