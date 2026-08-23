import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, RoomPublic, ServerToClientEvents } from "../shared/types.js";

type S = Socket<ServerToClientEvents, ClientToServerEvents>;

function connect(): Promise<S> {
  return new Promise((resolve, reject) => {
    const s = io("http://localhost:3001", { transports: ["websocket"] });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });
}

function waitRoom(s: S, pred: (r: RoomPublic) => boolean, ms = 5000): Promise<RoomPublic> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout waiting room")), ms);
    const handler = (r: RoomPublic) => {
      if (pred(r)) {
        clearTimeout(t);
        s.off("room:update", handler);
        resolve(r);
      }
    };
    s.on("room:update", handler);
  });
}

function ack<T>(fn: (cb: (res: T) => void) => void): Promise<T> {
  return new Promise((resolve) => fn(resolve));
}

async function main() {
  const host = await connect();
  const guest = await connect();

  const created = await ack<{ ok: true; room: RoomPublic; playerId: string } | { ok: false; error: string }>((cb) =>
    host.emit("room:create", { name: "阿明", maxRounds: 2 }, cb)
  );
  if (!created.ok) throw new Error(created.error);
  console.log("created", created.room.code);

  const joined = await ack<{ ok: true; room: RoomPublic; playerId: string } | { ok: false; error: string }>((cb) =>
    guest.emit("room:join", { code: created.room.code, name: "小華" }, cb)
  );
  if (!joined.ok) throw new Error(joined.error);
  console.log("joined players", joined.room.players.map((p) => p.name).join(","));

  const start = await ack<{ ok: true } | { ok: false; error: string }>((cb) => host.emit("room:start", {}, cb));
  if (!start.ok) throw new Error(start.error);

  let room = await waitRoom(host, (r) => r.phase === "setting");
  console.log("setting by", room.setterId === created.playerId ? "阿明" : "小華");

  const setterSock = room.setterId === created.playerId ? host : guest;
  const guesserSock = room.setterId === created.playerId ? guest : host;

  const set = await ack<{ ok: true } | { ok: false; error: string }>((cb) =>
    setterSock.emit("game:setSecret", { secret: "0418" }, cb)
  );
  if (!set.ok) throw new Error(set.error);

  room = await waitRoom(guesserSock, (r) => r.phase === "guessing");
  const miss = await ack<{ ok: true; a: number; b: number } | { ok: false; error: string }>((cb) =>
    guesserSock.emit("game:guess", { guess: "1234" }, cb)
  );
  if (!miss.ok) throw new Error(miss.error);
  console.log("miss", miss);

  // only 2 players: after miss, still same guesser's turn (only one guesser)
  room = await waitRoom(guesserSock, (r) => r.guesses.length >= 1);
  const hit = await ack<{ ok: true; a: number; b: number } | { ok: false; error: string }>((cb) =>
    guesserSock.emit("game:guess", { guess: "0418" }, cb)
  );
  if (!hit.ok) throw new Error(hit.error);
  console.log("hit", hit);

  room = await waitRoom(host, (r) => r.phase === "round_end");
  console.log("round end winner", room.lastRoundWinnerId === joined.playerId || room.lastRoundWinnerId === created.playerId);

  const next = await ack<{ ok: true } | { ok: false; error: string }>((cb) => host.emit("game:nextRound", {}, cb));
  if (!next.ok) throw new Error(next.error);
  room = await waitRoom(host, (r) => r.phase === "setting" && r.round === 2);
  console.log("round 2 setting ok");

  host.disconnect();
  guest.disconnect();
  console.log("ALL PASS");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
