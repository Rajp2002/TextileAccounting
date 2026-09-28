/**
 * Vitest stand-in for `next/font/google`, which only works inside Next's
 * compiler. Components that load fonts (the landing and policy pages) can then
 * be rendered to static markup in tests. Add a name here when a new font is used.
 */
type FontOptions = Record<string, unknown>

const font = (options?: FontOptions) => ({
    className: '',
    variable: typeof options?.variable === 'string' ? options.variable.replace(/^--/, 'font-var-') : '',
    style: { fontFamily: 'sans-serif' },
})

export const Anek_Latin = font
export const Anek_Gujarati = font
export const Anek_Devanagari = font
export const Inter = font
export const Geist_Mono = font
