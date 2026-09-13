import { getLegalMoves } from "@shared/engine";
import { COLOR_HEX, COLOR_LABEL, type GameState, type Move } from "@shared/types";
import { useMemo, useState } from "react";
import { Board } from "./Board";
import { DiceCup } from "./DiceCup";

type Props = {
  state: GameState;
  canAct: boolean;
  rolling: boolean;
  youName?: string;
  onRoll: () => void;
  onMove: (move: Move) => void;
  onExit: () => void;
  onRematch?: () => void;
};

export function GameScreen({
  state,
  canAct,
  rolling,
  youName,
  onRoll,
  onMove,
  onExit,
  onRematch,
}: Props) {
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const legal = useMemo(() => getLegalMoves(state), [state]);
  const current = state.players[state.current];
  const winner = state.winnerIndex != null ? state.players[state.winnerIndex] : null;

  const hint = winner
    ? `${winner.name} 勝出`
    : state.phase === "rolling"
      ? `${current.name} 請擲骰`
      : `${current.name} 請走馬${legal.some((m) => m.kind === "exit") ? "（可出廄）" : ""}`;

  return (
    <>
      <div className="toolbar">
        <div>
          <div className="brand-kicker">CỜ CÁ NGỰA</div>
          <strong>越南賽馬</strong>
          {youName ? <span className="muted"> · 你是 {youName}</span> : null}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={onExit}>
            離開
          </button>
        </div>
      </div>
      <p className="hint">{hint}</p>
      <div className="game-shell">
        <div className="board-wrap">
          <Board
            state={state}
            legal={legal}
            selectedHorse={selectedHorse}
            canAct={canAct && state.phase === "moving"}
            onSelectHorse={setSelectedHorse}
            onChooseMove={(move) => {
              setSelectedHorse(null);
              onMove(move);
            }}
          />
        </div>
        <aside className="sidebar">
          {state.players.map((player, index) => {
            const home = player.horses.filter((h) => h.zone === "home").length;
            const track = player.horses.filter((h) => h.zone === "path").length;
            return (
              <div key={player.color} className={`player-card${index === state.current ? " active" : ""}`}>
                <div>
                  <span className="swatch" style={{ background: COLOR_HEX[player.color] }} />
                  <b>{player.name}</b>
                  {player.isBot ? <span className="muted"> · 電腦</span> : null}
                </div>
                <div className="muted">
                  {COLOR_LABEL[player.color]} · 跑道 {track} · 馬槽 {home}
                </div>
              </div>
            );
          })}
          <div className="panel dice-cup">
            <DiceCup
              value={state.dice}
              rolling={rolling}
              disabled={!canAct || state.phase !== "rolling" || !!winner}
              onRoll={onRoll}
            />
          </div>
          <div className="panel">
            <h2 style={{ fontSize: 20 }}>賽況</h2>
            <div className="log">
              <ul>
                {state.log.slice(0, 8).map((line, i) => (
                  <li key={`${line}-${i}`}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
      {winner ? (
        <div className="overlay">
          <div className="rules-box" style={{ textAlign: "center" }}>
            <div className="brand-kicker">VỀ ĐÍCH</div>
            <h2>{winner.name} 的馬先入槽</h2>
            <p className="muted">四匹{COLOR_LABEL[winner.color]}佔滿 3、4、5、6 號槽，這局結束。</p>
            <div className="row" style={{ justifyContent: "center" }}>
              {onRematch ? (
                <button className="btn" onClick={onRematch}>
                  再來一局
                </button>
              ) : null}
              <button className="btn ghost" onClick={onExit}>
                回主選單
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
