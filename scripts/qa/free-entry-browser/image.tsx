/* eslint-disable @next/next/no-img-element -- Next image compiler is replaced only in this local Vite fixture. */
import type { CSSProperties } from 'react'

type ImageProps = {
  src: string
  alt: string
  fill?: boolean
  sizes?: string
  priority?: boolean
  className?: string
  width?: number
  height?: number
}

export default function Image({ src, alt, fill, sizes, priority, ...props }: ImageProps) {
  void priority
  return <img src={src} alt={alt} sizes={sizes} {...props} style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } as CSSProperties : undefined} />
}
