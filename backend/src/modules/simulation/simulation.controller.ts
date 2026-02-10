import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SimulationEngineService } from './services/simulation-engine.service';
import { ScenarioRunnerService } from './services/scenario-runner.service';
import { SimulationSession } from './entities/simulation-session.entity';
import {
  StartSimulationDto,
  UpdateTimeScaleDto,
  InjectScenarioDto,
  EmergencyScenarioType,
} from './types/simulation.types';

@Controller('simulation')
export class SimulationController {
  constructor(
    private readonly simulationEngine: SimulationEngineService,
    private readonly scenarioRunner: ScenarioRunnerService,
  ) {}

  /**
   * Start a new simulation session
   * POST /simulation/sessions
   */
  @Post('sessions')
  async startSimulation(
    @Body() dto: StartSimulationDto,
  ): Promise<SimulationSession> {
    return this.simulationEngine.startSimulation(dto);
  }

  /**
   * Get all simulation sessions
   * GET /simulation/sessions
   */
  @Get('sessions')
  async getAllSessions(): Promise<SimulationSession[]> {
    return this.simulationEngine.getAllSessions();
  }

  /**
   * Get active simulation sessions only
   * GET /simulation/sessions/active
   */
  @Get('sessions/active')
  async getActiveSessions(): Promise<SimulationSession[]> {
    return this.simulationEngine.getActiveSessions();
  }

  /**
   * Get a specific simulation session
   * GET /simulation/sessions/:id
   */
  @Get('sessions/:id')
  async getSession(@Param('id') id: string): Promise<SimulationSession> {
    return this.simulationEngine.getSession(id);
  }

  /**
   * Pause a running simulation
   * PATCH /simulation/sessions/:id/pause
   */
  @Patch('sessions/:id/pause')
  async pauseSimulation(@Param('id') id: string): Promise<SimulationSession> {
    return this.simulationEngine.pauseSimulation(id);
  }

  /**
   * Resume a paused simulation
   * PATCH /simulation/sessions/:id/resume
   */
  @Patch('sessions/:id/resume')
  async resumeSimulation(@Param('id') id: string): Promise<SimulationSession> {
    return this.simulationEngine.resumeSimulation(id);
  }

  /**
   * Update simulation time scale
   * PATCH /simulation/sessions/:id/time-scale
   */
  @Patch('sessions/:id/time-scale')
  async setTimeScale(
    @Param('id') id: string,
    @Body() dto: UpdateTimeScaleDto,
  ): Promise<SimulationSession> {
    return this.simulationEngine.setTimeScale(id, dto.timeScale);
  }

  /**
   * Inject an emergency scenario mid-flight
   * POST /simulation/sessions/:id/inject-scenario
   */
  @Post('sessions/:id/inject-scenario')
  async injectScenario(
    @Param('id') id: string,
    @Body() dto: InjectScenarioDto,
  ): Promise<{ success: boolean; event: { type: string; scenario: string; message: string; severity: string } }> {
    const event = await this.simulationEngine.injectScenario(
      id,
      dto.scenario,
      dto.config,
    );
    return { success: true, event };
  }

  /**
   * Stop and delete a simulation
   * DELETE /simulation/sessions/:id
   */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSimulation(@Param('id') id: string): Promise<void> {
    await this.simulationEngine.stopSimulation(id);
    await this.simulationEngine.deleteSession(id);
  }

  /**
   * Stop a simulation (without deleting)
   * POST /simulation/sessions/:id/stop
   */
  @Post('sessions/:id/stop')
  async stopSimulation(@Param('id') id: string): Promise<SimulationSession> {
    return this.simulationEngine.stopSimulation(id);
  }

  /**
   * Get available emergency scenarios
   * GET /simulation/scenarios
   */
  @Get('scenarios')
  getScenarios(): Array<{ type: EmergencyScenarioType; description: string }> {
    return this.scenarioRunner.getAvailableScenarios();
  }
}
