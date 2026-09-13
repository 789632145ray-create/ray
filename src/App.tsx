import { chooseAiMove } from "@shared/ai";
import { applyMove, createGame, rollDice } from "@shared/engine";
import { COLOR_LABEL, type GameState, type Move, type RoomState } from "@shared/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { soundCapture, soundMove, soundRoll, soundWin, unlockAudio } from "./audio";
import { GameScreen } from "./components/GameScreen";
import { RulesModal } from "./components/RulesModal";

type View = "menu" | "local-setup" | "local-game" | "online-entry" | "online-room" | "online-game";
type LocalKind = "hotseat" | "ai";

const BOT_NAMES = ["阿明", "小蓮", "阿雄"];

function playMoveSound(prev: GameState, next: GameState): void {
  if (next.winnerIndex != null && prev.winnerIndex == null) {
    soundWin();
    return;
  }
  const captured = next.log[0]?.includes("踢回");
  if (captured) soundCapture();
  else soundMove();
}

export function App() {
  const [view, setView] = useState<View>("menu");
  const [showRules, setShowRules] = useState(false);
  const [localKind, setLocalKind] = useState<LocalKind>("hotseat");
  const [playerCount, setPlayerCount] = useState(4);
  const [yourName, setYourName] = useState("玩家");
  const [localGame, setLocalGame] = useState<GameState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);

  const socket = useMemo(() => {
    const client = io({ autoConnect: false });
    socketRef.current = client;
    return client;
  }, []);

  useEffect(() => {
    const onRoom = (next: RoomState) => {
      setRoom((prev) => {
        if (prev?.game && next.game) playMoveSound(prev.game, next.game);
        return next;
      });
      if (next.status === "playing" || next.status === "finished") setView("online-game");
      if (next.status === "lobby") setView("online-room");
    };
    const onJoined = ({ playerId: id, room: next }: { playerId: string; room: RoomState }) => {
      setPlayerId(id);
      setRoom(next);
      setError("");
      setView(next.status === "lobby" ? "online-room" : "online-game");
    };
    const onError = (message: string) => {
      setError(message);
      setRolling(false);
    };
    socket.on("room", onRoom);
    socket.on("joined", onJoined);
    socket.on("error-message", onError);
    return () => {
      socket.off("room", onRoom);
      socket.off("joined", onJoined);
      socket.off("error-message", onError);
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (view !== "local-game" || !localGame || localGame.phase === "finished") return;
    const actor = localGame.players[localGame.current];
    if (!actor.isBot) return;
    const timer = window.setTimeout(() => {
      setLocalGame((current) => {
        if (!current || current.phase === "finished") return current;
        const bot = current.players[current.current];
        if (!bot.isBot) return current;
        try {
          if (current.phase === "rolling") {
            soundRoll();
            return rollDice(current);
          }
          const move = chooseAiMove(current);
          if (!move) return current;
          const next = applyMove(current, move);
          playMoveSound(current, next);
          return next;
        } catch {
          return current;
        }
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [view, localGame]);

  useEffect(() => {
    if (!rolling || view !== "online-game") return;
    if (room?.game?.lastDice == null) return;
    const timer = window.setTimeout(() => setRolling(false), 420);
    return () => window.clearTimeout(timer);
  }, [rolling, view, room?.game?.lastDice, room?.game?.rollsThisTurn]);

  function startLocal() {
    unlockAudio();
    const count = localKind === "ai" ? playerCount : playerCount;
    const names =
      localKind === "ai"
        ? [yourName.trim() || "你", ...BOT_NAMES.slice(0, count - 1)]
        : Array.from({ length: count }, (_, i) => (i === 0 ? yourName.trim() || "紅方" : `${["綠", "黃", "藍"][i - 1]}方`));
    const bots = localKind === "ai" ? names.map((_, i) => i !== 0) : names.map(() => false);
    setLocalGame(createGame(names, { bots }));
    setView("local-game");
  }

  function rollLocal() {
    if (!localGame || localGame.phase !== "rolling") return;
    setRolling(true);
    soundRoll();
    window.setTimeout(() => {
      setLocalGame((current) => {
        if (!current || current.phase !== "rolling") return current;
        try {
          return rollDice(current);
        } catch {
          return current;
        }
      });
      setRolling(false);
    }, 380);
  }

  function moveLocal(move: Move) {
    setLocalGame((current) => {
      if (!current || current.phase !== "moving") return current;
      try {
        const next = applyMove(current, move);
        playMoveSound(current, next);
        return next;
      } catch {
        return current;
      }
    });
  }

  function ensureSocket() {
    if (!socket.connected) socket.connect();
  }

  function createRoom() {
    unlockAudio();
    setError("");
    ensureSocket();
    socket.emit("create-room", { name: yourName });
  }

  function joinRoom() {
    unlockAudio();
    setError("");
    ensureSocket();
    socket.emit("join-room", { roomId: roomCode.trim().toUpperCase(), name: yourName });
  }

  const you = room?.players.find((p) => p.id === playerId);
  const onlineCanAct = Boolean(
    room?.game &&
      you &&
      room.game.winnerIndex == null &&
      room.players[room.game.current]?.id === you.id &&
      !you.isBot,
  );

  return (
    <div className="app">
      {view === "menu" ? (
        <>
          <header className="brand">
            <div className="brand-kicker">ONLINE BOARD GAME</div>
            <h1>越南賽馬</h1>
            <p>Cờ Cá Ngựa · 出廄 · 踢馬 · 搶槽</p>
          </header>
          <div className="menu-grid">
            <button
              className="mode-card"
              onClick={() => {
                setLocalKind("ai");
                setPlayerCount(4);
                setView("local-setup");
              }}
            >
              <h2>挑戰電腦</h2>
              <p>一個人也能開賽。電腦會搶踢、搶槽，適合先熟規則。</p>
            </button>
            <button
              className="mode-card"
              onClick={() => {
                setLocalKind("hotseat");
                setPlayerCount(4);
                setView("local-setup");
              }}
            >
              <h2>本機同樂</h2>
              <p>同一台裝置輪流擲骰走馬，適合圍在一起玩。</p>
            </button>
            <button className="mode-card" onClick={() => setView("online-entry")}>
              <h2>線上房間</h2>
              <p>建立或加入四字房號，和朋友連線對戰，也能加電腦補位。</p>
            </button>
          </div>
          <div className="row" style={{ marginTop: 22 }}>
            <button className="btn ghost" onClick={() => setShowRules(true)}>
              規則說明
            </button>
          </div>
        </>
      ) : null}

      {view === "local-setup" ? (
        <section className="panel">
          <h2>{localKind === "ai" ? "挑戰電腦" : "本機同樂"}</h2>
          <div className="field">
            <label>你的名字</label>
            <input value={yourName} maxLength={12} onChange={(e) => setYourName(e.target.value)} />
          </div>
          <div className="field">
            <label>{localKind === "ai" ? "總人數（含你）" : "玩家人數"}</label>
            <div className="row">
              {[2, 3, 4].map((n) => (
                <button key={n} className={playerCount === n ? "btn" : "btn ghost"} onClick={() => setPlayerCount(n)}>
                  {n} 人
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={startLocal}>
              開賽
            </button>
            <button className="btn ghost" onClick={() => setView("menu")}>
              返回
            </button>
          </div>
        </section>
      ) : null}

      {view === "local-game" && localGame ? (
        <GameScreen
          state={localGame}
          canAct={!localGame.players[localGame.current].isBot}
          rolling={rolling}
          youName={yourName}
          onRoll={rollLocal}
          onMove={moveLocal}
          onExit={() => {
            setLocalGame(null);
            setView("menu");
          }}
          onRematch={startLocal}
        />
      ) : null}

      {view === "online-entry" ? (
        <section className="panel">
          <h2>線上房間</h2>
          <div className="field">
            <label>你的名字</label>
            <input value={yourName} maxLength={12} onChange={(e) => setYourName(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn" onClick={createRoom}>
              建立房間
            </button>
          </div>
          <div className="field">
            <label>或輸入房號加入</label>
            <input
              value={roomCode}
              maxLength={4}
              placeholder="例如 7K3P"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="row">
            <button className="btn" onClick={joinRoom} disabled={roomCode.trim().length < 4}>
              加入
            </button>
            <button className="btn ghost" onClick={() => setView("menu")}>
              返回
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : null}

      {view === "online-room" && room ? (
        <section className="panel">
          <div className="brand-kicker">ROOM</div>
          <div className="room-code">{room.id}</div>
          <p className="muted">把房號傳給朋友。滿兩人就能開賽，空位可加電腦。</p>
          <button className="btn ghost" onClick={() => void navigator.clipboard.writeText(room.id)}>
            複製房號
          </button>
          <div className="seat-list">
            {room.players.map((player) => (
              <div className="seat" key={player.id}>
                <div>
                  <b>{player.name}</b>
                  <div className="muted">
                    {player.isHost ? "房主" : player.isBot ? "電腦" : "玩家"}
                    {player.color ? ` · ${COLOR_LABEL[player.color]}` : ""}
                  </div>
                </div>
                {you?.isHost && !player.isHost ? (
                  <button className="btn ghost" onClick={() => socket.emit("remove-player", { playerId: player.id })}>
                    移除
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="row">
            {you?.isHost ? (
              <>
                <button className="btn ghost" onClick={() => socket.emit("add-bot")} disabled={room.players.length >= 4}>
                  加電腦
                </button>
                <button className="btn" onClick={() => socket.emit("start-game")} disabled={room.players.length < 2}>
                  開始比賽
                </button>
              </>
            ) : (
              <p className="muted">等候房主開賽…</p>
            )}
            <button
              className="btn ghost"
              onClick={() => {
                socket.emit("leave");
                setRoom(null);
                setView("menu");
              }}
            >
              離開
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : null}

      {view === "online-game" && room?.game ? (
        <GameScreen
          state={room.game}
          canAct={onlineCanAct}
          rolling={rolling}
          youName={you?.name}
          onRoll={() => {
            setRolling(true);
            soundRoll();
            socket.emit("roll");
          }}
          onMove={(move) => socket.emit("move", { move })}
          onExit={() => {
            socket.emit("leave");
            setRoom(null);
            setView("menu");
          }}
        />
      ) : null}

      {showRules ? <RulesModal onClose={() => setShowRules(false)} /> : null}
    </div>
  );
}
