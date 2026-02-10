import { create } from 'zustand';

export interface DronePosition {
  flightId: string;
  droneId: string;
  flightNumber: string;
  position: [number, number];
  heading: number;
  altitude: number;
  groundSpeed: number;
  batteryLevel: number;
}

interface TelemetryState {
  drones: Record<string, DronePosition>;
  updateDrone: (flightId: string, data: DronePosition) => void;
  removeDrone: (flightId: string) => void;
  clearAll: () => void;
}

export const useTelemetryStore = create<TelemetryState>()((set) => ({
  drones: {},
  updateDrone: (flightId, data) =>
    set((state) => ({
      drones: { ...state.drones, [flightId]: data },
    })),
  removeDrone: (flightId) =>
    set((state) => {
      const { [flightId]: _, ...rest } = state.drones;
      return { drones: rest };
    }),
  clearAll: () => set({ drones: {} }),
}));
