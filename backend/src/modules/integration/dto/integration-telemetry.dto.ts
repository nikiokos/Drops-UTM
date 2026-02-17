import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class IntegrationTelemetryDto {
  @IsString()
  @IsNotEmpty()
  droneId: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(0)
  altitude: number;

  @IsNumber()
  @Min(0)
  @Max(360)
  heading: number;

  @IsNumber()
  @Min(0)
  speed: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  batteryLevel: number;

  @IsOptional()
  @IsNumber()
  batteryVoltage?: number;

  @IsOptional()
  @IsNumber()
  satellites?: number;

  @IsOptional()
  @IsNumber()
  signalStrength?: number;

  @IsOptional()
  @IsString()
  flightMode?: string;

  @IsOptional()
  @IsBoolean()
  armed?: boolean;

  @IsOptional()
  @IsObject()
  custom?: Record<string, unknown>;
}
