import { useEffect, useState } from "react";

type Props = {
  value: number | null;
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

function DieFace({ value }: { value: number }) {
  return (
    <svg className="die-svg" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="3" y="3" width="94" height="94" rx="20" fill="#fff6e4" stroke="#8a5a18" strokeWidth="5" />
      {PIPS[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9.5" fill="#1a0c08" />
      ))}
    </svg>
  );
}

export function DiceCup({ value, rolling, disabled, onRoll }: Props) {
  const [spinFace, setSpinFace] = useState(1);

  useEffect(() => {
    if (!rolling) return;
    const timer = window.setInterval(() => {
      setSpinFace(1 + Math.floor(Math.random() * 6));
    }, 70);
    return () => window.clearInterval(timer);
  }, [rolling]);

  const face = rolling ? spinFace : value;

  return (
    <div className="dice-cup">
      <div className={`die${rolling ? " rolling" : ""}`} aria-label={face ? `骰子 ${face} 點` : "尚未擲骰"}>
        {face ? <DieFace value={face} /> : <span className="die-empty">?</span>}
      </div>
      <p className="die-score">{rolling ? "轉動中…" : face ? `擲出 ${face} 點` : "尚未擲骰"}</p>
      <button className="btn" disabled={disabled} onClick={onRoll}>
        {rolling ? "骰盅轉動…" : "擲骰"}
      </button>
    </div>
  );
}
