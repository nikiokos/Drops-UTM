import { GeoPolygon } from './common.types';
import { ZoneType, ZoneStatus } from '../enums';

export interface AirspaceZone {
  id: string;
  hubId?: string;
  name: string;
  zoneType: ZoneType;
  geometry: GeoPolygon;
  altitudeFloor?: number;
  altitudeCeiling?: number;
  status: ZoneStatus;
  priority: number;
  effectiveStart?: Date;
  effectiveEnd?: Date;
  timeRestrictions?: Record<string, unknown>;
  restrictions?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAirspaceZoneDto {
  hubId?: string;
  name: string;
  zoneType: ZoneType;
  geometry: GeoPolygon;
  altitudeFloor?: number;
  altitudeCeiling?: number;
  priority?: number;
  effectiveStart?: Date;
  effectiveEnd?: Date;
  timeRestrictions?: Record<string, unknown>;
  restrictions?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
}

export interface UpdateAirspaceZoneDto extends Partial<CreateAirspaceZoneDto> {
  status?: ZoneStatus;
}

export interface RouteCheckResult {
  clear: boolean;
  violations: {
    zoneId: string;
    zoneName: string;
    zoneType: ZoneType;
    description: string;
  }[];
}
