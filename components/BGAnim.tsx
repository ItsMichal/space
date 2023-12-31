'use client'
/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import React, { useMemo, useRef } from 'react'
import { Color, Mesh, ShaderMaterial } from 'three'
import { bgFragShader, bgVertShader } from './BGShaders'

//Huge thanks to Book of Shaders and Maxime Heckel's blog post
//for helping me with writing shaders in React.
//https://thebookofshaders.com/
//https://blog.maximeheckel.com/posts/the-study-of-shaders-with-react-three-fiber/

export const ShadedBackground = ({
  className = '',
}: {
  className?: string
}) => {
  return (
    <Canvas className={className} orthographic={true}>
      <ContourShadedPlane />
    </Canvas>
  )
}

const ContourShadedPlane = () => {
  const mesh = useRef<Mesh>()
  const shaderMat = useRef<ShaderMaterial>()
  const { size } = useThree()

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0.0 },
      u_colorA: { value: new Color('#e4c5e6') },
      u_colorB: { value: new Color('#c9fffe') },
      u_colorC: { value: new Color('#110a12') },
      u_colorD: { value: new Color('#131314') },
      u_timeScale:
        size.width > size.height ? { value: 0.005 } : { value: 0.01 },
      u_middleParting: { value: size.width / size.height > 1 ? 0.0 : 0.55 },
      u_noiseScale: { value: 0.0035 },
      u_mouse: { value: { x: 0.0, y: 0.0 } },
    }),
    []
  )

  useFrame((state) => {
    const { clock } = state
    if (shaderMat.current != undefined) {
      ;(shaderMat.current as ShaderMaterial).uniforms.u_time.value =
        clock.getElapsedTime()
    }

    //get mouse position on screen
  })

  return (
    <mesh ref={mesh as React.MutableRefObject<Mesh>} scale={1}>
      <planeGeometry
        args={[
          //   5, 5, 500, 500,
          size.width,
          size.height,
          Math.ceil(size.width / 8),
          Math.ceil(size.height / 8),
        ]}
      />

      {/* <meshBasicMaterial color="#fff" wireframe={true} /> */}

      <shaderMaterial
        ref={shaderMat as React.MutableRefObject<ShaderMaterial>}
        vertexShader={bgVertShader}
        fragmentShader={bgFragShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}
