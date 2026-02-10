import { create } from 'zustand';
import { missionsApi, CreateMissionDto, UpdateMissionDto, CreateWaypointDto } from '@/lib/api';

export interface WaypointAction {
  type: string;
  parameters?: Record<string, unknown>;
}

export interface WaypointCondition {
  type: string;
  value?: unknown;
  action: string;
}

export interface Waypoint {
  id: string;
  missionId: string;
  sequence: number;
  name?: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speedToWaypoint?: number;
  headingAtWaypoint?: number;
  turnRadius?: number;
  actions?: WaypointAction[];
  conditions?: WaypointCondition[];
  hoverDuration?: number;
  waitForConfirmation?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MissionExecution {
  id: string;
  missionId: string;
  droneId: string;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'aborted' | 'failed';
  currentWaypointIndex: number;
  totalWaypoints: number;
  completedWaypoints: string[];
  waypointLogs: Array<{
    waypointId: string;
    waypointIndex: number;
    reachedAt: string;
    departedAt?: string;
    actionsExecuted: string[];
    conditionsTriggered: string[];
    telemetrySnapshot?: Record<string, unknown>;
  }>;
  events: Array<{
    timestamp: string;
    type: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
  triggerType: 'manual' | 'scheduled' | 'event';
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface Mission {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'scheduled' | 'executing' | 'paused' | 'completed' | 'aborted' | 'failed';
  droneId?: string;
  departureHubId: string;
  arrivalHubId?: string;
  scheduleType?: 'manual' | 'scheduled' | 'event_triggered';
  scheduledAt?: string;
  triggerConditions?: Record<string, unknown>;
  templateId?: string;
  templateVersion?: number;
  estimatedDuration?: number;
  estimatedDistance?: number;
  waypoints?: Waypoint[];
  executions?: MissionExecution[];
  drone?: {
    id: string;
    model: string;
    manufacturer: string;
    serialNumber: string;
    registrationNumber: string;
  };
  departureHub?: {
    id: string;
    name: string;
  };
  arrivalHub?: {
    id: string;
    name: string;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface MissionsState {
  missions: Mission[];
  selectedMission: Mission | null;
  selectedWaypoint: Waypoint | null;
  editingWaypointId: string | null;
  isLoading: boolean;
  error: string | null;

  // Mission CRUD
  fetchMissions: (params?: {
    status?: string;
    droneId?: string;
    hubId?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  fetchMission: (id: string) => Promise<Mission | null>;
  createMission: (data: CreateMissionDto) => Promise<Mission | null>;
  updateMission: (id: string, data: UpdateMissionDto) => Promise<Mission | null>;
  deleteMission: (id: string) => Promise<boolean>;

  // Waypoint management
  addWaypoint: (missionId: string, data: CreateWaypointDto) => Promise<Waypoint | null>;
  updateWaypoint: (missionId: string, waypointId: string, data: Partial<CreateWaypointDto>) => Promise<Waypoint | null>;
  deleteWaypoint: (missionId: string, waypointId: string) => Promise<boolean>;
  reorderWaypoints: (missionId: string, waypointIds: string[]) => Promise<boolean>;

  // Mission lifecycle
  scheduleMission: (id: string, scheduledAt?: string) => Promise<boolean>;
  startMission: (id: string) => Promise<boolean>;
  pauseMission: (id: string) => Promise<boolean>;
  resumeMission: (id: string) => Promise<boolean>;
  abortMission: (id: string) => Promise<boolean>;

  // Executions
  fetchExecutions: (missionId: string) => Promise<MissionExecution[]>;

  // UI state
  selectMission: (mission: Mission | null) => void;
  selectWaypoint: (waypoint: Waypoint | null) => void;
  setEditingWaypoint: (waypointId: string | null) => void;
  clearError: () => void;

  // Real-time updates
  updateMissionStatus: (missionId: string, status: Mission['status'], executionId?: string, progress?: number) => void;
  updateWaypointProgress: (missionId: string, waypointId: string, waypointIndex: number) => void;
}

export const useMissionsStore = create<MissionsState>((set, get) => ({
  missions: [],
  selectedMission: null,
  selectedWaypoint: null,
  editingWaypointId: null,
  isLoading: false,
  error: null,

  fetchMissions: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await missionsApi.getAll(params);
      set({ missions: response.data.data || response.data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch missions', isLoading: false });
      console.error('Failed to fetch missions:', error);
    }
  },

  fetchMission: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await missionsApi.getById(id);
      const mission = response.data;
      set((state) => ({
        missions: state.missions.some((m) => m.id === id)
          ? state.missions.map((m) => (m.id === id ? mission : m))
          : [...state.missions, mission],
        selectedMission: mission,
        isLoading: false,
      }));
      return mission;
    } catch (error) {
      set({ error: 'Failed to fetch mission', isLoading: false });
      console.error('Failed to fetch mission:', error);
      return null;
    }
  },

  createMission: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await missionsApi.create(data);
      const mission = response.data;
      set((state) => ({
        missions: [mission, ...state.missions],
        selectedMission: mission,
        isLoading: false,
      }));
      return mission;
    } catch (error) {
      set({ error: 'Failed to create mission', isLoading: false });
      console.error('Failed to create mission:', error);
      return null;
    }
  },

  updateMission: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await missionsApi.update(id, data);
      const mission = response.data;
      set((state) => ({
        missions: state.missions.map((m) => (m.id === id ? mission : m)),
        selectedMission: state.selectedMission?.id === id ? mission : state.selectedMission,
        isLoading: false,
      }));
      return mission;
    } catch (error) {
      set({ error: 'Failed to update mission', isLoading: false });
      console.error('Failed to update mission:', error);
      return null;
    }
  },

  deleteMission: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await missionsApi.delete(id);
      set((state) => ({
        missions: state.missions.filter((m) => m.id !== id),
        selectedMission: state.selectedMission?.id === id ? null : state.selectedMission,
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({ error: 'Failed to delete mission', isLoading: false });
      console.error('Failed to delete mission:', error);
      return false;
    }
  },

  addWaypoint: async (missionId, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await missionsApi.addWaypoint(missionId, data);
      const waypoint = response.data;
      set((state) => {
        const updatedMissions = state.missions.map((m) => {
          if (m.id === missionId) {
            return {
              ...m,
              waypoints: [...(m.waypoints || []), waypoint],
            };
          }
          return m;
        });
        const updatedSelected =
          state.selectedMission?.id === missionId
            ? {
                ...state.selectedMission,
                waypoints: [...(state.selectedMission.waypoints || []), waypoint],
              }
            : state.selectedMission;
        return {
          missions: updatedMissions,
          selectedMission: updatedSelected,
          selectedWaypoint: waypoint,
          isLoading: false,
        };
      });
      return waypoint;
    } catch (error) {
      set({ error: 'Failed to add waypoint', isLoading: false });
      console.error('Failed to add waypoint:', error);
      return null;
    }
  },

  updateWaypoint: async (missionId, waypointId, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await missionsApi.updateWaypoint(missionId, waypointId, data);
      const waypoint = response.data;
      set((state) => {
        const updateWaypoints = (waypoints?: Waypoint[]) =>
          waypoints?.map((w) => (w.id === waypointId ? waypoint : w));

        return {
          missions: state.missions.map((m) =>
            m.id === missionId ? { ...m, waypoints: updateWaypoints(m.waypoints) } : m
          ),
          selectedMission:
            state.selectedMission?.id === missionId
              ? { ...state.selectedMission, waypoints: updateWaypoints(state.selectedMission.waypoints) }
              : state.selectedMission,
          selectedWaypoint: state.selectedWaypoint?.id === waypointId ? waypoint : state.selectedWaypoint,
          isLoading: false,
        };
      });
      return waypoint;
    } catch (error) {
      set({ error: 'Failed to update waypoint', isLoading: false });
      console.error('Failed to update waypoint:', error);
      return null;
    }
  },

  deleteWaypoint: async (missionId, waypointId) => {
    set({ isLoading: true, error: null });
    try {
      await missionsApi.deleteWaypoint(missionId, waypointId);
      set((state) => {
        const filterWaypoints = (waypoints?: Waypoint[]) =>
          waypoints?.filter((w) => w.id !== waypointId);

        return {
          missions: state.missions.map((m) =>
            m.id === missionId ? { ...m, waypoints: filterWaypoints(m.waypoints) } : m
          ),
          selectedMission:
            state.selectedMission?.id === missionId
              ? { ...state.selectedMission, waypoints: filterWaypoints(state.selectedMission.waypoints) }
              : state.selectedMission,
          selectedWaypoint: state.selectedWaypoint?.id === waypointId ? null : state.selectedWaypoint,
          isLoading: false,
        };
      });
      return true;
    } catch (error) {
      set({ error: 'Failed to delete waypoint', isLoading: false });
      console.error('Failed to delete waypoint:', error);
      return false;
    }
  },

  reorderWaypoints: async (missionId, waypointIds) => {
    set({ isLoading: true, error: null });
    try {
      await missionsApi.reorderWaypoints(missionId, waypointIds);
      // Refresh mission to get updated sequence numbers
      await get().fetchMission(missionId);
      return true;
    } catch (error) {
      set({ error: 'Failed to reorder waypoints', isLoading: false });
      console.error('Failed to reorder waypoints:', error);
      return false;
    }
  },

  scheduleMission: async (id, scheduledAt) => {
    set({ isLoading: true, error: null });
    try {
      await missionsApi.schedule(id, scheduledAt);
      await get().fetchMission(id);
      return true;
    } catch (error) {
      set({ error: 'Failed to schedule mission', isLoading: false });
      console.error('Failed to schedule mission:', error);
      return false;
    }
  },

  startMission: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await missionsApi.start(id);
      await get().fetchMission(id);
      return true;
    } catch (error) {
      set({ error: 'Failed to start mission', isLoading: false });
      console.error('Failed to start mission:', error);
      return false;
    }
  },

