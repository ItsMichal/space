'use client'

import { useSyncExternalStore } from 'react'
import { HERO_DEFAULT, heroFromSearch } from '@/lib/hero/flag'
import { HeroAscii } from './HeroAscii'
import { HeroGlobe } from './HeroGlobe'

const none = () => () => {}

/** The home hero's decorative background: the WebGL globe or the character-cell one (lib/hero/flag.ts). */
export function HeroBackdrop() {
  const kind = useSyncExternalStore(none, () => heroFromSearch(window.location.search), () => HERO_DEFAULT)
  return kind === 'ascii' ? <HeroAscii /> : <HeroGlobe />
}
