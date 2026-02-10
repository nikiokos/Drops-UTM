'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conflictsApi } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

export default function ConflictsPage() {
  const queryClient = useQueryClient();
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState({ resolutionStrategy: '', notes: '' });

  const { data: activeData } = useQuery({
    queryKey: ['conflicts-active'],
    queryFn: () => conflictsApi.getActive().then((r) => r.data),
  });

  const { data: allData, isLoading } = useQuery({
    queryKey: ['conflicts'],
    queryFn: () => conflictsApi.getAll().then((r) => r.data),
  });

  const activeConflicts = Array.isArray(activeData) ? activeData : activeData?.data || [];
  const allConflicts = Array.isArray(allData) ? allData : allData?.data || [];
  const resolvedConflicts = allConflicts.filter((c: Record<string, unknown>) => c.status === 'resolved' || c.status === 'false_alarm');

  const resolveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => conflictsApi.resolve(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['conflicts-active'] });
      setResolveId(null);
      setResolution({ resolutionStrategy: '', notes: '' });
      toast({ title: 'Conflict resolved', description: 'The conflict has been marked as resolved' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to resolve conflict', variant: 'destructive' }),
  });

  const severityColor: Record<string, string> = {
    low: 'border-blue-500/30',
    medium: 'border-amber-500/30',
    high: 'border-orange-500/30',
    critical: 'border-red-500/50',
  };

  const resolvedColumns: Column<Record<string, unknown>>[] = [
    { key: 'conflictType', header: 'Type', render: (c) => <StatusBadge status={c.conflictType as string || 'unknown'} /> },
    { key: 'severity', header: 'Severity', render: (c) => <StatusBadge status={c.severity as string} /> },
    { key: 'description', header: 'Description' },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status as string} /> },
    { key: 'detectedAt', header: 'Detected', render: (c) => c.detectedAt ? formatDate(c.detectedAt as string) : '—' },
    { key: 'resolvedAt', header: 'Resolved', render: (c) => c.resolvedAt ? formatDate(c.resolvedAt as string) : '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Conflicts" description="Monitor and resolve airspace conflicts" />

      {activeConflicts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Active Conflicts ({activeConflicts.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {activeConflicts.map((conflict: Record<string, unknown>) => (
              <Card key={conflict.id as string} className={`border-2 ${severityColor[conflict.severity as string] || 'border-red-500/30'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{(conflict.conflictType as string || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</CardTitle>
                    <StatusBadge status={conflict.severity as string} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-base text-muted-foreground">{conflict.description as string || 'No description'}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Detected: {conflict.detectedAt ? formatDate(conflict.detectedAt as string) : '—'}</span>
                    {conflict.separationDistance != null && <span>| Separation: {String(conflict.separationDistance)}m</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={conflict.status as string} />
                    <Button size="sm" onClick={() => setResolveId(conflict.id as string)}>Resolve</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeConflicts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-emerald-500/10 p-3 mb-3">
              <AlertTriangle className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-base font-medium">No Active Conflicts</p>
            <p className="text-sm text-muted-foreground">All clear — no airspace conflicts detected</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Resolved Conflicts</h3>
        <DataTable columns={resolvedColumns} data={resolvedConflicts} loading={isLoading} emptyMessage="No resolved conflicts" />
      </div>

      <Dialog open={!!resolveId} onOpenChange={(v) => { if (!v) setResolveId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Conflict</DialogTitle>
            <DialogDescription>Provide a resolution strategy and notes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-base font-medium">Resolution Strategy</label>
              <Input
                value={resolution.resolutionStrategy}
                onChange={(e) => setResolution((r) => ({ ...r, resolutionStrategy: e.target.value }))}
                placeholder="e.g., Rerouted flight path"
              />
            </div>
            <div className="space-y-2">
              <label className="text-base font-medium">Notes</label>
              <Input
                value={resolution.notes}
                onChange={(e) => setResolution((r) => ({ ...r, notes: e.target.value }))}
                placeholder="Additional details..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveId(null)}>Cancel</Button>
            <Button
              onClick={() => resolveId && resolveMutation.mutate({ id: resolveId, data: resolution })}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve Conflict'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
