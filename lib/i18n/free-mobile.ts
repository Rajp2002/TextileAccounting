import type { Language } from './context'

const phrases = {
  help: ['Help', 'મદદ', 'मदद'],
  mode: ['Costing mode', 'કોસ્ટિંગ મોડ', 'कॉस्टिंग मोड'],
  complete: ['Complete inputs', 'માહિતી પૂર્ણ કરો', 'जानकारी पूरी करें'],
  incomplete: ['Enter the required costing inputs.', 'જરૂરી કોસ્ટિંગ માહિતી દાખલ કરો.', 'आवश्यक कॉस्टिंग जानकारी दर्ज करें।'],
  review: ['Review inputs', 'માહિતી તપાસો', 'जानकारी जाँचें'],
  saved: ['Saved result', 'સાચવેલું પરિણામ', 'सहेजा गया परिणाम'],
  savedIdentity: ['Saved {label} · v{revision}', 'સાચવેલું {label} · v{revision}', 'सहेजा गया {label} · v{revision}'],
  filters: ['Filters & sort', 'ફિલ્ટર અને ક્રમ', 'फ़िल्टर और क्रम'],
  allowance: ['{remaining} / {limit} costings left this month', 'આ મહિને {remaining} / {limit} કોસ્ટિંગ બાકી', 'इस महीने {remaining} / {limit} कॉस्टिंग बाकी'],
} as const

export function freeMobileText(language: Language, key: keyof typeof phrases, values: Record<string, string | number> = {}) {
  const text = phrases[key][language === 'gu' ? 1 : language === 'hi' ? 2 : 0]
  return text.replace(/\{(\w+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name]))
}
