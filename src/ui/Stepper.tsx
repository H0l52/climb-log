/** Numeric stepper: big − / + buttons instead of a keyboard. */
export function Stepper({ label, value, onChange, min = 1, max = 99 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="btn" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output className="num" aria-live="polite">{value}</output>
      <button type="button" className="btn" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}
