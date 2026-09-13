import {
  HOME_CELLS,
  PATH_CELLS,
  PLAYER_START,
  YARD_RECT,
  cellForHorse,
} from "@shared/board";
import { COLOR_HEX, type Color, type GameState, type Move } from "@shared/types";

const COLORS: Color[] = ["red", "green", "yellow", "blue"];

const HORSE_PATH =
  "M10.2 3.1c.6-1.3 1.8-2.2 2.6-2.1.2 1.1-.3 2.2-1 3.1 1.3.3 2.3 1.2 2.6 2.3-.8.1-1.6 0-2.3-.3.3 1.4.1 2.8-.6 4.1-.5.9-1.3 1.6-2.2 2.1v2.2h-1.5v-1.8c-.8.1-1.6 0-2.3-.3v2.1H4.1v-2.4c-1.1-.8-1.8-2-2-3.4 1.2.3 2.4.3 3.5 0C4.8 7.1 4.6 5.4 5.2 4c.8.8 1.8 1.3 2.9 1.4.2-.8.6-1.6 1.2-2.3z";

type Props = {
  state: GameState;
  legal: Move[];
  selectedHorse: number | null;
  canAct: boolean;
  onSelectHorse: (horseId: number) => void;
  onChooseMove: (move: Move) => void;
};

function destCell(state: GameState, move: Move): { x: number; y: number } {
  const color = state.players[move.playerIndex].color;
  return cellForHorse(color, move.zone, move.progress, move.horseId);
}

