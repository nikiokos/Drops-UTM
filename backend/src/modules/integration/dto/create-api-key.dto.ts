import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  manufacturerName: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsArray()
  permissions?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  rateLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  expiresInDays?: number;
}
