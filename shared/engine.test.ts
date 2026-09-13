import { describe, expect, it } from "vitest";
import { HOME_CELLS, PATH_CELLS } from "./board";
import { chooseAiMove } from "./ai";
import { applyMove, createGame, getLegalMoves, rollDice } from "./engine";
import type { GameState, Horse, Player } from "./types";

function rngSeq(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i] ?? 0.5;
    i += 1;
    return v;
  };
}

/** Map 1–6 to Math.random buckets used by rollDice. */
function die(n: number): number {
  return (n - 1) / 6 + 0.001;
}

function setHorse(player: Player, id: number, zone: Horse["zone"], progress: number): void {
  const horse = player.horses.find((h) => h.id === id)!;
  horse.zone = zone;
  horse.progress = progress;
}

describe("board", () => {
  it("has 52 unique path cells", () => {
    expect(PATH_CELLS).toHaveLength(56);
    const keys = new Set(PATH_CELLS.map((c) => `${c.x},${c.y}`));
    expect(keys.size).toBe(56);
    expect(PATH_CELLS).toEqual(expect.arrayContaining([
      { x: 6, y: 6 },
      { x: 8, y: 6 },
      { x: 8, y: 8 },
      { x: 6, y: 8 },
    ]));
  });

  it("keeps home stall 6 outside the center cell", () => {
    for (const cells of Object.values(HOME_CELLS)) {
      expect(cells).toHaveLength(6);
      expect(cells[5]).not.toEqual({ x: 7, y: 7 });
    }
  });
});

describe("createGame", () => {
  it("requires 2-4 players", () => {
    expect(() => createGame(["A"])).toThrow();
    expect(() => createGame(["A", "B", "C", "D", "E"])).toThrow();
    const g = createGame(["紅", "綠"]);
    expect(g.players).toHaveLength(2);
    expect(g.phase).toBe("rolling");
    expect(g.players[0].color).toBe("red");
    expect(g.players[1].color).toBe("green");
  });
});

describe("roll and exit", () => {
  it("lets a 6 leave the nest", () => {
    let state = createGame(["紅", "綠"]);
    state = rollDice(state, rngSeq([die(6)]));
    expect(state.dice).toBe(6);
    expect(state.lastDice).toBe(6);
    const moves = getLegalMoves(state);
    expect(moves.every((m) => m.kind === "exit")).toBe(true);
    expect(moves).toHaveLength(4);
    state = applyMove(state, moves[0]);
    expect(state.players[0].horses[0].zone).toBe("path");
    expect(state.players[0].horses[0].progress).toBe(0);
    expect(state.phase).toBe("rolling");
    expect(state.current).toBe(0);
  });

  it("cannot leave the nest on a 3", () => {
    let state = createGame(["紅", "綠"]);
    state = rollDice(state, rngSeq([die(3)]));
    expect(getLegalMoves(state)).toHaveLength(0);
    expect(state.current).toBe(1);
    expect(state.phase).toBe("rolling");
  });

  it("gives another roll when 1 or 6 has no legal move", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "home", 1);
    setHorse(state.players[0], 1, "home", 2);
    setHorse(state.players[0], 2, "home", 3);
    setHorse(state.players[0], 3, "home", 6);
    state = rollDice(state, rngSeq([die(6)]));
    expect(getLegalMoves(state)).toHaveLength(0);
    expect(state.current).toBe(0);
    expect(state.phase).toBe("rolling");
  });
});

