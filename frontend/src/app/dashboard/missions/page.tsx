'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useMissionsStore, Mission } from '@/store/missions.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  MapPin,
  Clock,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Play }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: FileText },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-600', icon: Clock },
  executing: { label: 'Executing', color: 'bg-green-500/20 text-green-600', icon: Play },
  paused: { label: 'Paused', color: 'bg-amber-500/20 text-amber-600', icon: Pause },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-600', icon: CheckCircle },
  aborted: { label: 'Aborted', color: 'bg-red-500/20 text-red-600', icon: XCircle },
  failed: { label: 'Failed', color: 'bg-red-500/20 text-red-600', icon: AlertCircle },
};

export default function MissionsPage() {
  const router = useRouter();
  const { missions, isLoading, fetchMissions } = useMissionsStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const filteredMissions = missions.filter((mission) => {
    const matchesSearch = mission.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || mission.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRowClick = (mission: Mission) => {
    router.push(`/dashboard/missions/${mission.id}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mission Planning</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage automated drone missions
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/missions/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Mission
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search missions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="executing">Executing</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="aborted">Aborted</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredMissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No missions found</h3>
          <p className="text-muted-foreground mt-1">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first mission to get started'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button
              className="mt-4"
              onClick={() => router.push('/dashboard/missions/new')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Mission
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Drone</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Waypoints</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMissions.map((mission) => {
                const statusConfig = STATUS_CONFIG[mission.status] || STATUS_CONFIG.draft;
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow
                    key={mission.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleRowClick(mission)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{mission.name}</div>
                        {mission.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {mission.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {mission.drone ? (
                        `${mission.drone.manufacturer} ${mission.drone.model}`
                      ) : (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{mission.departureHub?.name || '-'}</div>
                        {mission.arrivalHub && (
                          <div className="text-muted-foreground">
                            → {mission.arrivalHub.name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {mission.scheduleType === 'scheduled' && mission.scheduledAt ? (
                        <div className="text-sm">
                          {format(new Date(mission.scheduledAt), 'MMM d, HH:mm')}
                        </div>
                      ) : mission.scheduleType === 'event_triggered' ? (
                        <Badge variant="outline" className="text-xs">
                          Event Triggered
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Manual</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>{mission.waypoints?.length || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(mission.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
