import './stat.css'

/**
 * ::stat{value="84" label="..."}: one figure set at the hero name's display size (the only size above `title` in the type
 * scale) in the accent, with a line under it saying what it counts. The value and label are plain text (rules.mjs trims them
 * and keeps the value short).
 */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <p className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label t-text">{label}</span>
    </p>
  )
}
