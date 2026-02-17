import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', data),
};

export const hubsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/hubs', { params }),
  getById: (id: string) => api.get(`/hubs/${id}`),
  create: (data: Record<string, unknown>) => api.post('/hubs', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/hubs/${id}`, data),
  delete: (id: string) => api.delete(`/hubs/${id}`),
};

export const dronesApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/drones', { params }),
  getById: (id: string) => api.get(`/drones/${id}`),
  create: (data: Record<string, unknown>) => api.post('/drones', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/drones/${id}`, data),
  delete: (id: string) => api.delete(`/drones/${id}`),
};

export const flightsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/flights', { params }),
  getById: (id: string) => api.get(`/flights/${id}`),
  create: (data: Record<string, unknown>) => api.post('/flights', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/flights/${id}`, data),
  authorize: (id: string) => api.post(`/flights/${id}/authorize`),
  start: (id: string) => api.post(`/flights/${id}/start`),
  complete: (id: string) => api.post(`/flights/${id}/complete`),
  abort: (id: string) => api.post(`/flights/${id}/abort`),
};

export const telemetryApi = {
  getByFlight: (flightId: string, params?: Record<string, unknown>) =>
    api.get(`/telemetry/flight/${flightId}`, { params }),
  getLatest: (flightId: string) => api.get(`/telemetry/flight/${flightId}/latest`),
};

export const conflictsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/conflicts', { params }),
  getById: (id: string) => api.get(`/conflicts/${id}`),
  getActive: () => api.get('/conflicts/active'),
  resolve: (id: string, data: Record<string, unknown>) =>
    api.post(`/conflicts/${id}/resolve`, data),
};

export const airspaceApi = {
  getZones: (params?: Record<string, unknown>) => api.get('/airspace/zones', { params }),
  getZoneById: (id: string) => api.get(`/airspace/zones/${id}`),
  createZone: (data: Record<string, unknown>) => api.post('/airspace/zones', data),
  updateZone: (id: string, data: Record<string, unknown>) =>
    api.put(`/airspace/zones/${id}`, data),
  deleteZone: (id: string) => api.delete(`/airspace/zones/${id}`),
};

export const weatherApi = {
  getCurrent: (hubId: string) => api.get(`/weather/current/${hubId}`),
  getForecast: (hubId: string) => api.get(`/weather/forecast/${hubId}`),
  getAlerts: (hubId: string) => api.get(`/weather/alerts/${hubId}`),
};

export const commandsApi = {
  send: (droneId: string, data: { commandType: string; flightId?: string; parameters?: Record<string, unknown> }) =>
    api.post(`/drones/${droneId}/commands`, data),
  getHistory: (droneId: string, limit?: number) =>
    api.get(`/drones/${droneId}/commands`, { params: { limit } }),
  getById: (droneId: string, commandId: string) =>
    api.get(`/drones/${droneId}/commands/${commandId}`),
  cancel: (droneId: string, commandId: string) =>
    api.post(`/drones/${droneId}/commands/${commandId}/cancel`),
};

export const alertsApi = {
  getAll: (params?: {
    droneId?: string;
    flightId?: string;
    severity?: string;
    acknowledged?: boolean;
    resolved?: boolean;
    limit?: number;
  }) => api.get('/alerts', { params }),
  getActive: () => api.get('/alerts/active'),
  getById: (id: string) => api.get(`/alerts/${id}`),
  acknowledge: (id: string) => api.post(`/alerts/${id}/acknowledge`),
  resolve: (id: string) => api.post(`/alerts/${id}/resolve`),
};

// Mission types
export interface WaypointAction {
  type: string;
  parameters?: Record<string, unknown>;
}

export interface WaypointCondition {
  type: string;
  value?: unknown;
  action: string;
}

export interface CreateWaypointDto {
  sequence: number;
  name?: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speedToWaypoint?: number;
  headingAtWaypoint?: number;
  turnRadius?: number;
  actions?: WaypointAction[];
  conditions?: WaypointCondition[];
  hoverDuration?: number;
  waitForConfirmation?: boolean;
}

export interface CreateMissionDto {
  name: string;
  description?: string;
  droneId?: string;
  departureHubId: string;
  arrivalHubId?: string;
  scheduleType?: 'manual' | 'scheduled' | 'event_triggered';
  scheduledAt?: string;
  triggerConditions?: Record<string, unknown>;
  waypoints?: CreateWaypointDto[];
}

export interface UpdateMissionDto extends Partial<CreateMissionDto> {
  status?: string;
}

export const missionsApi = {
  getAll: (params?: {
    status?: string;
    droneId?: string;
    hubId?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/missions', { params }),
  getById: (id: string) => api.get(`/missions/${id}`),
  create: (data: CreateMissionDto) => api.post('/missions', data),
  update: (id: string, data: UpdateMissionDto) => api.put(`/missions/${id}`, data),
  delete: (id: string) => api.delete(`/missions/${id}`),

  // Waypoint management
  addWaypoint: (missionId: string, data: CreateWaypointDto) =>
    api.post(`/missions/${missionId}/waypoints`, data),
  updateWaypoint: (missionId: string, waypointId: string, data: Partial<CreateWaypointDto>) =>
    api.put(`/missions/${missionId}/waypoints/${waypointId}`, data),
  deleteWaypoint: (missionId: string, waypointId: string) =>
    api.delete(`/missions/${missionId}/waypoints/${waypointId}`),
  reorderWaypoints: (missionId: string, waypointIds: string[]) =>
    api.put(`/missions/${missionId}/waypoints/reorder`, { waypointIds }),

  // Lifecycle
  schedule: (id: string, scheduledAt?: string) =>
    api.post(`/missions/${id}/schedule`, { scheduledAt }),
  start: (id: string) => api.post(`/missions/${id}/start`),
  pause: (id: string) => api.post(`/missions/${id}/pause`),
  resume: (id: string) => api.post(`/missions/${id}/resume`),
  abort: (id: string) => api.post(`/missions/${id}/abort`),

  // Execution
  getExecutions: (missionId: string) => api.get(`/missions/${missionId}/executions`),
  getExecution: (missionId: string, executionId: string) =>
    api.get(`/missions/${missionId}/executions/${executionId}`),
};

// Template types
export interface TemplateVariable {
  key: string;
  name: string;
  type: 'coordinate' | 'number' | 'string' | 'hub' | 'drone';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
}

export interface WaypointBlueprint {
  sequence: number;
  name?: string;
  latitude: number | string;
  longitude: number | string;
  altitude: number | string;
  speedToWaypoint?: number | string;
  headingAtWaypoint?: number;
  turnRadius?: number;
  actions?: WaypointAction[];
  conditions?: WaypointCondition[];
  hoverDuration?: number;
  waitForConfirmation?: boolean;
}

export interface MissionBlueprint {
  waypoints: WaypointBlueprint[];
  defaultScheduleType?: 'manual' | 'scheduled' | 'event_triggered';
  defaultTriggerConditions?: Record<string, unknown>;
  estimatedDuration?: number;
  estimatedDistance?: number;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  variables?: TemplateVariable[];
  blueprint: MissionBlueprint;
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {
  changelog?: string;
}

export interface InstantiateTemplateDto {
  variableValues: Record<string, unknown>;
  droneId?: string;
  scheduleType?: 'manual' | 'scheduled' | 'event_triggered';
  scheduledAt?: string;
}

// Fleet types
export interface DroneScore {
  proximity: number;
  battery: number;
  capability: number;
  utilization: number;
  maintenance: number;
}

export interface ScoringWeights {
  proximity: number;
  battery: number;
  capability: number;
  utilization: number;
  maintenance: number;
}

export interface FleetThresholds {
  minDronesPerHub: number;
  maxIdleTimeMinutes: number;
  rebalanceCooldownMinutes: number;
  minDonorReserve: number;
  maxConcurrentRepositions: number;
  minBatteryForReposition: number;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  quietHoursOnly: boolean;
}

export interface FleetConfiguration {
  id: string;
  name: string;
  description?: string;
  weights: ScoringWeights;
  thresholds: FleetThresholds;
  isPreset: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HubFleetStatus {
  hubId: string;
  hubName: string;
  totalDrones: number;
  availableDrones: number;
  busyDrones: number;
  chargingDrones: number;
  maintenanceDrones: number;
  droneIds: string[];
  capacityUtilization: number;
  lastUpdated: string;
}

export interface FleetOverview {
  totalDrones: number;
  availableDrones: number;
  busyDrones: number;
  chargingDrones: number;
  maintenanceDrones: number;
  offlineDrones: number;
  activeMissions: number;
  pendingMissions: number;
  hubStatuses: HubFleetStatus[];
  fleetHealth: number;
  averageFlightHours: number;
}

export interface FleetAssignment {
  id: string;
  missionId: string;
  droneId: string;
  scores: DroneScore;
  weights: ScoringWeights;
  finalScore: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  assignedBy: 'system' | 'operator';
  alternativeDrones?: Array<{
    droneId: string;
    score: number;
    scores: DroneScore;
    reason?: string;
  }>;
  rejectionReason?: string;
  createdAt: string;
}

export interface RebalancingTask {
  id: string;
  sourceHubId: string;
  sourceHub?: { id: string; name: string };
  targetHubId: string;
  targetHub?: { id: string; name: string };
  droneId: string;
  drone?: { id: string; registrationNumber: string };
  repositioningMissionId?: string;
  trigger: 'threshold_breach' | 'scheduled' | 'manual' | 'predictive';
  rule: {
    type: string;
    condition: string;
    threshold?: number;
    actualValue?: number;
  };
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  priority: number;
  approvedBy?: string;
  approvedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledReason?: string;
  failureReason?: string;
  createdAt: string;
}

export interface RebalancingRecommendation {
  sourceHub: HubFleetStatus;
  targetHub: HubFleetStatus;
  recommendedDrone: { id: string; registrationNumber: string };
  trigger: string;
  priority: number;
  reason: string;
}

export const fleetApi = {
  // Fleet state
  getOverview: () => api.get<FleetOverview>('/fleet/overview'),
  getHubStatus: (hubId: string) => api.get<HubFleetStatus>(`/fleet/hubs/${hubId}/status`),
  getDronesAtHub: (hubId: string) => api.get(`/fleet/hubs/${hubId}/drones`),
  getAvailable: (hubId?: string) => api.get('/fleet/available', { params: { hubId } }),

  // Assignments
  assignDrone: (missionId: string, operatorOverride?: string) =>
    api.post('/fleet/assign', { missionId, operatorOverride }),
  acceptAssignment: (id: string) => api.post(`/fleet/assignments/${id}/accept`),
  rejectAssignment: (id: string, reason: string, alternativeDroneId?: string) =>
    api.post(`/fleet/assignments/${id}/reject`, { reason, alternativeDroneId }),
  getAssignmentHistory: (missionId: string) =>
    api.get<FleetAssignment[]>(`/fleet/assignments/mission/${missionId}`),

  // Rebalancing
  analyzeRebalancing: () => api.get<RebalancingRecommendation[]>('/fleet/rebalancing/analyze'),
  getPendingRebalancing: () => api.get<RebalancingTask[]>('/fleet/rebalancing/pending'),
  getActiveRebalancing: () => api.get<RebalancingTask[]>('/fleet/rebalancing/active'),
  getRebalancingHistory: (limit?: number, offset?: number) =>
    api.get<RebalancingTask[]>('/fleet/rebalancing/history', { params: { limit, offset } }),
  createRebalancing: (sourceHubId: string, targetHubId: string, droneId: string, autoApprove?: boolean) =>
    api.post<RebalancingTask>('/fleet/rebalancing', { sourceHubId, targetHubId, droneId, autoApprove }),
  approveRebalancing: (id: string, operatorId: string) =>
    api.post<RebalancingTask>(`/fleet/rebalancing/${id}/approve`, { operatorId }),
  executeRebalancing: (id: string) => api.post<RebalancingTask>(`/fleet/rebalancing/${id}/execute`),
  cancelRebalancing: (id: string, reason: string) =>
    api.post<RebalancingTask>(`/fleet/rebalancing/${id}/cancel`, { reason }),
  completeRebalancing: (id: string) => api.post<RebalancingTask>(`/fleet/rebalancing/${id}/complete`),

  // Configuration
  getActiveConfig: () => api.get<FleetConfiguration>('/fleet/config'),
  getAllConfigs: () => api.get<FleetConfiguration[]>('/fleet/config/all'),
  getConfig: (id: string) => api.get<FleetConfiguration>(`/fleet/config/${id}`),
  createConfig: (data: Omit<FleetConfiguration, 'id' | 'isPreset' | 'isActive' | 'createdAt' | 'updatedAt'>) =>
    api.post<FleetConfiguration>('/fleet/config', data),
  updateConfig: (id: string, data: Partial<FleetConfiguration>) =>
    api.put<FleetConfiguration>(`/fleet/config/${id}`, data),
  activateConfig: (id: string) => api.post<FleetConfiguration>(`/fleet/config/${id}/activate`),
};

export const templatesApi = {
  getAll: (params?: {
    category?: string;
    published?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/templates', { params }),
  getById: (id: string) => api.get(`/templates/${id}`),
  create: (data: CreateTemplateDto) => api.post('/templates', data),
  update: (id: string, data: UpdateTemplateDto) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),

  // Versioning
  getVersions: (id: string) => api.get(`/templates/${id}/versions`),
  getVersion: (id: string, version: number) => api.get(`/templates/${id}/versions/${version}`),

  // Publishing
  publish: (id: string) => api.post(`/templates/${id}/publish`),
  unpublish: (id: string) => api.post(`/templates/${id}/unpublish`),

  // Instantiation
  instantiate: (id: string, data: InstantiateTemplateDto) =>
    api.post(`/templates/${id}/instantiate`, data),
};

// Emergency Response types
export type EmergencyType =
  | 'battery_low'
  | 'battery_critical'
  | 'battery_rapid_discharge'
  | 'signal_weak'
  | 'signal_lost'
  | 'geofence_warning'
  | 'geofence_breach'
  | 'collision_aircraft'
  | 'collision_obstacle'
  | 'weather_wind'
  | 'weather_visibility'
  | 'motor_anomaly'
  | 'motor_failure'
  | 'gps_degraded'
  | 'gps_lost';

export type EmergencySeverity = 'warning' | 'critical' | 'emergency';

export type IncidentStatus = 'active' | 'pending_confirmation' | 'executing' | 'resolved' | 'escalated';

export type ResponseAction = 'RTH' | 'LAND' | 'HOVER' | 'DIVERT' | 'DESCEND' | 'CLIMB' | 'ESTOP' | 'NONE';

export type RootCause = 'equipment' | 'weather' | 'pilot_error' | 'software' | 'external' | 'unknown';

export type OperationMode = 'auto' | 'supervised';

export interface EmergencyIncident {
  id: string;
  droneId: string;
  drone?: { id: string; registrationNumber: string };
  flightId?: string;
  flight?: { id: string; flightNumber: string };
  emergencyType: EmergencyType;
  severity: EmergencySeverity;
  status: IncidentStatus;
  message: string;
  detectionData?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  responseAction?: ResponseAction;
  wasAutoExecuted: boolean;
  confirmationRequired: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  confirmationTimeoutAt?: string;
  actionStartedAt?: string;
  actionCompletedAt?: string;
  actionSuccess?: boolean;
  actionError?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  rootCause?: RootCause;
  rootCauseNotes?: string;
  lessonsLearned?: string;
  timeline?: Array<{ timestamp: string; event: string; data?: Record<string, unknown> }>;
  detectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyProtocol {
  id: string;
  name: string;
  description?: string;
  emergencyType: EmergencyType;
  severity: EmergencySeverity;
  responseAction: ResponseAction;
  fallbackAction?: ResponseAction;
  requiresConfirmation: boolean;
  confirmationTimeoutSeconds: number;
  autoExecuteOnTimeout: boolean;
  priority: number;
  thresholds?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  notifyPilot: boolean;
  notifySupervisor: boolean;
  notifyOpsCenter: boolean;
  sendSms: boolean;
  sendEmail: boolean;
  playAudioAlarm: boolean;
  isActive: boolean;
  isSystemDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlackboxEntry {
  id: string;
  flightId: string;
  droneId: string;
  incidentId?: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitudeMsl: number;
  altitudeAgl?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  groundSpeed: number;
  verticalSpeed?: number;
  heading: number;
  batteryLevel: number;
  batteryVoltage?: number;
  signalStrength: number;
  gpsSatellites?: number;
  gpsHdop?: number;
  motorRpm?: number[];
  commandReceived?: string;
  commandExecuted?: string;
  emergencyActive: boolean;
  emergencyType?: string;
  emergencySeverity?: string;
  flightMode?: string;
  windSpeed?: number;
  isEmergencyRecording: boolean;
}

export interface EmergencyStats {
  byStatus: Array<{ status: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  byDrone: Array<{ droneId: string; count: number }>;
  avgResponseTimeSeconds: number;
  resolutionStats: Array<{ success: boolean; count: number }>;
}

export interface EmergencyTrend {
  period: string;
  total: number;
  warnings: number;
  critical: number;
  emergencies: number;
}

export interface PendingConfirmation {
  incidentId: string;
  incident: EmergencyIncident;
  protocol: EmergencyProtocol;
  timeoutAt: string;
}

export const emergencyApi = {
  // Incidents
  getIncidents: (params?: {
    status?: string;
    severity?: EmergencySeverity;
    type?: EmergencyType;
    droneId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => api.get<{ data: EmergencyIncident[]; total: number }>('/emergency/incidents', { params }),
  getActiveIncidents: () => api.get<EmergencyIncident[]>('/emergency/incidents/active'),
  getPendingConfirmations: () => api.get<PendingConfirmation[]>('/emergency/incidents/pending'),
  getIncident: (id: string) => api.get<EmergencyIncident>(`/emergency/incidents/${id}`),
  confirmIncident: (id: string, approved: boolean) =>
    api.post<EmergencyIncident>(`/emergency/incidents/${id}/confirm`, { approved }),
  updateRootCause: (id: string, data: { rootCause: RootCause; notes?: string; lessonsLearned?: string }) =>
    api.put<EmergencyIncident>(`/emergency/incidents/${id}/root-cause`, data),

  // Blackbox
  getBlackbox: (incidentId: string, params?: { from?: string; to?: string }) =>
    api.get<BlackboxEntry[]>(`/emergency/incidents/${incidentId}/blackbox`, { params }),
  getFlightBlackbox: (flightId: string, params?: { from?: string; to?: string; limit?: number }) =>
    api.get<BlackboxEntry[]>(`/emergency/blackbox/flight/${flightId}`, { params }),

  // Protocols
  getProtocols: (active?: boolean) =>
    api.get<EmergencyProtocol[]>('/emergency/protocols', { params: { active } }),
  getProtocol: (id: string) => api.get<EmergencyProtocol>(`/emergency/protocols/${id}`),
  updateProtocol: (id: string, data: Partial<EmergencyProtocol>) =>
    api.put<EmergencyProtocol>(`/emergency/protocols/${id}`, data),
  createProtocol: (data: Partial<EmergencyProtocol>) =>
    api.post<EmergencyProtocol>('/emergency/protocols', data),

  // Configuration
  getConfig: () => api.get<{ mode: OperationMode; configs: Record<string, unknown> }>('/emergency/config'),
  setMode: (mode: OperationMode) => api.put<{ mode: OperationMode }>('/emergency/config/mode', { mode }),
  setConfig: (key: string, value: unknown, description?: string) =>
    api.put(`/emergency/config/${key}`, { value, description }),

  // Statistics
  getStats: (params?: { from?: string; to?: string }) =>
    api.get<EmergencyStats>('/emergency/stats', { params }),
  getTrends: (params: { from: string; to: string; interval?: 'day' | 'week' | 'month' }) =>
    api.get<EmergencyTrend[]>('/emergency/stats/trends', { params }),
};

// ============ Connectivity Types ============

export type DeviceType = 'drone' | 'gateway' | 'gcs';
export type RegistrationStatus = 'pending' | 'active' | 'revoked';
export type ConnectionStatus = 'offline' | 'online' | 'connecting';
export type TelemetryMode = 'idle' | 'normal' | 'enhanced' | 'emergency';

export interface DeviceRegistration {
  id: string;
  deviceType: DeviceType;
  droneId: string | null;
  hubId: string | null;
  deviceIdentifier: string;
  registrationStatus: RegistrationStatus;
  connectionStatus: ConnectionStatus;
  supportedProtocols: string[];
  certificateFingerprint: string | null;
  lastSeenAt: string | null;
  socketId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  drone?: {
    id: string;
    registrationNumber: string;
    manufacturer: string;
    model: string;
  };
  telemetryMode?: TelemetryMode;
  telemetryModeReason?: string;
}

export interface CertificateBundle {
  deviceCertificate: string;
  privateKey: string;
  caCertificate: string;
  fingerprint: string;
}

export interface ModeConfig {
  intervalMs: number;
  rateHz: number;
  description: string;
}

export interface ConnectivityStatus {
  status: string;
  onlineDevices: number;
  protocols: Record<string, { connected: number }>;
  telemetry: {
    totalDevices: number;
    byMode: Record<TelemetryMode, number>;
  };
  commands: {
    pendingCount: number;
    byPriority: Record<string, number>;
  };
}

export interface RegisterDeviceDto {
  deviceType: DeviceType;
  droneId?: string;
  hubId?: string;
  supportedProtocols: string[];
  metadata?: Record<string, unknown>;
}

// ============ Connectivity API ============

// ============ Integration / API Key Types ============

export interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  name: string;
  manufacturerName: string;
  contactEmail: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  totalRequests: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  manufacturerName: string;
  contactEmail: string;
  permissions?: string[];
  rateLimit?: number;
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  apiKey: string;
  keyInfo: ApiKeyInfo;
}

export const integrationApi = {
  // Admin key management (JWT auth)
  createKey: (data: CreateApiKeyRequest) =>
    api.post<CreateApiKeyResponse>('/integration/keys', data),
  listKeys: () => api.get<ApiKeyInfo[]>('/integration/keys'),
  revokeKey: (id: string) => api.post(`/integration/keys/${id}/revoke`),
};

export const connectivityApi = {
  // Status
  getStatus: () => api.get<ConnectivityStatus>('/connectivity/status'),

  // Devices
  getDevices: (params?: { hubId?: string }) =>
    api.get<DeviceRegistration[]>('/connectivity/devices', { params }),
  getOnlineDevices: () => api.get<DeviceRegistration[]>('/connectivity/devices/online'),
  getDevice: (id: string) => api.get<DeviceRegistration>(`/connectivity/devices/${id}`),
  registerDevice: (data: RegisterDeviceDto) =>
    api.post<DeviceRegistration>('/connectivity/devices/register', data),
  revokeDevice: (id: string) => api.delete(`/connectivity/devices/${id}`),

  // Certificates
  generateCertificate: (deviceId: string) =>
    api.post<CertificateBundle>(`/connectivity/devices/${deviceId}/certificate`),
  downloadCertificate: (deviceId: string) =>
    api.get(`/connectivity/devices/${deviceId}/certificate`),
  revokeCertificate: (deviceId: string) =>
    api.delete(`/connectivity/devices/${deviceId}/certificate`),
  getCACertificate: () => api.get<string>('/connectivity/ca-certificate'),

  // Protocol stats
  getProtocolStats: () =>
    api.get<{
      adapters: Record<string, { connected: number }>;
      connectedDevices: { deviceId: string; protocol: string }[];
    }>('/connectivity/protocols/stats'),

  // Telemetry modes
  getTelemetryModes: () => api.get<Record<TelemetryMode, ModeConfig>>('/connectivity/telemetry/modes'),
  getTelemetryStats: () =>
    api.get<{
      totalDevices: number;
      byMode: Record<TelemetryMode, number>;
    }>('/connectivity/telemetry/stats'),

  // Command stats
  getCommandStats: () =>
    api.get<{
      pendingCount: number;
      byPriority: Record<string, number>;
    }>('/connectivity/commands/stats'),
};
