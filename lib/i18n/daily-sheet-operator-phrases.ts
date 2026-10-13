import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for the owner daily sheet when a loom's operator cannot work the
 * selected date and shift (left, not yet joined, or on the other shift). Kept together so
 * a native reviewer can check them in one place; native review is a release gate and is
 * not done.
 */
const PHRASES: Array<[string, string, string]> = [
  [
    'Not available on this date and shift',
    'इस तारीख और शिफ्ट में उपलब्ध नहीं',
    'આ તારીખ અને શિફ્ટમાં ઉપલબ્ધ નથી',
  ],
  ['Reassign loom', 'लूम किसी और को दें', 'લૂમ બીજાને સોંપો'],
  [
    'Not saved. The operator on {rows} is not available on this date and shift. Reassign the loom in Machine Assignments or clear its readings. Your readings are kept.',
    'सेव नहीं हुआ। {rows} वाला कारीगर इस तारीख और शिफ्ट में उपलब्ध नहीं है। मशीन असाइनमेंट में लूम किसी और को दें या उसकी रीडिंग हटाएँ। आपकी रीडिंग रखी गई हैं।',
    'સાચવ્યું નથી. {rows} વાળો કારીગર આ તારીખ અને શિફ્ટમાં ઉપલબ્ધ નથી. મશીન અસાઇનમેન્ટમાં લૂમ બીજાને સોંપો અથવા તેનાં રીડિંગ કાઢી નાખો. તમારાં રીડિંગ રાખ્યાં છે.',
  ],
]

export const DAILY_SHEET_OPERATOR_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}

export const DAILY_SHEET_OPERATOR_SOURCE_PHRASES = PHRASES.map(([source]) => source)
