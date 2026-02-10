'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useEmergencyStore } from '@/store/emergency.store';
import { AlertTriangle, ShieldAlert, AlertOctagon, X, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SEVERITY_CONFIG = {
  warning: {
    bg: 'bg-amber-500/20 border-amber-500/50',
    text: 'text-amber-400',
    icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-orange-500/20 border-orange-500/50',
    text: 'text-orange-400',
    icon: ShieldAlert,
  },
  emergency: {
    bg: 'bg-red-500/20 border-red-500/50',
    text: 'text-red-400',
    icon: AlertOctagon,
  },
};

export function EmergencyBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { activeIncidents, pendingConfirmations, fetchActiveIncidents, fetchPendingConfirmations } =
    useEmergencyStore();

  useEffect(() => {
    fetchActiveIncidents();
    fetchPendingConfirmations();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchActiveIncidents();
      fetchPendingConfirmations();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchActiveIncidents, fetchPendingConfirmations]);

  // Get the most critical active incident that hasn't been dismissed
  const visibleIncidents = activeIncidents.filter(
    (i) =>
      !dismissed.has(i.id) &&
      (i.status === 'active' || i.status === 'pending_confirmation' || i.status === 'executing')
  );

  // Sort by severity (emergency > critical > warning)
  const sortedIncidents = visibleIncidents.sort((a, b) => {
    const severityOrder = { emergency: 0, critical: 1, warning: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const topIncident = sortedIncidents[0];
  const pendingCount = pendingConfirmations.length;

  if (!topIncident && pendingCount === 0) {
    return null;
  }

  // Show pending confirmation banner if any
  if (pendingCount > 0) {
    const pending = pendingConfirmations[0];
    const config = SEVERITY_CONFIG[pending.incident?.severity] || SEVERITY_CONFIG.warning;
    const Icon = config.icon;
    const timeoutAt = new Date(pending.timeoutAt);
    const timeLeft = Math.max(0, Math.floor((timeoutAt.getTime() - Date.now()) / 1000));

    return (
      <div
        className={`${config.bg} border-b px-4 py-2 flex items-center justify-between animate-pulse`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${config.text}`} />
          <div>
            <span className={`font-medium ${config.text}`}>
              ACTION REQUIRED ({timeLeft}s)
            </span>
            <span className="mx-2 text-muted-foreground">|</span>
            <span className="text-sm">{pending.incident.message}</span>
            {pendingCount > 1 && (
              <span className="text-sm text-muted-foreground ml-2">
                (+{pendingCount - 1} more)
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push('/dashboard/emergency')}
          className={`${config.text} border-current hover:bg-white/10`}
        >
          Respond Now
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    );
  }

  // Show active incident banner
  if (topIncident) {
    const config = SEVERITY_CONFIG[topIncident.severity] || SEVERITY_CONFIG.warning;
    const Icon = config.icon;

    return (
      <div className={`${config.bg} border-b px-4 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${config.text}`} />
          <div>
            <span className={`font-medium ${config.text} uppercase text-sm tracking-wide`}>
              {topIncident.severity}
            </span>
            <span className="mx-2 text-muted-foreground">|</span>
            <span className="text-sm">{topIncident.message}</span>
            <span className="text-sm text-muted-foreground ml-2">
              ({formatDistanceToNow(new Date(topIncident.detectedAt))} ago)
            </span>
            {visibleIncidents.length > 1 && (
              <span className="text-sm text-muted-foreground ml-2">
                (+{visibleIncidents.length - 1} more)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/dashboard/emergency/incidents/${topIncident.id}`)}
            className="text-foreground"
          >
            View Details
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(new Set([...dismissed, topIncident.id]))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
