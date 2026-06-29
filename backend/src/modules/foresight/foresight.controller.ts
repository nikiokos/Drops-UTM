import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { DemoScenarioService } from './demo-scenario.service';
import { AirTrafficDirectorService } from './air-traffic-director.service';
import type { PredictedConflict, ResolutionManeuver } from './foresight.types';

@ApiTags('Foresight')
@ApiBearerAuth()
@Controller('foresight')
export class ForesightController {
  constructor(
    private readonly prediction: PredictionService,
    private readonly demo: DemoScenarioService,
    private readonly director: AirTrafficDirectorService,
  ) {}

  @Get('predict')
  @ApiOperation({ summary: 'Predict the airspace N seconds ahead and surface CPA conflicts' })
  async predict(@Query('horizon') horizon?: string, @Query('step') step?: string) {
    return this.prediction.predict({
      horizonSec: horizon ? Number(horizon) : undefined,
      stepSec: step ? Number(step) : undefined,
    });
  }

  @Post('advise')
  @ApiOperation({ summary: 'Air Traffic Director: ranked resolution options for a predicted conflict' })
  async advise(@Body() body: { conflict: PredictedConflict }) {
    return this.director.advise(body.conflict);
  }

  @Post('simulate-resolution')
  @ApiOperation({ summary: 'Re-predict with maneuvers applied (preview only — executes nothing)' })
  async simulateResolution(
    @Body() body: { maneuvers: ResolutionManeuver[]; horizon?: number; step?: number },
  ) {
    return this.prediction.predict(
      { horizonSec: body.horizon, stepSec: body.step },
      body.maneuvers ?? [],
    );
  }

  @Post('demo/start')
  @ApiOperation({ summary: 'Activate the scripted demo conflict scenario' })
  startDemo() {
    this.demo.start();
    return { active: true };
  }

  @Post('demo/reset')
  @ApiOperation({ summary: 'Clear the scripted demo scenario' })
  resetDemo() {
    this.demo.reset();
    return { active: false };
  }
}
