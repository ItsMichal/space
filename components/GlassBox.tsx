'use client'

import Image from 'next/image'

import React, { ReactNode, useEffect, useState } from 'react'

type GlassBoxProps = {
  children?: ReactNode
  className?: string
}

//Helper function for timeless geometric easing
function ease(orig_val: number, new_val: number, factor = 0.1): number {
  return orig_val * (1 - factor) + new_val * factor
}

//TODO: optimize perf further. done for now
export function GlassBoxSimple({ children, className }: GlassBoxProps) {
  const [lightPoint, setPoint] = useState([0, 0])
  const [lightIntensity, setLightIntesity] = useState(0)
  const [rotation, setRotation] = useState([0, 0])
  const [inBox, setInBox] = useState(false)
  const [is3d, set3d] = useState(false)

  //   const [sizeFactor, setSizeFactor] = useState([1, 1])

  //TODO: escape the ease stuff to a timer func instead so you don't have to keep moving
  // const light = useMove(
  //   (state) => {
  //     // if (
  //     //   !(state.currentTarget as HTMLElement).classList.contains(
  //     //     'glass-hoverable'
  //     //   )
  //     // )
  //     //   return

  //     if (state.type == 'pointerleave') {
  //       setInBox(false)
  //     } else {
  //       if (!inBox || !is3d) {
  //         setInBox(true)
  //         set3d(true)
  //       }
  //       // const newX = (state.event as unknown as React.PointerEvent).nativeEvent
  //       //   .offsetX
  //       // const newY = (state.event as unknown as React.PointerEvent).nativeEvent
  //       const newX =
  //         state.values[0] - (state.currentTarget as HTMLElement).offsetLeft
  //       const newY =
  //         state.values[1] - (state.currentTarget as HTMLElement).offsetTop
  //       const width = (state.currentTarget as HTMLElement).offsetWidth
  //       const height = (state.currentTarget as HTMLElement).offsetHeight
  //       handleXYEvent(newX, newY, width, height)
  //     }
  //   },
  //   { from: [0, 0] }
  // )

  // const onMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
  //   if (inBox && e.currentTarget.classList.contains('glass-hoverable')) {
  //     const newX = e.pageX - e.currentTarget.getBoundingClientRect().left
  //     const newY = e.pageY - e.currentTarget.getBoundingClientRect().top
  //     const width = e.currentTarget.offsetWidth
  //     const height = e.currentTarget.offsetHeight
  //     handleXYEvent(newX, newY, width, height)
  //   }
  // }

  // function handleXYEvent(
  //   newX: number,
  //   newY: number,
  //   width: number,
  //   height: number
  // ) {
  //   //holy ugly typescript
  //   const light_factor = 1
  //   const x_factor = ease(lightPoint[0], newX, light_factor)
  //   const y_factor = ease(lightPoint[1], newY, light_factor)
  //   setPoint([newX, newY])
  //   // setPoint([x_factor, y_factor])
  //   setLightIntesity(ease(lightIntensity, 1, light_factor))

  //   const x_axis = 2 * (x_factor / width) - 1
  //   const y_axis = 2 * (y_factor / height) - 1
  //   const amplitude = 3
  //   setRotation([
  //     ease(rotation[0], -y_axis * amplitude, 0.05),
  //     ease(rotation[1], x_axis * amplitude, 0.05),
  //   ])
  // }

  //TODO: Take a look into this for performance issues
  useEffect(() => {
    const interval = setInterval(() => {
      const margin = 0.05
      if (!inBox) {
        let doneUpdating = true
        if (lightIntensity > margin) {
          setLightIntesity((lightIntensity) => lightIntensity * 0.9)
          doneUpdating = false
        }
        if (Math.abs(rotation[0]) > margin || Math.abs(rotation[1]) > margin) {
          setRotation((rotation) => [
            ease(rotation[0], 0),
            ease(rotation[1], 0),
          ])
          doneUpdating = false
        }
        if (doneUpdating) {
          set3d(false) //turn off 3d for performance
        }
      }
    }, 100)
    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <div
      className={'w-full glass-hoverable ' + className}
      style={
        {
          // perspective: is3d ? `2000px` : undefined,
          // transformStyle: is3d ? 'preserve-3d' : undefined,
          // transition: 'transform 0.1s ease-in-out 0s',
          // transform: inBox ? 'scale(1.05)' : undefined,
        }
      }
      onMouseEnter={() => {
        setInBox(true)
        set3d(true)
      }}
      onMouseLeave={() => {
        setInBox(false)
      }}
      // onMouseMove={onMouseOver}
      // {...light()}
    >
      <div
        className="glass-card overflow-hidden h-full w-full "
        style={{
          zIndex: is3d ? '10000' : '-10',
          // transform: is3d
          //   ? `rotateX(${rotation[0]}deg) rotateY(${rotation[1]}deg)  `
          //   : undefined,
        }}
      >
        <div
          className="absolute top-0 bottom-0 right-0 left-0 z-10"
          style={{
            backgroundImage: `radial-gradient(circle at ${lightPoint[0]}px ${
              lightPoint[1]
            }px, rgba(255,255,255,${
              0.13 * lightIntensity
            }) 10px, rgba(255,255,255,${
              0.02 * lightIntensity
            }) 200px, rgba(255,255,255,${0.005 * lightIntensity}) 300px)`,
            backgroundBlendMode: 'luminosity',
            pointerEvents: 'none',
            touchAction: 'none',
          }}
        ></div>
        <div
          className="drop-shadow-md w-full h-full"
          //   style={{
          //     transform: is3d
          //       ? `translateX(${rotation[1] * sizeFactor[0]}px) translateY(${
          //           -rotation[0] * sizeFactor[1]
          //         }px)`
          //       : undefined,
          //   }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

type GlassBoxContentProps = {
  image?: string
  title: string
  description: string
  children?: ReactNode
}

export function GlassBoxContent({
  image,
  title,
  description,
  children,
}: GlassBoxContentProps) {
  return (
    <GlassBoxSimple className="w-full">
      <div className="flex-nowrap flex flex-col">
        <div className="overflow-clip flex-shrink min-h-full">
          <>
            {image != undefined && <GlassBoxImage src={image}></GlassBoxImage>}
          </>
        </div>
        <div className="rounded-t-none flex-1 before:rounded-t-none px-[3vh] py-[1.5vh] w-fit">
          <>{image && <BGColorImage src={image}></BGColorImage>}</>

          <h1 className="font-title text-3xl">{title}</h1>
          <p className="font-paragraph text-lg mt-2">{description}</p>
          <>{children && <div className="mt-4">{children}</div>}</>
        </div>
      </div>
    </GlassBoxSimple>
  )
}

type GlassBoxImageProps = {
  src: string
}

function BGColorImage({ src }: GlassBoxImageProps) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 top-0 translate-y-36 blur-xl   -z-10 "
      style={{
        pointerEvents: 'none',
        touchAction: 'none',
      }}
    >
      <Image
        src={src}
        sizes="33vw"
        width={100}
        height={0}
        className="fade-img -scale-y-100"
        style={{
          width: '100%',
          height: 'auto',
          backgroundBlendMode: 'luminosity',
          opacity: 0.8,
        }}
        alt="woo"
      ></Image>
    </div>
  )
}

function GlassBoxImage({ src }: GlassBoxImageProps) {
  return (
    <div
      className="w-full overflow-hidden rounded-t-[3vh]"
      style={{ willChange: 'transform', maxHeight: '20vh' }}
    >
      <Image
        className="backfa"
        src={src}
        sizes="33vw"
        width={100}
        height={0}
        style={{
          width: '100%',
          height: 'auto',
          backgroundBlendMode: 'luminosity',
          opacity: 0.9,
        }}
        alt="woo"
      ></Image>
    </div>
  )
}
