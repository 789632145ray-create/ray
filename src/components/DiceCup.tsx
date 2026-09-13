type Props = {
  value: number | null;
  rolling: boolean;
  disabled: boolean;
  onRoll: () => void;
};

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DiceCup({ value, rolling, disabled, onRoll }: Props) {
  const face = rolling ? 6 : (value ?? 1);
  return (
    <div className="dice-cup">
      <div className={`die${rolling ? " rolling" : ""}`} aria-label={`骰子 ${value ?? "尚未擲"}`}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="pip" style={{ visibility: PIPS[face].includes(i) ? "visible" : "hidden" }} />
        ))}
      </div>
      <button className="btn" disabled={disabled} onClick={onRoll}>
        {rolling ? "骰盅轉動…" : "擲骰"}
      </button>
    </div>
  );
}
