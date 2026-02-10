'use client';

import { WaypointAction } from '@/store/missions.store';
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
import { Plus, Trash2, Camera, Package, RotateCw, Pause, Volume2 } from 'lucide-react';

const ACTION_TYPES = [
  { value: 'take_photo', label: 'Take Photo', icon: Camera },
  { value: 'start_video', label: 'Start Video Recording', icon: Camera },
  { value: 'stop_video', label: 'Stop Video Recording', icon: Camera },
  { value: 'drop_payload', label: 'Drop Payload', icon: Package },
  { value: 'rotate', label: 'Rotate Camera/Gimbal', icon: RotateCw },
  { value: 'hover', label: 'Hover in Place', icon: Pause },
  { value: 'sound_alert', label: 'Sound Alert', icon: Volume2 },
];

interface ActionBuilderProps {
  actions: WaypointAction[];
  onChange: (actions: WaypointAction[]) => void;
  disabled?: boolean;
}

export function ActionBuilder({ actions, onChange, disabled = false }: ActionBuilderProps) {
  const addAction = () => {
    onChange([...actions, { type: 'take_photo', parameters: {} }]);
  };

  const updateAction = (index: number, updates: Partial<WaypointAction>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    onChange(newActions);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, key: string, value: unknown) => {
    const newActions = [...actions];
    newActions[index] = {
      ...newActions[index],
      parameters: { ...newActions[index].parameters, [key]: value },
    };
    onChange(newActions);
  };

  const getActionIcon = (type: string) => {
    const actionType = ACTION_TYPES.find((a) => a.value === type);
    return actionType?.icon || Camera;
  };

  const renderParameters = (action: WaypointAction, index: number) => {
    switch (action.type) {
      case 'rotate':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Pitch (°)</Label>
              <Input
                type="number"
                min="-90"
                max="90"
                value={(action.parameters?.pitch as number) || 0}
                onChange={(e) => updateParameter(index, 'pitch', parseFloat(e.target.value))}
                disabled={disabled}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Yaw (°)</Label>
              <Input
                type="number"
                min="0"
                max="360"
                value={(action.parameters?.yaw as number) || 0}
                onChange={(e) => updateParameter(index, 'yaw', parseFloat(e.target.value))}
                disabled={disabled}
                className="h-8"
              />
            </div>
          </div>
        );

      case 'hover':
        return (
          <div>
            <Label className="text-xs">Duration (seconds)</Label>
            <Input
              type="number"
              min="1"
              value={(action.parameters?.duration as number) || 5}
              onChange={(e) => updateParameter(index, 'duration', parseFloat(e.target.value))}
              disabled={disabled}
              className="h-8"
            />
          </div>
        );

      case 'drop_payload':
        return (
          <div>
            <Label className="text-xs">Payload Bay</Label>
            <Select
              value={(action.parameters?.bay as string) || '1'}
              onValueChange={(value) => updateParameter(index, 'bay', value)}
              disabled={disabled}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Bay 1</SelectItem>
                <SelectItem value="2">Bay 2</SelectItem>
                <SelectItem value="all">All Bays</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'sound_alert':
        return (
          <div>
            <Label className="text-xs">Alert Type</Label>
            <Select
              value={(action.parameters?.alertType as string) || 'warning'}
              onValueChange={(value) => updateParameter(index, 'alertType', value)}
              disabled={disabled}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warning">Warning Tone</SelectItem>
                <SelectItem value="arrival">Arrival Chime</SelectItem>
                <SelectItem value="custom">Custom Sound</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Waypoint Actions</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={addAction}
          disabled={disabled}
          className="h-7"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Action
        </Button>
      </div>

      {actions.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <p>No actions configured</p>
          <p className="text-xs mt-1">Add actions to execute at this waypoint</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action, index) => {
            const Icon = getActionIcon(action.type);
            return (
              <div
                key={index}
                className="p-3 rounded-lg border bg-card space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <Select
                    value={action.type}
                    onValueChange={(value) => updateAction(index, { type: value, parameters: {} })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="flex-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAction(index)}
                    disabled={disabled}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {renderParameters(action, index)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
