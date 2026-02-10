import { useTelemetryStore, type DronePosition } from '@/store/telemetry.store';

type FlightMode = 'auto' | 'paused' | 'hover' | 'landing' | 'rtl' | 'emergency';

interface FlightData {
  flightId: string;
  droneId: string;
  flightNumber: string;
  startPos: [number, number];
  endPos: [number, number];
  progress: number;
  direction: 1 | -1;
  batteryLevel: number;
  mode: FlightMode;
  targetAltitude: number;
  currentAltitude: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function calculateHeading(from: [number, number], to: [number, number]): number {
  const dLon = to[1] - from[1];
  const dLat = to[0] - from[0];
  const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
  return (angle + 360) % 360;
}

function calculateAltitude(progress: number, cruiseAltitude: number = 120): number {
  // Climb to cruise altitude in first 20%, cruise in middle, descend in last 20%
  if (progress < 0.2) {
    return lerp(0, cruiseAltitude, progress / 0.2);
  } else if (progress > 0.8) {
    return lerp(cruiseAltitude, 0, (progress - 0.8) / 0.2);
  }
  return cruiseAltitude;
}

function calculateSpeed(progress: number, baseSpeed: number = 45): number {
  // Slower during climb/descent, faster during cruise
  if (progress < 0.15 || progress > 0.85) {
    return baseSpeed * 0.6;
  }
  // Add some variation during cruise
  return baseSpeed + Math.sin(progress * Math.PI * 8) * 5;
}

export class TelemetrySimulator {
  private flights: Map<string, FlightData> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private progressIncrement: number = 0.008; // ~2 minutes for full flight at 1s interval

  addFlight(
    flightId: string,
    droneId: string,
    flightNumber: string,
    startPos: [number, number],
    endPos: [number, number],
  ): void {
    // Check if flight with same endpoints exists (to avoid duplicates)
    if (this.flights.has(flightId)) {
      return;
    }

    this.flights.set(flightId, {
      flightId,
      droneId,
      flightNumber,
      startPos,
      endPos,
      progress: 0,
      direction: 1,
      batteryLevel: 95 + Math.random() * 5, // Start with 95-100%
      mode: 'auto',
      targetAltitude: 120,
      currentAltitude: 0,
    });
  }

  removeFlight(flightId: string): void {
    this.flights.delete(flightId);
    useTelemetryStore.getState().removeDrone(flightId);
  }

