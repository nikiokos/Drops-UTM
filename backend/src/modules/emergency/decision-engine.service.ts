import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmergencyProtocol, EmergencyConfig } from './protocol.entity';
import {
  EmergencyIncident,
  EmergencyType,
  EmergencySeverity,
  ResponseAction,
  IncidentStatus,
} from './incident.entity';
import { EmergencyEvent } from './detection.service';

export type OperationMode = 'auto' | 'supervised';

interface PendingConfirmation {
  incident: EmergencyIncident;
  protocol: EmergencyProtocol;
  timeoutAt: Date;
  timeoutHandle: NodeJS.Timeout;
}

// Priority mapping (lower = higher priority)
const EMERGENCY_PRIORITY: Record<string, number> = {
  collision_aircraft: 1,
  collision_obstacle: 2,
  motor_failure: 10,
  motor_anomaly: 15,
  gps_lost: 20,
  gps_degraded: 25,
  geofence_breach: 30,
  geofence_warning: 35,
  battery_critical: 40,
  battery_low: 45,
  battery_rapid_discharge: 50,
  signal_lost: 55,
  signal_weak: 60,
  weather_wind: 70,
  weather_visibility: 75,
};

@Injectable()
export class DecisionEngineService {
  private readonly logger = new Logger(DecisionEngineService.name);
  private mode: OperationMode = 'supervised';
  private protocols: EmergencyProtocol[] = [];
  private pendingConfirmations = new Map<string, PendingConfirmation>();

  constructor(
    @InjectRepository(EmergencyIncident)
    private incidentRepo: Repository<EmergencyIncident>,
    @InjectRepository(EmergencyProtocol)
    private protocolRepo: Repository<EmergencyProtocol>,
    @InjectRepository(EmergencyConfig)
    private configRepo: Repository<EmergencyConfig>,
    private eventEmitter: EventEmitter2,
  ) {
    this.loadConfig();
    this.loadProtocols();
  }

  private async loadConfig() {
    try {
      const modeConfig = await this.configRepo.findOne({ where: { key: 'operation_mode' } });
      if (modeConfig) {
        this.mode = modeConfig.value as OperationMode;
      }
      this.logger.log(`Decision Engine loaded in ${this.mode} mode`);
    } catch {
      this.logger.warn('Failed to load config, using default supervised mode');
    }
  }

  private async loadProtocols() {
    try {
      this.protocols = await this.protocolRepo.find({ where: { isActive: true } });
      this.logger.log(`Loaded ${this.protocols.length} emergency protocols`);
    } catch {
      this.logger.warn('Failed to load protocols');
    }
  }

  async setMode(mode: OperationMode): Promise<void> {
    this.mode = mode;
    await this.configRepo.upsert(
      { key: 'operation_mode', value: mode, description: 'Emergency response operation mode' },
      ['key'],
    );
    this.logger.log(`Operation mode set to: ${mode}`);
    this.eventEmitter.emit('emergency.mode_changed', { mode });
  }

  getMode(): OperationMode {
    return this.mode;
  }

  async reloadProtocols(): Promise<void> {
    await this.loadProtocols();
  }

  /**
   * Handle incoming emergency events from Detection Service
   */
  @OnEvent('emergency.detected')
  async handleEmergencyDetected(event: EmergencyEvent): Promise<void> {
    this.logger.warn(`Processing emergency: ${event.type} (${event.severity}) for drone ${event.droneId}`);

    // Create incident record
    const incident = await this.createIncident(event);

    // Find matching protocol
    const protocol = this.findMatchingProtocol(event);
    if (!protocol) {
      this.logger.warn(`No protocol found for ${event.type}, using default response`);
      await this.executeDefaultResponse(incident, event);
      return;
    }

    // Determine if we need confirmation
    const needsConfirmation = this.needsConfirmation(event, protocol);

    if (needsConfirmation) {
      await this.queueForConfirmation(incident, protocol);
    } else {
      await this.executeResponse(incident, protocol);
    }
  }

