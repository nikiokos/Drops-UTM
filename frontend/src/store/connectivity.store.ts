import { create } from 'zustand';
import {
  connectivityApi,
  DeviceRegistration,
  ConnectivityStatus,
  CertificateBundle,
  ModeConfig,
  TelemetryMode,
  RegisterDeviceDto,
} from '@/lib/api';

interface ConnectivityState {
  // State
  status: ConnectivityStatus | null;
  devices: DeviceRegistration[];
  onlineDevices: DeviceRegistration[];
  selectedDevice: DeviceRegistration | null;
  telemetryModes: Record<TelemetryMode, ModeConfig> | null;
  isLoading: boolean;
  error: string | null;

  // Actions - Status
  fetchStatus: () => Promise<void>;

  // Actions - Devices
  fetchDevices: (hubId?: string) => Promise<void>;
  fetchOnlineDevices: () => Promise<void>;
  fetchDevice: (id: string) => Promise<DeviceRegistration | null>;
  registerDevice: (data: RegisterDeviceDto) => Promise<DeviceRegistration | null>;
  revokeDevice: (id: string) => Promise<boolean>;
  selectDevice: (device: DeviceRegistration | null) => void;

  // Actions - Certificates
  generateCertificate: (deviceId: string) => Promise<CertificateBundle | null>;
  revokeCertificate: (deviceId: string) => Promise<boolean>;

  // Actions - Telemetry
  fetchTelemetryModes: () => Promise<void>;

  // Real-time updates
  updateDeviceStatus: (deviceId: string, connectionStatus: string) => void;
  addDevice: (device: DeviceRegistration) => void;
  removeDevice: (deviceId: string) => void;

  // Utility
  clearError: () => void;
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  status: null,
  devices: [],
  onlineDevices: [],
  selectedDevice: null,
  telemetryModes: null,
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    try {
      const response = await connectivityApi.getStatus();
      set({ status: response.data });
    } catch (error) {
      console.error('Failed to fetch connectivity status:', error);
      set({ error: 'Failed to fetch connectivity status' });
    }
  },

  fetchDevices: async (hubId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await connectivityApi.getDevices(hubId ? { hubId } : undefined);
      set({ devices: response.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      set({ error: 'Failed to fetch devices', isLoading: false });
    }
  },

  fetchOnlineDevices: async () => {
    try {
      const response = await connectivityApi.getOnlineDevices();
      set({ onlineDevices: response.data });
    } catch (error) {
      console.error('Failed to fetch online devices:', error);
    }
  },

  fetchDevice: async (id: string) => {
    try {
      const response = await connectivityApi.getDevice(id);
      set({ selectedDevice: response.data });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch device:', error);
      set({ error: 'Failed to fetch device details' });
      return null;
    }
  },

  registerDevice: async (data: RegisterDeviceDto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await connectivityApi.registerDevice(data);
      set((state) => ({
        devices: [response.data, ...state.devices],
        isLoading: false,
      }));
      return response.data;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to register device';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  revokeDevice: async (id: string) => {
    try {
      await connectivityApi.revokeDevice(id);
      set((state) => ({
        devices: state.devices.filter((d) => d.id !== id),
        selectedDevice: state.selectedDevice?.id === id ? null : state.selectedDevice,
      }));
      return true;
    } catch (error) {
      console.error('Failed to revoke device:', error);
      set({ error: 'Failed to revoke device' });
      return false;
    }
  },

  selectDevice: (device: DeviceRegistration | null) => {
    set({ selectedDevice: device });
  },

  generateCertificate: async (deviceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await connectivityApi.generateCertificate(deviceId);
      // Refresh device to get updated status
      await get().fetchDevice(deviceId);
      await get().fetchDevices();
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      set({ error: 'Failed to generate certificate', isLoading: false });
      return null;
    }
  },

  revokeCertificate: async (deviceId: string) => {
    try {
      await connectivityApi.revokeCertificate(deviceId);
      await get().fetchDevice(deviceId);
      await get().fetchDevices();
      return true;
    } catch (error) {
      console.error('Failed to revoke certificate:', error);
      set({ error: 'Failed to revoke certificate' });
      return false;
    }
  },

  fetchTelemetryModes: async () => {
    try {
      const response = await connectivityApi.getTelemetryModes();
      set({ telemetryModes: response.data });
    } catch (error) {
      console.error('Failed to fetch telemetry modes:', error);
    }
  },

  updateDeviceStatus: (deviceId: string, connectionStatus: string) => {
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === deviceId ? { ...d, connectionStatus: connectionStatus as DeviceRegistration['connectionStatus'] } : d,
      ),
      onlineDevices:
        connectionStatus === 'online'
          ? [...state.onlineDevices.filter((d) => d.id !== deviceId), state.devices.find((d) => d.id === deviceId)!].filter(Boolean)
          : state.onlineDevices.filter((d) => d.id !== deviceId),
      selectedDevice:
        state.selectedDevice?.id === deviceId
          ? { ...state.selectedDevice, connectionStatus: connectionStatus as DeviceRegistration['connectionStatus'] }
          : state.selectedDevice,
    }));
  },

  addDevice: (device: DeviceRegistration) => {
    set((state) => ({
      devices: [device, ...state.devices.filter((d) => d.id !== device.id)],
    }));
  },

  removeDevice: (deviceId: string) => {
    set((state) => ({
      devices: state.devices.filter((d) => d.id !== deviceId),
      onlineDevices: state.onlineDevices.filter((d) => d.id !== deviceId),
      selectedDevice: state.selectedDevice?.id === deviceId ? null : state.selectedDevice,
    }));
  },

  clearError: () => set({ error: null }),
}));
