import type { ReactNode } from 'react'

/** A blurred leaf-shaped shadow (static SVG, blur baked into the filter once) drifting across a panel in 40s. */
export function LeafShadow({ children }: { children: ReactNode }) {
  return (
    <div className="m-shadow">
      {children}
      <svg className="m-shadow__leaf" viewBox="0 0 200 300" aria-hidden preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="m-leaf-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <g filter="url(#m-leaf-blur)" fill="#18211b">
          <path d="M100 8c34 40 70 84 66 140-3 52-34 100-66 146C66 248 34 200 34 148 32 92 66 48 100 8Z" />
        </g>
      </svg>
    </div>
  )
}
