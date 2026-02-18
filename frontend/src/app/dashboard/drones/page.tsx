'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { CommunicationProtocol } from '@drops-utm/shared';
import { dronesApi, hubsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type DroneRecord = Record<string, unknown>;
type HubRecord = Record<string, unknown>;

const PROTOCOL_LABELS: Record<string, string> = {
  [CommunicationProtocol.MAVLINK]: 'MAVLink',
  [CommunicationProtocol.DJI_SDK]: 'DJI SDK',
  [CommunicationProtocol.CUSTOM_API]: 'Custom API',
};

const defaultForm = {
  registrationNumber: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  homeHubId: '',
  communicationProtocol: '',
};

export default function DronesPage() {
  const queryClient = useQueryClient();
  const { canCreateDrone, canEditDrone, canDeleteDrone } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDrone, setEditingDrone] = useState<DroneRecord | null>(null);
  const [form, setForm] = useState(defaultForm);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const { data: dronesData, isLoading: dronesLoading } = useQuery({
    queryKey: ['drones'],
    queryFn: () => dronesApi.getAll(),
    placeholderData: keepPreviousData,
  });

  // Hubs only needed for the create/edit dialog selectors
  const { data: hubsData } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => hubsApi.getAll(),
    enabled: dialogOpen,
  });

  const drones: DroneRecord[] = (() => {
    const d = dronesData?.data;
    return Array.isArray(d) ? d : (d as Record<string, unknown>)?.data as DroneRecord[] || [];
  })();

  const hubs: HubRecord[] = (() => {
    const h = hubsData?.data;
    return Array.isArray(h) ? h : (h as Record<string, unknown>)?.data as HubRecord[] || [];
  })();

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => dronesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drones'] });
      toast({ title: 'Drone registered', description: 'The drone has been successfully registered.' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to register drone.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      dronesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drones'] });
      toast({ title: 'Drone updated', description: 'The drone has been successfully updated.' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update drone.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dronesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drones'] });
      toast({ title: 'Drone deleted', description: 'The drone has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete drone.', variant: 'destructive' });
    },
  });

  // ---------------------------------------------------------------------------
  // Dialog helpers
  // ---------------------------------------------------------------------------
  function openCreateDialog() {
    setEditingDrone(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEditDialog(drone: DroneRecord) {
    setEditingDrone(drone);
    setForm({
      registrationNumber: (drone.registrationNumber as string) || '',
      manufacturer: (drone.manufacturer as string) || '',
      model: (drone.model as string) || '',
      serialNumber: (drone.serialNumber as string) || '',
      homeHubId: (drone.homeHubId as string) || '',
      communicationProtocol: (drone.communicationProtocol as string) || '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingDrone(null);
    setForm(defaultForm);
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = { ...form };
    if (editingDrone) {
      updateMutation.mutate({ id: editingDrone.id as string, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleDelete(drone: DroneRecord) {
    if (confirm('Are you sure you want to delete this drone? This action cannot be undone.')) {
      deleteMutation.mutate(drone.id as string);
    }
  }

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------
  const columns: Column<DroneRecord>[] = [
    {
      key: 'registrationNumber',
      header: 'Registration',
      render: (drone) => (
        <span className="font-mono font-medium">
          {(drone.registrationNumber as string) || '\u2014'}
        </span>
      ),
    },
    {
      key: 'manufacturer',
      header: 'Manufacturer',
    },
    {
      key: 'model',
      header: 'Model',
    },
    {
      key: 'homeHubId',
      header: 'Home Hub',
      render: (drone) => {
        const hub = drone.homeHub as HubRecord | undefined;
        if (!hub) return '\u2014';
        return `${hub.name as string} (${hub.code as string})`;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (drone) =>
        drone.status ? <StatusBadge status={drone.status as string} /> : '\u2014',
    },
    {
      key: 'totalFlightHours',
      header: 'Flight Hours',
      render: (drone) => {
        const hours = drone.totalFlightHours;
        return typeof hours === 'number' ? hours : '\u2014';
      },
    },
    ...(canEditDrone || canDeleteDrone
      ? [
          {
            key: 'actions',
            header: '',
            render: (drone: DroneRecord) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEditDrone && (
                    <DropdownMenuItem onClick={() => openEditDialog(drone)}>
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canEditDrone && canDeleteDrone && <DropdownMenuSeparator />}
                  {canDeleteDrone && (
                    <DropdownMenuItem
                      className="text-red-400 focus:text-red-400"
                      onClick={() => handleDelete(drone)}
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } as Column<DroneRecord>,
        ]
      : []),
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drones"
        description="Manage drone fleet"
        action={canCreateDrone ? { label: 'Register Drone', onClick: openCreateDialog } : undefined}
      />

      <DataTable
        columns={columns}
        data={drones}
        loading={dronesLoading}
        emptyMessage="No drones registered yet."
      />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDrone ? 'Edit Drone' : 'Register Drone'}</DialogTitle>
            <DialogDescription>
              {editingDrone
                ? 'Update the drone details below.'
                : 'Fill in the details to register a new drone.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-base font-medium">Registration Number</label>
              <Input
                placeholder="e.g. DRN-001"
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-base font-medium">Manufacturer</label>
                <Input
                  placeholder="e.g. DJI"
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-base font-medium">Model</label>
                <Input
                  placeholder="e.g. Matrice 300 RTK"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-base font-medium">Serial Number</label>
              <Input
                placeholder="e.g. SN-12345678"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-base font-medium">Home Hub</label>
              <Select
                value={form.homeHubId}
                onValueChange={(value) => setForm({ ...form, homeHubId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a hub" />
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

            <div className="grid gap-2">
              <label className="text-base font-medium">Communication Protocol</label>
              <Select
                value={form.communicationProtocol}
                onValueChange={(value) => setForm({ ...form, communicationProtocol: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select protocol" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CommunicationProtocol).map((protocol) => (
                    <SelectItem key={protocol} value={protocol}>
                      {PROTOCOL_LABELS[protocol] || protocol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving
                ? 'Saving...'
                : editingDrone
                  ? 'Save Changes'
                  : 'Register Drone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
