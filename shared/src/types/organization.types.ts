import { OrganizationType, OrganizationStatus } from '../enums';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  registrationNumber?: string;
  contactInfo?: Record<string, string>;
  address?: Record<string, string>;
  authorizedAirspace?: Record<string, unknown>;
  certifications?: Record<string, unknown>;
  insuranceInfo?: Record<string, unknown>;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationDto {
  name: string;
  type: OrganizationType;
  registrationNumber?: string;
  contactInfo?: Record<string, string>;
  address?: Record<string, string>;
  certifications?: Record<string, unknown>;
  insuranceInfo?: Record<string, unknown>;
}

export interface UpdateOrganizationDto extends Partial<CreateOrganizationDto> {
  status?: OrganizationStatus;
}
