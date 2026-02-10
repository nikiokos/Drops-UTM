'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { useMissionsStore, Mission, Waypoint, MissionExecution } from '@/store/missions.store';
import { hubsApi, dronesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MissionMapEditor,
  WaypointList,
  WaypointEditor,
  SchedulePicker,
  AltitudeProfile,
  MissionTimeline,
  MissionProgress,
  EditorMode,
} from '@/components/missions';
import {
  ArrowLeft,
  Save,
  MousePointer,
  Plus,
  Pencil,
  Route,
  Loader2,
  Play,
  Pause,
  Square,
  Clock,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Hub {
  id: string;
  name: string;
  location: { latitude: number; longitude: number };
}

interface Drone {
  id: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  registrationNumber: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-600' },
  executing: { label: 'Executing', color: 'bg-green-500/20 text-green-600' },
  paused: { label: 'Paused', color: 'bg-amber-500/20 text-amber-600' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-600' },
  aborted: { label: 'Aborted', color: 'bg-red-500/20 text-red-600' },
  failed: { label: 'Failed', color: 'bg-red-500/20 text-red-600' },
};

export default function MissionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const missionId = params.id as string;

  const {
    selectedMission,
    fetchMission,
    updateMission,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    reorderWaypoints,
    startMission,
    pauseMission,
    resumeMission,
    abortMission,
    scheduleMission,
    fetchExecutions,
    isLoading,
  } = useMissionsStore();

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [executions, setExecutions] = useState<MissionExecution[]>([]);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('select');
  const [defaultAltitude, setDefaultAltitude] = useState(50);
  const [showAbortDialog, setShowAbortDialog] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [droneId, setDroneId] = useState<string>('');
  const [departureHubId, setDepartureHubId] = useState<string>('');
  const [arrivalHubId, setArrivalHubId] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<'manual' | 'scheduled' | 'event_triggered'>('manual');
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchMission(missionId);
    const loadData = async () => {
      const [hubsRes, dronesRes, executionsData] = await Promise.all([
        hubsApi.getAll(),
        dronesApi.getAll(),
        fetchExecutions(missionId),
      ]);
      setHubs(hubsRes.data.data || hubsRes.data || []);
      setDrones(dronesRes.data.data || dronesRes.data || []);
      setExecutions(executionsData);
    };
    loadData();
  }, [missionId, fetchMission, fetchExecutions]);

  useEffect(() => {
    if (selectedMission) {
      setName(selectedMission.name);
      setDescription(selectedMission.description || '');
      setDroneId(selectedMission.droneId || '');
      setDepartureHubId(selectedMission.departureHubId);
      setArrivalHubId(selectedMission.arrivalHubId || '');
      setScheduleType(selectedMission.scheduleType || 'manual');
      setScheduledAt(selectedMission.scheduledAt ? new Date(selectedMission.scheduledAt) : undefined);
    }
  }, [selectedMission]);

  const mission = selectedMission;
  const waypoints = mission?.waypoints || [];
  const isEditable = mission?.status === 'draft';
  const isExecuting = mission?.status === 'executing';
  const isPaused = mission?.status === 'paused';
  const canStart = mission?.status === 'draft' || mission?.status === 'scheduled';
  const canPause = isExecuting;
  const canResume = isPaused;
  const canAbort = isExecuting || isPaused;

  const departureHub = hubs.find((h) => h.id === departureHubId);
  const arrivalHub = hubs.find((h) => h.id === arrivalHubId);
  const statusConfig = STATUS_CONFIG[mission?.status || 'draft'] || STATUS_CONFIG.draft;
  const latestExecution = executions[0];

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!isEditable || (editorMode !== 'add' && editorMode !== 'draw')) return;

      const newWaypoint = await addWaypoint(missionId, {
        sequence: waypoints.length,
        latitude: lat,
        longitude: lng,
        altitude: defaultAltitude,
      });

      if (newWaypoint) {
        setSelectedWaypointId(newWaypoint.id);
      }
    },
    [isEditable, editorMode, missionId, waypoints.length, defaultAltitude, addWaypoint]
  );

  const handleWaypointClick = (waypoint: Waypoint) => {
    setSelectedWaypointId(waypoint.id);
    setEditorMode('select');
  };

  const handleWaypointMove = async (waypointId: string, lat: number, lng: number) => {
    if (!isEditable) return;
    await updateWaypoint(missionId, waypointId, { latitude: lat, longitude: lng });
  };

  const handleWaypointUpdate = async (data: Partial<Waypoint>) => {
    if (!selectedWaypointId || !isEditable) return;
    await updateWaypoint(missionId, selectedWaypointId, data);
    setSelectedWaypointId(null);
  };

  const handleWaypointDelete = async (waypointId: string) => {
    if (!isEditable) return;
    await deleteWaypoint(missionId, waypointId);
    if (selectedWaypointId === waypointId) {
      setSelectedWaypointId(null);
    }
  };

  const handleWaypointReorder = async (waypointIds: string[]) => {
    if (!isEditable) return;
    await reorderWaypoints(missionId, waypointIds);
  };

  const handleSave = async () => {
    await updateMission(missionId, {
      name,
      description: description || undefined,
      droneId: droneId || undefined,
      departureHubId,
      arrivalHubId: arrivalHubId || undefined,
      scheduleType,
      scheduledAt: scheduledAt?.toISOString(),
    });
    setIsDirty(false);
  };

  const handleStart = async () => {
    await startMission(missionId);
  };

  const handlePause = async () => {
    await pauseMission(missionId);
  };

  const handleResume = async () => {
    await resumeMission(missionId);
  };

  const handleAbort = async () => {
    await abortMission(missionId);
    setShowAbortDialog(false);
  };

  const selectedWaypoint = waypoints.find((wp) => wp.id === selectedWaypointId);

  if (!mission) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/missions')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{mission.name}</h1>
              <Badge variant="outline" className={statusConfig.color}>
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {waypoints.length} waypoints • Created {format(new Date(mission.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canStart && (
            <Button onClick={handleStart} disabled={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              Start Mission
            </Button>
          )}
          {canPause && (
            <Button variant="outline" onClick={handlePause} disabled={isLoading}>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          {canResume && (
            <Button onClick={handleResume} disabled={isLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Resume
            </Button>
          )}
          {canAbort && (
            <Button variant="destructive" onClick={() => setShowAbortDialog(true)}>
              <Square className="h-4 w-4 mr-2" />
              Abort
            </Button>
          )}
          {isEditable && (
            <Button onClick={handleSave} disabled={!isDirty || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Map */}
        <div className="flex-1 flex flex-col">
          {/* Editor Mode Toolbar */}
          {isEditable && (
            <div className="flex items-center gap-2 p-2 border-b bg-muted/50">
              <div className="flex items-center gap-1 bg-background rounded-lg p-1">
                <Button
                  variant={editorMode === 'select' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('select')}
                  className="h-8"
                >
                  <MousePointer className="h-4 w-4 mr-1" />
                  Select
                </Button>
                <Button
                  variant={editorMode === 'add' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('add')}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Point
                </Button>
                <Button
                  variant={editorMode === 'draw' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('draw')}
                  className="h-8"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Draw Path
                </Button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-xs">Default Alt:</Label>
                <Input
                  type="number"
                  value={defaultAltitude}
                  onChange={(e) => setDefaultAltitude(parseInt(e.target.value) || 50)}
                  className="w-20 h-8"
                />
                <span className="text-xs text-muted-foreground">m</span>
              </div>
            </div>
          )}

          {/* Execution Progress */}
          {(isExecuting || isPaused) && latestExecution && (
            <div className="p-3 border-b bg-muted/50">
              <MissionProgress execution={latestExecution} />
            </div>
          )}

          {/* Map */}
          <div className="flex-1">
            <MissionMapEditor
              waypoints={waypoints}
              selectedWaypointId={selectedWaypointId}
              mode={isEditable ? editorMode : 'select'}
              departureHub={departureHub}
              arrivalHub={arrivalHub}
              hubs={hubs}
              onWaypointClick={handleWaypointClick}
              onWaypointMove={handleWaypointMove}
              onMapClick={handleMapClick}
              className="h-full"
            />
          </div>

          {/* Altitude Profile */}
          <AltitudeProfile
            waypoints={waypoints}
            selectedWaypointId={selectedWaypointId}
            onWaypointClick={handleWaypointClick}
            className="border-t"
          />
        </div>

        {/* Right Panel - Details */}
        <div className="w-96 border-l bg-card flex flex-col overflow-hidden">
          <Tabs defaultValue="details" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-4 m-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="waypoints">Waypoints</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-auto p-4 space-y-4 m-0">
              <div>
                <Label htmlFor="name">Mission Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Enter mission name"
                  disabled={!isEditable}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Optional description"
                  disabled={!isEditable}
                />
              </div>

              <div>
                <Label htmlFor="drone">Assigned Drone</Label>
                <Select
                  value={droneId}
                  onValueChange={(v) => {
                    setDroneId(v);
                    setIsDirty(true);
                  }}
                  disabled={!isEditable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select drone" />
                  </SelectTrigger>
                  <SelectContent>
                    {drones.map((drone) => (
                      <SelectItem key={drone.id} value={drone.id}>
                        {drone.manufacturer} {drone.model} ({drone.serialNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="departure">Departure Hub</Label>
                <Select
                  value={departureHubId}
                  onValueChange={(v) => {
                    setDepartureHubId(v);
                    setIsDirty(true);
                  }}
                  disabled={!isEditable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select departure hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubs.map((hub) => (
                      <SelectItem key={hub.id} value={hub.id}>
                        {hub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="arrival">Arrival Hub</Label>
                <Select
                  value={arrivalHubId}
                  onValueChange={(v) => {
                    setArrivalHubId(v);
                    setIsDirty(true);
                  }}
                  disabled={!isEditable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Same as departure" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubs.map((hub) => (
                      <SelectItem key={hub.id} value={hub.id}>
                        {hub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="waypoints" className="flex-1 overflow-auto p-4 m-0">
              {selectedWaypoint ? (
                <WaypointEditor
                  waypoint={selectedWaypoint}
                  onSave={handleWaypointUpdate}
                  onCancel={() => setSelectedWaypointId(null)}
                  disabled={!isEditable}
                />
              ) : (
                <WaypointList
                  waypoints={waypoints}
                  selectedWaypointId={selectedWaypointId}
                  onSelect={handleWaypointClick}
                  onDelete={handleWaypointDelete}
                  onReorder={handleWaypointReorder}
                  disabled={!isEditable}
                />
              )}
            </TabsContent>

            <TabsContent value="schedule" className="flex-1 overflow-auto p-4 m-0">
              <SchedulePicker
                scheduleType={scheduleType}
                scheduledAt={scheduledAt}
                onChange={({ scheduleType, scheduledAt }) => {
                  setScheduleType(scheduleType);
                  setScheduledAt(scheduledAt);
                  setIsDirty(true);
                }}
                disabled={!isEditable}
              />
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-auto p-4 m-0">
              {latestExecution ? (
                <MissionTimeline execution={latestExecution} />
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No execution history</p>
                  <p className="text-xs mt-1">Start the mission to see events</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Abort Confirmation Dialog */}
      <Dialog open={showAbortDialog} onOpenChange={setShowAbortDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Abort Mission
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to abort this mission? The drone will enter a safe hover
              state and wait for further instructions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbortDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleAbort}>
              <Square className="h-4 w-4 mr-2" />
              Abort Mission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