  /**
   * Operator confirms or rejects a pending action
   */
  async confirmAction(incidentId: string, approved: boolean, userId: string): Promise<EmergencyIncident> {
    const pending = this.pendingConfirmations.get(incidentId);
    if (!pending) {
      throw new Error('No pending confirmation found for this incident');
    }

    // Clear timeout
    clearTimeout(pending.timeoutHandle);
    this.pendingConfirmations.delete(incidentId);

    const incident = pending.incident;
    incident.confirmedBy = userId;
    incident.confirmedAt = new Date();

    if (approved) {
      await this.executeResponse(incident, pending.protocol);
    } else {
      incident.status = 'resolved';
      incident.resolvedAt = new Date();
      incident.resolvedBy = userId;
      incident.resolutionNotes = 'Action rejected by operator';
      incident.timeline = [
        ...(incident.timeline || []),
        { timestamp: new Date().toISOString(), event: 'action_rejected', data: { userId } },
      ];
      await this.incidentRepo.save(incident);
      this.eventEmitter.emit('emergency.action_rejected', { incident });
    }

    return incident;
  }

  /**
   * Get all pending confirmations
   */
  getPendingConfirmations(): Array<{
    incidentId: string;
    incident: EmergencyIncident;
    protocol: EmergencyProtocol;
    timeoutAt: Date;
  }> {
    return Array.from(this.pendingConfirmations.entries()).map(([id, pending]) => ({
      incidentId: id,
      incident: pending.incident,
      protocol: pending.protocol,
      timeoutAt: pending.timeoutAt,
    }));
  }

  /**
   * Handle multiple simultaneous emergencies - select highest priority
   */
  prioritizeEmergencies(events: EmergencyEvent[]): EmergencyEvent[] {
    return events.sort((a, b) => {
      const priorityA = EMERGENCY_PRIORITY[a.type] ?? 100;
      const priorityB = EMERGENCY_PRIORITY[b.type] ?? 100;
      return priorityA - priorityB;
    });
  }

  // ============ Private Methods ============

  private async createIncident(event: EmergencyEvent): Promise<EmergencyIncident> {
    const incident = this.incidentRepo.create({
      droneId: event.droneId,
      flightId: event.flightId,
      emergencyType: event.type,
      severity: event.severity,
      status: 'active',
      message: event.message,
      detectionData: event.data,
      latitude: event.position?.lat,
      longitude: event.position?.lng,
      altitude: event.position?.altitude,
      detectedAt: event.detectedAt,
      timeline: [
        { timestamp: event.detectedAt.toISOString(), event: 'detected', data: event.data },
      ],
    });

    await this.incidentRepo.save(incident);
    this.eventEmitter.emit('emergency.incident_created', { incident });
    return incident;
  }

  private findMatchingProtocol(event: EmergencyEvent): EmergencyProtocol | null {
    // Find protocol that matches emergency type and severity
    const matching = this.protocols.filter(
      (p) => p.emergencyType === event.type && p.severity === event.severity,
    );

    if (matching.length === 0) {
      // Try to find any protocol for this type
      const typeMatch = this.protocols.filter((p) => p.emergencyType === event.type);
      if (typeMatch.length > 0) {
        // Sort by severity (emergency > critical > warning) and return first
        return typeMatch.sort((a, b) => {
          const order = { emergency: 0, critical: 1, warning: 2 };
          return order[a.severity] - order[b.severity];
        })[0];
      }
      return null;
    }

    // Return highest priority (lowest number)
    return matching.sort((a, b) => a.priority - b.priority)[0];
  }

  private needsConfirmation(event: EmergencyEvent, protocol: EmergencyProtocol): boolean {
    // In auto mode, never need confirmation except for special cases
    if (this.mode === 'auto') {
      return false;
    }

    // Emergency severity always executes immediately (collision imminent, etc.)
    if (event.severity === 'emergency') {
      return false;
    }

    // Battery under 5% always immediate
    if (event.type === 'battery_critical' && (event.data.batteryLevel as number) < 5) {
      return false;
    }

    // Use protocol setting
    return protocol.requiresConfirmation;
  }

  private async queueForConfirmation(
    incident: EmergencyIncident,
    protocol: EmergencyProtocol,
  ): Promise<void> {
    const timeoutSeconds = protocol.confirmationTimeoutSeconds || 30;
    const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000);

