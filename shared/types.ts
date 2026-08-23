export const DIGIT_COUNT = 4;

export type GamePhase = "lobby" | "setting" | "guessing" | "round_end" | "finished";

export interface PlayerPublic {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
}

export interface GuessRecord {
  playerId: string;
  playerName: string;
  guess: string;
  a: number;
  b: number;
  at: number;
}

export interface RoomPublic {
  code: string;
  phase: GamePhase;
  players: PlayerPublic[];
  setterId: string | null;
  currentGuesserId: string | null;
  round: number;
  maxRounds: number;
  guesses: GuessRecord[];
  winnerId: string | null;
  lastRoundWinnerId: string | null;
  digitCount: number;
}

export type ClientToServerEvents = {
  "room:create": (
    payload: { name: string; maxRounds?: number },
    ack: (res: { ok: true; room: RoomPublic; playerId: string } | { ok: false; error: string }) => void
  ) => void;
  "room:join": (
    payload: { code: string; name: string },
    ack: (res: { ok: true; room: RoomPublic; playerId: string } | { ok: false; error: string }) => void
  ) => void;
  "room:start": (
    _payload: Record<string, never>,
    ack: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  "game:setSecret": (
    payload: { secret: string },
    ack: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  "game:guess": (
    payload: { guess: string },
    ack: (res: { ok: true; a: number; b: number } | { ok: false; error: string }) => void
  ) => void;
  "game:nextRound": (
    _payload: Record<string, never>,
    ack: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  "room:leave": () => void;
};

export type ServerToClientEvents = {
  "room:update": (room: RoomPublic) => void;
  "game:youAreSetter": () => void;
  "error:message": (message: string) => void;
};
