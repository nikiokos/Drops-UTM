import { create } from 'zustand';
import {
  emergencyApi,
  EmergencyIncident,
  EmergencyProtocol,
  PendingConfirmation,
  OperationMode,
  RootCause,
  EmergencyStats,
  EmergencyTrend,
  BlackboxEntry,
  EmergencySeverity,
  EmergencyType,
} from '@/lib/api';

interface EmergencyState {
  // State
  mode: OperationMode;
  activeIncidents: EmergencyIncident[];
  pendingConfirmations: PendingConfirmation[];
  incidents: EmergencyIncident[];
  incidentsTotal: number;
  selectedIncident: EmergencyIncident | null;
  blackboxData: BlackboxEntry[];
  protocols: EmergencyProtocol[];
  stats: EmergencyStats | null;
  trends: EmergencyTrend[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchMode: () => Promise<void>;
  setMode: (mode: OperationMode) => Promise<void>;
  fetchActiveIncidents: () => Promise<void>;
  fetchPendingConfirmations: () => Promise<void>;
  fetchIncidents: (params?: {
    status?: string;
    severity?: EmergencySeverity;
    type?: EmergencyType;
    droneId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  fetchIncident: (id: string) => Promise<void>;
  confirmIncident: (id: string, approved: boolean) => Promise<void>;
  updateRootCause: (id: string, rootCause: RootCause, notes?: string, lessonsLearned?: string) => Promise<void>;
  fetchBlackbox: (incidentId: string, from?: string, to?: string) => Promise<void>;
  fetchProtocols: (active?: boolean) => Promise<void>;
  updateProtocol: (id: string, data: Partial<EmergencyProtocol>) => Promise<void>;
  fetchStats: (from?: string, to?: string) => Promise<void>;
  fetchTrends: (from: string, to: string, interval?: 'day' | 'week' | 'month') => Promise<void>;

  // WebSocket handlers
  handleEmergencyDetected: (data: Partial<EmergencyIncident>) => void;
  handleEmergencyActionRequired: (data: PendingConfirmation) => void;
  handleEmergencyResolved: (data: { incidentId: string }) => void;
  handleModeChanged: (data: { mode: OperationMode }) => void;

  // Utility
  clearError: () => void;
}

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  // Initial state
  mode: 'supervised',
  activeIncidents: [],
  pendingConfirmations: [],
  incidents: [],
  incidentsTotal: 0,
  selectedIncident: null,
  blackboxData: [],
  protocols: [],
  stats: null,
  trends: [],
  loading: false,
  error: null,

  // Fetch operation mode
  fetchMode: async () => {
    try {
      const response = await emergencyApi.getConfig();
      set({ mode: response.data.mode });
    } catch (error) {
      console.error('Failed to fetch emergency mode:', error);
    }
  },

  // Set operation mode
  setMode: async (mode) => {
    try {
      set({ loading: true, error: null });
      await emergencyApi.setMode(mode);
      set({ mode, loading: false });
    } catch (error) {
      set({ error: 'Failed to set mode', loading: false });
      throw error;
    }
  },

  // Fetch active incidents
  fetchActiveIncidents: async () => {
    try {
      const response = await emergencyApi.getActiveIncidents();
      set({ activeIncidents: response.data });
    } catch (error) {
      console.error('Failed to fetch active incidents:', error);
    }
  },

  // Fetch pending confirmations
  fetchPendingConfirmations: async () => {
    try {
      const response = await emergencyApi.getPendingConfirmations();
      set({ pendingConfirmations: response.data });
    } catch (error) {
      console.error('Failed to fetch pending confirmations:', error);
    }
  },

  // Fetch incidents with filters
  fetchIncidents: async (params) => {
    try {
      set({ loading: true, error: null });
      const response = await emergencyApi.getIncidents(params);
      set({
        incidents: response.data.data,
        incidentsTotal: response.data.total,
        loading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch incidents', loading: false });
    }
  },

  // Fetch single incident
  fetchIncident: async (id) => {
    try {
      set({ loading: true, error: null });
      const response = await emergencyApi.getIncident(id);
      set({ selectedIncident: response.data, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch incident', loading: false });
    }
  },

  // Confirm or reject pending action
  confirmIncident: async (id, approved) => {
    try {
      set({ loading: true, error: null });
      const response = await emergencyApi.confirmIncident(id, approved);

      // Update local state
      const { pendingConfirmations, activeIncidents } = get();
      set({
        pendingConfirmations: pendingConfirmations.filter((p) => p.incidentId !== id),
        activeIncidents: activeIncidents.map((i) =>
          i.id === id ? response.data : i
        ),
        selectedIncident: get().selectedIncident?.id === id ? response.data : get().selectedIncident,
        loading: false,
      });
    } catch (error) {
      set({ error: 'Failed to confirm incident', loading: false });
      throw error;
    }
  },

  // Update root cause
  updateRootCause: async (id, rootCause, notes, lessonsLearned) => {
    try {
      set({ loading: true, error: null });
      const response = await emergencyApi.updateRootCause(id, { rootCause, notes, lessonsLearned });
      set({
        selectedIncident: get().selectedIncident?.id === id ? response.data : get().selectedIncident,
        incidents: get().incidents.map((i) => (i.id === id ? response.data : i)),
        loading: false,
      });
    } catch (error) {
      set({ error: 'Failed to update root cause', loading: false });
      throw error;
    }
  },

  // Fetch blackbox data
  fetchBlackbox: async (incidentId, from, to) => {
    try {
      set({ loading: true, error: null });
      const response = await emergencyApi.getBlackbox(incidentId, { from, to });
      set({ blackboxData: response.data, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch blackbox data', loading: false });
    }
  },

  // Fetch protocols
  fetchProtocols: async (active) => {
    try {
      const response = await emergencyApi.getProtocols(active);
      set({ protocols: response.data });
    } catch (error) {
      console.error('Failed to fetch protocols:', error);
    }
  },

  // Update protocol
  updateProtocol: async (id, data) => {
    try {
      set({ loading: true, error: null });
      const response = await emergencyApi.updateProtocol(id, data);
      set({
        protocols: get().protocols.map((p) => (p.id === id ? response.data : p)),
        loading: false,
      });
    } catch (error) {
      set({ error: 'Failed to update protocol', loading: false });
      throw error;
    }
  },

  // Fetch statistics
  fetchStats: async (from, to) => {
    try {
      const response = await emergencyApi.getStats({ from, to });
      set({ stats: response.data });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  },

  // Fetch trends
  fetchTrends: async (from, to, interval = 'day') => {
    try {
      const response = await emergencyApi.getTrends({ from, to, interval });
      set({ trends: response.data });
    } catch (error) {
      console.error('Failed to fetch trends:', error);
    }
  },

  // WebSocket handlers
  handleEmergencyDetected: (data) => {
    const incident = data as EmergencyIncident;
    set((state) => ({
      activeIncidents: [incident, ...state.activeIncidents.filter((i) => i.id !== incident.id)],
    }));
  },

  handleEmergencyActionRequired: (data) => {
    set((state) => ({
      pendingConfirmations: [
        data,
        ...state.pendingConfirmations.filter((p) => p.incidentId !== data.incidentId),
      ],
    }));
  },

  handleEmergencyResolved: (data) => {
    set((state) => ({
      activeIncidents: state.activeIncidents.filter((i) => i.id !== data.incidentId),
      pendingConfirmations: state.pendingConfirmations.filter((p) => p.incidentId !== data.incidentId),
    }));
  },

  handleModeChanged: (data) => {
    set({ mode: data.mode });
  },

  // Clear error
  clearError: () => set({ error: null }),
}));
