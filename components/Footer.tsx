import React from 'react'
import { GlassBoxAnim } from './GlassBox'

export const Footer = () => {
  return (
    <GlassBoxAnim className="mx-auto !w-fit">
      <footer className={'p-5 mx-auto font-paragraph opacity-50'}>
        Built by Michal with Next.js/Tailwind/Framer Motion.
      </footer>
    </GlassBoxAnim>
  )
}
