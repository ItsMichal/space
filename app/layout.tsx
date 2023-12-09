import 'react-notion-x/src/styles.css'
import 'prismjs/themes/prism-tomorrow.css'
import 'katex/dist/katex.min.css'
import './globals.css'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import React, { StrictMode } from 'react'
import { GlassBoxAnim } from '@/components/GlassBox'
import AnimLogo from '@/components/AnimLogo'
import { ShadedBackground } from '@/components/BGAnim'
import { Footer } from '@/components/Footer'
import { SpeedInsights } from '@vercel/speed-insights/next'

const paragraphFont = localFont({
  src: '../public/fonts/newmexica.otf',
  variable: '--new-mexica',
})

const titleFont = localFont({
  src: '../public/fonts/akira.otf',
  variable: '--akira-font',
})

export const metadata: Metadata = {
  title: 'michal "halmic"',
  description:
    'Michal "Halmic" Bodzianowski is a developer in the Web, XR, and Artificial Intelligence spaces.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <StrictMode>
      <html
        lang="en"
        className={`${titleFont.variable} ${paragraphFont.variable}`}
      >
        <head>
          <meta name="theme-color" content="#000000"></meta>
        </head>
        <body>
          <div className="fixed top-0 left-0 bottom-0 right-0 inset-0 w-screen h-screen z-[-1]">
            <ShadedBackground></ShadedBackground>
          </div>
          <div className="flex flex-col overflow-visible h-[100vh]">
            <div className="lg:flex-1"></div>
            <div
              className={
                'xl:container auto-rows-min px-2 lg:px-4 py-4  lg:mx-auto mb-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
              }
            >
              <div className="w-full h-[66vh] md:hidden text-center font-paragraph flex flex-col ">
                <div className="flex-1"></div>
                <p className="bg-black/40 w-fit p-2 mx-auto text-xl backdrop-blur-sm rounded-lg animate-pulse">
                  Swipe up! 🚀
                </p>
              </div>
              <div className="w-full h-full lg:col-span-2">
                <GlassBoxAnim className="h-full w-full">
                  <div className="flex flex-col h-full w-full">
                    <div className="flex-grow"></div>
                    <header className="p-4 flex flex-row gap-4 justify-center w-full  ">
                      <div className="h-[5rem] min-w-[4rem] overflow-hidden w-fit lg:h-[11rem] my-auto border-r border-r-white/50 pr-4">
                        <AnimLogo></AnimLogo>
                      </div>
                      <div className={`font-title`}>
                        <h1
                          className={
                            'text-[2.4rem] lg:text-[6rem] leading-none select-none lg:select-auto'
                          }
                        >
                          Michal
                          <p className="text-[1.2rem] lg:text-[3rem] select-none lg:select-auto">
                            Bodzianowski
                          </p>
                        </h1>
                        <h2
                          className={`font-paragraph text-[1.5rem] lg:text-[3rem] select-none lg:select-auto`}
                        >
                          Creative Developer
                        </h2>
                      </div>
                    </header>
                    <div className="flex-1"></div>
                  </div>
                </GlassBoxAnim>
              </div>
              {children}
              <div className="w-full h-full md:col-span-2 lg:col-span-3">
                <div className="flex flex-col h-full w-full">
                  <div className="flex-grow"></div>
                  <Footer></Footer>
                  <div className="flex-grow"></div>
                </div>
              </div>
            </div>
            <div className="lg:flex-1"></div>
          </div>
          <SpeedInsights />
        </body>
      </html>
    </StrictMode>
  )
}
