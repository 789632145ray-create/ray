import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server, type Socket } from "socket.io";
import { customAlphabet } from "nanoid";
import { chooseAiMove } from "../shared/ai";
import { applyMove, createGame, rollDice } from "../shared/engine";
import { COLORS } from "../shared/types";
import type { GameState, Move, RoomPlayer, RoomState } from "../shared/types";

const makeRoomId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);
const BOT_NAMES = ["阿明", "小蓮", "阿雄", "美秋"];

type InternalRoom = {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  game: GameState | null;
  status: RoomState["status"];
  botTimer: ReturnType<typeof setTimeout> | null;
};

const rooms = new Map<string, InternalRoom>();
const socketPlayer = new Map<string, { roomId: string; playerId: string }>();

function publicRoom(room: InternalRoom): RoomState {
  return {
    id: room.id,
    status: room.status,
    players: room.players,
    game: room.game,
    maxPlayers: 4,
  };
}

function getRoom(roomId: string): InternalRoom {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) throw new Error("找不到這個房間");
  return room;
}

function nextColor(room: InternalRoom) {
  const used = new Set(room.players.map((p) => p.color));
  return COLORS.find((c) => !used.has(c)) ?? null;
}

function emitRoom(io: Server, room: InternalRoom): void {
  io.to(room.id).emit("room", publicRoom(room));
}

function clearBot(room: InternalRoom): void {
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
}

function scheduleBot(io: Server, room: InternalRoom): void {
  clearBot(room);
  const game = room.game;
  if (!game || game.phase === "finished") return;
  const player = game.players[game.current];
  if (!player.isBot) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    try {
      playBot(io, room);
    } catch (error) {
      console.error(error);
    }
  }, 700 + Math.floor(Math.random() * 500));
}

function playBot(io: Server, room: InternalRoom): void {
  if (!room.game || room.game.phase === "finished") return;
  const player = room.game.players[room.game.current];
  if (!player.isBot) return;
  if (room.game.phase === "rolling") {
    room.game = rollDice(room.game);
  } else if (room.game.phase === "moving") {
    const move = chooseAiMove(room.game);
    if (move) room.game = applyMove(room.game, move);
  }
  if (room.game.winnerIndex != null) room.status = "finished";
  emitRoom(io, room);
  scheduleBot(io, room);
}

function seatIndex(room: InternalRoom, playerId: string): number {
  return room.players.findIndex((p) => p.id === playerId);
}

function assertTurn(room: InternalRoom, playerId: string): void {
  if (!room.game) throw new Error("比賽尚未開始");
  const index = seatIndex(room, playerId);
  if (index !== room.game.current) throw new Error("還沒輪到你");
  if (room.game.players[index].isBot) throw new Error("這是電腦的回合");
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "dist");

if (process.env.NODE_ENV === "production") {
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
} else {
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
}

