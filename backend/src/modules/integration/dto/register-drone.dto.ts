import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class RegisterDroneDto {
  @IsString()
  @IsNotEmpty()
  registrationNumber: string;

  @IsString()
  @IsNotEmpty()
  manufacturer: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsNumber()
  maxFlightTime?: number;

  @IsOptional()
  @IsNumber()
  maxRange?: number;

  @IsOptional()
  @IsNumber()
  maxAltitude?: number;

  @IsOptional()
  @IsNumber()
  maxSpeed?: number;
}
