import { Fraunces, Instrument_Serif } from 'next/font/google'

// Prototype candidates only (not wired into the live layout). Both are OFL and self-hosted by next/font.
export const instrument = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-instrument',
})

export const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT'],
  display: 'swap',
  variable: '--font-fraunces',
})
