import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (socket && socket.connected) return socket;
  if (socket) socket.removeAllListeners();
  const url = import.meta.env.VITE_API_URL || window.location.origin;
  socket = io(url, {
    auth: { token: localStorage.getItem('token') || '' },
    transports: ['websocket', 'polling']
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}