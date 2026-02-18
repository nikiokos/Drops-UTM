'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { hubsApi } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { MapView, MarkerData, CircleData } from '@/components/shared/map-view';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';

const statusColorMap: Record<string, string> = {
  active: 'green',
  maintenance: 'amber',
  offline: 'red',
};

const defaultFormState: Record<string, unknown> = {
  code: '',
  name: '',
  latitude: '',
  longitude: '',
  airspaceRadius: 5000,
  airspaceCeiling: 400,
  airspaceFloor: 0,
  timezone: 'UTC',
};

export default function HubsPage() {
  const queryClient = useQueryClient();
  const { canCreateHub, canEditHub, canDeleteHub } = usePermissions();
  const [selectedHub, setSelectedHub] = useState<Record<string, unknown> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({ ...defaultFormState });

  const { data, isLoading } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => hubsApi.getAll().then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const hubList: Record<string, unknown>[] = Array.isArray(data) ? data : (data as unknown as Record<string, unknown>)?.data as Record<string, unknown>[] || [];

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => hubsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      toast({ title: 'Hub created', description: 'The hub has been created successfully.' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create hub.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      hubsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      toast({ title: 'Hub updated', description: 'The hub has been updated successfully.' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update hub.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hubsApi.delete(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      toast({ title: 'Hub deleted', description: 'The hub has been deleted successfully.' });
      if (selectedHub && selectedHub.id === deletedId) {
        setSelectedHub(null);
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete hub.', variant: 'destructive' });
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingHub(null);
    setFormData({ ...defaultFormState });
  }

  function openCreateDialog() {
    setEditingHub(null);
    setFormData({ ...defaultFormState });
    setDialogOpen(true);
  }

  function openEditDialog(hub: Record<string, unknown>) {
    setEditingHub(hub);
    const loc = hub.location as Record<string, unknown> | undefined;
    setFormData({
      code: hub.code ?? '',
      name: hub.name ?? '',
      latitude: loc?.latitude ?? '',
      longitude: loc?.longitude ?? '',
      airspaceRadius: hub.airspaceRadius ?? 5000,
      airspaceCeiling: hub.airspaceCeiling ?? 400,
      airspaceFloor: hub.airspaceFloor ?? 0,
      timezone: hub.timezone ?? 'UTC',
    });
    setDialogOpen(true);
  }

  function handleDelete(hub: Record<string, unknown>) {
    const confirmed = confirm(`Are you sure you want to delete hub "${hub.name}"?`);
    if (confirmed) {
      deleteMutation.mutate(hub.id as string);
    }
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      code: formData.code,
      name: formData.name,
      location: {
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
      },
      airspaceRadius: Number(formData.airspaceRadius),
      airspaceCeiling: Number(formData.airspaceCeiling),
      airspaceFloor: Number(formData.airspaceFloor),
      timezone: formData.timezone,
    };

    if (editingHub) {
      updateMutation.mutate({ id: editingHub.id as string, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function updateField(field: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'code',
      header: 'Code',
    },
    {
      key: 'name',
      header: 'Name',
    },
    {
      key: 'status',
      header: 'Status',
      render: (hub) => <StatusBadge status={hub.status as string} />,
    },
    {
      key: 'maxSimultaneousDrones',
      header: 'Max Drones',
    },
    {
      key: 'airspaceRadius',
      header: 'Airspace Radius',
      render: (hub) => <span>{String(hub.airspaceRadius)}m</span>,
    },
    ...(canEditHub || canDeleteHub
      ? [
          {
            key: 'actions',
            header: '',
            render: (hub: Record<string, unknown>) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEditHub && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(hub);
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canEditHub && canDeleteHub && <DropdownMenuSeparator />}
                  {canDeleteHub && (
                    <DropdownMenuItem
                      className="text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(hub);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } as Column<Record<string, unknown>>,
        ]
      : []),
  ];

  const markers: MarkerData[] = hubList
    .filter((hub) => {
      const loc = hub.location as Record<string, unknown> | undefined;
      return loc?.latitude != null && loc?.longitude != null;
    })
    .map((hub) => {
      const loc = hub.location as Record<string, unknown>;
      return {
        id: String(hub.id),
        position: [Number(loc.latitude), Number(loc.longitude)] as [number, number],
        label: (hub.name as string) || (hub.code as string) || 'Hub',
        color: statusColorMap[(hub.status as string)?.toLowerCase()] || 'gray',
      };
    });

  const hubCircles: CircleData[] = hubList
    .filter((hub) => {
      const loc = hub.location as Record<string, unknown> | undefined;
      return loc?.latitude != null && loc?.longitude != null && hub.airspaceRadius;
    })
    .map((hub) => {
      const loc = hub.location as Record<string, unknown>;
      const status = (hub.status as string)?.toLowerCase();
      const color = status === 'active' ? '#10b981' : status === 'maintenance' ? '#f59e0b' : '#6b7280';
      return {
        id: `${hub.id}-radius`,
        center: [Number(loc.latitude), Number(loc.longitude)] as [number, number],
        radius: Number(hub.airspaceRadius),
        color,
        fillColor: color,
        fillOpacity: 0.06,
        weight: 1,
        label: `${hub.name} — ${hub.airspaceRadius}m radius`,
      };
    });

  const mapCenter: [number, number] = selectedHub
    ? (() => {
        const loc = selectedHub.location as Record<string, unknown> | undefined;
        return loc ? [Number(loc.latitude), Number(loc.longitude)] as [number, number] : [38.5, 23.8] as [number, number];
      })()
    : [38.5, 23.8];

  const mapZoom = selectedHub ? 14 : 6;

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hubs"
        description="Manage vertiport locations"
        action={canCreateHub ? { label: 'Add Hub', onClick: openCreateDialog } : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <DataTable
              columns={columns}
              data={hubList}
              loading={isLoading}
              emptyMessage="No hubs found. Create one to get started."
              onRowClick={(hub) => setSelectedHub(hub)}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <MapView
              center={mapCenter}
              zoom={mapZoom}
              markers={markers}
              circles={hubCircles}
              className="h-[600px] w-full rounded-md"
            />
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingHub ? 'Edit Hub' : 'Add Hub'}</DialogTitle>
            <DialogDescription>
              {editingHub
                ? 'Update the hub details below.'
                : 'Fill in the details to create a new hub.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="code" className="text-base font-medium">
                Code
              </label>
              <Input
                id="code"
                placeholder="HUB-001"
                value={String(formData.code ?? '')}
                onChange={(e) => updateField('code', e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="name" className="text-base font-medium">
                Name
              </label>
              <Input
                id="name"
                placeholder="Hub name"
                value={String(formData.name ?? '')}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="latitude" className="text-base font-medium">
                  Latitude
                </label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="37.9838"
                  value={String(formData.latitude ?? '')}
                  onChange={(e) => updateField('latitude', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="longitude" className="text-base font-medium">
                  Longitude
                </label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="23.7275"
                  value={String(formData.longitude ?? '')}
                  onChange={(e) => updateField('longitude', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <label htmlFor="airspaceRadius" className="text-base font-medium">
                  Radius (m)
                </label>
                <Input
                  id="airspaceRadius"
                  type="number"
                  value={String(formData.airspaceRadius ?? 5000)}
                  onChange={(e) => updateField('airspaceRadius', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="airspaceCeiling" className="text-base font-medium">
                  Ceiling (m)
                </label>
                <Input
                  id="airspaceCeiling"
                  type="number"
                  value={String(formData.airspaceCeiling ?? 400)}
                  onChange={(e) => updateField('airspaceCeiling', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="airspaceFloor" className="text-base font-medium">
                  Floor (m)
                </label>
                <Input
                  id="airspaceFloor"
                  type="number"
                  value={String(formData.airspaceFloor ?? 0)}
                  onChange={(e) => updateField('airspaceFloor', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="timezone" className="text-base font-medium">
                Timezone
              </label>
              <Input
                id="timezone"
                placeholder="UTC"
                value={String(formData.timezone ?? 'UTC')}
                onChange={(e) => updateField('timezone', e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingHub ? 'Update Hub' : 'Create Hub'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
