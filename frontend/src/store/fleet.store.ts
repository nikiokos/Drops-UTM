import { create } from 'zustand';
import {
  fleetApi,
  FleetOverview,
  HubFleetStatus,
  FleetAssignment,
  RebalancingTask,
  RebalancingRecommendation,
  FleetConfiguration,
} from '@/lib/api';

interface FleetState {
  // State
  overview: FleetOverview | null;
  hubStatuses: Map<string, HubFleetStatus>;
  assignments: FleetAssignment[];
  pendingRebalancing: RebalancingTask[];
  activeRebalancing: RebalancingTask[];
  rebalancingHistory: RebalancingTask[];
  recommendations: RebalancingRecommendation[];
  activeConfig: FleetConfiguration | null;
  allConfigs: FleetConfiguration[];
  isLoading: boolean;
  error: string | null;

  // Actions - Fleet overview
  fetchOverview: () => Promise<void>;
  fetchHubStatus: (hubId: string) => Promise<HubFleetStatus | null>;

  // Actions - Assignments
  assignDrone: (missionId: string, operatorOverride?: string) => Promise<FleetAssignment | null>;
  acceptAssignment: (id: string) => Promise<boolean>;
  rejectAssignment: (id: string, reason: string, alternativeDroneId?: string) => Promise<boolean>;
  fetchAssignmentHistory: (missionId: string) => Promise<FleetAssignment[]>;

  // Actions - Rebalancing
  analyzeRebalancing: () => Promise<void>;
  fetchPendingRebalancing: () => Promise<void>;
  fetchActiveRebalancing: () => Promise<void>;
  fetchRebalancingHistory: (limit?: number, offset?: number) => Promise<void>;
  createRebalancing: (
    sourceHubId: string,
    targetHubId: string,
    droneId: string,
    autoApprove?: boolean,
  ) => Promise<RebalancingTask | null>;
  approveRebalancing: (id: string) => Promise<boolean>;
  executeRebalancing: (id: string) => Promise<boolean>;
  cancelRebalancing: (id: string, reason: string) => Promise<boolean>;

  // Actions - Configuration
  fetchActiveConfig: () => Promise<void>;
  fetchAllConfigs: () => Promise<void>;
  activateConfig: (id: string) => Promise<boolean>;
  updateConfig: (id: string, data: Partial<FleetConfiguration>) => Promise<boolean>;

  // Real-time updates
  updateOverview: (data: Partial<FleetOverview>) => void;
  updateHubStatus: (hubId: string, status: HubFleetStatus) => void;
  updateAssignment: (assignment: FleetAssignment) => void;
  updateRebalancingTask: (task: RebalancingTask) => void;

  // Utility
  clearError: () => void;
}

