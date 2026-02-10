import { create } from 'zustand';

export type CommandType =
  | 'takeoff'
  | 'land'
  | 'rtl'
  | 'emergency_stop'
  | 'pause'
  | 'hover'
  | 'resume';

export type CommandStatus =
  | 'pending'
  | 'sent'
  | 'acknowledged'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DroneCommandLog {
  id: string;
  droneId: string;
  flightId?: string;
  commandType: CommandType;
  status: CommandStatus;
  message?: string;
  issuedAt: Date;
  acknowledgedAt?: Date;
  completedAt?: Date;
}

interface CommandsState {
  history: DroneCommandLog[];
  pending: Set<string>;
  addCommand: (cmd: DroneCommandLog) => void;
  updateStatus: (commandId: string, status: CommandStatus, message?: string) => void;
  setHistory: (history: DroneCommandLog[]) => void;
  clearHistory: () => void;
}

export const useCommandsStore = create<CommandsState>()((set) => ({
  history: [],
  pending: new Set(),

  addCommand: (cmd) =>
    set((state) => {
      const newPending = new Set(state.pending);
      if (cmd.status === 'pending' || cmd.status === 'sent' || cmd.status === 'executing') {
        newPending.add(cmd.id);
      }
      return {
        history: [cmd, ...state.history].slice(0, 100), // Keep last 100 commands
        pending: newPending,
      };
    }),

  updateStatus: (commandId, status, message) =>
    set((state) => {
      const newPending = new Set(state.pending);
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        newPending.delete(commandId);
      }

      return {
        history: state.history.map((cmd) =>
          cmd.id === commandId
            ? {
                ...cmd,
                status,
                message: message || cmd.message,
                ...(status === 'acknowledged' && { acknowledgedAt: new Date() }),
                ...(status === 'completed' || status === 'failed' || status === 'cancelled'
                  ? { completedAt: new Date() }
                  : {}),
              }
            : cmd,
        ),
        pending: newPending,
      };
    }),

  setHistory: (history) =>
    set(() => {
      const pending = new Set(
        history
          .filter((cmd) => cmd.status === 'pending' || cmd.status === 'sent' || cmd.status === 'executing')
          .map((cmd) => cmd.id),
      );
      return { history, pending };
    }),

  clearHistory: () => set({ history: [], pending: new Set() }),
}));
