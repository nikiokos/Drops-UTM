export type ProtocolType = 'websocket' | 'mqtt' | 'mavlink' | 'rest';
export type MessageSource = 'direct' | 'gateway' | 'gcs';
export type MessageType = 'telemetry' | 'status' | 'event' | 'command_ack';

export interface TelemetryPayload {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  speed: number;
  batteryLevel: number;
  batteryVoltage?: number;
  satellites?: number;
  signalStrength?: number;
  flightMode?: string;
  armed?: boolean;
  custom?: Record<string, unknown>;
}

export interface StatusPayload {
  status: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface EventPayload {
  eventType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  data?: Record<string, unknown>;
}

export interface CommandAckPayload {
  commandId: string;
  status: 'received' | 'executing' | 'completed' | 'failed';
  message?: string;
  result?: Record<string, unknown>;
}

export interface DroneMessage {
  droneId: string;
  deviceIdentifier: string;
  timestamp: Date;
  source: MessageSource;
  protocol: ProtocolType;
  type: MessageType;
  payload: TelemetryPayload | StatusPayload | EventPayload | CommandAckPayload;
}

export interface OutboundCommand {
  commandId: string;
  commandType: string;
  parameters?: Record<string, unknown>;
  priority: number;
  timeout: number;
}

export interface IProtocolAdapter {
  readonly protocolName: ProtocolType;

  initialize(): Promise<void>;

  shutdown(): Promise<void>;

  onMessage(callback: (msg: DroneMessage) => void): void;

  sendCommand(deviceId: string, cmd: OutboundCommand): Promise<boolean>;

  isDeviceConnected(deviceId: string): boolean;

  getConnectedDevices(): string[];
}
