'use client';

import { format } from 'date-fns';
import { MissionExecution } from '@/store/missions.store';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  MapPin,
  AlertTriangle,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface MissionTimelineProps {
  execution: MissionExecution;
  className?: string;
}

const EVENT_ICONS: Record<string, typeof Play> = {
  started: Play,
  paused: Pause,
  resumed: RefreshCw,
  waypoint_reached: MapPin,
  completed: CheckCircle,
  aborted: XCircle,
  failed: AlertTriangle,
  condition_triggered: AlertTriangle,
};

const EVENT_COLORS: Record<string, string> = {
  started: 'bg-green-500',
  paused: 'bg-amber-500',
  resumed: 'bg-blue-500',
  waypoint_reached: 'bg-indigo-500',
  completed: 'bg-green-500',
  aborted: 'bg-red-500',
  failed: 'bg-red-500',
  condition_triggered: 'bg-amber-500',
};

export function MissionTimeline({ execution, className }: MissionTimelineProps) {
  const events = execution.events || [];

  if (events.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground text-sm', className)}>
        No events recorded yet
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {events.map((event, index) => {
        const Icon = EVENT_ICONS[event.type] || Clock;
        const colorClass = EVENT_COLORS[event.type] || 'bg-muted';
        const isLast = index === events.length - 1;

        return (
          <div key={index} className="flex gap-3">
            {/* Timeline line and dot */}
            <div className="flex flex-col items-center">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', colorClass)}>
                <Icon className="h-3 w-3 text-white" />
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-border min-h-[20px]" />
              )}
            </div>

            {/* Event content */}
            <div className="flex-1 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{event.message}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(event.timestamp), 'HH:mm:ss')}
                </span>
              </div>
              {event.data && typeof event.data === 'object' && 'waypointId' in event.data && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <span>Waypoint {(typeof event.data.index === 'number' ? event.data.index : 0) + 1}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compact version for dashboard
export function MissionTimelineCompact({ execution, maxEvents = 5 }: { execution: MissionExecution; maxEvents?: number }) {
  const events = (execution.events || []).slice(-maxEvents).reverse();

  return (
    <div className="space-y-2">
      {events.map((event, index) => {
        const Icon = EVENT_ICONS[event.type] || Clock;
        const colorClass = EVENT_COLORS[event.type] || 'bg-muted';

        return (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', colorClass)}>
              <Icon className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="flex-1 truncate text-muted-foreground">{event.message}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(event.timestamp), 'HH:mm')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Progress indicator
export function MissionProgress({ execution }: { execution: MissionExecution }) {
  const progress = execution.totalWaypoints > 0
    ? Math.round((execution.currentWaypointIndex / execution.totalWaypoints) * 100)
    : 0;

  const statusColor = {
    pending: 'bg-muted',
    in_progress: 'bg-blue-500',
    paused: 'bg-amber-500',
    completed: 'bg-green-500',
    aborted: 'bg-red-500',
    failed: 'bg-red-500',
  }[execution.status] || 'bg-muted';

  const statusLabel = {
    pending: 'Pending',
    in_progress: 'In Progress',
    paused: 'Paused',
    completed: 'Completed',
    aborted: 'Aborted',
    failed: 'Failed',
  }[execution.status] || execution.status;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', statusColor)} />
          <span className="font-medium">{statusLabel}</span>
        </div>
        <span className="text-muted-foreground">
          {execution.currentWaypointIndex} / {execution.totalWaypoints} waypoints
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', statusColor)}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Started: {execution.startedAt ? format(new Date(execution.startedAt), 'HH:mm') : '-'}
        </span>
        {execution.completedAt && (
          <span>
            Completed: {format(new Date(execution.completedAt), 'HH:mm')}
          </span>
        )}
        {execution.status === 'in_progress' && (
          <span>{progress}% complete</span>
        )}
      </div>
    </div>
  );
}
