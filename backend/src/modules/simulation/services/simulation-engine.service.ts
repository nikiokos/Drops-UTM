import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SimulationSession } from '../entities/simulation-session.entity';
import { PhysicsModelService } from './physics-model.service';
import { ScenarioRunnerService, ScenarioEvent } from './scenario-runner.service';
import { EventsGateway } from '../../../gateways/events.gateway';
import {
  SimulationState,
  SimulatedTelemetry,
  StartSimulationDto,
  SimulationWaypoint,
  INITIAL_SIMULATION_STATE,
  FlightPhase,
  EmergencyScenarioType,
  ScenarioConfig,
} from '../types/simulation.types';
import { TelemetryPayload } from '../../connectivity/adapters/protocol-adapter.interface';
import { Drone } from '../../drones/drone.entity';
import { Mission } from '../../missions/mission.entity';
import { Waypoint } from '../../missions/waypoint.entity';

@Injectable()
export class SimulationEngineService {
  private readonly logger = new Logger(SimulationEngineService.name);

  // Active simulation intervals
  private activeSimulations: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(SimulationSession)
    private readonly sessionRepository: Repository<SimulationSession>,
    @InjectRepository(Drone)
    private readonly droneRepository: Repository<Drone>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(Waypoint)
    private readonly waypointRepository: Repository<Waypoint>,
    private readonly physicsModel: PhysicsModelService,
    private readonly scenarioRunner: ScenarioRunnerService,
    private readonly eventsGateway: EventsGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start a new simulation session
   */
  async startSimulation(dto: StartSimulationDto): Promise<SimulationSession> {
    // Validate drone exists
    const drone = await this.droneRepository.findOne({
      where: { id: dto.droneId },
    });
    if (!drone) {
      throw new NotFoundException(`Drone ${dto.droneId} not found`);
    }

    // Check if drone already has active simulation
    const existingSession = await this.sessionRepository.findOne({
      where: { droneId: dto.droneId, status: 'running' },
    });
    if (existingSession) {
      throw new BadRequestException(
        `Drone ${dto.droneId} already has an active simulation`,
      );
    }

    // Get waypoints from mission or use manual waypoints
    let waypoints: SimulationWaypoint[] = [];
    if (dto.missionId) {
      const mission = await this.missionRepository.findOne({
        where: { id: dto.missionId },
      });
      if (!mission) {
        throw new NotFoundException(`Mission ${dto.missionId} not found`);
      }

      const missionWaypoints = await this.waypointRepository.find({
        where: { missionId: dto.missionId },
        order: { sequence: 'ASC' },
      });

      waypoints = missionWaypoints.map((wp) => ({
        latitude: wp.latitude,
        longitude: wp.longitude,
        altitude: wp.altitude,
        speed: wp.speedToWaypoint || undefined,
        holdTime: wp.hoverDuration || undefined,
        sequence: wp.sequence,
      }));
    } else if (dto.manualWaypoints && dto.manualWaypoints.length > 0) {
      waypoints = dto.manualWaypoints;
    }

    if (waypoints.length === 0) {
      throw new BadRequestException(
        'Either missionId or manualWaypoints must be provided',
      );
    }

    // Initialize state
    const startPosition = dto.startPosition || {
      latitude: waypoints[0].latitude,
      longitude: waypoints[0].longitude,
      altitude: 0,
    };

    const initialState: SimulationState = {
      ...INITIAL_SIMULATION_STATE,
      position: startPosition,
      flightPhase: 'preflight',
      phaseStartTime: 0,
    };

    // Create session
    const session = this.sessionRepository.create({
      droneId: dto.droneId,
      missionId: dto.missionId || null,
      status: 'running',
      scenario: dto.scenario || 'normal',
      scenarioConfig: dto.scenarioConfig || null,
      timeScale: dto.timeScale || 1.0,
      currentState: initialState,
      waypoints,
      tickRate: 10,
    });

    const savedSession = await this.sessionRepository.save(session);

    // Start the simulation loop
    this.startLoop(savedSession.id);

    this.logger.log(
      `Started simulation ${savedSession.id} for drone ${dto.droneId}`,
    );

    // Emit simulation started event
    this.eventsGateway.emitDroneStatus(dto.droneId, {
      status: 'simulating',
      simulationId: savedSession.id,
      message: 'Simulation started',
    });

    return savedSession;
  }

