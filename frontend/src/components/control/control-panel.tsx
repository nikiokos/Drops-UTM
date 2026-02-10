'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plane,
  PlaneLanding,
  Home,
  OctagonX,
  Pause,
  Circle,
  Play,
  Gamepad2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommandType } from '@/store/commands.store';

interface ControlPanelProps {
  droneId: string | null;
  flightId: string | null;
  onCommand: (commandType: CommandType) => Promise<void>;
  pendingCommands: Set<string>;
  className?: string;
}

interface CommandButtonProps {
  icon: React.ReactNode;
  label: string;
  command: CommandType;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  requiresConfirmation?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

function CommandButton({
  icon,
  label,
  variant = 'outline',
  disabled,
  loading,
  onClick,
}: CommandButtonProps) {
  return (
    <Button
      variant={variant}
      className={cn(
        'flex flex-col items-center justify-center h-20 gap-1',
        variant === 'destructive' && 'hover:bg-destructive/90',
      )}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      <span className="text-xs font-mono tracking-wider uppercase">{label}</span>
    </Button>
  );
}

const CRITICAL_COMMANDS: CommandType[] = ['emergency_stop', 'land', 'rtl'];

export function ControlPanel({
  droneId,
  flightId,
  onCommand,
  pendingCommands,
  className,
}: ControlPanelProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    command: CommandType | null;
    title: string;
    description: string;
  }>({
    open: false,
    command: null,
    title: '',
    description: '',
  });
  const [loadingCommand, setLoadingCommand] = useState<CommandType | null>(null);

  const isDisabled = !droneId || !flightId;
  const hasPending = pendingCommands.size > 0;

  const handleCommand = async (command: CommandType) => {
    if (CRITICAL_COMMANDS.includes(command)) {
      const descriptions: Record<string, { title: string; description: string }> = {
        emergency_stop: {
          title: 'Emergency Stop',
          description:
            'This will immediately stop all motors. The drone will fall from the sky. Use only in emergencies when all other options have failed.',
        },
        land: {
          title: 'Initiate Landing',
          description:
            'The drone will begin a controlled descent at the current position. Ensure the landing zone is clear.',
        },
        rtl: {
          title: 'Return to Launch',
          description:
            'The drone will return to its departure hub and land automatically. This may take several minutes.',
        },
      };
      setConfirmDialog({
        open: true,
        command,
        ...descriptions[command],
      });
    } else {
      await executeCommand(command);
    }
  };

  const executeCommand = async (command: CommandType) => {
    setLoadingCommand(command);
    try {
      await onCommand(command);
    } finally {
      setLoadingCommand(null);
    }
  };

  const confirmCriticalCommand = async () => {
    if (confirmDialog.command) {
      setConfirmDialog({ ...confirmDialog, open: false });
      await executeCommand(confirmDialog.command);
    }
  };

  return (
    <>
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <CardTitle>Control Panel</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isDisabled ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <Gamepad2 className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground/50 font-mono tracking-wider">
                  NO DRONE SELECTED
                </p>
                <p className="text-xs text-muted-foreground/30 mt-0.5">
                  Select an active flight to enable controls
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <CommandButton
                icon={<Plane className="h-5 w-5" />}
                label="Takeoff"
                command="takeoff"
                variant="default"
                disabled={hasPending}
                loading={loadingCommand === 'takeoff'}
                onClick={() => handleCommand('takeoff')}
              />
              <CommandButton
                icon={<PlaneLanding className="h-5 w-5" />}
                label="Land"
                command="land"
                variant="secondary"
                requiresConfirmation
                disabled={hasPending}
                loading={loadingCommand === 'land'}
                onClick={() => handleCommand('land')}
              />
              <CommandButton
                icon={<Home className="h-5 w-5" />}
                label="RTH"
                command="rtl"
                variant="secondary"
                requiresConfirmation
                disabled={hasPending}
                loading={loadingCommand === 'rtl'}
                onClick={() => handleCommand('rtl')}
              />
              <CommandButton
                icon={<Pause className="h-5 w-5" />}
                label="Pause"
                command="pause"
                variant="outline"
                disabled={hasPending}
                loading={loadingCommand === 'pause'}
                onClick={() => handleCommand('pause')}
              />
              <CommandButton
                icon={<Circle className="h-5 w-5" />}
                label="Hover"
                command="hover"
                variant="outline"
                disabled={hasPending}
                loading={loadingCommand === 'hover'}
                onClick={() => handleCommand('hover')}
              />
              <CommandButton
                icon={<Play className="h-5 w-5" />}
                label="Resume"
                command="resume"
                variant="outline"
                disabled={hasPending}
                loading={loadingCommand === 'resume'}
                onClick={() => handleCommand('resume')}
              />
              <div className="col-span-3">
                <CommandButton
                  icon={<OctagonX className="h-5 w-5" />}
                  label="Emergency Stop"
                  command="emergency_stop"
                  variant="destructive"
                  requiresConfirmation
                  disabled={false} // Emergency stop always enabled
                  loading={loadingCommand === 'emergency_stop'}
                  onClick={() => handleCommand('emergency_stop')}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className={cn(
                confirmDialog.command === 'emergency_stop' && 'text-destructive',
              )}
            >
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Cancel
            </Button>
            <Button
              variant={confirmDialog.command === 'emergency_stop' ? 'destructive' : 'default'}
              onClick={confirmCriticalCommand}
            >
              Confirm {confirmDialog.command === 'emergency_stop' ? 'E-STOP' : confirmDialog.command?.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
