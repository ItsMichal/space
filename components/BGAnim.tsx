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
      u_colorA: { value: new Color('#F2EA72') },
      u_colorB: { value: new Color('#6DF7F5') },
      u_colorC: { value: new Color('#1A041B') },
      u_colorD: { value: new Color('#150C64') },
      u_noiseScale: { value: 0.006 },
    }),
    []
  )

  useFrame((state) => {
    const { clock } = state
    if (shaderMat.current != undefined) {
      ;(shaderMat.current as ShaderMaterial).uniforms.u_time.value =
        clock.getElapsedTime()
    }
  })

  return (
    <mesh ref={mesh as React.MutableRefObject<Mesh>} scale={1}>
      <planeGeometry
        args={[
          //   5, 5, 500, 500,
          size.width,
          size.height,
          Math.ceil(size.width / 64),
          Math.ceil(size.height / 64),
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
