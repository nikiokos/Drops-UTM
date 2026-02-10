'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { weatherApi, hubsApi } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Cloud, Wind, Eye, Thermometer, Droplets, Gauge, AlertTriangle, Compass, CloudSun } from 'lucide-react';

export default function WeatherPage() {
  const [selectedHubId, setSelectedHubId] = useState<string>('');

  const { data: hubsData } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => hubsApi.getAll().then((r) => r.data),
  });

  const hubs = Array.isArray(hubsData) ? hubsData : hubsData?.data || [];
  const selectedHub = hubs.find((h: Record<string, unknown>) => h.id === selectedHubId) as
    | Record<string, unknown>
    | undefined;

  const { data: weatherData, isLoading } = useQuery({
    queryKey: ['weather', selectedHubId],
    queryFn: () => weatherApi.getCurrent(selectedHubId).then((r) => r.data),
    enabled: !!selectedHubId,
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: alertsData } = useQuery({
    queryKey: ['weather-alerts', selectedHubId],
    queryFn: () => weatherApi.getAlerts(selectedHubId).then((r) => r.data),
    enabled: !!selectedHubId,
    refetchInterval: 60000,
  });

  const weather = weatherData as Record<string, unknown> | undefined;
  const alerts = (alertsData as Record<string, unknown>)?.alerts as Array<Record<string, unknown>> | undefined;
  const flightConditions = weather?.flightConditions as { safe: boolean; warnings: string[] } | undefined;

  const getFlightCategoryColor = (category: string) => {
    switch (category) {
      case 'VFR': return 'text-emerald-400';
      case 'MVFR': return 'text-amber-400';
      case 'IFR': return 'text-orange-400';
      case 'LIFR': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Weather" description="Real-time weather conditions from Open-Meteo" />

      <div className="max-w-sm">
        <label className="text-base font-medium mb-2 block">Select Hub</label>
        <Select value={selectedHubId} onValueChange={setSelectedHubId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a hub..." />
          </SelectTrigger>
          <SelectContent>
            {hubs.map((h: Record<string, unknown>) => (
              <SelectItem key={h.id as string} value={h.id as string}>
                {h.name as string} ({h.code as string})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedHubId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cloud className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-base font-medium">Select a Hub</p>
            <p className="text-sm text-muted-foreground">
              Choose a hub above to view current weather conditions
            </p>
          </CardContent>
        </Card>
      )}

      {selectedHubId && isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {selectedHubId && weather && !isLoading && (
        <div className="space-y-4">
          {/* Header with flight category and conditions */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedHub?.name as string}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CloudSun className="h-4 w-4" />
                    {weather.weatherDescription as string}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getFlightCategoryColor(weather.flightCategory as string)}`}>
                    {weather.flightCategory as string}
                  </div>
                  <p className="text-xs text-muted-foreground">Flight Category</p>
                </div>
              </div>
              {flightConditions && !flightConditions.safe && (
                <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-sm">
                  <p className="text-amber-400 font-medium">Flight Conditions Warning</p>
                  <ul className="text-muted-foreground text-xs mt-1">
                    {flightConditions.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weather alerts */}
          {alerts && alerts.length > 0 && (
            <Card className="border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Active Alerts ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.map((alert, i) => (
                  <div key={i} className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={alert.severity as string} />
                      <span className="font-medium">{alert.type as string}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{alert.message as string}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Weather metrics grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Temperature</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {weather.temperature != null ? `${weather.temperature}°C` : '—'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Wind className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Wind</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {weather.windSpeed != null ? `${weather.windSpeed} m/s` : '—'}
                </div>
                <p className="text-sm text-muted-foreground">
                  {weather.windDirectionCardinal as string} ({weather.windDirection as number}°)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Visibility</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {weather.visibility != null
                    ? (weather.visibility as number) >= 10000
                      ? '10+ km'
                      : `${((weather.visibility as number) / 1000).toFixed(1)} km`
                    : '—'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Droplets className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Humidity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {weather.humidity != null ? `${weather.humidity}%` : '—'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Pressure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {weather.pressure != null ? `${weather.pressure} hPa` : '—'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Cloud className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Cloud Cover</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {weather.cloudCover != null ? `${weather.cloudCover}%` : '—'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data source */}
          <p className="text-xs text-muted-foreground text-right">
            Data source: {weather.source as string} • Updated: {new Date(weather.timestamp as string).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
