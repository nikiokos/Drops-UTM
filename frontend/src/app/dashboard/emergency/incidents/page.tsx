'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmergencyStore } from '@/store/emergency.store';
import { EmergencySeverity, EmergencyType } from '@/lib/api';
import {
  AlertTriangle,
  ShieldAlert,
  AlertOctagon,
  ChevronRight,
  Search,
  Filter,
  ChevronLeft,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const SEVERITY_CONFIG = {
  warning: { color: 'bg-amber-500/20 text-amber-400', icon: AlertTriangle },
  critical: { color: 'bg-orange-500/20 text-orange-400', icon: ShieldAlert },
  emergency: { color: 'bg-red-500/20 text-red-400', icon: AlertOctagon },
};

const STATUS_CONFIG = {
  active: { color: 'bg-red-500/20 text-red-400', label: 'Active' },
  pending_confirmation: { color: 'bg-amber-500/20 text-amber-400', label: 'Pending' },
  executing: { color: 'bg-blue-500/20 text-blue-400', label: 'Executing' },
  resolved: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Resolved' },
  escalated: { color: 'bg-purple-500/20 text-purple-400', label: 'Escalated' },
};

const EMERGENCY_TYPES: { value: EmergencyType; label: string }[] = [
  { value: 'battery_low', label: 'Battery Low' },
  { value: 'battery_critical', label: 'Battery Critical' },
  { value: 'signal_weak', label: 'Signal Weak' },
  { value: 'signal_lost', label: 'Signal Lost' },
  { value: 'geofence_warning', label: 'Geofence Warning' },
  { value: 'geofence_breach', label: 'Geofence Breach' },
  { value: 'collision_aircraft', label: 'Aircraft Proximity' },
  { value: 'collision_obstacle', label: 'Obstacle Detected' },
  { value: 'gps_degraded', label: 'GPS Degraded' },
  { value: 'motor_anomaly', label: 'Motor Anomaly' },
];

const PAGE_SIZE = 20;

export default function IncidentsListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<EmergencySeverity | ''>('');
  const [typeFilter, setTypeFilter] = useState<EmergencyType | ''>('');
  const [page, setPage] = useState(0);

  const { incidents, incidentsTotal, loading, fetchIncidents } = useEmergencyStore();

  useEffect(() => {
    fetchIncidents({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      type: typeFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
  }, [fetchIncidents, statusFilter, severityFilter, typeFilter, page]);

  const totalPages = Math.ceil(incidentsTotal / PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {incidentsTotal} total incidents
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending_confirmation">Pending</SelectItem>
                <SelectItem value="executing">Executing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter || 'all'} onValueChange={(v) => setSeverityFilter(v === 'all' ? '' : v as EmergencySeverity)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v as EmergencyType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EMERGENCY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(statusFilter || severityFilter || typeFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('');
                  setSeverityFilter('');
                  setTypeFilter('');
                  setPage(0);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Incidents List */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No incidents found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((incident) => {
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
                          <span>{incident.drone?.registrationNumber || incident.droneId}</span>
                          <span>•</span>
                          <span>{format(new Date(incident.detectedAt), 'PPp')}</span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, incidentsTotal)} of {incidentsTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
