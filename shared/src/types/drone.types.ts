import { Capabilities } from './common.types';
import { DroneStatus, CommunicationProtocol } from '../enums';

export interface Drone {
  id: string;
  registrationNumber: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  ownerId?: string;
  homeHubId?: string;
  currentHubId?: string;
  status: DroneStatus;
  maxFlightTime?: number;
  maxRange?: number;
  maxAltitude?: number;
  maxSpeed?: number;
  maxPayload?: number;
  communicationProtocol: CommunicationProtocol;
  remoteId?: string;
  capabilities: Capabilities;
  specifications: Record<string, unknown>;
  telemetryConfig: Record<string, unknown>;
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  totalFlightHours: number;
  totalFlights: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDroneDto {
  registrationNumber: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  ownerId?: string;
  homeHubId?: string;
  communicationProtocol: CommunicationProtocol;
  maxFlightTime?: number;
  maxRange?: number;
  maxAltitude?: number;
  maxSpeed?: number;
  maxPayload?: number;
  remoteId?: string;
  capabilities?: Capabilities;
  specifications?: Record<string, unknown>;
  telemetryConfig?: Record<string, unknown>;
}

export interface UpdateDroneDto extends Partial<CreateDroneDto> {
  status?: DroneStatus;
  currentHubId?: string;
}

export interface DroneCommand {
  type: 'takeoff' | 'land' | 'goto' | 'rtl' | 'pause' | 'resume' | 'hold_position';
  latitude?: number;
  longitude?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface CommandResult {
  success: boolean;
  command: string;
  message?: string;
  timestamp: Date;
}
