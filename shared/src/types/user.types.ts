import { UserRole, UserStatus } from '../enums';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  organizationId?: string;
  pilotLicense?: string;
  licenseExpiry?: Date;
  certifications?: Record<string, unknown>;
  authorizedHubs?: string[];
  permissions?: Record<string, unknown>;
  status: UserStatus;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  organizationId?: string;
  pilotLicense?: string;
  licenseExpiry?: Date;
  certifications?: Record<string, unknown>;
  authorizedHubs?: string[];
}

export interface UpdateUserDto extends Partial<Omit<CreateUserDto, 'password'>> {
  status?: UserStatus;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}
