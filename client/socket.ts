import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const URL = import.meta.env.PROD ? undefined : "http://localhost:3001";

export function createSocket(): AppSocket {
  return io(URL, {
    autoConnect: true,
    transports: ["websocket", "polling"],
  });
}
