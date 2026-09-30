export function formatTourText(text: string, controls: Record<string, string>, values: Record<string, string | number> = {}): string {
    return text.replace(/\{(c:)?([^{}]+)\}/g, (token: string, control: string | undefined, key: string) => {
        const source = control ? controls : values
        if (Object.prototype.hasOwnProperty.call(source, key)) return String(source[key])
        if (process.env.NODE_ENV !== 'production') throw new Error(`Unknown tour text token: ${token}`)
        return token
    })
}
