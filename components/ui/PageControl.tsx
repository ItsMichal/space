'use client'

import { Glass, glass } from '@/components/glass'
import './ui.css'
import './gallery.css'

type Props = {
  count: number
  index: number
  label?: string
  onSelect: (i: number) => void
  /** Present only when the host can auto-advance. */
  playing?: boolean
  /** The active pill's fill is animating (auto-advance is actually running right now). */
  running?: boolean
  /** Milliseconds the fill takes to complete; the host advances on `onFillEnd`. */
  interval?: number
  onToggle?: () => void
  onFillEnd?: () => void
}

/**
 * Capsule page control. The current dot stretches into a pill (a little overshoot, then settle) and, while the gallery
 * auto-advances, that pill fills like a progress bar; the dot it left shrinks a beat later. The visible dots are small;
 * each button's hit area is padded to 44px with a pseudo-element, so nothing relies on hover.
 */
export function PageControl({ count, index, label = 'Pages', onSelect, playing, running, interval = 6000, onToggle, onFillEnd }: Props) {
  if (count < 2) return null
  return (
    <Glass as="div" effect={glass.regular.interactive()} shape="capsule" className="pc" role="group" aria-label={label}>
      <ul className="pc-dots">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              className="pc-dot"
              data-on={i === index ? '' : undefined}
              aria-label={`Show ${i + 1} of ${count}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => onSelect(i)}
            >
              <span className="pc-fill-wrap">
                {i === index ? (
                  <span
                    key={`${index}-${running ? 'r' : 's'}`}
                    className="pc-fill"
                    data-run={running ? '' : undefined}
                    style={{ animationDuration: `${interval}ms` }}
                    onAnimationEnd={running ? onFillEnd : undefined}
                  />
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {onToggle ? (
        <button type="button" className="pc-play" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} aria-pressed={!!playing} onClick={onToggle}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
            <g className="pc-ico pc-ico--pause" data-on={playing ? '' : undefined}>
              <rect x="2.5" y="2" width="2.6" height="8" rx="1.1" />
              <rect x="6.9" y="2" width="2.6" height="8" rx="1.1" />
            </g>
            <path className="pc-ico pc-ico--play" data-on={playing ? undefined : ''} d="M3.6 2.2c.5-.3 1 0 1.4.2l4.6 2.9c.5.3.5.9 0 1.2L5 9.4c-.4.3-1 .3-1.4 0-.3-.2-.4-.5-.4-.9V3.1c0-.4.1-.7.4-.9z" />
          </svg>
        </button>
      ) : null}
    </Glass>
  )
}