    incident.status = 'pending_confirmation';
    incident.confirmationRequired = true;
    incident.confirmationTimeoutAt = timeoutAt;
    incident.responseAction = protocol.responseAction;
    incident.timeline = [
      ...(incident.timeline || []),
      {
        timestamp: new Date().toISOString(),
        event: 'awaiting_confirmation',
        data: { action: protocol.responseAction, timeoutAt: timeoutAt.toISOString() },
      },
    ];

    await this.incidentRepo.save(incident);

    // Set up timeout for auto-execute
    const timeoutHandle = setTimeout(async () => {
      if (protocol.autoExecuteOnTimeout) {
        this.logger.warn(`Confirmation timeout for incident ${incident.id}, auto-executing`);
        await this.executeResponse(incident, protocol);
      } else {
        incident.status = 'escalated';
        incident.timeline = [
          ...(incident.timeline || []),
          { timestamp: new Date().toISOString(), event: 'confirmation_timeout_escalated' },
        ];
        await this.incidentRepo.save(incident);
        this.eventEmitter.emit('emergency.escalated', { incident });
      }
      this.pendingConfirmations.delete(incident.id);
    }, timeoutSeconds * 1000);

    this.pendingConfirmations.set(incident.id, {
      incident,
      protocol,
      timeoutAt,
      timeoutHandle,
    });

    this.eventEmitter.emit('emergency.action_required', {
      incident,
      protocol,
      timeoutAt,
      recommendedAction: protocol.responseAction,
    });

    this.logger.log(
      `Incident ${incident.id} queued for confirmation (timeout: ${timeoutSeconds}s)`,
    );
  }

  private async executeResponse(
    incident: EmergencyIncident,
    protocol: EmergencyProtocol,
  ): Promise<void> {
    incident.status = 'executing';
    incident.responseAction = protocol.responseAction;
    incident.wasAutoExecuted = this.mode === 'auto' || incident.severity === 'emergency';
    incident.actionStartedAt = new Date();
    incident.timeline = [
      ...(incident.timeline || []),
      {
        timestamp: new Date().toISOString(),
        event: 'action_started',
        data: { action: protocol.responseAction, autoExecuted: incident.wasAutoExecuted },
      },
    ];

    await this.incidentRepo.save(incident);

    // Emit event for Response Executor to handle
    this.eventEmitter.emit('emergency.execute_response', {
      incident,
      action: protocol.responseAction,
      fallbackAction: protocol.fallbackAction,
    });

    this.logger.log(`Executing ${protocol.responseAction} for incident ${incident.id}`);
  }

  private async executeDefaultResponse(
    incident: EmergencyIncident,
    event: EmergencyEvent,
  ): Promise<void> {
    // Default responses based on severity
    let action: ResponseAction = 'HOVER';

    if (event.severity === 'emergency') {
      action = 'LAND';
    } else if (event.severity === 'critical') {
      action = 'RTH';
    }

    incident.status = 'executing';
    incident.responseAction = action;
    incident.wasAutoExecuted = true;
    incident.actionStartedAt = new Date();
    incident.timeline = [
      ...(incident.timeline || []),
      {
        timestamp: new Date().toISOString(),
        event: 'default_action_started',
        data: { action, reason: 'No matching protocol' },
      },
    ];

    await this.incidentRepo.save(incident);

    this.eventEmitter.emit('emergency.execute_response', {
      incident,
      action,
      fallbackAction: 'HOVER',
    });

    this.logger.log(`Executing default response ${action} for incident ${incident.id}`);
  }

  /**
   * Mark an incident as resolved (called by Response Executor)
   */
  async markResolved(
    incidentId: string,
    success: boolean,
    error?: string,
  ): Promise<EmergencyIncident> {
    const incident = await this.incidentRepo.findOne({ where: { id: incidentId } });
    if (!incident) {
      throw new Error('Incident not found');
    }

    incident.status = 'resolved';
    incident.actionCompletedAt = new Date();
    incident.actionSuccess = success;
    if (error) {
      incident.actionError = error;
    }
    incident.resolvedAt = new Date();
    incident.timeline = [
      ...(incident.timeline || []),
      {
        timestamp: new Date().toISOString(),
        event: success ? 'action_completed' : 'action_failed',
        data: { success, error },
      },
    ];

    await this.incidentRepo.save(incident);
    this.eventEmitter.emit('emergency.resolved', { incident });

    return incident;
  }
}