  /**
   * Stop a simulation session
   */
  async stopSimulation(sessionId: string): Promise<SimulationSession> {
    const session = await this.getSession(sessionId);

    // Stop the loop
    this.stopLoop(sessionId);

    // Update session
    session.status = 'completed';
    session.completedAt = new Date();

    const savedSession = await this.sessionRepository.save(session);

    // Clear scenario state
    this.scenarioRunner.clearSession(sessionId);

    this.logger.log(`Stopped simulation ${sessionId}`);

    // Emit simulation stopped event
    this.eventsGateway.emitDroneStatus(session.droneId, {
      status: 'idle',
      simulationId: sessionId,
      message: 'Simulation stopped',
    });

    return savedSession;
  }

  /**
   * Pause a simulation
   */
  async pauseSimulation(sessionId: string): Promise<SimulationSession> {
    const session = await this.getSession(sessionId);

    if (session.status !== 'running') {
      throw new BadRequestException('Simulation is not running');
    }

    this.stopLoop(sessionId);
    session.status = 'paused';

    const savedSession = await this.sessionRepository.save(session);

    this.logger.log(`Paused simulation ${sessionId}`);

    return savedSession;
  }

  /**
   * Resume a paused simulation
   */
  async resumeSimulation(sessionId: string): Promise<SimulationSession> {
    const session = await this.getSession(sessionId);

    if (session.status !== 'paused') {
      throw new BadRequestException('Simulation is not paused');
    }

    session.status = 'running';
    const savedSession = await this.sessionRepository.save(session);

    this.startLoop(sessionId);

    this.logger.log(`Resumed simulation ${sessionId}`);

    return savedSession;
  }

  /**
   * Update time scale
   */
  async setTimeScale(sessionId: string, timeScale: number): Promise<SimulationSession> {
    const session = await this.getSession(sessionId);

    if (timeScale < 0.1 || timeScale > 10) {
      throw new BadRequestException('Time scale must be between 0.1 and 10');
    }

    session.timeScale = timeScale;
    const savedSession = await this.sessionRepository.save(session);

    this.logger.log(`Set time scale to ${timeScale}x for simulation ${sessionId}`);

    return savedSession;
  }

