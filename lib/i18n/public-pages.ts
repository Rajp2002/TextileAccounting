// These routes use complete, curated copy. Never run fragment/glossary
// substitution on a legal paragraph: it can silently change its meaning.
const PUBLIC_PAGE_PATHS = new Set([
  '/', '/privacy', '/terms', '/refund-policy', '/privacy-request', '/security-incident',
])

export function isPublicPagePath(pathname: string) {
  return PUBLIC_PAGE_PATHS.has(pathname.replace(/\/$/, '') || '/')
}

export type PublicPageTranslator = (source: string) => string | undefined

export function createPublicPageTranslator(copy: Record<string, string>): PublicPageTranslator {
  const phrases = new Map(Object.entries(copy))
  const templates = Object.entries(copy).flatMap(([source, target]) => {
    const keys: string[] = []
    const parts = source.split(/(\{\w+\})/g)
    if (parts.length === 1) return []
    const pattern = parts.map((part) => {
      if (/^\{\w+\}$/.test(part)) {
        keys.push(part.slice(1, -1))
        return '(.+?)'
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }).join('')
    return [{ pattern: new RegExp(`^${pattern}$`), keys, target }]
  })

  return (source) => {
    const exact = phrases.get(source)
    if (exact !== undefined) return exact
    for (const { pattern, keys, target } of templates) {
      const match = pattern.exec(source)
      if (!match) continue
      const values = new Map(keys.map((key, index) => [key, match[index + 1]]))
      return target.replace(/\{(\w+)\}/g, (token, key: string) => values.get(key) ?? token)
    }
    return undefined
  }
}

export async function loadPublicPageTranslator(language: 'hi' | 'gu') {
  const { default: copy } = language === 'hi'
    ? await import('./public-pages/hi.json')
    : await import('./public-pages/gu.json')
  return createPublicPageTranslator(copy)
}
