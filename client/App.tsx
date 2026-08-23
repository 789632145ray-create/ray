import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { RoomPublic } from "@shared/types";
import { DIGIT_COUNT } from "@shared/types";
import { formatAB } from "@shared/game";
import { createSocket, type AppSocket } from "./socket";

type Screen = "home" | "room";

function useSocket() {
  const [socket, setSocket] = useState<AppSocket | null>(null);

  useEffect(() => {
    const s = createSocket();
    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  return socket;
}

function whenConnected(socket: AppSocket, run: () => void) {
  if (socket.connected) {
    run();
    return;
  }
  socket.once("connect", run);
}

export default function App() {
  const socket = useSocket();
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [maxRounds, setMaxRounds] = useState(4);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [guessInput, setGuessInput] = useState("");

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (next: RoomPublic) => setRoom(next);
    const onErr = (message: string) => setError(message);
    socket.on("room:update", onUpdate);
    socket.on("error:message", onErr);
    return () => {
      socket.off("room:update", onUpdate);
      socket.off("error:message", onErr);
    };
  }, [socket]);

  const me = useMemo(
    () => room?.players.find((p) => p.id === playerId) ?? null,
    [room, playerId]
  );

  const isSetter = room?.setterId === playerId;
  const isMyTurn = room?.phase === "guessing" && room.currentGuesserId === playerId;
  const setter = room?.players.find((p) => p.id === room.setterId) ?? null;
  const currentGuesser = room?.players.find((p) => p.id === room.currentGuesserId) ?? null;
  const lastWinner = room?.players.find((p) => p.id === room.lastRoundWinnerId) ?? null;
  const champion = room?.players.find((p) => p.id === room.winnerId) ?? null;

  if (!socket) {
    return (
      <div className="app-shell">
        <p className="muted">連線中…</p>
      </div>
    );
  }

  const sock = socket;

  function enterRoom(nextRoom: RoomPublic, id: string) {
    setRoom(nextRoom);
    setPlayerId(id);
    setScreen("room");
    setError(null);
    setSecretInput("");
    setGuessInput("");
  }

  function createRoom() {
    setBusy(true);
    setError(null);
    whenConnected(sock, () => {
      sock.emit("room:create", { name, maxRounds }, (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        enterRoom(res.room, res.playerId);
      });
    });
  }

  function joinRoom() {
    setBusy(true);
    setError(null);
    whenConnected(sock, () => {
      sock.emit("room:join", { code, name }, (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        enterRoom(res.room, res.playerId);
      });
    });
  }

  function startGame() {
    setBusy(true);
    sock.emit("room:start", {}, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  }

  function submitSecret() {
    setBusy(true);
    sock.emit("game:setSecret", { secret: secretInput }, (res) => {
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSecretInput("");
      setError(null);
    });
  }

  function submitGuess() {
    setBusy(true);
    sock.emit("game:guess", { guess: guessInput }, (res) => {
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGuessInput("");
      setError(null);
    });
  }

  function nextRound() {
    setBusy(true);
    sock.emit("game:nextRound", {}, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  }

  function leaveRoom() {
    sock.emit("room:leave");
    setScreen("home");
    setRoom(null);
    setPlayerId(null);
    setError(null);
  }

  if (screen === "home") {
    return (
      <div className="app-shell">
        <HomeHero />
        <section className="surface rise-in" style={{ marginTop: "2rem", borderRadius: 28, padding: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <Tab active={mode === "create"} onClick={() => setMode("create")}>
              開新房間
            </Tab>
            <Tab active={mode === "join"} onClick={() => setMode("join")}>
              加入房間
            </Tab>
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="field">
              <label htmlFor="name">暱稱</label>
              <input
                id="name"
                value={name}
                maxLength={12}
                placeholder="你的名字"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") mode === "create" ? createRoom() : joinRoom();
                }}
              />
            </div>

            {mode === "create" ? (
              <div className="field">
                <label htmlFor="rounds">局數（輪流出題）</label>
                <input
                  id="rounds"
                  type="number"
                  min={1}
                  max={12}
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(Number(e.target.value) || 4)}
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="code">房間代碼</label>
                <input
                  id="code"
                  value={code}
                  maxLength={6}
                  placeholder="例如 AB3K"
                  style={{ textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "var(--font-display)" }}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") joinRoom();
                  }}
                />
              </div>
            )}

            {error && <div className="error-banner">{error}</div>}

            <button
              className="btn btn-primary"
              disabled={busy || !name.trim() || (mode === "join" && !code.trim())}
              onClick={mode === "create" ? createRoom : joinRoom}
            >
              {mode === "create" ? "建立房間" : "進入房間"}
            </button>
          </div>
        </section>

        <Rules />
      </div>
    );
  }

  if (!room || !me) return null;

  return (
    <div className="app-shell">
      <header
        className="rise-in"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <div className="brand-mark" style={{ fontSize: "clamp(1.8rem, 5vw, 2.4rem)" }}>
            幾<span className="ab">A</span>幾<span className="ab">B</span>
          </div>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.92rem" }}>
            房間 <span style={{ color: varAmber, fontFamily: "var(--font-display)", letterSpacing: "0.12em" }}>{room.code}</span>
            {" · "}第 {room.round}/{room.maxRounds} 局
          </p>
        </div>
        <button className="btn btn-ghost" onClick={leaveRoom}>
          離開
        </button>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(240px, 0.8fr)",
          gap: "1rem",
        }}
        className="room-grid"
      >
        <main className="surface rise-in" style={{ borderRadius: 28, padding: "1.35rem", minHeight: 360 }}>
          {room.phase === "lobby" && (
            <LobbyPanel room={room} meHost={me.isHost} busy={busy} onStart={startGame} error={error} />
          )}

          {room.phase === "setting" && (
            <SettingPanel
              isSetter={isSetter}
              setterName={setter?.name ?? "出題者"}
              secretInput={secretInput}
              setSecretInput={setSecretInput}
              onSubmit={submitSecret}
              busy={busy}
              error={error}
              digitCount={room.digitCount}
            />
          )}

          {room.phase === "guessing" && (
            <GuessingPanel
              isSetter={isSetter}
              isMyTurn={isMyTurn}
              guesserName={currentGuesser?.name ?? "—"}
              guessInput={guessInput}
              setGuessInput={setGuessInput}
              onSubmit={submitGuess}
              busy={busy}
              error={error}
              digitCount={room.digitCount}
              guesses={room.guesses}
            />
          )}

          {room.phase === "round_end" && (
            <RoundEndPanel
              winnerName={lastWinner?.name ?? "有人"}
              secretRevealed={false}
              meHost={me.isHost}
              busy={busy}
              onNext={nextRound}
              guesses={room.guesses}
              isLastRound={room.round >= room.maxRounds}
            />
          )}

          {room.phase === "finished" && (
            <FinishedPanel
              championName={champion?.name ?? "優勝者"}
              players={room.players}
              meHost={me.isHost}
              busy={busy}
              onRematch={nextRound}
            />
          )}
        </main>

        <aside className="surface rise-in" style={{ borderRadius: 28, padding: "1.2rem", animationDelay: "80ms" }}>
          <h2 style={{ margin: "0 0 0.85rem", fontSize: "1rem", fontWeight: 700 }}>玩家</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.55rem" }}>
            {[...room.players]
              .sort((a, b) => b.score - a.score)
              .map((p) => {
                const badges: string[] = [];
                if (p.isHost) badges.push("房主");
                if (room.setterId === p.id && room.phase !== "lobby" && room.phase !== "finished") badges.push("出題");
                if (room.currentGuesserId === p.id) badges.push("猜題中");
                return (
                  <li
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.7rem 0.8rem",
                      borderRadius: 14,
                      background: p.id === playerId ? "rgba(62, 207, 142, 0.12)" : "rgba(0,0,0,0.18)",
                      border: "1px solid var(--line)",
                      opacity: p.connected ? 1 : 0.45,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {p.name}
                        {p.id === playerId ? "（你）" : ""}
                      </div>
                      {badges.length > 0 && (
                        <div className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
                          {badges.join(" · ")}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--amber)" }}>
                      {p.score}
                    </div>
                  </li>
                );
              })}
          </ul>
        </aside>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .room-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const varAmber = "var(--amber)";

function HomeHero() {
  return (
    <section className="rise-in" style={{ paddingTop: "clamp(1.5rem, 6vw, 3.5rem)" }}>
      <p className="muted" style={{ margin: "0 0 0.75rem", letterSpacing: "0.18em", fontSize: "0.78rem", textTransform: "uppercase" }}>
        online parlor game
      </p>
      <h1 className="brand-mark" style={{ fontSize: "clamp(3.2rem, 12vw, 5.6rem)", margin: 0 }}>
        幾<span className="ab">A</span>幾<span className="ab">B</span>
      </h1>
      <p style={{ margin: "1rem 0 0", maxWidth: "34rem", fontSize: "1.05rem", lineHeight: 1.65, color: "var(--ink-muted)" }}>
        開房間、傳代碼，輪流出一個不重複的四位數；其餘玩家輪流猜，看誰先拿到 4A。
      </p>
      <div
        aria-hidden
        style={{
          marginTop: "1.75rem",
          display: "flex",
          gap: "0.55rem",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2rem, 8vw, 3rem)",
          fontWeight: 800,
        }}
      >
        {["0", "4", "1", "8"].map((d, i) => (
          <span
            key={d + i}
            className="guess-row"
            style={{
              width: "clamp(3rem, 12vw, 4.2rem)",
              aspectRatio: "1",
              display: "grid",
              placeItems: "center",
              borderRadius: 16,
              background: "rgba(62, 207, 142, 0.12)",
              border: "1px solid rgba(62, 207, 142, 0.35)",
              animationDelay: `${i * 90}ms`,
            }}
          >
            {d}
          </span>
        ))}
        <span
          style={{
            alignSelf: "center",
            marginLeft: "0.4rem",
            color: "var(--amber)",
            fontSize: "clamp(1.2rem, 4vw, 1.6rem)",
            letterSpacing: "0.04em",
          }}
        >
          2A1B
        </span>
      </div>
    </section>
  );
}

