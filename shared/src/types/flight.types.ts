import { GeoPoint } from './common.types';
import {
  FlightStatus,
  FlightType,
  OperationMode,
  AuthorizationStatus,
  RiskAssessment,
} from '../enums';

export interface Flight {
  id: string;
  flightNumber: string;
  droneId: string;
  pilotId?: string;
  departureHubId: string;
  arrivalHubId?: string;
  flightType: FlightType;
  operationMode: OperationMode;
  status: FlightStatus;
  plannedDeparture: Date;
  plannedArrival?: Date;
  actualDeparture?: Date;
  actualArrival?: Date;
  plannedRoute?: GeoPoint[];
  actualRoute?: GeoPoint[];
  maxAltitude?: number;
  minAltitude?: number;
  authorizationStatus?: AuthorizationStatus;
  authorizationNumber?: string;
  authorizedBy?: string;
  authorizedAt?: Date;
  missionType?: string;
  payloadWeight?: number;
  missionData?: Record<string, unknown>;
  riskAssessment?: RiskAssessment;
  emergencyContacts?: Record<string, string>[];
  emergencyProcedures?: Record<string, unknown>;
  notes?: string;
  weatherConditions?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFlightDto {
  droneId: string;
  pilotId?: string;
  departureHubId: string;
  arrivalHubId?: string;
  flightType: FlightType;
  operationMode: OperationMode;
  plannedDeparture: Date;
  plannedArrival?: Date;
  plannedRoute?: GeoPoint[];
  maxAltitude?: number;
  minAltitude?: number;
  missionType?: string;
  payloadWeight?: number;
  missionData?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateFlightDto extends Partial<CreateFlightDto> {
  status?: FlightStatus;
}

export interface FlightFilter {
  status?: FlightStatus[];
  droneId?: string;
  pilotId?: string;
  hubId?: string;
  flightType?: FlightType[];
  dateFrom?: Date;
  dateTo?: Date;
}
