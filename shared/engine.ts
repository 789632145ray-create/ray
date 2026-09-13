import {
  EXIT_NUMBERS,
  HOME_MAX,
  LAST_PATH,
  MAX_ROLLS_PER_TURN,
  WIN_HOME_CELLS,
  pathIndexFor,
} from "./board";
import {
  COLOR_LABEL,
  COLORS,
  type Color,
  type GameState,
  type Horse,
  type Move,
  type Player,
} from "./types";

export type Rng = () => number;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function makeHorses(): Horse[] {
  return [0, 1, 2, 3].map((id) => ({ id, zone: "nest" as const, progress: 0 }));
}

export function createGame(
  names: string[],
  options: { bots?: boolean[] } = {},
): GameState {
  if (names.length < 2 || names.length > 4) {
    throw new Error("需要 2 到 4 位玩家");
  }
  const players: Player[] = names.map((name, i) => ({
    color: COLORS[i],
    name,
    horses: makeHorses(),
    isBot: options.bots?.[i] ?? false,
  }));
  return {
    players,
    current: 0,
    phase: "rolling",
    dice: null,
    lastDice: null,
    bonusRoll: false,
    extraRollsLeft: 0,
    rollsThisTurn: 0,
    winnerIndex: null,
    log: [`${players[0].name} 先擲骰，賽馬開始！`],
    turnId: 1,
  };
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.current];
}

export function isBonusRoll(values: number[]): boolean {
  return values.some((value) => EXIT_NUMBERS.has(value)) || (values.length === 2 && values[0] === values[1]);
}

function occupantAtPath(
  state: GameState,
  pathIndex: number,
): { playerIndex: number; horseId: number } | null {
  for (let p = 0; p < state.players.length; p++) {
    for (const horse of state.players[p].horses) {
      if (horse.zone !== "path") continue;
      if (pathIndexFor(state.players[p].color, horse.progress) === pathIndex) {
        return { playerIndex: p, horseId: horse.id };
      }
    }
  }
  return null;
}

function ownHorseAtPath(player: Player, pathIndex: number): Horse | undefined {
  return player.horses.find(
    (h) => h.zone === "path" && pathIndexFor(player.color, h.progress) === pathIndex,
  );
}

function homeOccupied(player: Player, cell: number): boolean {
  return player.horses.some((h) => h.zone === "home" && h.progress === cell);
}

function homePathClear(player: Player, from: number, to: number): boolean {
  for (let cell = from + 1; cell <= to; cell++) {
    if (homeOccupied(player, cell)) return false;
  }
  return true;
}

function pathClearBefore(
  state: GameState,
  color: Color,
  fromProgress: number,
  destProgress: number,
): boolean {
  const last = Math.min(destProgress, LAST_PATH + 1);
  for (let step = fromProgress + 1; step < last; step++) {
    if (occupantAtPath(state, pathIndexFor(color, step))) return false;
  }
  return true;
}

function findHorse(player: Player, horseId: number): Horse {
  const horse = player.horses.find((h) => h.id === horseId);
  if (!horse) throw new Error("找不到馬匹");
  return horse;
}

function movesForDie(state: GameState, dice: number): Move[] {
  const playerIndex = state.current;
  const player = state.players[playerIndex];
  const moves: Move[] = [];

  if (EXIT_NUMBERS.has(dice)) {
    const startIndex = pathIndexFor(player.color, 0);
    const blocker = ownHorseAtPath(player, startIndex);
    if (!blocker) {
      const captured = occupantAtPath(state, startIndex);
      for (const horse of player.horses) {
        if (horse.zone !== "nest") continue;
        moves.push({
          playerIndex,
          horseId: horse.id,
          kind: "exit",
          zone: "path",
          progress: 0,
          captured:
            captured && captured.playerIndex !== playerIndex ? captured : null,
          steps: dice,
        });
      }
    }
  }

  for (const horse of player.horses) {
    if (horse.zone === "path") {
      const next = horse.progress + dice;
      if (!pathClearBefore(state, player.color, horse.progress, next)) continue;
      if (next <= LAST_PATH) {
        const destIndex = pathIndexFor(player.color, next);
        if (ownHorseAtPath(player, destIndex)) continue;
        const captured = occupantAtPath(state, destIndex);
        moves.push({
          playerIndex,
          horseId: horse.id,
          kind: "advance",
          zone: "path",
          progress: next,
          captured:
            captured && captured.playerIndex !== playerIndex ? captured : null,
          steps: dice,
        });
      } else {
        const homeCell = next - LAST_PATH;
        if (homeCell >= 1 && homeCell <= HOME_MAX && homePathClear(player, 0, homeCell)) {
          moves.push({
            playerIndex,
            horseId: horse.id,
            kind: "advance",
            zone: "home",
            progress: homeCell,
            captured: null,
            steps: dice,
          });
        }
      }
    } else if (horse.zone === "home") {
      const dest = horse.progress + dice;
      if (dest <= HOME_MAX && homePathClear(player, horse.progress, dest)) {
        moves.push({
          playerIndex,
          horseId: horse.id,
          kind: "advance",
          zone: "home",
          progress: dest,
          captured: null,
          steps: dice,
        });
      }
    }
  }

  return moves;
}