function Rules() {
  return (
    <section className="rise-in" style={{ marginTop: "2rem", animationDelay: "120ms" }}>
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.6rem" }}>怎麼玩</h2>
      <ol className="muted" style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.8, fontSize: "0.95rem" }}>
        <li>每位玩家輪流當出題者，設定 {DIGIT_COUNT} 位「數字不重複」的密碼。</li>
        <li>其餘玩家依序猜題。數字對且位置對是 A，數字對但位置錯是 B。</li>
        <li>猜中 {DIGIT_COUNT}A 得分，換下一位出題；打完設定局數後分數最高者獲勝。</li>
      </ol>
    </section>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn"
      style={{
        background: active ? "rgba(62, 207, 142, 0.16)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-muted)",
        border: active ? "1px solid rgba(62, 207, 142, 0.4)" : "1px solid transparent",
        padding: "0.55rem 1rem",
      }}
    >
      {children}
    </button>
  );
}

function LobbyPanel({
  room,
  meHost,
  busy,
  onStart,
  error,
}: {
  room: RoomPublic;
  meHost: boolean;
  busy: boolean;
  onStart: () => void;
  error: string | null;
}) {
  return (
    <div>
      <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.45rem" }}>等待玩家加入</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        把房間代碼 <strong style={{ color: "var(--amber)", letterSpacing: "0.12em" }}>{room.code}</strong> 傳給朋友。至少 2 人即可開始。
      </p>
      {error && <div className="error-banner" style={{ marginBottom: "1rem" }}>{error}</div>}
      {meHost ? (
        <button className="btn btn-primary" disabled={busy || room.players.length < 2} onClick={onStart}>
          開始遊戲
        </button>
      ) : (
        <p className="muted">等待房主開始…</p>
      )}
    </div>
  );
}

