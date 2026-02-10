'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useEmergencyStore } from '@/store/emergency.store';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Activity,
  Zap,
  AlertOctagon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SEVERITY_CONFIG = {
  warning: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertTriangle },
  critical: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: ShieldAlert },
  emergency: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertOctagon },
};

const STATUS_CONFIG = {
  active: { color: 'bg-red-500/20 text-red-400', label: 'Active' },
  pending_confirmation: { color: 'bg-amber-500/20 text-amber-400', label: 'Awaiting Confirmation' },
  executing: { color: 'bg-blue-500/20 text-blue-400', label: 'Executing' },
  resolved: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Resolved' },
  escalated: { color: 'bg-purple-500/20 text-purple-400', label: 'Escalated' },
};

export default function EmergencyDashboardPage() {
  const router = useRouter();
  const [changingMode, setChangingMode] = useState(false);

  const {
    mode,
    activeIncidents,
    pendingConfirmations,
    stats,
    fetchMode,
    setMode,
    fetchActiveIncidents,
    fetchPendingConfirmations,
    fetchStats,
    confirmIncident,
  } = useEmergencyStore();

  useEffect(() => {
    fetchMode();
    fetchActiveIncidents();
    fetchPendingConfirmations();
    fetchStats();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchActiveIncidents();
      fetchPendingConfirmations();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchMode, fetchActiveIncidents, fetchPendingConfirmations, fetchStats]);

  const handleModeToggle = async () => {
    setChangingMode(true);
    try {
      await setMode(mode === 'auto' ? 'supervised' : 'auto');
    } finally {
      setChangingMode(false);
    }
  };

  const handleConfirm = async (incidentId: string, approved: boolean) => {
    try {
      await confirmIncident(incidentId, approved);
    } catch {
      // Error handled in store
    }
  };

  const activeCount = activeIncidents.filter(
    (i) => i.status === 'active' || i.status === 'executing'
  ).length;
  const pendingCount = pendingConfirmations.length;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emergency Response</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and respond to drone emergencies in real-time
          </p>
        </div>

        {/* Mode Toggle */}
        <Card className="px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {mode === 'auto' ? (
                <Zap className="h-5 w-5 text-amber-400" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              )}
              <span className="font-medium">
                {mode === 'auto' ? 'Auto Mode' : 'Supervised Mode'}
              </span>
            </div>
            <Switch
              checked={mode === 'auto'}
              onCheckedChange={handleModeToggle}
              disabled={changingMode}
            />
            <span className="text-xs text-muted-foreground max-w-[200px]">
              {mode === 'auto'
                ? 'System executes responses automatically'
                : 'Operator confirms critical actions'}
            </span>
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Emergencies</p>
                <p className="text-3xl font-bold mt-1">{activeCount}</p>
              </div>
              <div className={`p-3 rounded-lg ${activeCount > 0 ? 'bg-red-500/20' : 'bg-muted'}`}>
                <AlertTriangle className={`h-6 w-6 ${activeCount > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Confirmation</p>
                <p className="text-3xl font-bold mt-1">{pendingCount}</p>
              </div>
              <div className={`p-3 rounded-lg ${pendingCount > 0 ? 'bg-amber-500/20' : 'bg-muted'}`}>
                <Clock className={`h-6 w-6 ${pendingCount > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved Today</p>
                <p className="text-3xl font-bold mt-1">
                  {stats?.byStatus.find((s) => s.status === 'resolved')?.count || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-3xl font-bold mt-1">
                  {stats?.avgResponseTimeSeconds
                    ? `${Math.round(stats.avgResponseTimeSeconds)}s`
                    : '--'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Confirmations */}
      {pendingConfirmations.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Clock className="h-5 w-5" />
              Awaiting Your Confirmation ({pendingConfirmations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingConfirmations.map((pending) => {
              const timeoutAt = new Date(pending.timeoutAt);
              const timeLeft = Math.max(0, Math.floor((timeoutAt.getTime() - Date.now()) / 1000));
              const config = SEVERITY_CONFIG[pending.incident.severity];
              const Icon = config.icon;

              return (
                <div
                  key={pending.incidentId}
                  className={`p-4 rounded-lg border ${config.color}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 mt-0.5" />
                      <div>
                        <p className="font-medium">{pending.incident.message}</p>
                        <p className="text-sm opacity-80 mt-1">
                          Drone: {pending.incident.drone?.registrationNumber || pending.incident.droneId}
                          {pending.incident.flight && ` • Flight: ${pending.incident.flight.flightNumber}`}
                        </p>
                        <p className="text-sm mt-2">
                          Recommended: <span className="font-medium">{pending.protocol.responseAction}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-sm font-mono">
                        Timeout: {timeLeft}s
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirm(pending.incidentId, false)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(pending.incidentId, true)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Active Incidents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Incidents</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/emergency/incidents')}
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {activeIncidents.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="h-12 w-12 mx-auto text-emerald-400 mb-4" />
              <p className="text-lg font-medium">All Clear</p>
              <p className="text-sm text-muted-foreground mt-1">
                No active emergencies at this time
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeIncidents.map((incident) => {
                const severityConfig = SEVERITY_CONFIG[incident.severity];
                const statusConfig = STATUS_CONFIG[incident.status];
                const Icon = severityConfig.icon;

                return (
                  <div
                    key={incident.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/emergency/incidents/${incident.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${severityConfig.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{incident.message}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span>
                            {incident.drone?.registrationNumber || incident.droneId}
                          </span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(incident.detectedAt))} ago</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {incident.responseAction && (
                        <Badge variant="outline">{incident.responseAction}</Badge>
                      )}
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push('/dashboard/emergency/incidents')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">Incident History</p>
                <p className="text-sm text-muted-foreground">
                  View all past incidents and investigations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push('/dashboard/emergency/trends')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">Trend Analysis</p>
                <p className="text-sm text-muted-foreground">
                  Analyze patterns and identify issues
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push('/dashboard/emergency/protocols')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">Response Protocols</p>
                <p className="text-sm text-muted-foreground">
                  Configure thresholds and responses
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
