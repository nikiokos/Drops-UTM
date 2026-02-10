import { FlightCategory } from '../enums';

export interface WeatherData {
  time: Date;
  hubId: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  windSpeed?: number;
  windDirection?: number;
  windGust?: number;
  visibility?: number;
  cloudCoverage?: number;
  cloudBase?: number;
  precipitationType?: string;
  precipitationIntensity?: number;
  flightCategory?: FlightCategory;
  source?: string;
  rawData?: Record<string, unknown>;
}

export interface WeatherForecast {
  hubId: string;
  forecasts: WeatherData[];
  updatedAt: Date;
}

export interface WeatherAlert {
  hubId: string;
  type: string;
  severity: string;
  message: string;
  effectiveFrom: Date;
  effectiveTo: Date;
}