function SettingPanel({
  isSetter,
  setterName,
  secretInput,
  setSecretInput,
  onSubmit,
  busy,
  error,
  digitCount,
}: {
  isSetter: boolean;
  setterName: string;
  secretInput: string;
  setSecretInput: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  digitCount: number;
}) {
  if (!isSetter) {
    return (
      <div>
        <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.45rem" }}>出題中</h2>
        <p className="muted">
          <strong style={{ color: "var(--ink)" }}>{setterName}</strong> 正在設定密碼，請稍候…
        </p>
        <div
          className="pulse-turn"
          style={{
            marginTop: "1.5rem",
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "2px solid var(--jade)",
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.45rem" }}>輪到你出題</h2>
      <p className="muted">輸入 {digitCount} 位不重複數字，其他人看不到。</p>
      {error && <div className="error-banner" style={{ marginBottom: "1rem" }}>{error}</div>}
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="secret">密碼</label>
        <input
          id="secret"
          className="digit-input"
          inputMode="numeric"
          autoComplete="off"
          maxLength={digitCount}
          value={secretInput}
          placeholder={"•".repeat(digitCount)}
          onChange={(e) => setSecretInput(e.target.value.replace(/\D/g, "").slice(0, digitCount))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
        />
      </div>
      <button
        className="btn btn-amber"
        style={{ marginTop: "1rem" }}
        disabled={busy || secretInput.length !== digitCount}
        onClick={onSubmit}
      >
        鎖定密碼，開始猜
      </button>
    </div>
  );
}

function GuessingPanel({
  isSetter,
  isMyTurn,
  guesserName,
  guessInput,
  setGuessInput,
  onSubmit,
  busy,
  error,
  digitCount,
  guesses,
}: {
  isSetter: boolean;
  isMyTurn: boolean;
  guesserName: string;
  guessInput: string;
  setGuessInput: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  digitCount: number;
  guesses: RoomPublic["guesses"];
}) {
  return (
    <div>
      <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.45rem" }}>
        {isSetter ? "大家正在猜你的密碼" : isMyTurn ? "輪到你猜了" : `等待 ${guesserName} 猜題`}
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {isSetter ? "坐看其他人推理，密碼只有你知道。" : "A = 數字與位置都對；B = 數字對、位置錯。"}
      </p>

      {!isSetter && isMyTurn && (
        <div className={isMyTurn ? "pulse-turn" : undefined} style={{ borderRadius: 20, padding: "0.2rem" }}>
          {error && <div className="error-banner" style={{ marginBottom: "1rem" }}>{error}</div>}
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="guess">你的猜測</label>
            <input
              id="guess"
              className="digit-input"
              inputMode="numeric"
              autoComplete="off"
              maxLength={digitCount}
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value.replace(/\D/g, "").slice(0, digitCount))}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
            disabled={busy || guessInput.length !== digitCount}
            onClick={onSubmit}
          >
            送出猜測
          </button>
        </div>
      )}

      <GuessHistory guesses={guesses} />
    </div>
  );
}

function RoundEndPanel({
  winnerName,
  meHost,
  busy,
  onNext,
  guesses,
  isLastRound,
}: {
  winnerName: string;
  secretRevealed: boolean;
  meHost: boolean;
  busy: boolean;
  onNext: () => void;
  guesses: RoomPublic["guesses"];
  isLastRound: boolean;
}) {
  return (
    <div>
      <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.45rem", color: "var(--jade)" }}>
        {winnerName} 猜中了！
      </h2>
      <p className="muted">本局結束，得分 +1。{isLastRound ? "這是最後一局。" : "接著換下一位出題。"}</p>
      <GuessHistory guesses={guesses} />
      {meHost ? (
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={busy} onClick={onNext}>
          {isLastRound ? "看總成績" : "下一局"}
        </button>
      ) : (
        <p className="muted" style={{ marginTop: "1rem" }}>
          等待房主繼續…
        </p>
      )}
    </div>
  );
}

function FinishedPanel({
  championName,
  players,
  meHost,
  busy,
  onRematch,
}: {
  championName: string;
  players: RoomPublic["players"];
  meHost: boolean;
  busy: boolean;
  onRematch: () => void;
}) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  return (
    <div>
      <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.45rem" }}>遊戲結束</h2>
      <p style={{ marginTop: 0, fontSize: "1.15rem" }}>
        優勝：<strong style={{ color: "var(--amber)" }}>{championName}</strong>
      </p>
      <ol style={{ margin: "0 0 1.2rem", paddingLeft: "1.2rem", lineHeight: 1.9 }}>
        {ranked.map((p) => (
          <li key={p.id}>
            {p.name} — {p.score} 分
          </li>
        ))}
      </ol>
      {meHost ? (
        <button className="btn btn-amber" disabled={busy} onClick={onRematch}>
          再來一場
        </button>
      ) : (
        <p className="muted">等待房主決定是否再來一場…</p>
      )}
    </div>
  );
}

function GuessHistory({ guesses }: { guesses: RoomPublic["guesses"] }) {
  if (guesses.length === 0) {
    return (
      <p className="muted" style={{ marginTop: "1.5rem" }}>
        還沒有猜測紀錄。
      </p>
    );
  }
  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 style={{ margin: "0 0 0.65rem", fontSize: "0.95rem" }}>猜測紀錄</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.45rem" }}>
        {guesses.map((g) => (
          <li
            key={`${g.at}-${g.playerId}-${g.guess}`}
            className="guess-row"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "0.75rem",
              alignItems: "center",
              padding: "0.65rem 0.8rem",
              borderRadius: 12,
              background: "rgba(0,0,0,0.22)",
              border: "1px solid var(--line)",
            }}
          >
            <span className="muted" style={{ fontSize: "0.88rem" }}>
              {g.playerName}
            </span>
            <span style={{ fontFamily: "var(--font-display)", letterSpacing: "0.2em", fontWeight: 700 }}>
              {g.guess}
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                color: g.a === DIGIT_COUNT ? "var(--jade)" : "var(--amber)",
                minWidth: "3.2rem",
                textAlign: "right",
              }}
            >
              {formatAB(g.a, g.b)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
