'use client';

import { WaypointCondition } from '@/store/missions.store';
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
import {
  Plus,
  Trash2,
  Battery,
  Signal,
  Wind,
  Thermometer,
  MapPin,
  AlertTriangle,
} from 'lucide-react';

const CONDITION_TYPES = [
  { value: 'battery_below', label: 'Battery Below', icon: Battery, unit: '%' },
  { value: 'battery_above', label: 'Battery Above', icon: Battery, unit: '%' },
  { value: 'signal_below', label: 'Signal Below', icon: Signal, unit: '%' },
  { value: 'wind_above', label: 'Wind Speed Above', icon: Wind, unit: 'm/s' },
  { value: 'temperature_below', label: 'Temperature Below', icon: Thermometer, unit: '°C' },
  { value: 'temperature_above', label: 'Temperature Above', icon: Thermometer, unit: '°C' },
  { value: 'geofence_breach', label: 'Geofence Breach', icon: MapPin, unit: null },
  { value: 'obstacle_detected', label: 'Obstacle Detected', icon: AlertTriangle, unit: null },
];

const CONDITION_ACTIONS = [
  { value: 'continue', label: 'Continue Mission' },
  { value: 'pause', label: 'Pause & Notify' },
  { value: 'rtl', label: 'Return to Launch' },
  { value: 'land', label: 'Land Immediately' },
  { value: 'hover', label: 'Hover in Place' },
  { value: 'skip_waypoint', label: 'Skip This Waypoint' },
  { value: 'abort', label: 'Abort Mission' },
];

interface ConditionBuilderProps {
  conditions: WaypointCondition[];
  onChange: (conditions: WaypointCondition[]) => void;
  disabled?: boolean;
}

export function ConditionBuilder({
  conditions,
  onChange,
  disabled = false,
}: ConditionBuilderProps) {
  const addCondition = () => {
    onChange([...conditions, { type: 'battery_below', value: 20, action: 'pause' }]);
  };

  const updateCondition = (index: number, updates: Partial<WaypointCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onChange(newConditions);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const getConditionType = (type: string) => {
    return CONDITION_TYPES.find((c) => c.value === type);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Conditional Logic</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={addCondition}
          disabled={disabled}
          className="h-7"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Condition
        </Button>
      </div>

      {conditions.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <p>No conditions configured</p>
          <p className="text-xs mt-1">Add conditions to trigger actions based on telemetry</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => {
            const conditionType = getConditionType(condition.type);
            const Icon = conditionType?.icon || AlertTriangle;

            return (
              <div
                key={index}
                className="p-3 rounded-lg border bg-card space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-amber-500/10">
                    <Icon className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium flex-1">
                    Condition {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(index)}
                    disabled={disabled}
                    className="h-7 w-7"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">IF</span>
                    <Select
                      value={condition.type}
                      onValueChange={(value) =>
                        updateCondition(index, { type: value, value: undefined })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="flex-1 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {conditionType?.unit && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={(condition.value as number) || ''}
                          onChange={(e) =>
                            updateCondition(index, { value: parseFloat(e.target.value) })
                          }
                          disabled={disabled}
                          className="w-20 h-8"
                        />
                        <span className="text-xs text-muted-foreground">
                          {conditionType.unit}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">THEN</span>
                    <Select
                      value={condition.action}
                      onValueChange={(value) => updateCondition(index, { action: value })}
                      disabled={disabled}
                    >
                      <SelectTrigger className="flex-1 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_ACTIONS.map((action) => (
                          <SelectItem key={action.value} value={action.value}>
                            {action.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {conditions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Conditions are checked in order. First matching condition triggers.
        </p>
      )}
    </div>
  );
}
