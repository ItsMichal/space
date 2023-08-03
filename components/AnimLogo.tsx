'use client'

import React from 'react'

import { motion } from 'framer-motion'

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => {
    const delay = 1 + i * 0.1
    return {
      pathLength: [null, 1] as [null, ...number[]],
      opacity: [null, 1] as [null, ...number[]],
      stroke: [null, '#ff0f', '#f0ff', '#0fff', '#ffff'] as [null, ...string[]],
      fill: [null, '#ffff'] as [null, ...string[]],
      transition: {
        pathLength: {
          delay,
          type: 'spring',
          duration: 1.5,
        },
        stroke: {
          delay: delay,
          duration: 1,
          bounce: 0,
        },
        fill: {
          delay: delay + 0.5,
          type: 'spring',
          duration: 1.5,
          bounce: 0,
        },
        opacity: {
          delay,
          type: 'spring',
          duration: 0.2,
        },
      },
    }
  },
  revisible: (i: number) => {
    const delay = 0 + i * 0.05
    return {
      pathLength: [null, 0] as [null, ...number[]],
      opacity: [null, 0] as [null, ...number[]],
      stroke: [null, '#fff0'] as [null, ...string[]],
      fill: [null, '#fff0'] as [null, ...string[]],
      transition: {
        pathLength: {
          delay: delay + 0.1,
          type: 'spring',
          duration: 0.4,
        },
        stroke: {
          delay: delay + 0.1,
          duration: 0.5,
          bounce: 0,
        },
        fill: {
          delay: delay,
          type: 'spring',
          duration: 0.2,
          bounce: 0,
        },
        opacity: {
          delay: delay + 1.8,
          type: 'spring',
          duration: 0.1,
        },
      },
    }
  },
}

export default function AnimLogo() {
  return (
    <motion.svg
      initial="hidden"
      whileHover="revisible"
      whileTap="revisible"
      animate={'visible'}
      viewBox="-1 -1 350.92 236.02"
      style={{
        width: 'auto',
        height: '100%',
      }}
    >
      <motion.path
        stroke="#fff"
        fill="#fff0"
        d="m21.09,148.21h0c-14.64,0-23.76-11.86-20.38-26.5L22.68,26.5C26.06,11.86,40.67,0,55.3,0h0c14.64,0,23.76,11.86,20.38,26.5l-21.98,95.21c-3.38,14.64-17.98,26.5-32.62,26.5Z"
        variants={draw}
        custom={1}
      />
      <motion.path
        stroke="#fff"
        fill="#fff0"
        d="m34.77,7.76h0c12.74-10.35,29.52-10.35,37.48,0l69.61,90.51c7.96,10.35,4.09,27.13-8.65,37.48h0c-12.74,10.35-29.52,10.35-37.48,0L26.12,45.24c-7.96-10.35-4.09-27.13,8.65-37.48Z"
        variants={draw}
        custom={2}
      />
      <motion.path
        stroke="#fff"
        fill="#fff0"
        d="m96.48,135.75h0c-7.96-10.35-4.09-27.13,8.65-37.48L216.54,7.76c12.74-10.35,29.52-10.35,37.48,0h0c7.96,10.35,4.09,27.13-8.65,37.48l-111.41,90.51c-12.74,10.35-29.52,10.35-37.48,0Z"
        variants={draw}
        custom={3}
      />
      <motion.path
        stroke="#fff"
        fill="#fff0"
        d="m183.06,235.02h0c-14.64,0-23.76-11.86-20.38-26.5L204.7,26.5C208.08,11.86,222.69,0,237.32,0h0c14.64,0,23.76,11.86,20.38,26.5l-42.02,182.02c-3.38,14.64-17.98,26.5-32.62,26.5Z"
        variants={draw}
        custom={4}
      />
      <motion.path
        stroke="#fff"
        fill="#fff0"
        d="m183.06,235.02h-91.51c-14.64,0-23.76-11.86-20.38-26.5h0c3.38-14.64,17.98-26.5,32.62-26.5h91.51c14.64,0,23.76,11.86,20.38,26.5h0c-3.38,14.64-17.98,26.5-32.62,26.5Z"
        variants={draw}
        custom={5}
      />

      <motion.path
        stroke="#fff"
        fill="#fff0"
        d="m328.83,0h0c14.64,0,23.76,11.86,20.38,26.5l-20.21,87.54c-3.38,14.64-17.98,26.5-32.62,26.5h0c-14.64,0-23.76-11.86-20.38-26.5l20.21-87.54C299.59,11.86,314.2,0,328.83,0Z"
        variants={draw}
        custom={6}
      />
      <motion.path
        stroke="#fff"
        fill="#fff0"
        d="m274.07,235.02h0c-14.64,0-23.76-11.86-20.38-26.5h0c3.38-14.64,17.98-26.5,32.62-26.5h0c14.64,0,23.76,11.86,20.38,26.5h0c-3.38,14.64-17.98,26.5-32.62,26.5Z"
        variants={draw}
        custom={7}
      />
    </motion.svg>
  )
}

{
  /* <Image
      src={'./logo.svg'}
      width={350}
      height={235}
      style={{ width: 'auto', height: '100%' }}
      alt="MJB Logo"
    ></Image> */
}
