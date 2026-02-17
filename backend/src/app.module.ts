import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from './config/configuration';
import { getDatabaseConfig } from './config/database.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { HubsModule } from './modules/hubs/hubs.module';
import { DronesModule } from './modules/drones/drones.module';
import { FlightsModule } from './modules/flights/flights.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { ConflictsModule } from './modules/conflicts/conflicts.module';
import { AirspaceModule } from './modules/airspace/airspace.module';
import { WeatherModule } from './modules/weather/weather.module';
import { GatewayModule } from './gateways/gateway.module';
import { HealthModule } from './modules/health/health.module';
import { CommandsModule } from './modules/commands/commands.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { MissionsModule } from './modules/missions/missions.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ConnectivityModule } from './modules/connectivity/connectivity.module';
import { SimulationModule } from './modules/simulation/simulation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    HubsModule,
    DronesModule,
    FlightsModule,
    TelemetryModule,
    ConflictsModule,
    AirspaceModule,
    WeatherModule,
    GatewayModule,
    HealthModule,
    CommandsModule,
    AlertsModule,
    MissionsModule,
    TemplatesModule,
    FleetModule,
    EmergencyModule,
    NotificationsModule,
    ConnectivityModule,
    SimulationModule,
  ],
  providers: [
    // Global JWT authentication guard - requires auth for all routes except @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global roles guard - enforces @Roles() decorators
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
