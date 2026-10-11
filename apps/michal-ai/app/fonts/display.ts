import localFont from 'next/font/local'

/**
 * THE display face (name, titles, role, intro, project titles). This is the ONLY place the face is chosen.
 * To replace it (for example if the Michelangelus web licence is refused), swap this one call for e.g.
 *   import { Instrument_Serif } from 'next/font/google'
 *   export const display = Instrument_Serif({ subsets: ['latin','latin-ext'], weight: '400', style: ['normal','italic'], display: 'swap', variable: '--font-display-face' })
 * and nothing else changes: globals.css maps --font-display-face to --font-display, which Tailwind exposes as `font-display`.
 *
 * Michelangelus: Latin + Latin-Extended subset (incl. Polish), Regular + Italic (see docs/design-system/type-michelangelus.md).
 * adjustFontFallback generates a size-adjusted local fallback so the swap does not shift layout.
 */
export const display = localFont({
  src: [
    { path: './Michelangelus-Regular.woff2', weight: '400', style: 'normal' },
    { path: './Michelangelus-Italic.woff2', weight: '400', style: 'italic' },
  ],
  display: 'swap',
  preload: true,
  variable: '--font-display-face',
  adjustFontFallback: 'Times New Roman',
  fallback: ['Iowan Old Style', 'Georgia', 'serif'],
})
