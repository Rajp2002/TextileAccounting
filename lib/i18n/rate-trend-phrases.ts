import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for the Rate Book price-history modal (the chart opened from
 * a yarn's rate and trend). Kept together so a native reviewer can check them in
 * one place; native review is a release gate and is not done.
 */
const PHRASES: Array<[string, string, string]> = [
  ['Price history', 'भाव का इतिहास', 'ભાવનો ઇતિહાસ'],
  ['View price history', 'भाव का इतिहास देखें', 'ભાવનો ઇતિહાસ જુઓ'],
  ['Price history chart', 'भाव इतिहास चार्ट', 'ભાવ ઇતિહાસ ચાર્ટ'],
  ['Loading price history…', 'भाव का इतिहास लोड हो रहा है…', 'ભાવનો ઇતિહાસ લોડ થઈ રહ્યો છે…'],
  ['No price history recorded yet.', 'अभी तक कोई भाव इतिहास दर्ज नहीं है।', 'હજી સુધી ભાવનો ઇતિહાસ નોંધાયો નથી.'],
  ['Only one price is recorded so far. The trend appears once this rate changes.', 'अब तक केवल एक भाव दर्ज है। यह रेट बदलने पर ट्रेंड दिखेगा।', 'અત્યાર સુધી માત્ર એક ભાવ નોંધાયો છે. આ રેટ બદલાય ત્યારે ટ્રેન્ડ દેખાશે.'],
  ['Today', 'आज', 'આજે'],
  ['Since first entry', 'पहली एंट्री से', 'પહેલી એન્ટ્રીથી'],
  ['Price changes', 'भाव बदलाव', 'ભાવ ફેરફાર'],
  ['No change', 'कोई बदलाव नहीं', 'કોઈ ફેરફાર નથી'],
  ['First entry', 'पहली एंट्री', 'પહેલી એન્ટ્રી'],
  ['Rate before first change', 'पहले बदलाव से पहले का रेट', 'પહેલા ફેરફાર પહેલાંનો રેટ'],
  ['Price changed', 'भाव बदला', 'ભાવ બદલાયો'],
  ['Reviewed, price unchanged', 'समीक्षा हुई, भाव वही', 'સમીક્ષા થઈ, ભાવ એ જ'],
  ['Full activity', 'पूरी गतिविधि', 'પૂરી પ્રવૃત્તિ'],
  ['Date', 'तारीख', 'તારીખ'],
  ['Event', 'घटना', 'ઘટના'],
]

export const RATE_TREND_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}
