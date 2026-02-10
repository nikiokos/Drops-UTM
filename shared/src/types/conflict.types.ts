import { GeoPoint } from './common.types';
import { ConflictType, ConflictSeverity, ConflictStatus } from '../enums';

export interface Conflict {
  id: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  status: ConflictStatus;
  primaryFlightId?: string;
  secondaryFlightId?: string;
  hubId?: string;
  affectedZoneId?: string;
  detectedAt: Date;
  detectionMethod?: string;
  location?: GeoPoint;
  altitude?: number;
  description?: string;
  estimatedTimeToConflict?: string;
  separationDistance?: number;
  resolutionStrategy?: string;
  resolutionActions?: Record<string, unknown>;
  resolvedAt?: Date;
  resolvedBy?: string;
  data?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConflictDto {
  conflictType: ConflictType;
  severity: ConflictSeverity;
  primaryFlightId?: string;
  secondaryFlightId?: string;
  hubId?: string;
  affectedZoneId?: string;
  detectionMethod?: string;
  location?: GeoPoint;
  altitude?: number;
  description?: string;
  estimatedTimeToConflict?: string;
  separationDistance?: number;
}
