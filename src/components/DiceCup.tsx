import { useEffect, useState } from "react";

type Props = {
  values: number[] | null;
  remaining: number[] | null;
  rolling: boolean;
  disabled: boolean;
  onRoll: () => void;
};

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
};

function DieFace({ value, spent }: { value: number; spent?: boolean }) {
  return (
    <svg className={`die-svg${spent ? " is-spent" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="3" y="3" width="94" height="94" rx="20" fill="#fff6e4" stroke="#8a5a18" strokeWidth="5" />
      {PIPS[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9.5" fill="#1a0c08" />
      ))}
    </svg>
  );
}

function isSpent(faces: number[], leftover: number[], index: number): boolean {
  const copy = [...leftover];
  for (let i = 0; i < faces.length; i++) {
    const at = copy.indexOf(faces[i]);
    const available = at >= 0;
    if (available) copy.splice(at, 1);
    if (i === index) return !available;
  }
  return false;
}

export function DiceCup({ values, remaining, rolling, disabled, onRoll }: Props) {
  const [spin, setSpin] = useState<[number, number]>([1, 2]);

  useEffect(() => {
    if (!rolling) return;
    const timer = window.setInterval(() => {
      setSpin([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    }, 70);
    return () => window.clearInterval(timer);
  }, [rolling]);

  const faces = rolling ? spin : values;
  const leftover = remaining ?? [];
  const label = rolling
    ? "轉動中…"
    : faces?.length
      ? leftover.length
        ? `擲出 ${faces.join("、")} 點 · 還可走 ${leftover.join("、")}`
        : `擲出 ${faces.join("、")} 點`
      : "尚未擲骰";

  return (
    <div className="dice-cup">
      <div className={`dice-pair${rolling ? " rolling" : ""}`} aria-label={label}>
        {faces?.length ? (
          faces.map((face, index) => (
            <div key={`${face}-${index}`} className="die">
              <DieFace value={face} spent={!rolling && leftover.length >= 0 && isSpent(faces, leftover, index)} />
            </div>
          ))
        ) : (
          <>
            <div className="die">
              <span className="die-empty">?</span>
            </div>
            <div className="die">
              <span className="die-empty">?</span>
            </div>
          </>
        )}
      </div>
      <p className="die-score">{label}</p>
      <button className="btn" disabled={disabled} onClick={onRoll}>
        {rolling ? "骰盅轉動…" : "擲兩顆骰"}
      </button>
    </div>
  );
}
