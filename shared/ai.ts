import { LAST_PATH } from "./board";
import { getLegalMoves } from "./engine";
import type { GameState, Move } from "./types";

function scoreMove(state: GameState, move: Move): number {
  let score = 0;
  const player = state.players[move.playerIndex];
  const horse = player.horses.find((h) => h.id === move.horseId);
  if (move.kind === "exit") score += 420;
  if (move.captured) {
    const victim = state.players[move.captured.playerIndex];
    const victimHorse = victim.horses.find((h) => h.id === move.captured!.horseId);
    const threat = victimHorse?.zone === "path" ? victimHorse.progress : 0;
    score += 700 + threat * 8;
  }
  if (move.zone === "home") {
    score += 260 + move.progress * 70;
    if (move.progress >= 3) score += 180;
  } else if (move.zone === "path") {
    score += move.progress * 3;
    if (horse?.zone === "path") score += (move.progress - horse.progress) * 2;
    if (move.progress > LAST_PATH - 6) score += 80;
  }
  const remainingNest = player.horses.filter((h) => h.zone === "nest").length;
  if (move.kind === "exit" && remainingNest >= 3) score += 80;
  return score;
}

export function chooseAiMove(state: GameState, rng: () => number = Math.random): Move | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;
  const ranked = [...moves].sort((a, b) => scoreMove(state, b) - scoreMove(state, a));
  if (ranked.length > 1 && rng() < 0.18) return ranked[1];
  return ranked[0];
}