describe("movement and capture", () => {
  it("advances along the path", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 4);
    state.phase = "moving";
    state.dice = 3;
    const moves = getLegalMoves(state).filter((m) => m.horseId === 0);
    expect(moves).toHaveLength(1);
    expect(moves[0].progress).toBe(7);
    state = applyMove(state, moves[0]);
    expect(state.players[0].horses[0].progress).toBe(7);
    expect(state.current).toBe(1);
  });

  it("keeps showing the rolled face after the move is spent", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 4);
    state = rollDice(state, rngSeq([die(3)]));
    expect(state.lastDice).toBe(3);
    const move = getLegalMoves(state).find((m) => m.horseId === 0)!;
    state = applyMove(state, move);
    expect(state.dice).toBeNull();
    expect(state.lastDice).toBe(3);
  });

  it("kicks an opponent back to the nest", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 11);
    setHorse(state.players[1], 0, "path", 0);
    state.phase = "moving";
    state.dice = 3;
    const move = getLegalMoves(state).find((m) => m.horseId === 0 && m.captured);
    expect(move).toBeTruthy();
    state = applyMove(state, move!);
    expect(state.players[1].horses[0].zone).toBe("nest");
    expect(state.players[0].horses[0].progress).toBe(14);
  });

  it("cannot land on its own horse", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 2);
    setHorse(state.players[0], 1, "path", 5);
    state.phase = "moving";
    state.dice = 3;
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.horseId === 0)).toBe(false);
  });

  it("cannot jump a horse in front, even to kick further ahead", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 11);
    setHorse(state.players[0], 1, "path", 13);
    setHorse(state.players[1], 0, "path", 0);
    state.phase = "moving";
    state.dice = 3;
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.horseId === 0)).toBe(false);
    expect(moves.some((m) => m.horseId === 0 && m.captured)).toBe(false);
  });

  it("kicks only when the roll lands exactly on the opponent", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 11);
    setHorse(state.players[1], 0, "path", 0);
    state.phase = "moving";
    state.dice = 4;
    expect(getLegalMoves(state).some((m) => m.horseId === 0)).toBe(false);
    state.dice = 2;
    expect(getLegalMoves(state).some((m) => m.horseId === 0 && m.progress === 13 && !m.captured)).toBe(
      true,
    );
    state.dice = 3;
    const kick = getLegalMoves(state).find((m) => m.horseId === 0 && m.captured);
    expect(kick?.progress).toBe(14);
  });

  it("cannot jump an opponent sitting in front", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 10);
    setHorse(state.players[1], 0, "path", 54);
    state.phase = "moving";
    state.dice = 4;
    expect(getLegalMoves(state).some((m) => m.horseId === 0)).toBe(false);
    state.dice = 2;
    const kick = getLegalMoves(state).find((m) => m.horseId === 0);
    expect(kick).toMatchObject({ progress: 12, captured: { playerIndex: 1, horseId: 0 } });
  });
});

describe("home stretch and win", () => {
  it("cannot enter home by jumping a horse on the last path squares", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 53);
    setHorse(state.players[1], 0, "path", 41);
    state.phase = "moving";
    state.dice = 4;
    expect(getLegalMoves(state).some((m) => m.horseId === 0)).toBe(false);
    state.dice = 2;
    const kick = getLegalMoves(state).find((m) => m.horseId === 0);
    expect(kick).toMatchObject({ zone: "path", progress: 55, captured: { playerIndex: 1, horseId: 0 } });
  });

  it("enters the home column with leftover steps", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 54);
    state.phase = "moving";
    state.dice = 3;
    const move = getLegalMoves(state).find((m) => m.horseId === 0);
    expect(move).toMatchObject({ zone: "home", progress: 2 });
    state = applyMove(state, move!);
    expect(state.players[0].horses[0]).toMatchObject({ zone: "home", progress: 2 });
  });

  it("needs an exact roll to climb the stalls", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "home", 4);
    state.phase = "moving";
    state.dice = 3;
    expect(getLegalMoves(state).some((m) => m.horseId === 0)).toBe(false);
    state.dice = 2;
    const move = getLegalMoves(state).find((m) => m.horseId === 0);
    expect(move).toMatchObject({ zone: "home", progress: 6 });
  });

  it("wins when stalls 3-6 are filled", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "home", 6);
    setHorse(state.players[0], 1, "home", 5);
    setHorse(state.players[0], 2, "home", 4);
    setHorse(state.players[0], 3, "home", 2);
    state.phase = "moving";
    state.dice = 1;
    const move = getLegalMoves(state).find((m) => m.horseId === 3)!;
    state = applyMove(state, move);
    expect(state.winnerIndex).toBe(0);
    expect(state.phase).toBe("finished");
  });

  it("cannot jump a horse already in a higher stall", () => {
    let state = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "home", 4);
    setHorse(state.players[0], 1, "home", 2);
    state.phase = "moving";
    state.dice = 3;
    expect(getLegalMoves(state).some((m) => m.horseId === 1)).toBe(false);
  });
});

describe("AI", () => {
  it("prefers a capture over a quiet advance", () => {
    const state = createGame(["紅", "綠"], { bots: [true, false] });
    setHorse(state.players[0], 0, "path", 3);
    setHorse(state.players[0], 1, "path", 11);
    setHorse(state.players[1], 0, "path", 0);
    state.phase = "moving";
    state.dice = 3;
    const move = chooseAiMove(state, () => 0.9);
    expect(move?.captured).toBeTruthy();
  });
});

describe("turn cycle", () => {
  it("caps extra rolls at three", () => {
    let state: GameState = createGame(["紅", "綠"]);
    setHorse(state.players[0], 0, "path", 0);
    for (let i = 0; i < 3; i++) {
      state = rollDice(state, rngSeq([die(6)]));
      expect(state.current).toBe(0);
      const move = getLegalMoves(state).find((m) => m.kind === "advance" && m.horseId === 0);
      expect(move).toBeTruthy();
      state = applyMove(state, move!);
    }
    expect(state.current).toBe(1);
  });
});
