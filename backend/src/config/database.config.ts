import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'better-sqlite3',
  database: configService.get('database.path'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: true,
  logging: configService.get('nodeEnv') === 'development',
});

export const dataSourceOptions: DataSourceOptions = {
  type: 'better-sqlite3',
  database: process.env.DATABASE_PATH || './data/drops_utm.sqlite',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
};

export default new DataSource(dataSourceOptions);
