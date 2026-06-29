import { create } from 'zustand';
import type { ForesightTimeline, PredictedConflict, DirectorAdvice } from '@/lib/api';

interface ForesightState {
  engaged: boolean;
  timeline: ForesightTimeline | null;
  playheadSec: number;
  focusConflict: PredictedConflict | null;
  advice: DirectorAdvice | null;
  resolved: boolean;
  set: (patch: Partial<ForesightState>) => void;
  reset: () => void;
}

export const useForesightStore = create<ForesightState>((set) => ({
  engaged: false,
  timeline: null,
  playheadSec: 0,
  focusConflict: null,
  advice: null,
  resolved: false,
  set: (patch) => set(patch),
  reset: () =>
    set({
      engaged: false,
      timeline: null,
      playheadSec: 0,
      focusConflict: null,
      advice: null,
      resolved: false,
    }),
}));
