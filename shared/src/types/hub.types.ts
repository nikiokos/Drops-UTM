import { GeoPoint, Capabilities } from './common.types';
import { HubStatus } from '../enums';

export interface Hub {
  id: string;
  code: string;
  name: string;
  location: GeoPoint;
  altitudeMsl: number;
  status: HubStatus;
  maxSimultaneousDrones: number;
  airspaceRadius: number;
  airspaceCeiling: number;
  airspaceFloor: number;
  timezone: string;
  capabilities: Capabilities;
  contactInfo: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface HubStatusInfo {
  hubId: string;
  activeFlights: number;
  capacity: number;
  utilization: number;
  scheduledFlights: number;
  weather: Record<string, unknown>;
  timestamp: Date;
}

export interface CreateHubDto {
  code: string;
  name: string;
  location: GeoPoint;
  altitudeMsl?: number;
  maxSimultaneousDrones?: number;
  airspaceRadius: number;
  airspaceCeiling: number;
  airspaceFloor: number;
  timezone: string;
  capabilities?: Capabilities;
  contactInfo?: Record<string, string>;
}

export interface UpdateHubDto extends Partial<CreateHubDto> {
  status?: HubStatus;
}
