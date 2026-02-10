import { create } from 'zustand';

export type AlertType =
  | 'low_battery'
  | 'signal_loss'
  | 'signal_weak'
  | 'geofence_breach'
  | 'altitude_limit'
  | 'collision_warning'
  | 'weather_warning'
  | 'system_error'
  | 'communication_lost'
  | 'gps_degraded';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export interface DroneAlert {
  id: string;
  droneId: string;
  flightId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  data?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

interface AlertsState {
  alerts: DroneAlert[];
  unacknowledgedCount: number;
  addAlert: (alert: DroneAlert) => void;
  updateAlert: (alert: DroneAlert) => void;
  acknowledge: (alertId: string) => void;
  resolve: (alertId: string) => void;
  setAlerts: (alerts: DroneAlert[]) => void;
  clearAlerts: () => void;
}

export const useAlertsStore = create<AlertsState>()((set) => ({
  alerts: [],
  unacknowledgedCount: 0,

  addAlert: (alert) =>
    set((state) => {
      // Avoid duplicates
      if (state.alerts.some((a) => a.id === alert.id)) {
        return state;
      }
      const newAlerts = [alert, ...state.alerts].slice(0, 100); // Keep last 100 alerts
      return {
        alerts: newAlerts,
        unacknowledgedCount: newAlerts.filter((a) => !a.acknowledged).length,
      };
    }),

  updateAlert: (alert) =>
    set((state) => {
      const newAlerts = state.alerts.map((a) => (a.id === alert.id ? alert : a));
      return {
        alerts: newAlerts,
        unacknowledgedCount: newAlerts.filter((a) => !a.acknowledged).length,
      };
    }),

  acknowledge: (alertId) =>
    set((state) => {
      const newAlerts = state.alerts.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true, acknowledgedAt: new Date() } : a,
      );
      return {
        alerts: newAlerts,
        unacknowledgedCount: newAlerts.filter((a) => !a.acknowledged).length,
      };
    }),

  resolve: (alertId) =>
    set((state) => {
      const newAlerts = state.alerts.map((a) =>
        a.id === alertId
          ? { ...a, resolved: true, resolvedAt: new Date(), acknowledged: true }
          : a,
      );
      return {
        alerts: newAlerts,
        unacknowledgedCount: newAlerts.filter((a) => !a.acknowledged).length,
      };
    }),

  setAlerts: (alerts) =>
    set(() => ({
      alerts,
      unacknowledgedCount: alerts.filter((a) => !a.acknowledged).length,
    })),

  clearAlerts: () => set({ alerts: [], unacknowledgedCount: 0 }),
}));
