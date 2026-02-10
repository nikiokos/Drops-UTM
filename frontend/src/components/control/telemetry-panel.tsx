'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TelemetryGauge } from './telemetry-gauge';
import { Activity, Compass, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TelemetryData {
  altitude: number;
  groundSpeed: number;
  verticalSpeed?: number;
  heading: number;
  batteryLevel: number;
  signalStrength?: number;
  gpsSatellites?: number;
  flightMode?: string;
}

interface TelemetryPanelProps {
  data: TelemetryData | null;
  className?: string;
}

function CompassIndicator({ heading }: { heading: number }) {
  return (
    <div className="relative w-20 h-20">
      {/* Compass ring */}
      <div className="absolute inset-0 rounded-full border-2 border-border/30" />

      {/* Cardinal directions */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 text-[10px] font-bold text-primary">
        N
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-0.5 text-[10px] font-bold text-muted-foreground">
        S
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-0.5 text-[10px] font-bold text-muted-foreground">
        E
      </div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-0.5 text-[10px] font-bold text-muted-foreground">
        W
      </div>

      {/* Heading indicator needle */}
      <div
        className="absolute inset-2 flex items-center justify-center"
        style={{ transform: `rotate(${heading}deg)` }}
      >
        <div className="h-full w-0.5 flex flex-col items-center">
          <div className="h-1/2 w-0 border-l border-primary" />
          <Navigation className="h-4 w-4 text-primary -rotate-180 -mt-1" />
        </div>
      </div>

      {/* Center dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
    </div>
  );
}

function StatRow({ label, value, unit, className }: { label: string; value: string | number; unit?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between py-1.5 border-b border-border/20 last:border-0', className)}>
      <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">{label}</span>
      <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
        {value}{unit && <span className="text-muted-foreground ml-1">{unit}</span>}
      </span>
    </div>
  );
}

export function TelemetryPanel({ data, className }: TelemetryPanelProps) {
  if (!data) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle>Telemetry</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[calc(100%-60px)]">
          <div className="text-center">
            <Activity className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/50 font-mono tracking-wider">
              NO TELEMETRY DATA
            </p>
            <p className="text-xs text-muted-foreground/30 mt-0.5">
              Select an active flight
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle>Telemetry</CardTitle>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main gauges */}
        <div className="grid grid-cols-2 gap-4">
          <TelemetryGauge
            label="Altitude"
            value={data.altitude}
            unit="m"
            min={0}
            max={200}
            warningThreshold={150}
            criticalThreshold={180}
            invertWarning
          />
          <TelemetryGauge
            label="Speed"
            value={data.groundSpeed}
            unit="km/h"
            min={0}
            max={100}
            warningThreshold={70}
            criticalThreshold={85}
            invertWarning
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TelemetryGauge
            label="Battery"
            value={data.batteryLevel}
            unit="%"
            min={0}
            max={100}
            warningThreshold={30}
            criticalThreshold={15}
          />
          <div className="flex flex-col items-center">
            <CompassIndicator heading={data.heading} />
            <span className="mt-2 text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
              Heading
            </span>
            <span className="text-sm font-mono font-semibold text-foreground">
              {Math.round(data.heading)}°
            </span>
          </div>
        </div>

        {/* Additional stats */}
        <div className="pt-2 border-t border-border/30">
          {data.verticalSpeed !== undefined && (
            <StatRow label="V/S" value={data.verticalSpeed.toFixed(1)} unit="m/s" />
          )}
          {data.signalStrength !== undefined && (
            <StatRow label="Signal" value={data.signalStrength} unit="%" />
          )}
          {data.gpsSatellites !== undefined && (
            <StatRow label="GPS Sats" value={data.gpsSatellites} />
          )}
          {data.flightMode && (
            <StatRow label="Mode" value={data.flightMode.toUpperCase()} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
