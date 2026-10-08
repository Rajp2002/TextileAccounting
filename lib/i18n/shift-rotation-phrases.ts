import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for the Workers page "Switch shifts" pill and its modal. Kept
 * together so a native reviewer can check them in one place; native review is a
 * release gate and is not done.
 */
const PHRASES: Array<[string, string, string]> = [
  ['Switch shifts', 'शिफ्ट बदलें', 'શિફ્ટ બદલો'],
  [
    'Day workers move to night and night workers move to day. Their looms move with them, starting today.',
    'दिन की शिफ्ट वाले कारीगर रात में और रात की शिफ्ट वाले कारीगर दिन में जाएँगे। उनके लूम भी उनके साथ बदलेंगे, आज से।',
    'દિવસની શિફ્ટના કારીગરો રાતમાં અને રાતની શિફ્ટના કારીગરો દિવસમાં જશે. તેમના લૂમ પણ તેમની સાથે બદલાશે, આજથી.',
  ],
  ['Select all', 'सभी चुनें', 'બધા પસંદ કરો'],
  ['Clear all', 'सभी हटाएँ', 'બધા હટાવો'],
  ['{selected} of {total} selected', '{total} में से {selected} चुने गए', '{total} માંથી {selected} પસંદ કર્યા'],
  ['Day → Night', 'दिन → रात', 'દિવસ → રાત'],
  ['Night → Day', 'रात → दिन', 'રાત → દિવસ'],
  ['No looms', 'कोई लूम नहीं', 'કોઈ લૂમ નથી'],
  ['1 loom', '1 लूम', '1 લૂમ'],
  ['{count} looms', '{count} लूम', '{count} લૂમ'],
  ['Switch shift for {name}', '{name} की शिफ्ट बदलें', '{name}ની શિફ્ટ બદલો'],
  ['Fix these before switching:', 'शिफ्ट बदलने से पहले इन्हें ठीक करें:', 'શિફ્ટ બદલતા પહેલાં આને સુધારો:'],
  [
    '{machine} ({shift}) is held by {holder}, who is not switching.',
    '{machine} ({shift}) पर {holder} हैं, जो शिफ्ट नहीं बदल रहे।',
    '{machine} ({shift}) પર {holder} છે, જે શિફ્ટ બદલતા નથી.',
  ],
  ['Switch 1 worker', 'एक कारीगर की शिफ्ट बदलें', 'એક કારીગરની શિફ્ટ બદલો'],
  ['Switch {count} workers', '{count} कारीगरों की शिफ्ट बदलें', '{count} કારીગરોની શિફ્ટ બદલો'],
  ['Switching…', 'शिफ्ट बदली जा रही है…', 'શિફ્ટ બદલાઈ રહી છે…'],
  [
    'No piece-rate workers on a single shift to switch.',
    'बदलने के लिए एक शिफ्ट वाला कोई पीस-रेट कारीगर नहीं है।',
    'બદલવા માટે એક શિફ્ટવાળા કોઈ પીસ-રેટ કારીગર નથી.',
  ],
  [
    'Workers set to Day & night and fixed-salary staff are not included.',
    'दिन और रात वाले कारीगर और फिक्स्ड सैलरी स्टाफ़ शामिल नहीं हैं।',
    'દિવસ અને રાતવાળા કારીગરો અને ફિક્સ્ડ સેલરી સ્ટાફ સામેલ નથી.',
  ],
  [
    'Shifts switched: {workers} workers, {looms} looms.',
    'शिफ्ट बदल गई: {workers} कारीगर, {looms} लूम।',
    'શિફ્ટ બદલાઈ: {workers} કારીગર, {looms} લૂમ.',
  ],
  [
    'A loom changed since this list loaded. Close this window and try again.',
    'यह सूची लोड होने के बाद कोई लूम बदल गया है। यह विंडो बंद करके फिर कोशिश करें।',
    'આ યાદી લોડ થયા પછી કોઈ લૂમ બદલાયો છે. આ વિન્ડો બંધ કરીને ફરી પ્રયાસ કરો.',
  ],
  [
    'Shifts could not be switched. Please try again.',
    'शिफ्ट बदली नहीं जा सकी। कृपया फिर कोशिश करें।',
    'શિફ્ટ બદલી શકાઈ નથી. કૃપા કરીને ફરી પ્રયાસ કરો.',
  ],
]

export const SHIFT_ROTATION_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}
