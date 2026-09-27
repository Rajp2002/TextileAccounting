/* eslint-disable -- guided-tour harness: a local diagnostic tool, not application code. */
export default function Image({ src, alt, fill, priority, ...rest }: any) { return <img src={typeof src === 'string' ? src : src?.src} alt={alt} {...rest} /> }
