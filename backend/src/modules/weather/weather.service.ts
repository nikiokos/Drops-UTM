import { Injectable, Logger } from '@nestjs/common';
import { HubsService } from '../hubs/hubs.service';

interface OpenMeteoCurrentResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
  };
}

interface OpenMeteoForecastResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    weather_code: number[];
    visibility: number[];
    cloud_cover: number[];
  };
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

  constructor(private readonly hubsService: HubsService) {}

  private getFlightCategory(
    visibility: number | null,
    cloudCover: number,
    windSpeed: number,
  ): string {
    // Simplified flight category based on visibility and conditions
    // VFR: Visual Flight Rules (good conditions)
    // MVFR: Marginal VFR
    // IFR: Instrument Flight Rules (poor visibility)
    // LIFR: Low IFR (very poor conditions)

    if (visibility !== null && visibility < 1000) return 'LIFR';
    if (visibility !== null && visibility < 3000) return 'IFR';
    if (cloudCover > 80 || windSpeed > 15) return 'MVFR';
    return 'VFR';
  }

  private getWeatherDescription(code: number): string {
    const descriptions: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };
    return descriptions[code] || 'Unknown';
  }

  async getCurrentWeather(hubId: string) {
    try {
      const hub = await this.hubsService.findById(hubId);
      const { latitude, longitude } = hub.location;

      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,pressure_msl',
        wind_speed_unit: 'ms',
      });

      const response = await fetch(`${this.OPEN_METEO_BASE}?${params}`);

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data = (await response.json()) as OpenMeteoCurrentResponse;
      const current = data.current;

      // Estimate visibility based on weather code and humidity
      let estimatedVisibility: number | null = null;
      if (current.weather_code >= 45 && current.weather_code <= 48) {
        estimatedVisibility = 500; // Fog
      } else if (current.weather_code >= 95) {
        estimatedVisibility = 3000; // Thunderstorm
      } else if (current.relative_humidity_2m > 95) {
        estimatedVisibility = 5000;
      } else {
        estimatedVisibility = 10000; // Good visibility
      }

      return {
        hubId,
        hubName: hub.name,
        hubCode: hub.code,
        coordinates: { latitude, longitude },
        temperature: Math.round(current.temperature_2m * 10) / 10,
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
        windDirection: current.wind_direction_10m,
        windDirectionCardinal: this.degreesToCardinal(current.wind_direction_10m),
        pressure: current.pressure_msl,
        cloudCover: current.cloud_cover,
        visibility: estimatedVisibility,
        weatherCode: current.weather_code,
        weatherDescription: this.getWeatherDescription(current.weather_code),
        flightCategory: this.getFlightCategory(
          estimatedVisibility,
          current.cloud_cover,
          current.wind_speed_10m,
        ),
        flightConditions: this.getFlightConditions(current),
        timestamp: new Date(current.time),
        source: 'Open-Meteo',
      };
    } catch (error) {
      this.logger.error(`Failed to fetch weather for hub ${hubId}:`, error);
      throw error;
    }
  }

  async getForecast(hubId: string) {
    try {
      const hub = await this.hubsService.findById(hubId);
      const { latitude, longitude } = hub.location;

      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,visibility,cloud_cover',
        wind_speed_unit: 'ms',
        forecast_days: '2',
      });

      const response = await fetch(`${this.OPEN_METEO_BASE}?${params}`);

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data = (await response.json()) as OpenMeteoForecastResponse;
      const hourly = data.hourly;

      const forecasts = hourly.time.map((time, i) => ({
        time: new Date(time),
        temperature: hourly.temperature_2m[i],
        humidity: hourly.relative_humidity_2m[i],
        windSpeed: hourly.wind_speed_10m[i],
        windDirection: hourly.wind_direction_10m[i],
        weatherCode: hourly.weather_code[i],
        weatherDescription: this.getWeatherDescription(hourly.weather_code[i]),
        visibility: hourly.visibility[i],
        cloudCover: hourly.cloud_cover[i],
        flightCategory: this.getFlightCategory(
          hourly.visibility[i],
          hourly.cloud_cover[i],
          hourly.wind_speed_10m[i],
        ),
      }));

      return {
        hubId,
        hubName: hub.name,
        hubCode: hub.code,
        forecasts,
        updatedAt: new Date(),
        source: 'Open-Meteo',
      };
    } catch (error) {
      this.logger.error(`Failed to fetch forecast for hub ${hubId}:`, error);
      throw error;
    }
  }

  async getAlerts(hubId: string) {
    // Generate alerts based on current conditions
    const current = await this.getCurrentWeather(hubId);
    const alerts: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      validFrom: Date;
      validUntil: Date;
    }> = [];

    const now = new Date();
    const later = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // Wind alerts
    if (current.windSpeed > 12) {
      alerts.push({
        type: 'HIGH_WIND',
        severity: current.windSpeed > 18 ? 'critical' : 'high',
        message: `High wind speeds of ${current.windSpeed} m/s detected. Drone operations may be affected.`,
        validFrom: now,
        validUntil: later,
      });
    }

    // Visibility alerts
    if (current.visibility && current.visibility < 5000) {
      alerts.push({
        type: 'LOW_VISIBILITY',
        severity: current.visibility < 1000 ? 'critical' : 'high',
        message: `Reduced visibility of ${current.visibility}m. Visual line of sight operations restricted.`,
        validFrom: now,
        validUntil: later,
      });
    }

    // Weather condition alerts
    if (current.weatherCode >= 95) {
      alerts.push({
        type: 'THUNDERSTORM',
        severity: 'critical',
        message: 'Thunderstorm activity detected. All drone operations should cease immediately.',
        validFrom: now,
        validUntil: later,
      });
    } else if (current.weatherCode >= 71 && current.weatherCode <= 77) {
      alerts.push({
        type: 'SNOW',
        severity: 'high',
        message: 'Snow conditions detected. Drone operations not recommended.',
        validFrom: now,
        validUntil: later,
      });
    } else if (current.weatherCode >= 61 && current.weatherCode <= 65) {
      alerts.push({
        type: 'RAIN',
        severity: current.weatherCode >= 63 ? 'high' : 'medium',
        message: `${current.weatherDescription}. Exercise caution for drone operations.`,
        validFrom: now,
        validUntil: later,
      });
    }

    // Flight category alert
    if (current.flightCategory === 'IFR' || current.flightCategory === 'LIFR') {
      alerts.push({
        type: 'FLIGHT_CATEGORY',
        severity: current.flightCategory === 'LIFR' ? 'critical' : 'high',
        message: `${current.flightCategory} conditions. Instrument flight rules apply.`,
        validFrom: now,
        validUntil: later,
      });
    }

    return {
      hubId,
      hubName: current.hubName,
      alerts,
      checkedAt: now,
    };
  }

  private degreesToCardinal(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  private getFlightConditions(current: OpenMeteoCurrentResponse['current']): {
    safe: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    if (current.wind_speed_10m > 10) {
      warnings.push(`Wind speed ${current.wind_speed_10m.toFixed(1)} m/s exceeds safe threshold`);
    }
    if (current.weather_code >= 95) {
      warnings.push('Thunderstorm activity - flights not recommended');
    }
    if (current.weather_code >= 61 && current.weather_code <= 65) {
      warnings.push('Rain conditions - reduced visibility possible');
    }
    if (current.weather_code >= 45 && current.weather_code <= 48) {
      warnings.push('Fog conditions - VLOS operations restricted');
    }

    return {
      safe: warnings.length === 0,
      warnings,
    };
  }
}