export const useFleetStore = create<FleetState>((set, get) => ({
  overview: null,
  hubStatuses: new Map(),
  assignments: [],
  pendingRebalancing: [],
  activeRebalancing: [],
  rebalancingHistory: [],
  recommendations: [],
  activeConfig: null,
  allConfigs: [],
  isLoading: false,
  error: null,

  fetchOverview: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fleetApi.getOverview();
      const overview = response.data;

      // Also update hub statuses map
      const hubStatuses = new Map<string, HubFleetStatus>();
      overview.hubStatuses.forEach((status) => {
        hubStatuses.set(status.hubId, status);
      });

      set({ overview, hubStatuses, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch fleet overview', isLoading: false });
      console.error('Failed to fetch fleet overview:', error);
    }
  },

  fetchHubStatus: async (hubId: string) => {
    try {
      const response = await fleetApi.getHubStatus(hubId);
      const status = response.data;

      set((state) => {
        const newStatuses = new Map(state.hubStatuses);
        newStatuses.set(hubId, status);
        return { hubStatuses: newStatuses };
      });

      return status;
    } catch (error) {
      console.error('Failed to fetch hub status:', error);
      return null;
    }
  },

  assignDrone: async (missionId: string, operatorOverride?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fleetApi.assignDrone(missionId, operatorOverride);
      const result = response.data;

      if (result.assignment) {
        set((state) => ({
          assignments: [result.assignment, ...state.assignments],
          isLoading: false,
        }));
        return result.assignment;
      }

      set({ error: result.reason || 'Assignment failed', isLoading: false });
      return null;
    } catch (error) {
      set({ error: 'Failed to assign drone', isLoading: false });
      console.error('Failed to assign drone:', error);
      return null;
    }
  },

  acceptAssignment: async (id: string) => {
    try {
      const response = await fleetApi.acceptAssignment(id);
      const assignment = response.data;

      set((state) => ({
        assignments: state.assignments.map((a) =>
          a.id === id ? assignment : a
        ),
      }));

      return true;
    } catch (error) {
      console.error('Failed to accept assignment:', error);
      return false;
    }
  },

  rejectAssignment: async (id: string, reason: string, alternativeDroneId?: string) => {
    try {
      const response = await fleetApi.rejectAssignment(id, reason, alternativeDroneId);
      const assignment = response.data;

      set((state) => ({
        assignments: state.assignments.map((a) =>
          a.id === id ? assignment : a
        ),
      }));

      return true;
    } catch (error) {
      console.error('Failed to reject assignment:', error);
      return false;
    }
  },

  fetchAssignmentHistory: async (missionId: string) => {
    try {
      const response = await fleetApi.getAssignmentHistory(missionId);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch assignment history:', error);
      return [];
    }
  },

  analyzeRebalancing: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fleetApi.analyzeRebalancing();
      set({ recommendations: response.data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to analyze rebalancing needs', isLoading: false });
      console.error('Failed to analyze rebalancing:', error);
    }
  },

  fetchPendingRebalancing: async () => {
    try {
      const response = await fleetApi.getPendingRebalancing();
      set({ pendingRebalancing: response.data });
    } catch (error) {
      console.error('Failed to fetch pending rebalancing:', error);
    }
  },

  fetchActiveRebalancing: async () => {
    try {
      const response = await fleetApi.getActiveRebalancing();
      set({ activeRebalancing: response.data });
    } catch (error) {
      console.error('Failed to fetch active rebalancing:', error);
    }
  },

  fetchRebalancingHistory: async (limit = 20, offset = 0) => {
    try {
      const response = await fleetApi.getRebalancingHistory(limit, offset);
      set({ rebalancingHistory: response.data });
    } catch (error) {
      console.error('Failed to fetch rebalancing history:', error);
    }
  },

  createRebalancing: async (sourceHubId, targetHubId, droneId, autoApprove) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fleetApi.createRebalancing(
        sourceHubId,
        targetHubId,
        droneId,
        autoApprove,
      );
      const task = response.data;

      set((state) => ({
        pendingRebalancing: autoApprove
          ? state.pendingRebalancing
          : [task, ...state.pendingRebalancing],
        activeRebalancing: autoApprove
          ? [task, ...state.activeRebalancing]
          : state.activeRebalancing,
        isLoading: false,
      }));

      return task;
    } catch (error) {
      set({ error: 'Failed to create rebalancing task', isLoading: false });
      console.error('Failed to create rebalancing:', error);
      return null;
    }
  },

  approveRebalancing: async (id: string) => {
    try {
      const response = await fleetApi.approveRebalancing(id, 'operator');
      const task = response.data;

      set((state) => ({
        pendingRebalancing: state.pendingRebalancing.filter((t) => t.id !== id),
        activeRebalancing: [task, ...state.activeRebalancing],
      }));

      return true;
    } catch (error) {
      console.error('Failed to approve rebalancing:', error);
      return false;
    }
  },

  executeRebalancing: async (id: string) => {
    try {
      const response = await fleetApi.executeRebalancing(id);
      const task = response.data;

      set((state) => ({
        activeRebalancing: state.activeRebalancing.map((t) =>
          t.id === id ? task : t
        ),
      }));

      return true;
    } catch (error) {
      console.error('Failed to execute rebalancing:', error);
      return false;
    }
  },

  cancelRebalancing: async (id: string, reason: string) => {
    try {
      await fleetApi.cancelRebalancing(id, reason);

      set((state) => ({
        pendingRebalancing: state.pendingRebalancing.filter((t) => t.id !== id),
        activeRebalancing: state.activeRebalancing.filter((t) => t.id !== id),
      }));

      return true;
    } catch (error) {
      console.error('Failed to cancel rebalancing:', error);
      return false;
    }
  },

  fetchActiveConfig: async () => {
    try {
      const response = await fleetApi.getActiveConfig();
      set({ activeConfig: response.data });
    } catch (error) {
      console.error('Failed to fetch active config:', error);
    }
  },

  fetchAllConfigs: async () => {
    try {
      const response = await fleetApi.getAllConfigs();
      set({ allConfigs: response.data });
    } catch (error) {
      console.error('Failed to fetch all configs:', error);
    }
  },

  activateConfig: async (id: string) => {
    try {
      const response = await fleetApi.activateConfig(id);
      set({ activeConfig: response.data });

      // Update the isActive flag in allConfigs
      set((state) => ({
        allConfigs: state.allConfigs.map((c) => ({
          ...c,
          isActive: c.id === id,
        })),
      }));

      return true;
    } catch (error) {
      console.error('Failed to activate config:', error);
      return false;
    }
  },

  updateConfig: async (id: string, data: Partial<FleetConfiguration>) => {
    try {
      const response = await fleetApi.updateConfig(id, data);
      const updated = response.data;

      set((state) => ({
        allConfigs: state.allConfigs.map((c) =>
          c.id === id ? updated : c
        ),
        activeConfig:
          state.activeConfig?.id === id ? updated : state.activeConfig,
      }));

      return true;
    } catch (error) {
      console.error('Failed to update config:', error);
      return false;
    }
  },

  // Real-time update handlers
  updateOverview: (data: Partial<FleetOverview>) => {
    set((state) => ({
      overview: state.overview ? { ...state.overview, ...data } : null,
    }));
  },

  updateHubStatus: (hubId: string, status: HubFleetStatus) => {
    set((state) => {
      const newStatuses = new Map(state.hubStatuses);
      newStatuses.set(hubId, status);

      // Also update overview hubStatuses if present
      const newOverview = state.overview
        ? {
            ...state.overview,
            hubStatuses: state.overview.hubStatuses.map((s) =>
              s.hubId === hubId ? status : s
            ),
          }
        : null;

      return { hubStatuses: newStatuses, overview: newOverview };
    });
  },

  updateAssignment: (assignment: FleetAssignment) => {
    set((state) => {
      const exists = state.assignments.some((a) => a.id === assignment.id);
      return {
        assignments: exists
          ? state.assignments.map((a) =>
              a.id === assignment.id ? assignment : a
            )
          : [assignment, ...state.assignments],
      };
    });
  },

  updateRebalancingTask: (task: RebalancingTask) => {
    set((state) => {
      let newPending = state.pendingRebalancing;
      let newActive = state.activeRebalancing;

      if (task.status === 'pending') {
        newPending = state.pendingRebalancing.some((t) => t.id === task.id)
          ? state.pendingRebalancing.map((t) => (t.id === task.id ? task : t))
          : [task, ...state.pendingRebalancing];
        newActive = state.activeRebalancing.filter((t) => t.id !== task.id);
      } else if (['approved', 'in_progress'].includes(task.status)) {
        newPending = state.pendingRebalancing.filter((t) => t.id !== task.id);
        newActive = state.activeRebalancing.some((t) => t.id === task.id)
          ? state.activeRebalancing.map((t) => (t.id === task.id ? task : t))
          : [task, ...state.activeRebalancing];
      } else {
        // completed, cancelled, failed
        newPending = state.pendingRebalancing.filter((t) => t.id !== task.id);
        newActive = state.activeRebalancing.filter((t) => t.id !== task.id);
      }

      return {
        pendingRebalancing: newPending,
        activeRebalancing: newActive,
      };
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