io.on("connection", (socket: Socket) => {
  const fail = (message: string) => socket.emit("error-message", message);

  socket.on("create-room", ({ name }: { name: string }) => {
    try {
      const trimmed = (name || "玩家").trim().slice(0, 12) || "玩家";
      let id = makeRoomId();
      while (rooms.has(id)) id = makeRoomId();
      const player: RoomPlayer = {
        id: socket.id,
        name: trimmed,
        color: "red",
        isBot: false,
        connected: true,
        isHost: true,
      };
      const room: InternalRoom = {
        id,
        hostId: player.id,
        players: [player],
        game: null,
        status: "lobby",
        botTimer: null,
      };
      rooms.set(id, room);
      socketPlayer.set(socket.id, { roomId: id, playerId: player.id });
      void socket.join(id);
      socket.emit("joined", { playerId: player.id, room: publicRoom(room) });
    } catch (error) {
      fail(error instanceof Error ? error.message : "建立房間失敗");
    }
  });

  socket.on("join-room", ({ roomId, name }: { roomId: string; name: string }) => {
    try {
      const room = getRoom(roomId);
      if (room.status !== "lobby") throw new Error("這場已經開始了");
      if (room.players.filter((p) => !p.isBot).length >= 4) throw new Error("房間已滿");
      const color = nextColor(room);
      if (!color) throw new Error("房間已滿");
      const trimmed = (name || "玩家").trim().slice(0, 12) || "玩家";
      const player: RoomPlayer = {
        id: socket.id,
        name: trimmed,
        color,
        isBot: false,
        connected: true,
        isHost: false,
      };
      room.players.push(player);
      socketPlayer.set(socket.id, { roomId: room.id, playerId: player.id });
      void socket.join(room.id);
      socket.emit("joined", { playerId: player.id, room: publicRoom(room) });
      emitRoom(io, room);
    } catch (error) {
      fail(error instanceof Error ? error.message : "加入房間失敗");
    }
  });

  socket.on("add-bot", () => {
    try {
      const ref = socketPlayer.get(socket.id);
      if (!ref) throw new Error("請先進入房間");
      const room = getRoom(ref.roomId);
      if (room.hostId !== ref.playerId) throw new Error("只有房主可以加電腦");
      if (room.status !== "lobby") throw new Error("比賽已開始");
      const color = nextColor(room);
      if (!color) throw new Error("座位已滿");
      const usedNames = new Set(room.players.map((p) => p.name));
      const name = BOT_NAMES.find((n) => !usedNames.has(n)) ?? `電腦${room.players.length}`;
      room.players.push({
        id: `bot-${color}`,
        name,
        color,
        isBot: true,
        connected: true,
        isHost: false,
      });
      emitRoom(io, room);
    } catch (error) {
      fail(error instanceof Error ? error.message : "無法加入電腦");
    }
  });

  socket.on("remove-player", ({ playerId }: { playerId: string }) => {
    try {
      const ref = socketPlayer.get(socket.id);
      if (!ref) return;
      const room = getRoom(ref.roomId);
      if (room.hostId !== ref.playerId) throw new Error("只有房主可以請人離開");
      if (room.status !== "lobby") throw new Error("比賽已開始");
      if (playerId === room.hostId) throw new Error("不能移除房主");
      room.players = room.players.filter((p) => p.id !== playerId);
      emitRoom(io, room);
    } catch (error) {
      fail(error instanceof Error ? error.message : "無法移除玩家");
    }
  });

  socket.on("start-game", () => {
    try {
      const ref = socketPlayer.get(socket.id);
      if (!ref) throw new Error("請先進入房間");
      const room = getRoom(ref.roomId);
      if (room.hostId !== ref.playerId) throw new Error("只有房主可以開賽");
      if (room.players.length < 2) throw new Error("至少需要兩位選手");
      room.game = createGame(
        room.players.map((p) => p.name),
        { bots: room.players.map((p) => p.isBot) },
      );
      room.status = "playing";
      emitRoom(io, room);
      scheduleBot(io, room);
    } catch (error) {
      fail(error instanceof Error ? error.message : "無法開始");
    }
  });

  socket.on("roll", () => {
    try {
      const ref = socketPlayer.get(socket.id);
      if (!ref) return;
      const room = getRoom(ref.roomId);
      assertTurn(room, ref.playerId);
      room.game = rollDice(room.game!);
      if (room.game.winnerIndex != null) room.status = "finished";
      emitRoom(io, room);
      scheduleBot(io, room);
    } catch (error) {
      fail(error instanceof Error ? error.message : "不能擲骰");
    }
  });

  socket.on("move", ({ move }: { move: Move }) => {
    try {
      const ref = socketPlayer.get(socket.id);
      if (!ref) return;
      const room = getRoom(ref.roomId);
      assertTurn(room, ref.playerId);
      room.game = applyMove(room.game!, move);
      if (room.game.winnerIndex != null) room.status = "finished";
      emitRoom(io, room);
      scheduleBot(io, room);
    } catch (error) {
      fail(error instanceof Error ? error.message : "不能這樣走");
    }
  });

  socket.on("leave", () => {
    leaveSocket(io, socket);
  });

  socket.on("disconnect", () => {
    leaveSocket(io, socket);
  });
});

function leaveSocket(io: Server, socket: Socket): void {
  const ref = socketPlayer.get(socket.id);
  if (!ref) return;
  socketPlayer.delete(socket.id);
  const room = rooms.get(ref.roomId);
  if (!room) return;
  const player = room.players.find((p) => p.id === ref.playerId);
  if (player && !player.isBot) player.connected = false;
  if (room.status === "lobby") {
    room.players = room.players.filter((p) => p.id !== ref.playerId);
    if (room.players.every((p) => p.isBot) || room.players.length === 0) {
      clearBot(room);
      rooms.delete(room.id);
      return;
    }
    if (room.hostId === ref.playerId) {
      const nextHost = room.players.find((p) => !p.isBot);
      if (nextHost) {
        room.hostId = nextHost.id;
        nextHost.isHost = true;
      }
    }
  }
  emitRoom(io, room);
}

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => {
  console.log(`Cờ Cá Ngựa server on :${port}`);
});