  private tick(): void {
    const { updateDrone } = useTelemetryStore.getState();

    this.flights.forEach((flight) => {
      let groundSpeed = 0;
      let heading = 0;

      // Handle different flight modes
      switch (flight.mode) {
        case 'auto':
          // Normal flight - update progress
          flight.progress += this.progressIncrement * flight.direction;

          // Reverse direction at endpoints
          if (flight.progress >= 1) {
            flight.progress = 1;
            flight.direction = -1;
          } else if (flight.progress <= 0) {
            flight.progress = 0;
            flight.direction = 1;
          }

          // Calculate target altitude based on progress
          flight.targetAltitude = calculateAltitude(flight.progress);
          groundSpeed = calculateSpeed(flight.progress);

          // Calculate heading based on direction
          heading =
            flight.direction === 1
              ? calculateHeading(flight.startPos, flight.endPos)
              : calculateHeading(flight.endPos, flight.startPos);
          break;

        case 'paused':
        case 'hover':
          // Maintain position - no progress change
          groundSpeed = 0;
          heading =
            flight.direction === 1
              ? calculateHeading(flight.startPos, flight.endPos)
              : calculateHeading(flight.endPos, flight.startPos);
          break;

        case 'landing':
          // Decrease altitude gradually
          flight.targetAltitude = 0;
          groundSpeed = 0;
          heading =
            flight.direction === 1
              ? calculateHeading(flight.startPos, flight.endPos)
              : calculateHeading(flight.endPos, flight.startPos);
          break;

        case 'rtl':
          // Return to launch - move back towards start
          if (flight.progress > 0) {
            flight.progress -= this.progressIncrement * 1.5; // Faster return
            if (flight.progress <= 0) {
              flight.progress = 0;
              flight.mode = 'landing';
            }
          }
          flight.targetAltitude = 120; // Maintain cruise altitude during return
          groundSpeed = calculateSpeed(flight.progress) * 1.2;
          heading = calculateHeading(flight.endPos, flight.startPos);
          break;

        case 'emergency':
          // Emergency stop - drop altitude quickly
          flight.targetAltitude = 0;
          groundSpeed = 0;
          // Keep heading stable
          heading =
            flight.direction === 1
              ? calculateHeading(flight.startPos, flight.endPos)
              : calculateHeading(flight.endPos, flight.startPos);
          break;
      }

      // Smoothly adjust current altitude towards target
      const altitudeDiff = flight.targetAltitude - flight.currentAltitude;
      const altitudeChangeRate = flight.mode === 'emergency' ? 15 : 5; // m/s
      if (Math.abs(altitudeDiff) > 0.5) {
        flight.currentAltitude += Math.sign(altitudeDiff) * Math.min(Math.abs(altitudeDiff), altitudeChangeRate);
      } else {
        flight.currentAltitude = flight.targetAltitude;
      }

      // Calculate current position via interpolation
      const t = flight.progress;
      const currentPos: [number, number] = [
        lerp(flight.startPos[0], flight.endPos[0], t),
        lerp(flight.startPos[1], flight.endPos[1], t),
      ];

      // Drain battery (slower drain during cruise, faster during emergencies)
      let drainRate = flight.progress > 0.2 && flight.progress < 0.8 ? 0.02 : 0.04;
      if (flight.mode === 'paused' || flight.mode === 'hover') {
        drainRate = 0.015; // Slower drain when stationary
      } else if (flight.mode === 'emergency') {
        drainRate = 0.1; // Fast drain in emergency
      }
      flight.batteryLevel = Math.max(5, flight.batteryLevel - drainRate);

      const droneData: DronePosition = {
        flightId: flight.flightId,
        droneId: flight.droneId,
        flightNumber: flight.flightNumber,
        position: currentPos,
        heading,
        altitude: Math.round(Math.max(0, flight.currentAltitude)),
        groundSpeed: Math.round(groundSpeed),
        batteryLevel: Math.round(flight.batteryLevel),
      };

      updateDrone(flight.flightId, droneData);
    });
  }

  start(intervalMs: number = 1000): void {
    if (this.intervalId) {
      return;
    }
    // Defer first tick to avoid updating store during render
    setTimeout(() => this.tick(), 0);
    this.intervalId = setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  clear(): void {
    this.stop();
    this.flights.clear();
    useTelemetryStore.getState().clearAll();
  }

  getFlightIds(): string[] {
    return Array.from(this.flights.keys());
  }

  executeCommand(flightId: string, command: string): void {
    const flight = this.flights.get(flightId);
    if (!flight) return;

    switch (command) {
      case 'takeoff':
        flight.mode = 'auto';
        flight.targetAltitude = 120;
        break;

      case 'land':
        flight.mode = 'landing';
        flight.targetAltitude = 0;
        break;

      case 'rtl':
        flight.mode = 'rtl';
        break;

      case 'emergency_stop':
        flight.mode = 'emergency';
        flight.targetAltitude = 0;
        break;

      case 'pause':
        flight.mode = 'paused';
        break;

      case 'hover':
        flight.mode = 'hover';
        break;

      case 'resume':
        flight.mode = 'auto';
        break;
    }
  }

  getFlightMode(flightId: string): FlightMode | null {
    const flight = this.flights.get(flightId);
    return flight?.mode || null;
  }
}

// Singleton instance
let simulatorInstance: TelemetrySimulator | null = null;

export function getTelemetrySimulator(): TelemetrySimulator {
  if (!simulatorInstance) {
    simulatorInstance = new TelemetrySimulator();
  }
  return simulatorInstance;
}
