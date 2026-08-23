import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import {
  DIGIT_COUNT,
  type ClientToServerEvents,
  type GamePhase,
  type GuessRecord,
  type PlayerPublic,
  type RoomPublic,
  type ServerToClientEvents,
} from "../shared/types.js";
import { generateRoomCode, isValidSecret, scoreGuess } from "../shared/game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const isProd = process.env.NODE_ENV === "production";

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  socketId: string | null;
}

interface Room {
  code: string;
  phase: GamePhase;
  players: Player[];
  setterId: string | null;
  currentGuesserId: string | null;
  round: number;
  maxRounds: number;
  guesses: GuessRecord[];
  winnerId: string | null;
  lastRoundWinnerId: string | null;
  digitCount: number;
  secret: string | null;
  setterIndex: number;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, { roomCode: string; playerId: string }>();

function toPublic(room: Room): RoomPublic {
  return {
    code: room.code,
    phase: room.phase,
    players: room.players.map(
      (p): PlayerPublic => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isHost: p.isHost,
        connected: p.connected,
      })
    ),
    setterId: room.setterId,
    currentGuesserId: room.currentGuesserId,
    round: room.round,
    maxRounds: room.maxRounds,
    guesses: room.guesses,
    winnerId: room.winnerId,
    lastRoundWinnerId: room.lastRoundWinnerId,
    digitCount: room.digitCount,
  };
}

function broadcast(io: Server<ClientToServerEvents, ServerToClientEvents>, room: Room) {
  io.to(room.code).emit("room:update", toPublic(room));
}

function notifySetter(io: Server<ClientToServerEvents, ServerToClientEvents>, room: Room) {
  if (room.phase !== "setting") return;
  const setter = room.players.find((p) => p.id === room.setterId);
  if (setter?.socketId) io.to(setter.socketId).emit("game:youAreSetter");
}

