'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEmergencyStore } from '@/store/emergency.store';
import { emergencyApi, ResponseAction } from '@/lib/api';
import {
  AlertTriangle,
  ShieldAlert,
  AlertOctagon,
  Clock,
  Plane,
  MapPin,
  Check,
  X,
  Loader2,
} from 'lucide-react';

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

const ACTION_LABELS: Record<ResponseAction, string> = {
  RTH: 'Return to Home',
  LAND: 'Land Immediately',
  HOVER: 'Hover in Place',
  DIVERT: 'Divert to Safe Zone',
  DESCEND: 'Descend Altitude',
  CLIMB: 'Climb Altitude',
  ESTOP: 'Emergency Stop',
  NONE: 'No Action Required',
};

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmergencyConfirmationModal({ open, onOpenChange }: ConfirmationModalProps) {
  const { pendingConfirmations, fetchPendingConfirmations } = useEmergencyStore();
  const [loading, setLoading] = useState<'confirm' | 'reject' | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const pending = pendingConfirmations[0];

  // Countdown timer
  useEffect(() => {
    if (!pending) return;

    const updateTimer = () => {
      const timeout = new Date(pending.timeoutAt).getTime();
      const remaining = Math.max(0, Math.floor((timeout - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pending]);

  const handleConfirm = async () => {
    if (!pending) return;
    setLoading('confirm');
    try {
      await emergencyApi.confirmIncident(pending.incident.id, true);
      await fetchPendingConfirmations();
      if (pendingConfirmations.length <= 1) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to confirm action:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!pending) return;
    setLoading('reject');
    try {
      await emergencyApi.confirmIncident(pending.incident.id, false);
      await fetchPendingConfirmations();
      if (pendingConfirmations.length <= 1) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to reject action:', error);
    } finally {
      setLoading(null);
    }
  };

  if (!pending) return null;

  const config = SEVERITY_CONFIG[pending.incident.severity];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md w-fit ${config.bg}`}>
            <Icon className={`h-4 w-4 ${config.text}`} />
            <span className={`text-sm font-semibold uppercase tracking-wide ${config.text}`}>
              {pending.incident.severity}
            </span>
          </div>
          <DialogTitle className="mt-3">Emergency Response Required</DialogTitle>
          <DialogDescription className="text-base">
            {pending.incident.message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Incident Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Plane className="h-4 w-4" />
              <span>Drone:</span>
              <span className="text-foreground font-medium">
                {pending.incident.drone?.registrationNumber || pending.incident.droneId.slice(0, 8)}
              </span>
            </div>
            {pending.incident.flight && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Flight:</span>
                <span className="text-foreground font-medium">
                  {pending.incident.flight.flightNumber || 'N/A'}
                </span>
              </div>
            )}
          </div>

          {/* Proposed Action */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-2">Proposed Action:</p>
            <p className="text-lg font-semibold">
              {ACTION_LABELS[pending.protocol.responseAction] || pending.protocol.responseAction}
            </p>
            {pending.incident.emergencyType === 'battery_critical' && (
              <p className="text-sm text-muted-foreground mt-2">
                Battery level critical. Immediate landing recommended to prevent crash.
              </p>
            )}
            {pending.incident.emergencyType === 'signal_lost' && (
              <p className="text-sm text-muted-foreground mt-2">
                Signal lost. Automatic return to launch will be initiated.
              </p>
            )}
            {pending.incident.emergencyType === 'geofence_breach' && (
              <p className="text-sm text-muted-foreground mt-2">
                Drone has breached geofence boundary. Course correction required.
              </p>
            )}
          </div>

          {/* Timeout Warning */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            timeLeft <= 10 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              Auto-execute in {timeLeft}s if no response
            </span>
          </div>

          {pendingConfirmations.length > 1 && (
            <p className="text-sm text-muted-foreground text-center">
              +{pendingConfirmations.length - 1} more pending confirmations
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={loading !== null}
            className="flex-1"
          >
            {loading === 'reject' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <X className="h-4 w-4 mr-2" />
            )}
            Override
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading !== null}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {loading === 'confirm' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Confirm Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
