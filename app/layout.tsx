import './globals.css'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Image from 'next/image'
import React, { StrictMode } from 'react'
import { GlassBoxSimple } from '@/components/GlassBox'

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
          {/* <meta
            name="theme-color"
            content="#004444"
            media="(prefers-color-scheme: light)"
          ></meta>
          <meta
            name="theme-color"
            content="#000000"
            media="(prefers-color-scheme: dark)"
          ></meta> */}
        </head>
        <body>
          <div className="flex flex-col overflow-visible h-[100vh]">
            <div className="lg:flex-1"></div>
            <div
              className={
                'lg:container auto-rows-min lg:px-4 py-4  lg:mx-auto mb-16 grid grid-cols-1 gap-4 lg:grid-cols-3'
              }
            >
              <div className="w-full h-full  lg:col-span-2">
                <GlassBoxSimple className="h-full">
                  <div className="flex flex-col h-full">
                    <div className="flex-grow"></div>
                    <header className="p-4 flex flex-row gap-4 justify-center w-full  ">
                      <div className="h-[5rem] min-w-[4rem] w-fit lg:h-[11rem] my-auto border-r border-r-white/50 pr-4">
                        <Image
                          src={'./logo.svg'}
                          width={350}
                          height={235}
                          style={{ width: 'auto', height: '100%' }}
                          alt="MJB Logo"
                        ></Image>
                      </div>
                      <div className={`font-title`}>
                        <h1
                          className={
                            'text-[2.4rem] lg:text-[6rem] leading-none'
                          }
                        >
                          Michal
                          <p className="text-[1.2rem] lg:text-[3rem]">
                            Bodzianowski
                          </p>
                        </h1>
                        <h2
                          className={`font-paragraph text-[1.5rem] lg:text-[3rem]`}
                        >
                          WEB / AI / XR
                        </h2>
                      </div>
                    </header>
                    <div className="flex-1"></div>
                  </div>
                </GlassBoxSimple>
              </div>
              {children}
            </div>
            <div className="lg:flex-1"></div>
          </div>
        </body>
      </html>
    </StrictMode>
  )
}
