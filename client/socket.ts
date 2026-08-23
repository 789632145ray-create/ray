import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Same-origin in prod; in Vite dev, /socket.io is proxied to the API server. */
export function createSocket(): AppSocket {
  return io({
    autoConnect: true,
    // Vite's WS proxy can drop Socket.IO upgrades; polling is reliable.
    transports: ["polling"],
    reconnection: true,
  });
}