export function Board({
  state,
  legal,
  selectedHorse,
  canAct,
  onSelectHorse,
  onChooseMove,
}: Props) {
  const current = state.players[state.current];
  const dests = legal
    .filter((m) => selectedHorse == null || m.horseId === selectedHorse)
    .map((m) => ({ move: m, ...destCell(state, m) }));

  function clickCell(x: number, y: number) {
    if (!canAct) return;
    const hits = dests.filter((d) => Math.abs(d.x - x) < 0.01 && Math.abs(d.y - y) < 0.01);
    if (hits.length === 1) onChooseMove(hits[0].move);
    else if (selectedHorse != null) {
      const match = hits.find((h) => h.move.horseId === selectedHorse);
      if (match) onChooseMove(match.move);
    }
  }

  return (
    <svg className="board-svg" viewBox="-0.55 -0.55 16.1 16.1" role="img" aria-label="賽馬棋盤">
      <defs>
        <radialGradient id="felt" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#2f7a4e" />
          <stop offset="100%" stopColor="#163d28" />
        </radialGradient>
        <filter id="soft">
          <feDropShadow dx="0" dy="0.08" stdDeviation="0.06" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="-0.45" y="-0.45" width="15.9" height="15.9" rx="0.55" fill="#6b3218" />
      <rect x="0" y="0" width="15" height="15" rx="0.2" fill="url(#felt)" />

      {COLORS.map((color) => (
        <g key={color}>
          <rect
            x={YARD_RECT[color].x}
            y={YARD_RECT[color].y}
            width="6"
            height="6"
            fill={COLOR_HEX[color]}
            opacity="0.92"
          />
          <rect
            x={YARD_RECT[color].x + 0.35}
            y={YARD_RECT[color].y + 0.35}
            width="5.3"
            height="5.3"
            fill="none"
            stroke="rgba(255,244,210,0.35)"
            strokeWidth="0.08"
          />
        </g>
      ))}

      {PATH_CELLS.map((cell, i) => {
        const startColor = COLORS.find((c) => PLAYER_START[c] === i);
        return (
          <g key={`p${i}`} onClick={() => clickCell(cell.x, cell.y)} style={{ cursor: "pointer" }}>
            <rect
              x={cell.x + 0.06}
              y={cell.y + 0.06}
              width="0.88"
              height="0.88"
              rx="0.12"
              fill={startColor ? COLOR_HEX[startColor] : i % 2 === 0 ? "#f3e2bf" : "#efe0b0"}
              stroke="#5a3a18"
              strokeWidth="0.03"
            />
            {startColor ? (
              <path
                d={`M${cell.x + 0.5} ${cell.y + 0.22} l0.1 0.2 0.22.03-0.16.16.04.22L${cell.x + 0.5} ${cell.y + 0.72} l-0.2.11.04-.22-0.16-.16 0.22-.03z`}
                fill="#fff6cf"
              />
            ) : null}
          </g>
        );
      })}

      {COLORS.map((color) =>
        HOME_CELLS[color].map((cell, idx) => (
          <g key={`${color}-h${idx}`} onClick={() => clickCell(cell.x, cell.y)} style={{ cursor: "pointer" }}>
            <rect
              x={cell.x + 0.06}
              y={cell.y + 0.06}
              width="0.88"
              height="0.88"
              rx="0.12"
              fill={COLOR_HEX[color]}
              stroke="#fff1c2"
              strokeWidth="0.035"
            />
            <text
              x={cell.x + 0.5}
              y={cell.y + 0.64}
              textAnchor="middle"
              fontSize="0.42"
              fill="#fff8df"
              fontWeight="700"
            >
              {idx + 1}
            </text>
          </g>
        )),
      )}

      <polygon
        points="6,6 9,6 9,9 6,9"
        fill="#7a1d1a"
        stroke="#e3c36a"
        strokeWidth="0.08"
      />
      <circle cx="7.5" cy="7.5" r="1.15" fill="#c4282a" stroke="#e3c36a" strokeWidth="0.07" />
      <text
        x="7.5"
        y="7.18"
        textAnchor="middle"
        fill="#ffe7a8"
        fontSize="0.32"
        fontFamily="Noto Serif TC, serif"
      >
        賽馬
      </text>
      <text x="7.5" y="7.62" textAnchor="middle" fill="#fff0c8" fontSize="0.42">
        🐎
      </text>
      <text x="7.5" y="8.08" textAnchor="middle" fill="#f0d27a" fontSize="0.22">
        CÁ NGỰA
      </text>

      {dests.map((d, i) => (
        <rect
          key={`d${i}`}
          x={d.x + 0.18}
          y={d.y + 0.18}
          width="0.64"
          height="0.64"
          rx="0.14"
          fill="none"
          stroke="#fff4b0"
          strokeWidth="0.07"
          opacity="0.95"
        />
      ))}

      {state.players.flatMap((player, playerIndex) =>
        player.horses.map((horse) => {
          const pos = cellForHorse(player.color, horse.zone, horse.progress, horse.id);
          const playable =
            canAct &&
            state.phase === "moving" &&
            playerIndex === state.current &&
            legal.some((m) => m.horseId === horse.id);
          const selected = playerIndex === state.current && selectedHorse === horse.id;
          return (
            <g
              key={`${player.color}-${horse.id}`}
              className={`horse-token${playable ? " is-playable" : ""}${selected ? " is-selected" : ""}`}
              transform={`translate(${pos.x + 0.5} ${pos.y + 0.5})`}
              filter="url(#soft)"
              onClick={(event) => {
                event.stopPropagation();
                if (!canAct || playerIndex !== state.current) return;
                const horseMoves = legal.filter((m) => m.horseId === horse.id);
                if (horseMoves.length === 1) onChooseMove(horseMoves[0]);
                else if (horseMoves.length > 1) onSelectHorse(horse.id);
              }}
            >
              <circle r="0.36" fill={COLOR_HEX[player.color]} stroke="#fff6d7" strokeWidth="0.05" />
              <g transform="translate(-0.17 -0.2) scale(0.026)" fill="#fff8e4">
                <path d={HORSE_PATH} />
              </g>
              <text
                y="0.26"
                textAnchor="middle"
                fill="#fff8e4"
                fontSize="0.2"
                fontWeight="700"
              >
                {horse.id + 1}
              </text>
            </g>
          );
        }),
      )}

      {current ? (
        <title>{`${current.name} 行動中`}</title>
      ) : null}
    </svg>
  );
}
