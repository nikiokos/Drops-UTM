'use client';

import { useEffect, useCallback } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';

export function useSocket() {
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (accessToken) {
      connectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [accessToken]);

  const subscribe = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const socket = getSocket();
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    const socket = getSocket();
    socket.emit(event, data);
  }, []);

  return { subscribe, emit };
}

export function useFlightUpdates(flightId: string | null, onUpdate: (data: unknown) => void) {
  const { subscribe, emit } = useSocket();

  useEffect(() => {
    if (!flightId) return;

    emit('subscribe_flight', { flightId });
    const unsubscribe = subscribe('flight_update', onUpdate);

    return () => {
      emit('unsubscribe_flight', { flightId });
      unsubscribe();
    };
  }, [flightId, subscribe, emit, onUpdate]);
}

export function useHubUpdates(hubId: string | null, onUpdate: (data: unknown) => void) {
  const { subscribe, emit } = useSocket();

  useEffect(() => {
    if (!hubId) return;

    emit('subscribe_hub', { hubId });
    const unsubscribe = subscribe('hub_update', onUpdate);

    return () => {
      emit('unsubscribe_hub', { hubId });
      unsubscribe();
    };
  }, [hubId, subscribe, emit, onUpdate]);
}

export function useTelemetryUpdates(
  flightId: string | null,
  onUpdate: (data: unknown) => void,
) {
  const { subscribe, emit } = useSocket();

  useEffect(() => {
    if (!flightId) return;

    emit('subscribe_flight', { flightId });
    const unsubscribe = subscribe('telemetry_update', onUpdate);

    return () => {
      emit('unsubscribe_flight', { flightId });
      unsubscribe();
    };
  }, [flightId, subscribe, emit, onUpdate]);
}

export function useConflictAlerts(onAlert: (data: unknown) => void) {
  const { subscribe } = useSocket();

  useEffect(() => {
    const unsubscribe = subscribe('conflict_alert', onAlert);
    return unsubscribe;
  }, [subscribe, onAlert]);
}
