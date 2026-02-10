'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalendarIcon, Clock, Zap, Hand, Timer } from 'lucide-react';

type ScheduleType = 'manual' | 'scheduled' | 'event_triggered';

interface TriggerCondition {
  type: string;
  value?: unknown;
}

interface SchedulePickerProps {
  scheduleType: ScheduleType;
  scheduledAt?: Date | null;
  triggerConditions?: TriggerCondition[];
  onChange: (data: {
    scheduleType: ScheduleType;
    scheduledAt?: Date;
    triggerConditions?: TriggerCondition[];
  }) => void;
  disabled?: boolean;
}

const SCHEDULE_TYPES = [
  {
    value: 'manual' as const,
    label: 'Manual Start',
    description: 'Start mission manually when ready',
    icon: Hand,
  },
  {
    value: 'scheduled' as const,
    label: 'Scheduled',
    description: 'Start at a specific date and time',
    icon: Timer,
  },
  {
    value: 'event_triggered' as const,
    label: 'Event Triggered',
    description: 'Start when conditions are met',
    icon: Zap,
  },
];

const TRIGGER_EVENTS = [
  { value: 'battery_charged', label: 'Battery Fully Charged' },
  { value: 'weather_clear', label: 'Weather Conditions Clear' },
  { value: 'airspace_available', label: 'Airspace Available' },
  { value: 'sunrise', label: 'At Sunrise' },
  { value: 'sunset', label: 'At Sunset' },
  { value: 'previous_complete', label: 'Previous Mission Complete' },
  { value: 'api_trigger', label: 'External API Trigger' },
];

export function SchedulePicker({
  scheduleType,
  scheduledAt,
  triggerConditions = [],
  onChange,
  disabled = false,
}: SchedulePickerProps) {
  const [date, setDate] = useState<Date | undefined>(
    scheduledAt ? new Date(scheduledAt) : undefined
  );
  const [time, setTime] = useState(
    scheduledAt ? format(new Date(scheduledAt), 'HH:mm') : '09:00'
  );

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      const [hours, minutes] = time.split(':').map(Number);
      newDate.setHours(hours, minutes, 0, 0);
      onChange({ scheduleType, scheduledAt: newDate, triggerConditions });
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date) {
      const newDate = new Date(date);
      const [hours, minutes] = newTime.split(':').map(Number);
      newDate.setHours(hours, minutes, 0, 0);
      onChange({ scheduleType, scheduledAt: newDate, triggerConditions });
    }
  };

  const handleTypeChange = (newType: ScheduleType) => {
    onChange({
      scheduleType: newType,
      scheduledAt: newType === 'scheduled' ? date : undefined,
      triggerConditions: newType === 'event_triggered' ? triggerConditions : undefined,
    });
  };

  const handleTriggerChange = (triggerType: string) => {
    const newConditions = [{ type: triggerType }];
    onChange({ scheduleType, triggerConditions: newConditions });
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Schedule Type</Label>

      <div className="grid gap-2">
        {SCHEDULE_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => !disabled && handleTypeChange(type.value)}
              disabled={disabled}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                scheduleType === type.value
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card hover:bg-accent border-border',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-md',
                  scheduleType === type.value ? 'bg-primary/20' : 'bg-muted'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    scheduleType === type.value ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p className="font-medium text-sm">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {scheduleType === 'scheduled' && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground'
                    )}
                    disabled={disabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateChange}
                    disabled={(d: Date) => d < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  disabled={disabled}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {date && (
            <p className="text-xs text-muted-foreground">
              Mission will start at {format(date, "PPP 'at' p")}
            </p>
          )}
        </div>
      )}

      {scheduleType === 'event_triggered' && (
        <div className="space-y-3 pt-2">
          <Label className="text-xs">Trigger Event</Label>
          <Select
            value={triggerConditions[0]?.type || ''}
            onValueChange={handleTriggerChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select trigger event" />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_EVENTS.map((event) => (
                <SelectItem key={event.value} value={event.value}>
                  {event.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {triggerConditions[0]?.type && (
            <p className="text-xs text-muted-foreground">
              Mission will start automatically when the condition is met
            </p>
          )}
        </div>
      )}
    </div>
  );
}
