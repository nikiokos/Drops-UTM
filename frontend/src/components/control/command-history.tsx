'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, CheckCircle, XCircle, Loader2, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DroneCommandLog, CommandStatus } from '@/store/commands.store';

interface CommandHistoryProps {
  commands: DroneCommandLog[];
  className?: string;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const statusConfig: Record<
  CommandStatus,
  { icon: React.ReactNode; color: string; label: string }
> = {
  pending: {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: 'text-muted-foreground',
    label: 'Pending',
  },
  sent: {
    icon: <Circle className="h-3.5 w-3.5" />,
    color: 'text-blue-400',
    label: 'Sent',
  },
  acknowledged: {
    icon: <Circle className="h-3.5 w-3.5 fill-current" />,
    color: 'text-blue-400',
    label: 'Acknowledged',
  },
  executing: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: 'text-amber-400',
    label: 'Executing',
  },
  completed: {
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    color: 'text-emerald-400',
    label: 'Completed',
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: 'text-red-400',
    label: 'Failed',
  },
  cancelled: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: 'text-muted-foreground',
    label: 'Cancelled',
  },
};

const commandLabels: Record<string, string> = {
  takeoff: 'Takeoff',
  land: 'Land',
  rtl: 'Return to Launch',
  emergency_stop: 'E-STOP',
  pause: 'Pause',
  hover: 'Hover',
  resume: 'Resume',
};

export function CommandHistory({ commands, className }: CommandHistoryProps) {
  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <CardTitle>Command History</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {commands.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <History className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50 font-mono tracking-wider">
                NO COMMANDS
              </p>
              <p className="text-xs text-muted-foreground/30 mt-0.5">
                Send a command to see history
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {commands.map((cmd) => {
              const config = statusConfig[cmd.status];
              return (
                <div
                  key={cmd.id}
                  className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-accent/30 transition-colors"
                >
                  <span className={cn('flex-shrink-0', config.color)}>{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium truncate">
                        {commandLabels[cmd.commandType] || cmd.commandType}
                      </span>
                      <span className={cn('text-xs font-mono', config.color)}>
                        {config.label}
                      </span>
                    </div>
                    {cmd.message && (
                      <p className="text-xs text-muted-foreground/70 truncate">{cmd.message}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground/50 font-mono flex-shrink-0">
                    {formatTime(cmd.issuedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
