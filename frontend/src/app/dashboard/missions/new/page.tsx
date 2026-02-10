'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMissionsStore, Waypoint } from '@/store/missions.store';
import { hubsApi, dronesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MissionMapEditor,
  WaypointList,
  WaypointEditor,
  SchedulePicker,
  AltitudeProfile,
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

type LocalWaypoint = Omit<Waypoint, 'id' | 'missionId' | 'createdAt' | 'updatedAt'> & {
  tempId: string;
};

export default function NewMissionPage() {
  const router = useRouter();
  const { createMission, addWaypoint, isLoading } = useMissionsStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [droneId, setDroneId] = useState<string>('');
  const [departureHubId, setDepartureHubId] = useState<string>('');
  const [arrivalHubId, setArrivalHubId] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<'manual' | 'scheduled' | 'event_triggered'>('manual');
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [triggerConditions, setTriggerConditions] = useState<Array<{ type: string }>>([]);

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [waypoints, setWaypoints] = useState<LocalWaypoint[]>([]);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('add');
  const [defaultAltitude, setDefaultAltitude] = useState(50);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hubsRes, dronesRes] = await Promise.all([
          hubsApi.getAll(),
          dronesApi.getAll(),
        ]);
        setHubs(hubsRes.data.data || hubsRes.data || []);
        setDrones(dronesRes.data.data || dronesRes.data || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  const departureHub = hubs.find((h) => h.id === departureHubId);
  const arrivalHub = hubs.find((h) => h.id === arrivalHubId);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (editorMode !== 'add' && editorMode !== 'draw') return;

      const newWaypoint: LocalWaypoint = {
        tempId: `temp-${Date.now()}`,
        sequence: waypoints.length,
        latitude: lat,
        longitude: lng,
        altitude: defaultAltitude,
        actions: [],
        conditions: [],
      };

      setWaypoints((prev) => [...prev, newWaypoint]);
      setSelectedWaypointId(newWaypoint.tempId);
    },
    [editorMode, waypoints.length, defaultAltitude]
  );

  const handleWaypointClick = (waypoint: LocalWaypoint | Waypoint) => {
    const id = 'tempId' in waypoint ? waypoint.tempId : waypoint.id;
    setSelectedWaypointId(id);
    setEditorMode('select');
  };

  const handleWaypointMove = (waypointId: string, lat: number, lng: number) => {
    setWaypoints((prev) =>
      prev.map((wp) =>
        wp.tempId === waypointId ? { ...wp, latitude: lat, longitude: lng } : wp
      )
    );
  };

  const handleWaypointUpdate = (data: Partial<Waypoint>) => {
    if (!selectedWaypointId) return;
    setWaypoints((prev) =>
      prev.map((wp) =>
        wp.tempId === selectedWaypointId ? { ...wp, ...data } : wp
      )
    );
    setSelectedWaypointId(null);
  };

  const handleWaypointDelete = (waypointId: string) => {
    setWaypoints((prev) => {
      const filtered = prev.filter((wp) => wp.tempId !== waypointId);
      return filtered.map((wp, index) => ({ ...wp, sequence: index }));
    });
    if (selectedWaypointId === waypointId) {
      setSelectedWaypointId(null);
    }
  };

  const handleWaypointReorder = (waypointIds: string[]) => {
    setWaypoints((prev) => {
      const reordered = waypointIds
        .map((id) => prev.find((wp) => wp.tempId === id))
        .filter(Boolean) as LocalWaypoint[];
      return reordered.map((wp, index) => ({ ...wp, sequence: index }));
    });
  };

  const handleHubSelect = (hubId: string, type: 'departure' | 'arrival') => {
    if (type === 'departure') {
      setDepartureHubId(hubId);
    } else {
      setArrivalHubId(hubId);
    }
  };

  const handleSave = async () => {
    if (!name || !departureHubId) return;

    const mission = await createMission({
      name,
      description: description || undefined,
      droneId: droneId || undefined,
      departureHubId,
      arrivalHubId: arrivalHubId || undefined,
      scheduleType,
      scheduledAt: scheduledAt?.toISOString(),
      triggerConditions: triggerConditions.length > 0 ? { conditions: triggerConditions } : undefined,
    });

    if (mission) {
      // Add waypoints
      for (const wp of waypoints) {
        await addWaypoint(mission.id, {
          sequence: wp.sequence,
          name: wp.name,
          latitude: wp.latitude,
          longitude: wp.longitude,
          altitude: wp.altitude,
          speedToWaypoint: wp.speedToWaypoint,
          headingAtWaypoint: wp.headingAtWaypoint,
          turnRadius: wp.turnRadius,
          actions: wp.actions,
          conditions: wp.conditions,
          hoverDuration: wp.hoverDuration,
          waitForConfirmation: wp.waitForConfirmation,
        });
      }

      router.push(`/dashboard/missions/${mission.id}`);
    }
  };

  const selectedWaypoint = waypoints.find((wp) => wp.tempId === selectedWaypointId);

  const displayWaypoints = waypoints.map((wp) => ({
    ...wp,
    id: wp.tempId,
    missionId: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })) as Waypoint[];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">New Mission</h1>
            <p className="text-sm text-muted-foreground">
              Create a new automated drone mission
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !departureHubId || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Mission
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Map */}
        <div className="flex-1 flex flex-col">
          {/* Editor Mode Toolbar */}
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
              <Button
                variant={editorMode === 'hub-to-hub' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setEditorMode('hub-to-hub')}
                className="h-8"
              >
                <Route className="h-4 w-4 mr-1" />
                Hub-to-Hub
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

          {/* Map */}
          <div className="flex-1">
            <MissionMapEditor
              waypoints={displayWaypoints}
              selectedWaypointId={selectedWaypointId}
              mode={editorMode}
              departureHub={departureHub}
              arrivalHub={arrivalHub}
              hubs={hubs}
              onWaypointClick={handleWaypointClick}
              onWaypointMove={handleWaypointMove}
              onMapClick={handleMapClick}
              onHubSelect={handleHubSelect}
              className="h-full"
            />
          </div>

          {/* Altitude Profile */}
          <AltitudeProfile
            waypoints={displayWaypoints}
            selectedWaypointId={selectedWaypointId}
            onWaypointClick={handleWaypointClick}
            className="border-t"
          />
        </div>

        {/* Right Panel - Details */}
        <div className="w-96 border-l bg-card flex flex-col overflow-hidden">
          <Tabs defaultValue="details" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 m-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="waypoints">Waypoints</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-auto p-4 space-y-4 m-0">
              <div>
                <Label htmlFor="name">Mission Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter mission name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <Label htmlFor="drone">Assigned Drone</Label>
                <Select value={droneId} onValueChange={setDroneId}>
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
                <Label htmlFor="departure">Departure Hub *</Label>
                <Select value={departureHubId} onValueChange={setDepartureHubId}>
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
                <Select value={arrivalHubId} onValueChange={setArrivalHubId}>
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
                  waypoint={{
                    ...selectedWaypoint,
                    id: selectedWaypoint.tempId,
                    missionId: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }}
                  onSave={handleWaypointUpdate}
                  onCancel={() => setSelectedWaypointId(null)}
                />
              ) : (
                <WaypointList
                  waypoints={displayWaypoints}
                  selectedWaypointId={selectedWaypointId}
                  onSelect={handleWaypointClick}
                  onDelete={handleWaypointDelete}
                  onReorder={handleWaypointReorder}
                />
              )}
            </TabsContent>

            <TabsContent value="schedule" className="flex-1 overflow-auto p-4 m-0">
              <SchedulePicker
                scheduleType={scheduleType}
                scheduledAt={scheduledAt}
                triggerConditions={triggerConditions}
                onChange={({ scheduleType, scheduledAt, triggerConditions }) => {
                  setScheduleType(scheduleType);
                  setScheduledAt(scheduledAt);
                  if (triggerConditions) {
                    setTriggerConditions(triggerConditions);
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
