import { create } from 'zustand';
import type { ApiKeyInfo } from '@/lib/api';

interface IntegrationState {
  keys: ApiKeyInfo[];
  loading: boolean;
  setKeys: (keys: ApiKeyInfo[]) => void;
  addKey: (key: ApiKeyInfo) => void;
  removeKey: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useIntegrationStore = create<IntegrationState>((set) => ({
  keys: [],
  loading: false,
  setKeys: (keys) => set({ keys }),
  addKey: (key) => set((state) => ({ keys: [key, ...state.keys] })),
  removeKey: (id) => set((state) => ({ keys: state.keys.filter((k) => k.id !== id) })),
  setLoading: (loading) => set({ loading }),
}));