  pauseMission: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await missionsApi.pause(id);
      await get().fetchMission(id);
      return true;
    } catch (error) {
      set({ error: 'Failed to pause mission', isLoading: false });
      console.error('Failed to pause mission:', error);
      return false;
    }
  },

  resumeMission: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await missionsApi.resume(id);
      await get().fetchMission(id);
      return true;
    } catch (error) {
      set({ error: 'Failed to resume mission', isLoading: false });
      console.error('Failed to resume mission:', error);
      return false;
    }
  },

  abortMission: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await missionsApi.abort(id);
      await get().fetchMission(id);
      return true;
    } catch (error) {
      set({ error: 'Failed to abort mission', isLoading: false });
      console.error('Failed to abort mission:', error);
      return false;
    }
  },

  fetchExecutions: async (missionId) => {
    try {
      const response = await missionsApi.getExecutions(missionId);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch executions:', error);
      return [];
    }
  },

  selectMission: (mission) => {
    set({ selectedMission: mission, selectedWaypoint: null, editingWaypointId: null });
  },

  selectWaypoint: (waypoint) => {
    set({ selectedWaypoint: waypoint });
  },

  setEditingWaypoint: (waypointId) => {
    set({ editingWaypointId: waypointId });
  },

  clearError: () => {
    set({ error: null });
  },

  updateMissionStatus: (missionId, status, executionId, progress) => {
    set((state) => ({
      missions: state.missions.map((m) =>
        m.id === missionId ? { ...m, status } : m
      ),
      selectedMission:
        state.selectedMission?.id === missionId
          ? { ...state.selectedMission, status }
          : state.selectedMission,
    }));
  },

  updateWaypointProgress: (missionId, waypointId, waypointIndex) => {
    // This could be used to highlight the current waypoint during execution
    console.log(`Mission ${missionId}: Reached waypoint ${waypointIndex} (${waypointId})`);
  },
}));
