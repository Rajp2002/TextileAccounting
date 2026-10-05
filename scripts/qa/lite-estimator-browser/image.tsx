import React from 'react'
type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }
export default function Image(props: ImageProps) {
    const forwarded = Object.fromEntries(Object.entries(props).filter(([key]) => !['fill', 'priority'].includes(key)))
    return React.createElement('img', { ...forwarded, alt: props.alt ?? '' })
}
