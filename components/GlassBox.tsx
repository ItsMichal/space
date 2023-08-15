'use client'

import {
  motion,
  MotionValue,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import Image from 'next/image'

import React, { ReactNode } from 'react'

type GlassBoxProps = {
  children?: ReactNode
  className?: string
}

//Helper function for timeless geometric easing
// function ease(orig_val: number, new_val: number, factor = 0.1): number {
//   return orig_val * (1 - factor) + new_val * factor
// }

//TODO: optimize perf further. done for now
export function GlassBoxAnim({ children, className }: GlassBoxProps) {
  const x_pos: MotionValue<number> = useMotionValue(0)
  const y_pos: MotionValue<number> = useMotionValue(0)
  const width: MotionValue<number> = useMotionValue(1)
  const height: MotionValue<number> = useMotionValue(1)
  const inBox: MotionValue<number> = useMotionValue(0)

  // const scaleFactor = useTransform(inBox, [0, 1], [1, 1.05])
  // const scaleSpring = useSpring(scaleFactor)

  const tiltAmplitude = 10

  const x_rot = useTransform(
    [inBox, y_pos, height],
    ([inBox_cur, y_pos_cur, height_cur]) => {
      return (
        -(inBox_cur as number) *
        tiltAmplitude *
        (2 * ((y_pos_cur as number) / (height_cur as number)) - 1)
      )
    }
  )

  const y_rot = useTransform(
    [inBox, x_pos, width],
    ([inBox_cur, x_pos_cur, width_cur]) => {
      return (
        (inBox_cur as number) *
        tiltAmplitude *
        (2 * ((x_pos_cur as number) / (width_cur as number)) - 1)
      )
    }
  )
  const x_rot_spring = useSpring(x_rot)
  const y_rot_spring = useSpring(y_rot)

  const onMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const nx_pos = e.pageX - e.currentTarget.getBoundingClientRect().left
    const ny_pos = e.pageY - e.currentTarget.getBoundingClientRect().top
    const nwidth = e.currentTarget.offsetWidth
    const nheight = e.currentTarget.offsetHeight

    const threshold = 2
    const dx_pos = Math.abs(nx_pos - x_pos.get())
    const dy_pos = Math.abs(ny_pos - y_pos.get())
    const dwidth = Math.abs(nwidth - width.get())
    const dheight = Math.abs(nheight - height.get())

    if (
      dx_pos < threshold &&
      dy_pos < threshold &&
      dwidth < threshold &&
      dheight < threshold
    )
      return

    if (
      x_pos.isAnimating() ||
      y_pos.isAnimating() ||
      width.isAnimating() ||
      height.isAnimating()
    )
      return

    if (e.currentTarget.classList.contains('glass-hoverable')) {
      x_pos.set(e.clientX - e.currentTarget.getBoundingClientRect().left)
      y_pos.set(e.clientY - e.currentTarget.getBoundingClientRect().top)
      width.set(e.currentTarget.offsetWidth)
      height.set(e.currentTarget.offsetHeight)
    }
  }

  return (
    <motion.div
      className={'w-full glass-hoverable ' + className}
      style={{
        perspective: `2000px`,
        willChange: 'contents',
      }}
      whileHover={{
        scale: 1.02,
      }}
      whileTap={{
        scale: 1.02,
      }}
      transition={{
        type: 'spring',
      }}
      onMouseMove={onMouseOver}
      onMouseEnter={() => {
        inBox.set(1)
      }}
      onMouseLeave={() => {
        inBox.set(0)
      }}
    >
      <motion.div
        className="glass-card h-full w-full group"
        style={{
          rotateX: x_rot_spring,
          rotateY: y_rot_spring,
          translate: 'translate3d(0,0,0)',
          transformStyle: 'preserve-3d',
        }}
      >
        <motion.div
          className="absolute -inset-px rounded-[3vh]  z-10 opacity-0 group-hover:opacity-100 duration-300"
          style={{
            transformStyle: 'preserve-3d',
            backgroundImage: useMotionTemplate`radial-gradient(circle at ${x_pos}px ${y_pos}px, rgba(255,255,255,${
              0.13 * 1
            }) 30px, rgba(255,255,255,${0.02 * 1}) 300px, rgba(255,255,255,${
              0.005 * 1
            }) 500px)`,
            backgroundBlendMode: 'luminosity',
            pointerEvents: 'none',
            touchAction: 'none',
          }}
        ></motion.div>
        <div
          className="w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {children}
        </div>
      </motion.div>
    </motion.div>
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
    <GlassBoxAnim className="w-full overflow-hidden">
      <>{image && <BGColorImage src={image}></BGColorImage>}</>

      <div className="flex-nowrap flex flex-col">
        <div className="overflow-clip flex-shrink min-h-full">
          <>
            {image != undefined && <GlassBoxImage src={image}></GlassBoxImage>}
          </>
        </div>
        <div className="rounded-t-none flex-1 before:rounded-t-none px-[3vh] py-[1.5vh] w-full z-10">
          <h1 className="font-title text-3xl">{title}</h1>
          <p className="font-paragraph text-lg mt-2">{description}</p>
          <>{children && <div className="mt-4">{children}</div>}</>
        </div>
      </div>
    </GlassBoxAnim>
  )
}

type GlassBoxImageProps = {
  src: string
}

function BGColorImage({ src }: GlassBoxImageProps) {
  return (
    <div
      className="absolute top-[6vh]  inset-0 "
      style={{
        pointerEvents: 'none',
        touchAction: 'none',
        transform: 'translateZ(-10px)',
        filter: 'blur(4vh)',
        maxHeight: '20vh',
        overflow: 'hidden',
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
          opacity: 0.7,
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
      style={{
        willChange: 'transform',
      }}
    >
      <Image
        className="backfa"
        src={src}
        sizes="33vw"
        width={100}
        height={0}
        style={{
          width: '100%',
          aspectRatio: '3 / 2',
          height: 'auto',
          objectFit: 'cover',
          objectPosition: 'top left',
          backgroundBlendMode: 'luminosity',
          opacity: 0.9,
        }}
        alt="woo"
      ></Image>
    </div>
  )
}
