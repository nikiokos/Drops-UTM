import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebSocketAdapter } from '../modules/connectivity/adapters/websocket.adapter';
import { TelemetryPayload, CommandAckPayload } from '../modules/connectivity/adapters/protocol-adapter.interface';

@WebSocketGateway({
  cors: {
    origin: process.env.WS_CORS_ORIGIN || 'http://localhost:3005',
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');
  private websocketAdapter: WebSocketAdapter | null = null;

  setWebSocketAdapter(adapter: WebSocketAdapter): void {
    this.websocketAdapter = adapter;
  }

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    if (this.websocketAdapter) {
      this.websocketAdapter.handleDeviceDisconnect(client.id);
    }
  }

  @SubscribeMessage('subscribe_flight')
  handleSubscribeFlight(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { flightId: string },
  ) {
    client.join(`flight:${data.flightId}`);
  }

  @SubscribeMessage('subscribe_hub')
  handleSubscribeHub(@ConnectedSocket() client: Socket, @MessageBody() data: { hubId: string }) {
    client.join(`hub:${data.hubId}`);
  }

  @SubscribeMessage('subscribe_drone')
  handleSubscribeDrone(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { droneId: string },
  ) {
    client.join(`drone:${data.droneId}`);
  }

  @SubscribeMessage('subscribe_mission')
  handleSubscribeMission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { missionId: string },
  ) {
    client.join(`mission:${data.missionId}`);
  }

  @SubscribeMessage('unsubscribe_mission')
  handleUnsubscribeMission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { missionId: string },
  ) {
    client.leave(`mission:${data.missionId}`);
  }

  emitFlightUpdate(flightId: string, data: Record<string, unknown>) {
    this.server.to(`flight:${flightId}`).emit('flight_update', data);
  }

  emitTelemetry(flightId: string, data: Record<string, unknown>) {
    this.server.to(`flight:${flightId}`).emit('telemetry', data);
  }

  emitHubStatus(hubId: string, data: Record<string, unknown>) {
    this.server.to(`hub:${hubId}`).emit('hub_status', data);
  }

  emitDroneStatus(droneId: string, data: Record<string, unknown>) {
    this.server.to(`drone:${droneId}`).emit('drone_status', data);
  }

  emitConflictDetected(data: Record<string, unknown>) {
    this.server.emit('conflict_detected', data);
  }

  emitEmergency(data: Record<string, unknown>) {
    this.server.emit('emergency', data);
  }

  emitCommandStatus(
    droneId: string,
    data: {
      commandId: string;
      status: string;
      commandType: string;
      message: string;
    },
  ) {
    this.server.to(`drone:${droneId}`).emit('command_status', data);
    // Also broadcast globally for control center monitoring
    this.server.emit('command_status', { droneId, ...data });
  }

  emitAlert(droneId: string, alert: Record<string, unknown>) {
    this.server.to(`drone:${droneId}`).emit('drone_alert', alert);
    // Also broadcast globally for control center monitoring
    this.server.emit('drone_alert', { droneId, ...alert });
  }

  // Mission events
  emitMissionStatus(
    missionId: string,
    data: {
      missionId: string;
      status: string;
      executionId?: string;
      progress?: number;
      reason?: string;
    },
  ) {
    this.server.to(`mission:${missionId}`).emit('mission_status', data);
    this.server.emit('mission_status', data);
  }

  emitWaypointReached(
    missionId: string,
    data: {
      missionId: string;
      waypointId: string;
      waypointIndex: number;
      totalWaypoints: number;
      timestamp: Date;
    },
  ) {
    this.server.to(`mission:${missionId}`).emit('waypoint_reached', data);
  }

  emitMissionAlert(
    missionId: string,
    data: {
      missionId: string;
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
    },
  ) {
    this.server.to(`mission:${missionId}`).emit('mission_alert', data);
    this.server.emit('mission_alert', data);
  }

  emitConditionTriggered(
    missionId: string,
    data: {
      missionId: string;
      waypointId: string;
      condition: string;
      action: string;
    },
  ) {
    this.server.to(`mission:${missionId}`).emit('condition_triggered', data);
  }

  // Fleet Intelligence events
  @SubscribeMessage('subscribe_fleet')
  handleSubscribeFleet(@ConnectedSocket() client: Socket) {
    client.join('fleet');
    this.logger.debug(`Client ${client.id} subscribed to fleet updates`);
  }

  @SubscribeMessage('unsubscribe_fleet')
  handleUnsubscribeFleet(@ConnectedSocket() client: Socket) {
    client.leave('fleet');
  }

  emitFleetOverview(data: {
    totalDrones: number;
    availableDrones: number;
    busyDrones: number;
    activeMissions: number;
    pendingMissions: number;
    fleetHealth: number;
  }) {
    this.server.to('fleet').emit('fleet_overview', data);
  }

  emitHubFleetStatus(
    hubId: string,
    data: {
      hubId: string;
      hubName: string;
      totalDrones: number;
      availableDrones: number;
      busyDrones: number;
      capacityUtilization: number;
    },
  ) {
    this.server.to(`hub:${hubId}`).emit('hub_fleet_status', data);
    this.server.to('fleet').emit('hub_fleet_status', data);
  }

  emitAssignmentUpdate(data: {
    assignmentId: string;
    missionId: string;
    droneId: string;
    status: string;
    finalScore: number;
    assignedBy: string;
  }) {
    this.server.to('fleet').emit('assignment_update', data);
    this.server.to(`mission:${data.missionId}`).emit('assignment_update', data);
    if (data.droneId) {
      this.server.to(`drone:${data.droneId}`).emit('assignment_update', data);
    }
  }

  emitRebalancingUpdate(data: {
    taskId: string;
    sourceHubId: string;
    targetHubId: string;
    droneId: string;
    status: string;
    trigger: string;
    priority: number;
  }) {
    this.server.to('fleet').emit('rebalancing_update', data);
    this.server.to(`hub:${data.sourceHubId}`).emit('rebalancing_update', data);
    this.server.to(`hub:${data.targetHubId}`).emit('rebalancing_update', data);
    this.server.to(`drone:${data.droneId}`).emit('rebalancing_update', data);
  }

  emitFleetAlert(data: {
    type: 'hub_understaffed' | 'drone_idle' | 'rebalancing_needed' | 'config_changed';
    message: string;
    severity: 'info' | 'warning' | 'critical';
    hubId?: string;
    droneId?: string;
  }) {
    this.server.to('fleet').emit('fleet_alert', data);
  }

  // ============ Emergency Response Events ============

  @SubscribeMessage('subscribe_emergency')
  handleSubscribeEmergency(@ConnectedSocket() client: Socket) {
    client.join('emergency');
    this.logger.debug(`Client ${client.id} subscribed to emergency updates`);
  }

  @SubscribeMessage('unsubscribe_emergency')
  handleUnsubscribeEmergency(@ConnectedSocket() client: Socket) {
    client.leave('emergency');
  }

  emitEmergencyDetected(data: {
    incidentId: string;
    droneId: string;
    flightId?: string;
    emergencyType: string;
    severity: string;
    message: string;
    position?: { lat: number; lng: number; altitude?: number };
    detectedAt: Date;
  }) {
    this.server.to('emergency').emit('emergency_detected', data);
    if (data.droneId) {
      this.server.to(`drone:${data.droneId}`).emit('emergency_detected', data);
    }
    if (data.flightId) {
      this.server.to(`flight:${data.flightId}`).emit('emergency_detected', data);
    }
  }

  emitEmergencyActionRequired(data: {
    incidentId: string;
    droneId: string;
    flightId?: string;
    emergencyType: string;
    severity: string;
    recommendedAction: string;
    timeoutAt: Date;
    message: string;
  }) {
    this.server.to('emergency').emit('emergency_action_required', data);
    // Also broadcast globally so all operators see it
    this.server.emit('emergency_action_required', data);
  }

  emitEmergencyConfirmed(data: {
    incidentId: string;
    approved: boolean;
    confirmedBy: string;
    action?: string;
  }) {
    this.server.to('emergency').emit('emergency_confirmed', data);
  }

  emitEmergencyExecuting(data: {
    incidentId: string;
    droneId: string;
    action: string;
    autoExecuted: boolean;
  }) {
    this.server.to('emergency').emit('emergency_executing', data);
    this.server.to(`drone:${data.droneId}`).emit('emergency_executing', data);
  }

  emitEmergencyResolved(data: {
    incidentId: string;
    droneId: string;
    action: string;
    success: boolean;
    resolvedAt: Date;
    error?: string;
  }) {
    this.server.to('emergency').emit('emergency_resolved', data);
    this.server.to(`drone:${data.droneId}`).emit('emergency_resolved', data);
  }

  emitEmergencyModeChanged(data: { mode: 'auto' | 'supervised' }) {
    this.server.to('emergency').emit('emergency_mode_changed', data);
    this.server.emit('emergency_mode_changed', data);
  }

  emitEmergencyNotification(data: {
    id: string;
    incidentId: string;
    emergencyType: string;
    severity: string;
    droneId: string;
    flightId?: string;
    message: string;
    actionTaken?: string;
    awaitingConfirmation: boolean;
    confirmationTimeoutAt?: Date;
    deepLink: string;
    priority: 'normal' | 'high' | 'critical';
    playAlarm: boolean;
    timestamp: Date;
  }) {
    this.server.to('emergency').emit('emergency_notification', data);
    // High priority notifications go to everyone
    if (data.priority !== 'normal') {
      this.server.emit('emergency_notification', data);
    }
  }

  emitEmergencyAlarm(data: { incidentId: string; severity: string }) {
    this.server.emit('emergency_alarm', data);
  }

  // ============ Device Connectivity Events ============

  @SubscribeMessage('device_connect')
  async handleDeviceConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      deviceIdentifier?: string;
      authMethod: 'certificate' | 'token';
      certificateFingerprint?: string;
      token?: string;
    },
  ) {
    if (!this.websocketAdapter) {
      return { success: false, error: 'Connectivity module not initialized' };
    }

    const result = await this.websocketAdapter.handleDeviceConnect(client.id, data);

    if (result.success) {
      client.join('devices');
      this.logger.log(`Device authenticated: ${data.deviceIdentifier || 'via certificate'}`);
    }

    return result;
  }

  @SubscribeMessage('device_telemetry')
  async handleDeviceTelemetry(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TelemetryPayload,
  ) {
    if (!this.websocketAdapter) {
      return { success: false, error: 'Connectivity module not initialized' };
    }

    await this.websocketAdapter.handleDeviceTelemetry(client.id, payload);
    return { success: true };
  }

  @SubscribeMessage('device_command_ack')
  async handleDeviceCommandAck(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CommandAckPayload,
  ) {
    if (!this.websocketAdapter) {
      return { success: false, error: 'Connectivity module not initialized' };
    }

    await this.websocketAdapter.handleDeviceCommandAck(client.id, payload);
    return { success: true };
  }

  @SubscribeMessage('device_heartbeat')
  handleDeviceHeartbeat(@ConnectedSocket() client: Socket) {
    if (!this.websocketAdapter) {
      return { success: false };
    }

    const connection = this.websocketAdapter.getConnectionBySocketId(client.id);
    if (connection) {
      return { success: true, timestamp: new Date().toISOString() };
    }
    return { success: false, error: 'Device not connected' };
  }

  emitDeviceCommand(
    socketId: string,
    command: {
      commandId: string;
      commandType: string;
      parameters?: Record<string, unknown>;
      priority: number;
      timeout: number;
    },
  ) {
    this.server.to(socketId).emit('device_command', command);
  }

  emitTelemetryRateChange(socketId: string, rateHz: number) {
    this.server.to(socketId).emit('telemetry_rate_change', { rateHz });
  }

  emitDeviceDisconnect(socketId: string, reason: string) {
    this.server.to(socketId).emit('device_disconnect', { reason });
  }

  emitDeviceStatus(data: {
    deviceId: string;
    deviceIdentifier: string;
    connectionStatus: string;
    droneId?: string;
  }) {
    this.server.to('devices').emit('device_status', data);
    this.server.emit('device_status', data);
  }
}