export function getLegalMoves(state: GameState): Move[] {
  if (state.phase !== "moving" || !state.dice?.length || state.winnerIndex != null) {
    return [];
  }
  const seen = new Set<string>();
  const moves: Move[] = [];
  for (const value of new Set(state.dice)) {
    for (const move of movesForDie(state, value)) {
      const key = `${move.horseId}-${move.kind}-${move.zone}-${move.progress}-${move.steps}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push(move);
    }
  }
  return moves;
}

function hasWon(player: Player): boolean {
  const occupied = new Set(
    player.horses.filter((h) => h.zone === "home").map((h) => h.progress),
  );
  return WIN_HOME_CELLS.every((cell) => occupied.has(cell));
}

function describeMove(state: GameState, move: Move, player: Player): string {
  const label = COLOR_LABEL[player.color];
  if (move.kind === "exit") {
    let text = `${player.name} 的${label}出廄上跑道`;
    if (move.captured) {
      const victim = state.players[move.captured.playerIndex];
      text += `，踢回 ${victim.name} 的${COLOR_LABEL[victim.color]}`;
    }
    return text;
  }
  if (move.zone === "home") {
    return `${player.name} 的${label}進入馬槽 ${move.progress}`;
  }
  let text = `${player.name} 的${label}前進 ${move.steps} 步`;
  if (move.captured) {
    const victim = state.players[move.captured.playerIndex];
    text += `，踢回 ${victim.name} 的${COLOR_LABEL[victim.color]}`;
  }
  return text;
}

function finishDiceOrPass(state: GameState): void {
  if (state.bonusRoll && state.rollsThisTurn < MAX_ROLLS_PER_TURN) {
    state.phase = "rolling";
    state.dice = null;
    state.log = [`擲到 1、6 或對子，${state.players[state.current].name} 再擲一次`, ...state.log];
    return;
  }
  passTurn(state);
}

export function applyMove(state: GameState, move: Move): GameState {
  const next = clone(state);
  if (next.phase !== "moving" || !next.dice?.length) {
    throw new Error("現在不能走馬");
  }
  const legal = getLegalMoves(next);
  const match = legal.find(
    (m) =>
      m.playerIndex === move.playerIndex &&
      m.horseId === move.horseId &&
      m.kind === move.kind &&
      m.zone === move.zone &&
      m.progress === move.progress &&
      m.steps === move.steps,
  );
  if (!match || move.playerIndex !== next.current) {
    throw new Error("不合法的走法");
  }

  const used = next.dice.indexOf(move.steps);
  if (used < 0) throw new Error("沒有這個點數");
  next.dice.splice(used, 1);

  const player = next.players[next.current];
  const horse = findHorse(player, move.horseId);

  if (move.captured) {
    const victim = next.players[move.captured.playerIndex];
    const capturedHorse = findHorse(victim, move.captured.horseId);
    capturedHorse.zone = "nest";
    capturedHorse.progress = 0;
  }

  horse.zone = move.zone;
  horse.progress = move.progress;
  next.log = [describeMove(state, move, player), ...next.log].slice(0, 40);

  if (hasWon(player)) {
    next.phase = "finished";
    next.winnerIndex = next.current;
    next.dice = null;
    next.log = [`${player.name} 的四匹馬入槽，贏得比賽！`, ...next.log];
    return next;
  }

  if (next.dice.length > 0 && getLegalMoves(next).length === 0) {
    next.log = [`剩下的點數走不了`, ...next.log];
    next.dice = [];
  }

  if (next.dice.length > 0) return next;
  finishDiceOrPass(next);
  return next;
}

function passTurn(state: GameState): void {
  state.current = (state.current + 1) % state.players.length;
  state.phase = "rolling";
  state.dice = null;
  state.bonusRoll = false;
  state.extraRollsLeft = 0;
  state.rollsThisTurn = 0;
  state.turnId += 1;
}

export function rollDice(state: GameState, rng: Rng = Math.random): GameState {
  if (state.phase !== "rolling" || state.winnerIndex != null) {
    throw new Error("現在不能擲骰");
  }
  const next = clone(state);
  const first = 1 + Math.floor(rng() * 6);
  const second = 1 + Math.floor(rng() * 6);
  next.dice = [first, second];
  next.lastDice = [first, second];
  next.bonusRoll = isBonusRoll([first, second]);
  next.rollsThisTurn += 1;
  next.phase = "moving";
  const player = next.players[next.current];
  next.log = [`${player.name} 擲出 ${first} 與 ${second}`, ...next.log].slice(0, 40);

  const moves = getLegalMoves(next);
  if (moves.length === 0) {
    if (next.bonusRoll && next.rollsThisTurn < MAX_ROLLS_PER_TURN) {
      next.phase = "rolling";
      next.dice = null;
      next.log = [`沒有可走的馬，但擲到 ${first}、${second}，再擲一次`, ...next.log];
    } else {
      next.log = [`沒有可走的馬，輪到下一位`, ...next.log];
      passTurn(next);
    }
  }
  return next;
}

export function forcedPassIfStuck(state: GameState): GameState {
  if (state.phase !== "moving") return state;
  if (getLegalMoves(state).length > 0) return state;
  const next = clone(state);
  if (next.bonusRoll && next.rollsThisTurn < MAX_ROLLS_PER_TURN) {
    next.phase = "rolling";
    next.dice = null;
    return next;
  }
  passTurn(next);
  return next;
}

export function colorOfSeat(index: number): Color {
  return COLORS[index];
}
