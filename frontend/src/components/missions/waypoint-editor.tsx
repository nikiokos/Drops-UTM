'use client';

import { useState, useEffect } from 'react';
import { Waypoint, WaypointAction, WaypointCondition } from '@/store/missions.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActionBuilder } from './action-builder';
import { ConditionBuilder } from './condition-builder';
import { Save, X, MapPin, Gauge, Clock, Compass } from 'lucide-react';

interface WaypointEditorProps {
  waypoint: Waypoint;
  onSave: (data: Partial<Waypoint>) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function WaypointEditor({
  waypoint,
  onSave,
  onCancel,
  disabled = false,
}: WaypointEditorProps) {
  const [name, setName] = useState(waypoint.name || '');
  const [latitude, setLatitude] = useState(waypoint.latitude.toString());
  const [longitude, setLongitude] = useState(waypoint.longitude.toString());
  const [altitude, setAltitude] = useState(waypoint.altitude.toString());
  const [speedToWaypoint, setSpeedToWaypoint] = useState(
    waypoint.speedToWaypoint?.toString() || ''
  );
  const [headingAtWaypoint, setHeadingAtWaypoint] = useState(
    waypoint.headingAtWaypoint?.toString() || ''
  );
  const [turnRadius, setTurnRadius] = useState(waypoint.turnRadius?.toString() || '');
  const [hoverDuration, setHoverDuration] = useState(
    waypoint.hoverDuration?.toString() || ''
  );
  const [waitForConfirmation, setWaitForConfirmation] = useState(
    waypoint.waitForConfirmation || false
  );
  const [actions, setActions] = useState<WaypointAction[]>(waypoint.actions || []);
  const [conditions, setConditions] = useState<WaypointCondition[]>(
    waypoint.conditions || []
  );

  useEffect(() => {
    setName(waypoint.name || '');
    setLatitude(waypoint.latitude.toString());
    setLongitude(waypoint.longitude.toString());
    setAltitude(waypoint.altitude.toString());
    setSpeedToWaypoint(waypoint.speedToWaypoint?.toString() || '');
    setHeadingAtWaypoint(waypoint.headingAtWaypoint?.toString() || '');
    setTurnRadius(waypoint.turnRadius?.toString() || '');
    setHoverDuration(waypoint.hoverDuration?.toString() || '');
    setWaitForConfirmation(waypoint.waitForConfirmation || false);
    setActions(waypoint.actions || []);
    setConditions(waypoint.conditions || []);
  }, [waypoint]);

  const handleSave = () => {
    onSave({
      name: name || undefined,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      altitude: parseFloat(altitude),
      speedToWaypoint: speedToWaypoint ? parseFloat(speedToWaypoint) : undefined,
      headingAtWaypoint: headingAtWaypoint ? parseFloat(headingAtWaypoint) : undefined,
      turnRadius: turnRadius ? parseFloat(turnRadius) : undefined,
      hoverDuration: hoverDuration ? parseFloat(hoverDuration) : undefined,
      waitForConfirmation,
      actions,
      conditions,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Edit Waypoint</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={disabled}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={disabled}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="position">Position</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="conditions">Conditions</TabsTrigger>
        </TabsList>

        <TabsContent value="position" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional waypoint name"
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="latitude" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Latitude
              </Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="longitude" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Longitude
              </Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="altitude" className="flex items-center gap-1">
                <Gauge className="h-3 w-3" /> Altitude (m)
              </Label>
              <Input
                id="altitude"
                type="number"
                value={altitude}
                onChange={(e) => setAltitude(e.target.value)}
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="speed" className="flex items-center gap-1">
                <Gauge className="h-3 w-3" /> Speed (m/s)
              </Label>
              <Input
                id="speed"
                type="number"
                value={speedToWaypoint}
                onChange={(e) => setSpeedToWaypoint(e.target.value)}
                placeholder="Default"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="heading" className="flex items-center gap-1">
                <Compass className="h-3 w-3" /> Heading (°)
              </Label>
              <Input
                id="heading"
                type="number"
                min="0"
                max="360"
                value={headingAtWaypoint}
                onChange={(e) => setHeadingAtWaypoint(e.target.value)}
                placeholder="Auto"
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="turnRadius">Turn Radius (m)</Label>
              <Input
                id="turnRadius"
                type="number"
                value={turnRadius}
                onChange={(e) => setTurnRadius(e.target.value)}
                placeholder="Default"
                disabled={disabled}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="hover" className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Hover Duration (s)
            </Label>
            <Input
              id="hover"
              type="number"
              value={hoverDuration}
              onChange={(e) => setHoverDuration(e.target.value)}
              placeholder="No hover"
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="waitConfirm">Wait for Confirmation</Label>
              <p className="text-xs text-muted-foreground">
                Pause at waypoint until operator confirms
              </p>
            </div>
            <Switch
              id="waitConfirm"
              checked={waitForConfirmation}
              onCheckedChange={setWaitForConfirmation}
              disabled={disabled}
            />
          </div>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <ActionBuilder
            actions={actions}
            onChange={setActions}
            disabled={disabled}
          />
        </TabsContent>

        <TabsContent value="conditions" className="mt-4">
          <ConditionBuilder
            conditions={conditions}
            onChange={setConditions}
            disabled={disabled}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
