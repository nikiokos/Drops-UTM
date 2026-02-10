'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, AlertOctagon, Info, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DroneAlert, AlertSeverity } from '@/store/alerts.store';

interface AlertsPanelProps {
  alerts: DroneAlert[];
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
  className?: string;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const severityConfig: Record<
  AlertSeverity,
  { icon: React.ReactNode; color: string; bgColor: string; borderColor: string }
> = {
  info: {
    icon: <Info className="h-4 w-4" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/30',
  },
  critical: {
    icon: <AlertOctagon className="h-4 w-4" />,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
  },
  emergency: {
    icon: <AlertOctagon className="h-4 w-4" />,
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/50',
  },
};

const alertTypeLabels: Record<string, string> = {
  low_battery: 'Low Battery',
  signal_loss: 'Signal Lost',
  signal_weak: 'Weak Signal',
  geofence_breach: 'Geofence Breach',
  altitude_limit: 'Altitude Limit',
  collision_warning: 'Collision Warning',
  weather_warning: 'Weather Alert',
  system_error: 'System Error',
  communication_lost: 'Comm Lost',
  gps_degraded: 'GPS Degraded',
};

export function AlertsPanel({ alerts, onAcknowledge, onResolve, className }: AlertsPanelProps) {
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle>Alerts</CardTitle>
          </div>
          {unacknowledgedCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-400/20 text-red-400 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              {unacknowledgedCount} NEW
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {activeAlerts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 text-emerald-400/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50 font-mono tracking-wider">
                ALL CLEAR
              </p>
              <p className="text-xs text-muted-foreground/30 mt-0.5">
                No active alerts
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {activeAlerts.map((alert) => {
              const config = severityConfig[alert.severity];
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'rounded border p-2',
                    config.bgColor,
                    config.borderColor,
                    !alert.acknowledged && 'animate-pulse',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn('flex-shrink-0 mt-0.5', config.color)}>
                      {config.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-semibold', config.color)}>
                          {alertTypeLabels[alert.alertType] || alert.alertType}
                        </span>
                        <span className="text-xs text-muted-foreground/50 font-mono">
                          {formatTime(alert.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {!alert.acknowledged && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => onAcknowledge(alert.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => onResolve(alert.id)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
