export default function Image({ src, alt, fill, priority, ...rest }: any) { return <img src={typeof src === 'string' ? src : src?.src} alt={alt} {...rest} /> }
