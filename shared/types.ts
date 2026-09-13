export const COLORS = ["red", "green", "yellow", "blue"] as const;
export type Color = (typeof COLORS)[number];

export type HorseZone = "nest" | "path" | "home";

export type Horse = {
  id: number;
  zone: HorseZone;
  /** Path: 0–51 from this player's start. Home: 1–6. Nest: unused. */
  progress: number;
};

export type Player = {
  color: Color;
  name: string;
  horses: Horse[];
  isBot: boolean;
};

export type GamePhase = "rolling" | "moving" | "finished";

export type GameState = {
  players: Player[];
  current: number;
  phase: GamePhase;
  dice: number | null;
  /** Last rolled face, kept for display after the move is spent. */
  lastDice: number | null;
  extraRollsLeft: number;
  rollsThisTurn: number;
  winnerIndex: number | null;
  log: string[];
  turnId: number;
};

export type MoveKind = "exit" | "advance";

export type Move = {
  playerIndex: number;
  horseId: number;
  kind: MoveKind;
  /** Destination after the move. */
  zone: HorseZone;
  progress: number;
  captured: { playerIndex: number; horseId: number } | null;
};

export type RoomPlayer = {
  id: string;
  name: string;
  color: Color | null;
  isBot: boolean;
  connected: boolean;
  isHost: boolean;
};

export type RoomStatus = "lobby" | "playing" | "finished";

export type RoomState = {
  id: string;
  status: RoomStatus;
  players: RoomPlayer[];
  game: GameState | null;
  maxPlayers: number;
};

export type ClientAction =
  | { type: "create-room"; name: string }
  | { type: "join-room"; roomId: string; name: string }
  | { type: "add-bot" }
  | { type: "remove-player"; playerId: string }
  | { type: "start-game" }
  | { type: "roll" }
  | { type: "move"; move: Move }
  | { type: "leave" };

export const COLOR_LABEL: Record<Color, string> = {
  red: "紅馬",
  green: "綠馬",
  yellow: "黃馬",
  blue: "藍馬",
};

export const COLOR_HEX: Record<Color, string> = {
  red: "#c4282a",
  green: "#1f8a4c",
  yellow: "#e0b000",
  blue: "#1d5fbf",
};