  /**
   * Inject a scenario mid-flight
   */
  async injectScenario(
    sessionId: string,
    scenario: EmergencyScenarioType,
    config?: Partial<ScenarioConfig>,
  ): Promise<ScenarioEvent> {
    const session = await this.getSession(sessionId);

    if (session.status !== 'running') {
      throw new BadRequestException('Simulation is not running');
    }

    const event = this.scenarioRunner.injectScenario(
      sessionId,
      scenario,
      config || {},
      session.currentState.elapsedTime,
    );

    // Emit scenario event
    this.emitScenarioEvent(session.droneId, event);

    return event;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SimulationSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Simulation session ${sessionId} not found`);
    }

    return session;
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<SimulationSession[]> {
    return this.sessionRepository.find({
      where: [{ status: 'running' }, { status: 'paused' }],
      order: { startedAt: 'DESC' },
    });
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<SimulationSession[]> {
    return this.sessionRepository.find({
      order: { startedAt: 'DESC' },
    });
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    // Stop if running
    if (session.status === 'running') {
      this.stopLoop(sessionId);
    }

    // Clear scenario state
    this.scenarioRunner.clearSession(sessionId);

    await this.sessionRepository.remove(session);

    this.logger.log(`Deleted simulation session ${sessionId}`);
  }

  // ============================================================================
  // Simulation Loop
  // ============================================================================

  /**
   * Start the simulation loop for a session
   */
  private startLoop(sessionId: string): void {
    if (this.activeSimulations.has(sessionId)) {
      return;
    }

    const tickInterval = 100; // 10 Hz = 100ms

    const interval = setInterval(async () => {
      try {
        await this.tick(sessionId);
      } catch (error) {
        this.logger.error(`Simulation tick error for ${sessionId}:`, error);
        this.stopLoop(sessionId);
        await this.markFailed(sessionId, error instanceof Error ? error.message : 'Unknown error');
      }
    }, tickInterval);

    this.activeSimulations.set(sessionId, interval);
  }

  /**
   * Stop the simulation loop for a session
   */
  private stopLoop(sessionId: string): void {
    const interval = this.activeSimulations.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.activeSimulations.delete(sessionId);
    }
  }

  /**
   * Single simulation tick
   */
  private async tick(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'running') {
      this.stopLoop(sessionId);
      return;
    }

    const dt = (100 / 1000) * session.timeScale; // Convert to seconds with time scale
    const waypoints = session.waypoints || [];

    // Update physics
    const { newState, hasReachedWaypoint } = this.physicsModel.update(
      session.currentState,
      waypoints,
      dt,
    );

    // Check scenario triggers
    const scenarioEvent = this.scenarioRunner.checkTriggers(session, newState);
    if (scenarioEvent) {
      this.emitScenarioEvent(session.droneId, scenarioEvent);
    }

    // Apply scenario effects
    const stateWithEffects = this.scenarioRunner.applyScenarioEffects(
      sessionId,
      newState,
      dt,
    );

    // Check for phase transitions
    const nextPhase = this.physicsModel.determineNextPhase(
      stateWithEffects.flightPhase,
      stateWithEffects,
      waypoints,
      hasReachedWaypoint,
    );

    if (nextPhase !== stateWithEffects.flightPhase) {
      stateWithEffects.flightPhase = nextPhase;
      stateWithEffects.phaseStartTime = stateWithEffects.elapsedTime;

      // Handle phase-specific logic
      if (nextPhase === 'preflight') {
        stateWithEffects.isArmed = true;
      }

      this.logger.debug(
        `Simulation ${sessionId}: Phase transition to ${nextPhase}`,
      );
    }

    // Advance waypoint if reached
    if (hasReachedWaypoint && stateWithEffects.currentWaypointIndex < waypoints.length - 1) {
      stateWithEffects.currentWaypointIndex++;
      this.emitWaypointReached(session, stateWithEffects);
    }

    // Check for emergency RTH
    if (this.scenarioRunner.requiresRTH(sessionId)) {
      // Set last waypoint as target (return home)
      stateWithEffects.currentWaypointIndex = waypoints.length - 1;
      stateWithEffects.flightPhase = 'waypoint_nav';
    }

    // Check for emergency landing (but don't override if already landed)
    if (
      this.scenarioRunner.requiresEmergencyLanding(sessionId, stateWithEffects) &&
      stateWithEffects.flightPhase !== 'landed'
    ) {
      stateWithEffects.flightPhase = 'emergency';
    }

    // Update session
    session.currentState = stateWithEffects;
    await this.sessionRepository.save(session);

    // Generate and emit telemetry (unless comm loss)
    if (!this.scenarioRunner.isCommLossActive(sessionId)) {
      const telemetry = this.generateTelemetry(session, stateWithEffects);
      this.emitTelemetry(session.droneId, telemetry);
    }

    // Check for simulation completion
    if (stateWithEffects.flightPhase === 'landed') {
      await this.completeSimulation(sessionId);
    }
  }

  /**
   * Generate telemetry payload from state
   */
  private generateTelemetry(
    session: SimulationSession,
    state: SimulationState,
  ): SimulatedTelemetry {
    // Add sensor noise
    const noisyState = this.physicsModel.addSensorNoise(state);

    // Calculate speeds
    const speed = this.physicsModel.calculateSpeed(state.velocity);
    const verticalSpeed = this.physicsModel.calculateVerticalSpeed(state.velocity);

    // Battery voltage approximation (3.7V nominal per cell, 3S = 11.1V full)
    const batteryVoltage = 9.0 + (state.batteryLevel / 100) * 3.6;

    return {
      droneId: session.droneId,
      timestamp: new Date(),
      latitude: noisyState.position.latitude,
      longitude: noisyState.position.longitude,
      altitude: noisyState.position.altitude,
      heading: noisyState.heading,
      speed,
      batteryLevel: state.batteryLevel,
      batteryVoltage,
      satellites: state.satellites,
      signalStrength: state.signalStrength,
      flightMode: this.getFlightMode(state.flightPhase),
      armed: state.isArmed,
      gpsAccuracy: state.gpsAccuracy,
      verticalSpeed,
      custom: {
        simulationId: session.id,
        flightPhase: state.flightPhase,
        currentWaypoint: state.currentWaypointIndex,
        totalWaypoints: session.waypoints?.length || 0,
        elapsedTime: state.elapsedTime,
        isSimulated: true,
      },
    };
  }

  /**
   * Emit telemetry via WebSocket
   */
  private emitTelemetry(droneId: string, telemetry: SimulatedTelemetry): void {
    // Create payload matching TelemetryPayload interface
    const payload: TelemetryPayload = {
      latitude: telemetry.latitude,
      longitude: telemetry.longitude,
      altitude: telemetry.altitude,
      heading: telemetry.heading,
      speed: telemetry.speed,
      batteryLevel: telemetry.batteryLevel,
      batteryVoltage: telemetry.batteryVoltage,
      satellites: telemetry.satellites,
      signalStrength: telemetry.signalStrength,
      flightMode: telemetry.flightMode,
      armed: telemetry.armed,
      custom: telemetry.custom,
    };

    // Emit to drone room
    this.eventsGateway.emitDroneStatus(droneId, {
      type: 'telemetry',
      ...payload,
      timestamp: telemetry.timestamp,
    });

    // Also emit telemetry event for any flight subscribers
    this.eventEmitter.emit('drone.telemetry', {
      droneId,
      payload,
      timestamp: telemetry.timestamp,
      source: 'simulation',
    });
  }

  /**
   * Emit scenario event
   */
  private emitScenarioEvent(droneId: string, event: ScenarioEvent): void {
    if (event.severity === 'critical') {
      // Emit emergency event
      this.eventsGateway.emitEmergencyDetected({
        incidentId: `sim-${Date.now()}`,
        droneId,
        emergencyType: event.scenario,
        severity: event.severity,
        message: event.message,
        position: event.data?.position as { lat: number; lng: number },
        detectedAt: new Date(),
      });
    }

    // Always emit as drone alert
    this.eventsGateway.emitAlert(droneId, {
      type: 'simulation_scenario',
      scenario: event.scenario,
      message: event.message,
      severity: event.severity,
      data: event.data,
      timestamp: new Date(),
    });
  }

  /**
   * Emit waypoint reached event
   */
  private emitWaypointReached(
    session: SimulationSession,
    state: SimulationState,
  ): void {
    if (session.missionId) {
      this.eventsGateway.emitWaypointReached(session.missionId, {
        missionId: session.missionId,
        waypointId: `wp-${state.currentWaypointIndex}`,
        waypointIndex: state.currentWaypointIndex,
        totalWaypoints: session.waypoints?.length || 0,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Mark simulation as failed
   */
  private async markFailed(sessionId: string, errorMessage: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (session) {
      session.status = 'failed';
      session.completedAt = new Date();
      session.errorMessage = errorMessage;
      await this.sessionRepository.save(session);

      this.eventsGateway.emitDroneStatus(session.droneId, {
        status: 'simulation_failed',
        simulationId: sessionId,
        error: errorMessage,
      });
    }
  }

  /**
   * Complete a simulation normally
   */
  private async completeSimulation(sessionId: string): Promise<void> {
    this.stopLoop(sessionId);

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (session) {
      session.status = 'completed';
      session.completedAt = new Date();
      await this.sessionRepository.save(session);

      this.scenarioRunner.clearSession(sessionId);

      this.logger.log(`Simulation ${sessionId} completed`);

      this.eventsGateway.emitDroneStatus(session.droneId, {
        status: 'idle',
        simulationId: sessionId,
        message: 'Simulation completed',
      });

      if (session.missionId) {
        this.eventsGateway.emitMissionStatus(session.missionId, {
          missionId: session.missionId,
          status: 'completed',
          progress: 100,
        });
      }
    }
  }

  /**
   * Map flight phase to flight mode string
   */
  private getFlightMode(phase: FlightPhase): string {
    switch (phase) {
      case 'idle':
        return 'STABILIZE';
      case 'preflight':
        return 'PREFLIGHT';
      case 'takeoff':
        return 'TAKEOFF';
      case 'climb':
      case 'cruise':
      case 'waypoint_nav':
        return 'AUTO';
      case 'approach':
        return 'APPROACH';
      case 'landing':
        return 'LAND';
      case 'landed':
        return 'STABILIZE';
      case 'emergency':
        return 'RTL';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Clean up on module destroy
   */
  onModuleDestroy(): void {
    // Stop all active simulations
    for (const sessionId of this.activeSimulations.keys()) {
      this.stopLoop(sessionId);
    }
  }
}
