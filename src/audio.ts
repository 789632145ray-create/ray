let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain = 0.08,
  delay = 0,
): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  g.gain.setValueAtTime(0.0001, ac.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + delay + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + duration + 0.02);
}

export function soundRoll(): void {
  tone(180, 0.08, "triangle", 0.05, 0);
  tone(220, 0.08, "triangle", 0.05, 0.06);
  tone(260, 0.12, "square", 0.04, 0.12);
}

export function soundMove(): void {
  tone(420, 0.09, "sine", 0.05);
}

export function soundCapture(): void {
  tone(160, 0.16, "sawtooth", 0.07);
  tone(520, 0.1, "square", 0.04, 0.05);
}

export function soundWin(): void {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "triangle", 0.07, i * 0.12));
}

export function unlockAudio(): void {
  try {
    void audio();
  } catch {
    /* ignore */
  }
}
