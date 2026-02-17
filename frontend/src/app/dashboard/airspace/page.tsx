'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { airspaceApi, hubsApi } from '@/lib/api';
import { ZoneType, ZoneStatus } from '@drops-utm/shared';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

export default function AirspacePage() {
  const queryClient = useQueryClient();
  const { canCreateAirspaceZone, canDeleteAirspaceZone } = usePermissions();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    zoneType: ZoneType.CONTROLLED,
    hubId: '',
    altitudeFloor: 0,
    altitudeCeiling: 400,
    priority: 1,
  });

  const { data: zonesData, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => airspaceApi.getZones().then((r) => r.data),
  });

  const { data: hubsData } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => hubsApi.getAll().then((r) => r.data),
  });

  const zones = Array.isArray(zonesData) ? zonesData : zonesData?.data || [];
  const hubs = Array.isArray(hubsData) ? hubsData : hubsData?.data || [];
  const hubMap = new Map(hubs.map((h: Record<string, unknown>) => [h.id, h]));

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => airspaceApi.createZone(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setOpen(false);
      setForm({ name: '', zoneType: ZoneType.CONTROLLED, hubId: '', altitudeFloor: 0, altitudeCeiling: 400, priority: 1 });
      toast({ title: 'Zone created', description: 'Airspace zone has been created' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create zone', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => airspaceApi.deleteZone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast({ title: 'Zone deleted' });
    },
  });

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'name', header: 'Name' },
    { key: 'zoneType', header: 'Type', render: (z) => <StatusBadge status={z.zoneType as string} /> },
    { key: 'hubId', header: 'Hub', render: (z) => {
      const hub = hubMap.get(z.hubId as string) as Record<string, unknown> | undefined;
      return hub ? (hub.name as string) : '—';
    }},
    { key: 'altitudeFloor', header: 'Floor (m)', render: (z) => `${z.altitudeFloor ?? 0}m` },
    { key: 'altitudeCeiling', header: 'Ceiling (m)', render: (z) => `${z.altitudeCeiling ?? 0}m` },
    { key: 'status', header: 'Status', render: (z) => <StatusBadge status={z.status as string} /> },
    { key: 'priority', header: 'Priority' },
    ...(canDeleteAirspaceZone
      ? [
          {
            key: 'actions',
            header: '',
            render: (z: Record<string, unknown>) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => { if (confirm('Delete this zone?')) deleteMutation.mutate(z.id as string); }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } as Column<Record<string, unknown>>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Airspace" description="Manage airspace zones" action={canCreateAirspaceZone ? { label: 'Create Zone', onClick: () => setOpen(true) } : undefined} />
      <DataTable columns={columns} data={zones} loading={isLoading} emptyMessage="No airspace zones defined" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Airspace Zone</DialogTitle>
            <DialogDescription>Define a new airspace zone</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-base font-medium">Name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Zone Alpha" />
            </div>
            <div className="space-y-2">
              <label className="text-base font-medium">Zone Type</label>
              <Select value={form.zoneType} onValueChange={(v) => setForm((f) => ({ ...f, zoneType: v as ZoneType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(ZoneType).map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-base font-medium">Hub</label>
              <Select value={form.hubId} onValueChange={(v) => setForm((f) => ({ ...f, hubId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select hub" /></SelectTrigger>
                <SelectContent>
                  {hubs.map((h: Record<string, unknown>) => (
                    <SelectItem key={h.id as string} value={h.id as string}>{h.name as string} ({h.code as string})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-base font-medium">Altitude Floor (m)</label>
                <Input type="number" value={form.altitudeFloor} onChange={(e) => setForm((f) => ({ ...f, altitudeFloor: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-base font-medium">Altitude Ceiling (m)</label>
                <Input type="number" value={form.altitudeCeiling} onChange={(e) => setForm((f) => ({ ...f, altitudeCeiling: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-base font-medium">Priority</label>
              <Input type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} min={1} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Zone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
