'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plane } from 'lucide-react';

interface ActiveFlight {
  flightId: string;
  droneId: string;
  flightNumber: string;
  batteryLevel?: number;
}

interface DroneSelectorProps {
  flights: ActiveFlight[];
  selectedFlightId: string | null;
  onSelect: (flightId: string) => void;
}

export function DroneSelector({ flights, selectedFlightId, onSelect }: DroneSelectorProps) {
  if (flights.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-border/40 bg-card/50">
        <Plane className="h-4 w-4 text-muted-foreground/50" />
        <span className="text-sm text-muted-foreground font-mono tracking-wider">
          NO ACTIVE FLIGHTS
        </span>
      </div>
    );
  }

  return (
    <Select value={selectedFlightId || ''} onValueChange={onSelect}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a flight to control">
          {selectedFlightId ? (
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-primary" />
              <span className="font-mono">
                {flights.find((f) => f.flightId === selectedFlightId)?.flightNumber || 'Unknown'}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select flight...</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {flights.map((flight) => (
          <SelectItem key={flight.flightId} value={flight.flightId}>
            <div className="flex items-center gap-3">
              <Plane className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="font-mono font-medium">{flight.flightNumber}</span>
                <span className="text-xs text-muted-foreground">
                  Drone: {flight.droneId.slice(0, 8)}...
                  {flight.batteryLevel !== undefined && (
                    <span className="ml-2">Battery: {Math.round(flight.batteryLevel)}%</span>
                  )}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
