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
  // NOAA Aviation Weather Center — free, no key. Real METAR/TAF/SIGMET.
  private readonly AWC_BASE = 'https://aviationweather.gov/api/data';
  // Main Greek aerodromes (ICAO) for the aviation-weather board.
  private readonly GREEK_AERODROMES = [
    'LGAV', // Athens
    'LGTS', // Thessaloniki
    'LGIR', // Heraklion
    'LGKR', // Corfu
    'LGRP', // Rhodes
    'LGSR', // Santorini
    'LGKO', // Kos
    'LGZA', // Zakynthos
    'LGSM', // Samos
    'LGAL', // Alexandroupoli
  ];

  // Map each DROPS hub to its nearest Greek ICAO aerodrome for METAR.
  private readonly HUB_ICAO: Record<string, string> = {
    'ATH-HUB': 'LGAV',
    'SKG-HUB': 'LGTS',
    'HER-HUB': 'LGIR',
    'GPA-HUB': 'LGRX',
    'RHO-HUB': 'LGRP',
  };

  constructor(private readonly hubsService: HubsService) {}

  /**
   * GO / CAUTION / NO_GO recommendation for a hub, from real METAR (flight
   * category, wind, visibility) + active LGGG SIGMETs + Open-Meteo precip.
   * Worst-of aggregation; every rule contributes an explainable reason.
   */
  async getGoNoGo(hubId: string) {
    const hub = await this.hubsService.findById(hubId);
    const icao = this.HUB_ICAO[hub.code] || 'LGAV';

    const reasons: Array<{ rule: string; verdict: 'GO' | 'CAUTION' | 'NO_GO'; message: string; source: string }> = [];
    const rank = { GO: 0, CAUTION: 1, NO_GO: 2 } as const;
    let verdict: 'GO' | 'CAUTION' | 'NO_GO' = 'GO';
    const raise = (v: 'GO' | 'CAUTION' | 'NO_GO') => {
      if (rank[v] > rank[verdict]) verdict = v;
    };

    // ── METAR (flight category, wind, visibility) ──
    let station: Record<string, unknown> | null = null;
    let windMs: number | null = null;
    let gustMs: number | null = null;
    let visM: number | null = null;
    let fltCat: string | null = null;
    try {
      const metar = await this.getMetar(icao);
      station = metar.stations[0] || null;
      if (station) {
        fltCat = (station.flightCategory as string) || null;
        const wspdKt = station.windSpeedKt as number | null;
        const wgstKt = station.windGustKt as number | null;
        windMs = typeof wspdKt === 'number' ? Math.round(wspdKt * 0.514444 * 10) / 10 : null;
        gustMs = typeof wgstKt === 'number' ? Math.round(wgstKt * 0.514444 * 10) / 10 : null;
        visM = this.parseVisibilityM(station.visibility);

        if (fltCat === 'IFR' || fltCat === 'LIFR') {
          raise('NO_GO');
          reasons.push({ rule: 'flight_category', verdict: 'NO_GO', message: `${fltCat} conditions at ${icao}`, source: 'METAR' });
        } else if (fltCat === 'MVFR') {
          raise('CAUTION');
          reasons.push({ rule: 'flight_category', verdict: 'CAUTION', message: `Marginal VFR (MVFR) at ${icao}`, source: 'METAR' });
        } else if (fltCat === 'VFR') {
          reasons.push({ rule: 'flight_category', verdict: 'GO', message: `VFR at ${icao}`, source: 'METAR' });
        }

        if (windMs != null) {
          if (windMs > 12) {
            raise('NO_GO');
            reasons.push({ rule: 'wind', verdict: 'NO_GO', message: `Wind ${windMs} m/s exceeds 12 m/s limit`, source: 'METAR' });
          } else if (windMs > 9) {
            raise('CAUTION');
            reasons.push({ rule: 'wind', verdict: 'CAUTION', message: `Wind ${windMs} m/s — marginal`, source: 'METAR' });
          }
        }
        if (gustMs != null && gustMs > 15) {
          raise('NO_GO');
          reasons.push({ rule: 'gust', verdict: 'NO_GO', message: `Gusts ${gustMs} m/s exceed 15 m/s limit`, source: 'METAR' });
        } else if (gustMs != null && gustMs > 12) {
          raise('CAUTION');
          reasons.push({ rule: 'gust', verdict: 'CAUTION', message: `Gusts ${gustMs} m/s — marginal`, source: 'METAR' });
        }
        if (visM != null && visM < 1500) {
          raise('NO_GO');
          reasons.push({ rule: 'visibility', verdict: 'NO_GO', message: `Visibility ${Math.round(visM)} m below 1500 m`, source: 'METAR' });
        } else if (visM != null && visM < 5000) {
          raise('CAUTION');
          reasons.push({ rule: 'visibility', verdict: 'CAUTION', message: `Visibility ${Math.round(visM)} m — reduced`, source: 'METAR' });
        }
      }
    } catch {
      reasons.push({ rule: 'metar', verdict: 'CAUTION', message: `METAR unavailable for ${icao}`, source: 'METAR' });
      raise('CAUTION');
    }

    // ── SIGMET (Athinai FIR) ──
    try {
      const sig = await this.getSigmet();
      if (sig.count > 0) {
        raise('NO_GO');
        reasons.push({ rule: 'sigmet', verdict: 'NO_GO', message: `${sig.count} active SIGMET(s) in Athinai FIR`, source: 'SIGMET' });
      }
    } catch {
      /* non-fatal */
    }

    // ── Open-Meteo precip/thunderstorm augmentation ──
    try {
      const cur = await this.getCurrentWeather(hubId);
      if (cur.weatherCode >= 95) {
        raise('NO_GO');
        reasons.push({ rule: 'thunderstorm', verdict: 'NO_GO', message: 'Thunderstorm activity at hub', source: 'Open-Meteo' });
      } else if (cur.weatherCode >= 61 && cur.weatherCode <= 75) {
        raise('CAUTION');
        reasons.push({ rule: 'precipitation', verdict: 'CAUTION', message: cur.weatherDescription, source: 'Open-Meteo' });
      }
    } catch {
      /* non-fatal */
    }

    if (reasons.length === 0) {
      reasons.push({ rule: 'default', verdict: 'GO', message: 'No adverse conditions detected', source: 'system' });
    }

    return {
      hubId,
      hubName: hub.name,
      hubCode: hub.code,
      verdict,
      station: { icaoId: icao, flightCategory: fltCat, observedAt: station?.observedAt ?? null },
      wind: { speedMs: windMs, gustMs },
      visibilityM: visM,
      reasons,
      checkedAt: new Date().toISOString(),
    };
  }

  private parseVisibilityM(visib: unknown): number | null {
    if (visib == null) return null;
    if (typeof visib === 'number') return visib * 1609.34; // statute miles → m
    const s = String(visib);
    if (s.includes('+')) return 16093; // "10+" sm
    const n = parseFloat(s);
    return isNaN(n) ? null : n * 1609.34;
  }

  /** Live METAR observations for the given (or default Greek) aerodromes. */
  async getMetar(ids?: string) {
    const stationIds = (ids || this.GREEK_AERODROMES.join(',')).toUpperCase();
    const params = new URLSearchParams({ ids: stationIds, format: 'json' });
    try {
      const res = await fetch(`${this.AWC_BASE}/metar?${params}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`AWC METAR error: ${res.status}`);
      const data = (await res.json()) as Array<Record<string, unknown>>;
      return {
        updatedAt: new Date().toISOString(),
        source: 'NOAA Aviation Weather Center',
        count: data.length,
        stations: data.map((m) => ({
          icaoId: m.icaoId,
          name: m.name,
          lat: m.lat,
          lon: m.lon,
          observedAt: m.reportTime ?? m.obsTime,
          flightCategory: m.fltCat ?? null,
          tempC: m.temp ?? null,
          dewpointC: m.dewp ?? null,
          windDir: m.wdir ?? null,
          windSpeedKt: m.wspd ?? null,
          windGustKt: m.wgst ?? null,
          visibility: m.visib ?? null,
          altimeterHpa: m.altim ?? null,
          raw: m.rawOb ?? null,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch METAR:', error);
      throw error;
    }
  }

  /** Live TAF forecasts for the given (or default Greek) aerodromes. */
  async getTaf(ids?: string) {
    const stationIds = (ids || this.GREEK_AERODROMES.slice(0, 6).join(',')).toUpperCase();
    const params = new URLSearchParams({ ids: stationIds, format: 'json' });
    try {
      const res = await fetch(`${this.AWC_BASE}/taf?${params}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`AWC TAF error: ${res.status}`);
      const data = (await res.json()) as Array<Record<string, unknown>>;
      return {
        updatedAt: new Date().toISOString(),
        source: 'NOAA Aviation Weather Center',
        count: data.length,
        forecasts: data.map((t) => ({
          icaoId: t.icaoId,
          issuedAt: t.issueTime,
          validFrom: t.validTimeFrom,
          validTo: t.validTimeTo,
          raw: t.rawTAF ?? null,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch TAF:', error);
      throw error;
    }
  }

  /** Active international SIGMETs filtered to the Athinai FIR (LGGG). */
  async getSigmet() {
    try {
      const res = await fetch(`${this.AWC_BASE}/isigmet?format=json`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`AWC SIGMET error: ${res.status}`);
      const all = (await res.json()) as Array<Record<string, unknown>>;
      const greek = all.filter((s) => s.firId === 'LGGG' || s.firName === 'ATHINAI');
      return {
        updatedAt: new Date().toISOString(),
        source: 'NOAA Aviation Weather Center',
        fir: 'LGGG (Athinai)',
        count: greek.length,
        sigmets: greek,
      };
    } catch (error) {
      this.logger.error('Failed to fetch SIGMET:', error);
      throw error;
    }
  }

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
