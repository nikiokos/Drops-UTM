import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmergencyIncident } from '../emergency/incident.entity';
import { EmergencyProtocol } from '../emergency/protocol.entity';

export interface EmergencyNotification {
  id: string;
  incidentId: string;
  emergencyType: string;
  severity: string;
  droneId: string;
  flightId?: string;
  flightNumber?: string;
  position?: { lat: number; lng: number };
  message: string;
  actionTaken?: string;
  awaitingConfirmation: boolean;
  confirmationTimeoutAt?: Date;
  deepLink: string;
  timestamp: Date;
}

export interface NotificationRecipient {
  userId: string;
  name: string;
  role: 'pilot' | 'supervisor' | 'ops_center';
  channels: {
    websocket: boolean;
    sms?: string;
    email?: string;
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * Handle new incident - notify all stakeholders
   */
  @OnEvent('emergency.incident_created')
  async handleIncidentCreated(event: { incident: EmergencyIncident }): Promise<void> {
    const { incident } = event;

    const notification = this.buildNotification(incident, {
      awaitingConfirmation: false,
      actionTaken: undefined,
    });

    await this.broadcastNotification(notification);
  }

  /**
   * Handle action required - notify with confirmation request
   */
  @OnEvent('emergency.action_required')
  async handleActionRequired(event: {
    incident: EmergencyIncident;
    protocol: EmergencyProtocol;
    timeoutAt: Date;
    recommendedAction: string;
  }): Promise<void> {
    const { incident, timeoutAt, recommendedAction } = event;

    const notification = this.buildNotification(incident, {
      awaitingConfirmation: true,
      confirmationTimeoutAt: timeoutAt,
      actionTaken: recommendedAction,
    });

    // Send with high priority
    await this.broadcastNotification(notification, { priority: 'high', playAlarm: true });
  }

  /**
   * Handle incident resolved
   */
  @OnEvent('emergency.resolved')
  async handleResolved(event: { incident: EmergencyIncident }): Promise<void> {
    const { incident } = event;

    const notification: EmergencyNotification = {
      ...this.buildNotification(incident, { awaitingConfirmation: false }),
      message: `RESOLVED: ${incident.message}`,
      actionTaken: incident.responseAction || undefined,
    };

    await this.broadcastNotification(notification, { priority: 'normal' });
  }

  /**
   * Handle escalation
   */
  @OnEvent('emergency.escalated')
  async handleEscalated(event: { incident: EmergencyIncident }): Promise<void> {
    const { incident } = event;

    const notification = this.buildNotification(incident, {
      awaitingConfirmation: false,
      actionTaken: 'ESCALATED - Requires immediate attention',
    });

    // Escalations get all channels
    await this.broadcastNotification(notification, {
      priority: 'critical',
      playAlarm: true,
      sendSms: true,
      sendEmail: true,
    });
  }

  /**
   * Handle mode change
   */
  @OnEvent('emergency.mode_changed')
  async handleModeChanged(event: { mode: string }): Promise<void> {
    this.logger.log(`Emergency mode changed to: ${event.mode}`);

    // Notify via WebSocket
    this.eventEmitter.emit('websocket.broadcast', {
      event: 'emergency_mode_changed',
      data: { mode: event.mode },
    });
  }

  /**
   * Build notification payload
   */
  private buildNotification(
    incident: EmergencyIncident,
    options: {
      awaitingConfirmation: boolean;
      confirmationTimeoutAt?: Date;
      actionTaken?: string;
    },
  ): EmergencyNotification {
    return {
      id: `notif-${Date.now()}`,
      incidentId: incident.id,
      emergencyType: incident.emergencyType,
      severity: incident.severity,
      droneId: incident.droneId,
      flightId: incident.flightId || undefined,
      position: incident.latitude && incident.longitude
        ? { lat: incident.latitude, lng: incident.longitude }
        : undefined,
      message: incident.message,
      actionTaken: options.actionTaken,
      awaitingConfirmation: options.awaitingConfirmation,
      confirmationTimeoutAt: options.confirmationTimeoutAt,
      deepLink: `/dashboard/emergency/incidents/${incident.id}`,
      timestamp: new Date(),
    };
  }

  /**
   * Broadcast notification to all channels
   */
  private async broadcastNotification(
    notification: EmergencyNotification,
    options: {
      priority?: 'normal' | 'high' | 'critical';
      playAlarm?: boolean;
      sendSms?: boolean;
      sendEmail?: boolean;
    } = {},
  ): Promise<void> {
    const { priority = 'normal', playAlarm = false, sendSms = false, sendEmail = false } = options;

    this.logger.log(
      `Broadcasting ${notification.severity} notification for incident ${notification.incidentId}`,
    );

    // 1. WebSocket push (< 100ms)
    this.eventEmitter.emit('websocket.broadcast', {
      event: 'emergency_notification',
      data: {
        ...notification,
        priority,
        playAlarm,
      },
    });

    // 2. Audio alarm trigger
    if (playAlarm) {
      this.eventEmitter.emit('websocket.broadcast', {
        event: 'emergency_alarm',
        data: {
          incidentId: notification.incidentId,
          severity: notification.severity,
        },
      });
    }

    // 3. SMS (placeholder - would integrate with Twilio/similar)
    if (sendSms) {
      this.logger.log(`[SMS] Would send SMS for incident ${notification.incidentId}`);
      // await this.smsService.send(recipients, message);
    }

    // 4. Email (placeholder - would integrate with email service)
    if (sendEmail) {
      this.logger.log(`[EMAIL] Would send email for incident ${notification.incidentId}`);
      // await this.emailService.send(recipients, subject, body);
    }
  }

  /**
   * Send targeted notification to specific user
   */
  async sendToUser(userId: string, notification: EmergencyNotification): Promise<void> {
    this.eventEmitter.emit('websocket.send_to_user', {
      userId,
      event: 'emergency_notification',
      data: notification,
    });
  }

  /**
   * Get notification recipients for an incident
   * In production, this would query user roles and on-duty status
   */
  async getRecipients(incident: EmergencyIncident): Promise<NotificationRecipient[]> {
    // Placeholder - would query from users service
    return [
      {
        userId: 'pilot-1',
        name: 'Assigned Pilot',
        role: 'pilot',
        channels: { websocket: true },
      },
      {
        userId: 'supervisor-1',
        name: 'Shift Supervisor',
        role: 'supervisor',
        channels: { websocket: true, sms: '+1234567890' },
      },
      {
        userId: 'ops-1',
        name: 'Operations Center',
        role: 'ops_center',
        channels: { websocket: true, email: 'ops@example.com' },
      },
    ];
  }
}
