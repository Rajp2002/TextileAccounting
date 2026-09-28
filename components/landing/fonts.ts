import { Anek_Devanagari, Anek_Gujarati, Anek_Latin } from 'next/font/google'

/**
 * Landing-only type. Anek (Ek Type) is one design across Latin, Gujarati and
 * Devanagari, so the English headlines and the ગુજરાતી / हिन्दी moments read as
 * one voice. These only define CSS variables; they are applied inside the page
 * plane, never on <main>, so the protected navbar keeps its own type.
 */
export const anekLatin = Anek_Latin({
    subsets: ['latin'],
    axes: ['wdth'],
    variable: '--font-lp-display',
    display: 'swap',
})

// Script faces are only needed for a few words, so they are not preloaded; the
// browser fetches them by unicode-range when those words render.
export const anekGujarati = Anek_Gujarati({
    subsets: ['gujarati'],
    variable: '--font-lp-gujarati',
    display: 'swap',
    preload: false,
})

export const anekDevanagari = Anek_Devanagari({
    subsets: ['devanagari'],
    variable: '--font-lp-devanagari',
    display: 'swap',
    preload: false,
})

export const landingFontVariables = `${anekLatin.variable} ${anekGujarati.variable} ${anekDevanagari.variable}`