function uniqueName(room: Room, name: string): string {
  const base = name.trim().slice(0, 12) || "玩家";
  const taken = new Set(room.players.map((p) => p.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}${i}`)) i += 1;
  return `${base}${i}`;
}

function guesserOrder(room: Room): Player[] {
  return room.players.filter((p) => p.id !== room.setterId && p.connected);
}

function setNextGuesser(room: Room, afterPlayerId?: string | null) {
  const guessers = guesserOrder(room);
  if (guessers.length === 0) {
    room.currentGuesserId = null;
    return;
  }
  if (!afterPlayerId) {
    room.currentGuesserId = guessers[0].id;
    return;
  }
  const idx = guessers.findIndex((p) => p.id === afterPlayerId);
  const next = guessers[(idx + 1) % guessers.length];
  room.currentGuesserId = next.id;
}

function beginSettingPhase(room: Room) {
  room.phase = "setting";
  room.secret = null;
  room.guesses = [];
  room.lastRoundWinnerId = null;
  room.currentGuesserId = null;

  const connected = room.players.filter((p) => p.connected);
  if (connected.length === 0) return;

  room.setterIndex = room.setterIndex % connected.length;
  const setter = connected[room.setterIndex];
  room.setterId = setter.id;
}

function beginGuessingPhase(room: Room) {
  room.phase = "guessing";
  setNextGuesser(room, null);
}

function advanceAfterRound(room: Room) {
  room.round += 1;
  if (room.round > room.maxRounds) {
    room.phase = "finished";
    const top = [...room.players].sort((a, b) => b.score - a.score)[0];
    room.winnerId = top?.id ?? null;
    room.setterId = null;
    room.currentGuesserId = null;
    return;
  }
  room.setterIndex += 1;
  beginSettingPhase(room);
}

function createRoom(hostName: string, maxRounds = 4): { room: Room; playerId: string } {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();

  const playerId = crypto.randomUUID();
  const room: Room = {
    code,
    phase: "lobby",
    players: [
      {
        id: playerId,
        name: hostName.trim().slice(0, 12) || "房主",
        score: 0,
        isHost: true,
        connected: true,
        socketId: null,
      },
    ],
    setterId: null,
    currentGuesserId: null,
    round: 1,
    maxRounds: Math.min(12, Math.max(1, maxRounds)),
    guesses: [],
    winnerId: null,
    lastRoundWinnerId: null,
    digitCount: DIGIT_COUNT,
    secret: null,
    setterIndex: 0,
  };
  rooms.set(code, room);
  return { room, playerId };
}

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: isProd
      ? false
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
  },
});

app.get("/health", (_req, res) => res.json({ ok: true }));

if (isProd) {
  const clientDist = path.join(__dirname, "../dist/client");
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/socket.io")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.on("room:create", (payload, ack) => {
    try {
      const name = (payload?.name || "").trim();
      if (!name) {
        ack({ ok: false, error: "請輸入暱稱" });
        return;
      }
      const { room, playerId } = createRoom(name, payload?.maxRounds);
      const player = room.players[0];
      player.socketId = socket.id;
      socket.join(room.code);
      socketToRoom.set(socket.id, { roomCode: room.code, playerId });
      ack({ ok: true, room: toPublic(room), playerId });
      broadcast(io, room);
    } catch {
      ack({ ok: false, error: "建立房間失敗" });
    }
  });

  socket.on("room:join", (payload, ack) => {
    try {
      const code = (payload?.code || "").trim().toUpperCase();
      const name = (payload?.name || "").trim();
      if (!name) {
        ack({ ok: false, error: "請輸入暱稱" });
        return;
      }
      const room = rooms.get(code);
      if (!room) {
        ack({ ok: false, error: "找不到這個房間" });
        return;
      }
      if (room.phase !== "lobby") {
        ack({ ok: false, error: "遊戲已開始，無法加入" });
        return;
      }
      if (room.players.length >= 8) {
        ack({ ok: false, error: "房間已滿（最多 8 人）" });
        return;
      }

      const playerId = crypto.randomUUID();
      room.players.push({
        id: playerId,
        name: uniqueName(room, name),
        score: 0,
        isHost: false,
        connected: true,
        socketId: socket.id,
      });
      socket.join(room.code);
      socketToRoom.set(socket.id, { roomCode: room.code, playerId });
      ack({ ok: true, room: toPublic(room), playerId });
      broadcast(io, room);
    } catch {
      ack({ ok: false, error: "加入房間失敗" });
    }
  });

  socket.on("room:start", (_payload, ack) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) {
      ack({ ok: false, error: "尚未加入房間" });
      return;
    }
    const room = rooms.get(ref.roomCode);
    if (!room) {
      ack({ ok: false, error: "房間不存在" });
      return;
    }
    const player = room.players.find((p) => p.id === ref.playerId);
    if (!player?.isHost) {
      ack({ ok: false, error: "只有房主可以開始" });
      return;
    }
    if (room.players.filter((p) => p.connected).length < 2) {
      ack({ ok: false, error: "至少需要 2 位玩家" });
      return;
    }
    if (room.phase !== "lobby") {
      ack({ ok: false, error: "遊戲已開始" });
      return;
    }

    room.round = 1;
    room.setterIndex = 0;
    room.winnerId = null;
    beginSettingPhase(room);
    ack({ ok: true });
    broadcast(io, room);
    notifySetter(io, room);
  });

  socket.on("game:setSecret", (payload, ack) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) {
      ack({ ok: false, error: "尚未加入房間" });
      return;
    }
    const room = rooms.get(ref.roomCode);
    if (!room) {
      ack({ ok: false, error: "房間不存在" });
      return;
    }
    if (room.phase !== "setting" || room.setterId !== ref.playerId) {
      ack({ ok: false, error: "現在不是你出題" });
      return;
    }
    const secret = (payload?.secret || "").trim();
    if (!isValidSecret(secret, room.digitCount)) {
      ack({
        ok: false,
        error: `請輸入 ${room.digitCount} 位不重複數字`,
      });
      return;
    }
    room.secret = secret;
    beginGuessingPhase(room);
    ack({ ok: true });
    broadcast(io, room);
  });

  socket.on("game:guess", (payload, ack) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) {
      ack({ ok: false, error: "尚未加入房間" });
      return;
    }
    const room = rooms.get(ref.roomCode);
    if (!room) {
      ack({ ok: false, error: "房間不存在" });
      return;
    }
    if (room.phase !== "guessing") {
      ack({ ok: false, error: "現在不能猜" });
      return;
    }
    if (room.currentGuesserId !== ref.playerId) {
      ack({ ok: false, error: "還沒輪到你" });
      return;
    }
    if (!room.secret) {
      ack({ ok: false, error: "題目尚未設定" });
      return;
    }

    const guess = (payload?.guess || "").trim();
    if (!isValidSecret(guess, room.digitCount)) {
      ack({
        ok: false,
        error: `請輸入 ${room.digitCount} 位不重複數字`,
      });
      return;
    }

    const player = room.players.find((p) => p.id === ref.playerId);
    if (!player) {
      ack({ ok: false, error: "玩家不存在" });
      return;
    }

    const { a, b } = scoreGuess(room.secret, guess);
    room.guesses.unshift({
      playerId: player.id,
      playerName: player.name,
      guess,
      a,
      b,
      at: Date.now(),
    });

    if (a === room.digitCount) {
      player.score += 1;
      room.lastRoundWinnerId = player.id;
      room.phase = "round_end";
      room.currentGuesserId = null;
      ack({ ok: true, a, b });
      broadcast(io, room);
      return;
    }

    setNextGuesser(room, player.id);
    ack({ ok: true, a, b });
    broadcast(io, room);
  });

  socket.on("game:nextRound", (_payload, ack) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) {
      ack({ ok: false, error: "尚未加入房間" });
      return;
    }
    const room = rooms.get(ref.roomCode);
    if (!room) {
      ack({ ok: false, error: "房間不存在" });
      return;
    }
    const player = room.players.find((p) => p.id === ref.playerId);
    if (!player?.isHost) {
      ack({ ok: false, error: "只有房主可以進入下一局" });
      return;
    }
    if (room.phase !== "round_end" && room.phase !== "finished") {
      ack({ ok: false, error: "現在不能進入下一局" });
      return;
    }
    if (room.phase === "finished") {
      // rematch: reset scores and restart
      for (const p of room.players) p.score = 0;
      room.round = 1;
      room.setterIndex = 0;
      room.winnerId = null;
      room.lastRoundWinnerId = null;
      beginSettingPhase(room);
      ack({ ok: true });
      broadcast(io, room);
      notifySetter(io, room);
      return;
    }

    advanceAfterRound(room);
    ack({ ok: true });
    broadcast(io, room);
    notifySetter(io, room);
  });

  socket.on("room:leave", () => {
    handleDisconnect(socket.id, false);
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket.id, true);
  });

  function handleDisconnect(socketId: string, soft: boolean) {
    const ref = socketToRoom.get(socketId);
    if (!ref) return;
    socketToRoom.delete(socketId);
    const room = rooms.get(ref.roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === ref.playerId);
    if (!player) return;

    player.connected = false;
    player.socketId = null;

    if (!soft) {
      room.players = room.players.filter((p) => p.id !== player.id);
    }

    if (room.players.every((p) => !p.connected) || room.players.length === 0) {
      rooms.delete(room.code);
      return;
    }

    if (player.isHost) {
      const nextHost = room.players.find((p) => p.connected) || room.players[0];
      if (nextHost) {
        for (const p of room.players) p.isHost = p.id === nextHost.id;
      }
    }

    if (room.phase === "setting" && room.setterId === player.id) {
      beginSettingPhase(room);
    } else if (room.phase === "guessing" && room.currentGuesserId === player.id) {
      setNextGuesser(room, player.id);
      if (!room.currentGuesserId) {
        // no guessers left
        room.phase = "lobby";
        room.secret = null;
      }
    }

    broadcast(io, room);
  }
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`幾A幾B server on http://0.0.0.0:${PORT}`);
});
