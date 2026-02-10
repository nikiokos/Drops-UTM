import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      auth: {
        token: useAuthStore.getState().accessToken,
      },
      transports: ['websocket'],
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: useAuthStore.getState().accessToken };
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function subscribeToFlight(flightId: string): void {
  getSocket().emit('subscribe_flight', { flightId });
}

export function unsubscribeFromFlight(flightId: string): void {
  getSocket().emit('unsubscribe_flight', { flightId });
}

export function subscribeToHub(hubId: string): void {
  getSocket().emit('subscribe_hub', { hubId });
}

export function unsubscribeFromHub(hubId: string): void {
  getSocket().emit('unsubscribe_hub', { hubId });
}

export function subscribeToDrone(droneId: string): void {
  getSocket().emit('subscribe_drone', { droneId });
}

export function unsubscribeFromDrone(droneId: string): void {
  getSocket().emit('unsubscribe_drone', { droneId });
}
