import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmergencyIncident, ResponseAction } from './incident.entity';
import { BlackboxEntry } from './blackbox.entity';
import { Hub } from '../hubs/hub.entity';
import { Flight } from '../flights/flight.entity';

interface ExecuteResponseEvent {
  incident: EmergencyIncident;
  action: ResponseAction;
  fallbackAction?: ResponseAction;
}

interface SafeZone {
  id: string;
  name: string;
  position: { lat: number; lng: number };
  distance: number;
}

@Injectable()
export class ResponseExecutorService {
  private readonly logger = new Logger(ResponseExecutorService.name);

  constructor(
    @InjectRepository(EmergencyIncident)
    private incidentRepo: Repository<EmergencyIncident>,
    @InjectRepository(BlackboxEntry)
    private blackboxRepo: Repository<BlackboxEntry>,
    @InjectRepository(Hub)
    private hubRepo: Repository<Hub>,
    @InjectRepository(Flight)
    private flightRepo: Repository<Flight>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle execute response events from Decision Engine
   */
  @OnEvent('emergency.execute_response')
  async handleExecuteResponse(event: ExecuteResponseEvent): Promise<void> {
    const { incident, action, fallbackAction } = event;
    this.logger.log(`Executing response ${action} for incident ${incident.id}`);

    try {
      // Validate the action is safe to execute
      const validation = await this.validateAction(incident, action);

      if (!validation.safe) {
        this.logger.warn(`Action ${action} not safe: ${validation.reason}`);

        if (fallbackAction) {
          this.logger.log(`Trying fallback action: ${fallbackAction}`);
          const fallbackValidation = await this.validateAction(incident, fallbackAction);

          if (fallbackValidation.safe) {
            await this.executeAction(incident, fallbackAction);
            return;
          }
        }

        // If no safe action, hover in place
        this.logger.warn('No safe action available, executing HOVER');
        await this.executeAction(incident, 'HOVER');
        return;
      }

      await this.executeAction(incident, action);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute response: ${errorMessage}`);

      incident.actionSuccess = false;
      incident.actionError = errorMessage;
      incident.status = 'resolved';
      incident.resolvedAt = new Date();
      incident.timeline = [
        ...(incident.timeline || []),
        { timestamp: new Date().toISOString(), event: 'execution_error', data: { error: errorMessage } },
      ];
      await this.incidentRepo.save(incident);

      this.eventEmitter.emit('emergency.execution_failed', { incident, error: errorMessage });
    }
  }

  /**
   * Validate if an action is safe to execute
   */
  async validateAction(
    incident: EmergencyIncident,
    action: ResponseAction,
  ): Promise<{ safe: boolean; reason?: string }> {
    // Get current flight and drone info
    const flight = incident.flightId
      ? await this.flightRepo.findOne({
          where: { id: incident.flightId },
          relations: ['departureHub', 'arrivalHub'],
        })
      : null;

    const currentBattery = (incident.detectionData?.batteryLevel as number) ?? 50;
    const currentPosition = incident.latitude && incident.longitude
      ? { lat: incident.latitude, lng: incident.longitude }
      : null;

    switch (action) {
      case 'RTH': {
        // Check if RTH is possible (enough battery, clear path)
        if (!flight?.departureHub) {
          return { safe: false, reason: 'No home hub defined' };
        }

        const homeHub = flight.departureHub;
        const homeLocation = homeHub.location as { latitude: number; longitude: number };

        if (!currentPosition || !homeLocation) {
          return { safe: false, reason: 'Position unknown' };
        }

        const distanceToHome = this.calculateDistance(
          currentPosition.lat,
          currentPosition.lng,
          homeLocation.latitude,
          homeLocation.longitude,
        );

        // Rough estimate: 1km requires ~1% battery (very conservative)
        const batteryNeeded = distanceToHome / 1000;
        if (currentBattery < batteryNeeded + 10) {
          return { safe: false, reason: `Insufficient battery for RTH (need ${batteryNeeded.toFixed(0)}%, have ${currentBattery}%)` };
        }

        return { safe: true };
      }

      case 'LAND': {
        // Check if current location is safe to land
        if (!currentPosition) {
          return { safe: false, reason: 'Position unknown' };
        }

        // In a real system, we'd check:
        // - Not over water
        // - Not over populated areas
        // - Not in restricted zones
        // For demo, we'll assume landing is safe
        return { safe: true };
      }

      case 'DIVERT': {
        // Check if there's a nearby safe zone to divert to
        const safeZones = await this.findNearbySafeZones(currentPosition);
        if (safeZones.length === 0) {
          return { safe: false, reason: 'No safe zones nearby' };
        }

        const nearest = safeZones[0];
        const batteryNeeded = nearest.distance / 1000;
        if (currentBattery < batteryNeeded + 5) {
          return { safe: false, reason: `Insufficient battery to reach ${nearest.name}` };
        }

        return { safe: true };
      }

      case 'HOVER':
      case 'DESCEND':
      case 'CLIMB':
      case 'ESTOP':
      case 'NONE':
        // These actions are always "safe" to attempt
        return { safe: true };

      default:
        return { safe: false, reason: `Unknown action: ${action}` };
    }
  }

  /**
   * Execute the response action
   */
  private async executeAction(incident: EmergencyIncident, action: ResponseAction): Promise<void> {
    this.logger.log(`Executing ${action} for drone ${incident.droneId}`);

    // Start high-frequency blackbox recording
    this.startEmergencyRecording(incident);

    // Update incident
    incident.responseAction = action;
    incident.timeline = [
      ...(incident.timeline || []),
      { timestamp: new Date().toISOString(), event: 'action_executing', data: { action } },
    ];
    await this.incidentRepo.save(incident);

    // Emit command to drone (this would integrate with CommandsService in production)
    this.eventEmitter.emit('drone.command', {
      droneId: incident.droneId,
      flightId: incident.flightId,
      command: action,
      emergency: true,
      incidentId: incident.id,
    });

    // Simulate execution for demo (in production, we'd wait for drone acknowledgment)
    await this.simulateExecution(incident, action);
  }

  /**
   * Simulate action execution for demo purposes
   */
  private async simulateExecution(incident: EmergencyIncident, action: ResponseAction): Promise<void> {
    const executionTimes: Record<ResponseAction, number> = {
      ESTOP: 500,
      HOVER: 1000,
      DESCEND: 3000,
      CLIMB: 3000,
      LAND: 5000,
      RTH: 10000,
      DIVERT: 8000,
      NONE: 0,
    };

    const delay = executionTimes[action] || 2000;

    // Simulate execution with delay
    setTimeout(async () => {
      // Stop emergency recording
      this.stopEmergencyRecording(incident);

      // Mark as completed
      incident.status = 'resolved';
      incident.actionCompletedAt = new Date();
      incident.actionSuccess = true;
      incident.resolvedAt = new Date();
      incident.timeline = [
        ...(incident.timeline || []),
        { timestamp: new Date().toISOString(), event: 'action_completed', data: { action } },
      ];
      await this.incidentRepo.save(incident);

      this.eventEmitter.emit('emergency.resolved', { incident });
      this.logger.log(`Action ${action} completed for incident ${incident.id}`);
    }, delay);
  }

  /**
   * Find nearby hubs as safe zones
   */
  private async findNearbySafeZones(
    position: { lat: number; lng: number } | null,
  ): Promise<SafeZone[]> {
    if (!position) return [];

    const hubs = await this.hubRepo.find({ where: { status: 'active' } });

    return hubs
      .map((hub) => {
        const location = hub.location as { latitude: number; longitude: number };
        if (!location?.latitude || !location?.longitude) return null;

        const distance = this.calculateDistance(
          position.lat,
          position.lng,
          location.latitude,
          location.longitude,
        );

        return {
          id: hub.id,
          name: hub.name,
          position: { lat: location.latitude, lng: location.longitude },
          distance,
        };
      })
      .filter((zone): zone is SafeZone => zone !== null)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Start high-frequency telemetry recording during emergency
   */
  private startEmergencyRecording(incident: EmergencyIncident): void {
    this.logger.log(`Starting emergency recording for incident ${incident.id}`);
    // In production, this would increase telemetry recording frequency to 10Hz
    this.eventEmitter.emit('telemetry.start_emergency_recording', {
      incidentId: incident.id,
      droneId: incident.droneId,
      flightId: incident.flightId,
    });
  }

  /**
   * Stop high-frequency recording
   */
  private stopEmergencyRecording(incident: EmergencyIncident): void {
    this.logger.log(`Stopping emergency recording for incident ${incident.id}`);
    this.eventEmitter.emit('telemetry.stop_emergency_recording', {
      incidentId: incident.id,
      droneId: incident.droneId,
    });
  }

  /**
   * Record a blackbox entry
   */
  async recordBlackboxEntry(data: Partial<BlackboxEntry>): Promise<void> {
    const entry = this.blackboxRepo.create(data);
    await this.blackboxRepo.save(entry);
  }
}
