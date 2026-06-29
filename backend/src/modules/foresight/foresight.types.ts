/** A single tracked object in the foresight world (drone, manned aircraft, or demo). */
export interface ForesightObject {
  id: string;
  kind: 'drone' | 'manned' | 'demo';
  label: string;
  lat: number;
  lon: number;
  altitudeM: number;
  headingDeg: number;
  speedMps: number;
  verticalSpeedMps: number;
}

/** All object positions at one future time offset. */
export interface ForesightFrame {
  tOffsetSec: number;
  objects: Array<{ id: string; lat: number; lon: number; altitudeM: number }>;
}

/** A conflict predicted to occur in the future. */
export interface PredictedConflict {
  id: string;
  timeToConflictSec: number;
  minSeparationM: number;
  location: { lat: number; lon: number };
  altitudeM: number;
  primary: { id: string; label: string };
  secondary: { id: string; label: string };
}

/** A resolution maneuver applied (as a preview) to one object. */
export interface ResolutionManeuver {
  objectId: string;
  kind: 'hold' | 'altitude' | 'lateral';
  delaySec?: number;
  altitudeDeltaM?: number;
  lateralOffsetM?: number;
}

/** The full prediction result returned to the client. */
export interface ForesightTimeline {
  generatedAt: string;
  horizonSec: number;
  stepSec: number;
  objects: ForesightObject[];
  frames: ForesightFrame[];
  predictedConflicts: PredictedConflict[];
}

/** One resolution option proposed by the Air Traffic Director. */
export interface DirectorOption {
  kind: 'hold' | 'altitude' | 'lateral';
  label: string;
  delaySec?: number;
  altitudeDeltaM?: number;
  lateralOffsetM?: number;
  objectId: string;
  rationale: string;
  sideEffects: string;
}

/** The Director's full assessment of a predicted conflict. */
export interface DirectorAdvice {
  summary: string;
  cause: string;
  options: DirectorOption[];
  recommendedIndex: number;
  source: 'ai' | 'deterministic';
}
