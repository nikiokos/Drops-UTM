import { create } from 'zustand';

interface DashboardStats {
  activeFlights: number;
  activeHubs: number;
  registeredDrones: number;
  activeConflicts: number;
}

interface DashboardState {
  stats: DashboardStats;
  selectedHubId: string | null;
  selectedFlightId: string | null;
  sidebarOpen: boolean;
  setStats: (stats: Partial<DashboardStats>) => void;
  selectHub: (hubId: string | null) => void;
  selectFlight: (flightId: string | null) => void;
  toggleSidebar: () => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  stats: {
    activeFlights: 0,
    activeHubs: 0,
    registeredDrones: 0,
    activeConflicts: 0,
  },
  selectedHubId: null,
  selectedFlightId: null,
  sidebarOpen: true,
  setStats: (stats) =>
    set((state) => ({
      stats: { ...state.stats, ...stats },
    })),
  selectHub: (hubId) => set({ selectedHubId: hubId }),
  selectFlight: (flightId) => set({ selectedFlightId: flightId }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
