export function formatTourText(text: string, controls: Record<string, string>, values: Record<string, string | number> = {}): string {
  return text.replace(/\{(c:)?([^}]+)\}/g, (token, control, name: string) => {
    const value = control ? controls[name] : values[name]
    if (value !== undefined) return String(value)
    if (process.env.NODE_ENV !== 'production') throw new Error(`Unknown tour token: ${token}`)
    return token
  })
}
