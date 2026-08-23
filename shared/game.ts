import { DIGIT_COUNT } from "./types.js";

export function isValidSecret(value: string, digitCount = DIGIT_COUNT): boolean {
  if (!new RegExp(`^\\d{${digitCount}}$`).test(value)) return false;
  return new Set(value).size === value.length;
}

export function scoreGuess(secret: string, guess: string): { a: number; b: number } {
  let a = 0;
  let b = 0;
  const secretUsed = Array(secret.length).fill(false);
  const guessUsed = Array(guess.length).fill(false);

  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) {
      a += 1;
      secretUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < secret.length; j++) {
      if (secretUsed[j]) continue;
      if (guess[i] === secret[j]) {
        b += 1;
        secretUsed[j] = true;
        break;
      }
    }
  }

  return { a, b };
}

export function formatAB(a: number, b: number): string {
  return `${a}A${b}B`;
}

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
