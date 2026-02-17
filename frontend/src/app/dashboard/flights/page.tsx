'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flightsApi, dronesApi, hubsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { FlightStatus, FlightType, OperationMode } from '@drops-utm/shared';
import { toast } from '@/hooks/use-toast';

export default function FlightsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  // Helper to get default departure time (1 hour from now) in datetime-local format
  const getDefaultDeparture = () => {
    const date = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  const [formData, setFormData] = useState({
    droneId: '',
    departureHubId: '',
    arrivalHubId: '',
    flightType: '',
    operationMode: '',
    plannedDeparture: getDefaultDeparture(),
  });

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: flightsResponse, isLoading: flightsLoading } = useQuery({
    queryKey: ['flights'],
    queryFn: () => flightsApi.getAll(),
  });

  // Drones & hubs only needed for the create dialog selectors
  const { data: dronesResponse } = useQuery({
    queryKey: ['drones'],
    queryFn: () => dronesApi.getAll(),
    enabled: dialogOpen,
  });

  const { data: hubsResponse } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => hubsApi.getAll(),
    enabled: dialogOpen,
  });

  // Normalize API responses
  const flightsRaw = flightsResponse?.data;
  const flights: Record<string, unknown>[] = Array.isArray(flightsRaw)
    ? flightsRaw
    : (flightsRaw as Record<string, unknown>)?.data
      ? ((flightsRaw as Record<string, unknown>).data as Record<string, unknown>[])
      : [];

  const dronesRaw = dronesResponse?.data;
  const drones: Record<string, unknown>[] = Array.isArray(dronesRaw)
    ? dronesRaw
    : (dronesRaw as Record<string, unknown>)?.data
      ? ((dronesRaw as Record<string, unknown>).data as Record<string, unknown>[])
      : [];

  const hubsRaw = hubsResponse?.data;
  const hubs: Record<string, unknown>[] = Array.isArray(hubsRaw)
    ? hubsRaw
    : (hubsRaw as Record<string, unknown>)?.data
      ? ((hubsRaw as Record<string, unknown>).data as Record<string, unknown>[])
      : [];

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => flightsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      toast({ title: 'Flight created', description: 'The flight has been created successfully.' });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create flight.',
        variant: 'destructive',
      });
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: (id: string) => flightsApi.authorize(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      toast({ title: 'Flight authorized', description: 'The flight has been authorized.' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to authorize flight.',
        variant: 'destructive',
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => flightsApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      toast({ title: 'Flight started', description: 'The flight has been started.' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to start flight.',
        variant: 'destructive',
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => flightsApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      toast({ title: 'Flight completed', description: 'The flight has been completed.' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to complete flight.',
        variant: 'destructive',
      });
    },
  });

  const abortMutation = useMutation({
    mutationFn: (id: string) => flightsApi.abort(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      toast({ title: 'Flight aborted', description: 'The flight has been aborted.' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to abort flight.',
        variant: 'destructive',
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function resetForm() {
    setFormData({
      droneId: '',
      departureHubId: '',
      arrivalHubId: '',
      flightType: '',
      operationMode: '',
      plannedDeparture: getDefaultDeparture(),
    });
  }

  function handleCreate() {
    // Use form value or fallback to 1 hour from now
    const departure = formData.plannedDeparture
      ? new Date(formData.plannedDeparture).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    createMutation.mutate({
      droneId: formData.droneId,
      departureHubId: formData.departureHubId,
      arrivalHubId: formData.arrivalHubId,
      flightType: formData.flightType,
      operationMode: formData.operationMode,
      plannedDeparture: departure,
    });
  }

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'flightNumber',
      header: 'Flight Number',
      render: (row) => (row.flightNumber as string) ?? '-',
    },
    {
      key: 'droneId',
      header: 'Drone',
      render: (row) => {
        const drone = row.drone as Record<string, unknown> | undefined;
        return drone?.registrationNumber ? (drone.registrationNumber as string) : '-';
      },
    },
    {
      key: 'departureHubId',
      header: 'Departure Hub',
      render: (row) => {
        const hub = row.departureHub as Record<string, unknown> | undefined;
        return hub?.name ? `${hub.name}` : '-';
      },
    },
    {
      key: 'arrivalHubId',
      header: 'Arrival Hub',
      render: (row) => {
        const hub = row.arrivalHub as Record<string, unknown> | undefined;
        return hub?.name ? `${hub.name}` : '-';
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: 'plannedDeparture',
      header: 'Planned Departure',
      render: (row) =>
        row.plannedDeparture ? formatDate(row.plannedDeparture as string) : '-',
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        const status = (row.status as string)?.toLowerCase();
        const id = row.id as string;

        const showAuthorize = status === FlightStatus.PLANNED?.toLowerCase() || status === 'planned';
        const showStart = status === FlightStatus.AUTHORIZED?.toLowerCase() || status === 'authorized';
        const showComplete = status === FlightStatus.ACTIVE?.toLowerCase() || status === 'active';
        const showAbort =
          status === FlightStatus.ACTIVE?.toLowerCase() ||
          status === 'active' ||
          status === FlightStatus.AUTHORIZED?.toLowerCase() ||
          status === 'authorized';

        if (!showAuthorize && !showStart && !showComplete && !showAbort) {
          return null;
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showAuthorize && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    authorizeMutation.mutate(id);
                  }}
                >
                  Authorize
                </DropdownMenuItem>
              )}
              {showStart && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    startMutation.mutate(id);
                  }}
                >
                  Start
                </DropdownMenuItem>
              )}
              {showComplete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    completeMutation.mutate(id);
                  }}
                >
                  Complete
                </DropdownMenuItem>
              )}
              {showAbort && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    abortMutation.mutate(id);
                  }}
                >
                  Abort
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flights"
        description="Manage flight operations"
        action={{ label: 'New Flight', onClick: () => setDialogOpen(true) }}
      />

      <DataTable
        columns={columns}
        data={flights}
        loading={flightsLoading}
        emptyMessage="No flights found."
      />

      {/* New Flight Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Flight</DialogTitle>
            <DialogDescription>Create a new flight operation.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Drone */}
            <div className="space-y-2">
              <label className="text-base font-medium">Drone</label>
              <Select
                value={formData.droneId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, droneId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a drone" />
                </SelectTrigger>
                <SelectContent>
                  {drones.map((drone) => (
                    <SelectItem key={drone.id as string} value={drone.id as string}>
                      {drone.registrationNumber as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Departure Hub */}
            <div className="space-y-2">
              <label className="text-base font-medium">Departure Hub</label>
              <Select
                value={formData.departureHubId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, departureHubId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select departure hub" />
                </SelectTrigger>
                <SelectContent>
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id as string} value={hub.id as string}>
                      {hub.name as string} ({hub.code as string})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Arrival Hub */}
            <div className="space-y-2">
              <label className="text-base font-medium">Arrival Hub</label>
              <Select
                value={formData.arrivalHubId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, arrivalHubId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select arrival hub" />
                </SelectTrigger>
                <SelectContent>
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id as string} value={hub.id as string}>
                      {hub.name as string} ({hub.code as string})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Flight Type */}
            <div className="space-y-2">
              <label className="text-base font-medium">Flight Type</label>
              <Select
                value={formData.flightType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, flightType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select flight type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(FlightType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Operation Mode */}
            <div className="space-y-2">
              <label className="text-base font-medium">Operation Mode</label>
              <Select
                value={formData.operationMode}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, operationMode: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select operation mode" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(OperationMode).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Planned Departure Time */}
            <div className="space-y-2">
              <label className="text-base font-medium">Planned Departure Time</label>
              <Input
                type="datetime-local"
                value={formData.plannedDeparture}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    plannedDeparture: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Flight'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
