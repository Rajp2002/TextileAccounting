import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for the payroll worker card's Breakdown control, its per-machine panel
 * and the fixed-salary attendance calendar. Native review is a release gate and is not done.
 */
const PHRASES: Array<[string, string, string]> = [
  ['Breakdown', 'विवरण', 'વિગત'],
  ['Close', 'बंद करें', 'બંધ કરો'],
  ['Period breakdown', 'अवधि का विवरण', 'સમયગાળાની વિગત'],
  ['Pay', 'भुगतान', 'ચુકવણી'],
  ['Machine', 'मशीन', 'મશીન'],
  ['Rate', 'दर', 'દર'],
  ['Metres', 'मीटर', 'મીટર'],
  ['Worker total (machine not recorded)', 'कारीगर का कुल (मशीन दर्ज नहीं)', 'કારીગરનો કુલ (મશીન નોંધાયેલ નથી)'],
  ['No metres recorded in this period.', 'इस अवधि में कोई मीटर दर्ज नहीं है।', 'આ સમયગાળામાં કોઈ મીટર નોંધાયા નથી.'],
  // Fixed-salary attendance calendar.
  ['Off', 'छुट्टी', 'રજા'],
  ['{count} off', '{count} छुट्टी', '{count} રજા'],
  ['{days} days worked', '{days} दिन काम', '{days} દિવસ કામ'],
  ['{salary} ÷ {monthDays} days ≈ {dayRate} a day', '{salary} ÷ {monthDays} दिन ≈ {dayRate} प्रति दिन', '{salary} ÷ {monthDays} દિવસ ≈ {dayRate} પ્રતિ દિવસ'],
  ['{date}: worked. Tap to mark off.', '{date}: काम किया। छुट्टी दर्ज करने के लिए टैप करें।', '{date}: કામ કર્યું. રજા નોંધવા ટેપ કરો.'],
  ['{date}: off. Tap to mark worked.', '{date}: छुट्टी। काम दर्ज करने के लिए टैप करें।', '{date}: રજા. કામ નોંધવા ટેપ કરો.'],
  ['Tap a day to mark it off.', 'छुट्टी दर्ज करने के लिए किसी दिन पर टैप करें।', 'રજા નોંધવા કોઈ દિવસ પર ટેપ કરો.'],
  ['Paid · days locked', 'भुगतान हो गया · दिन लॉक हैं', 'ચુકવણી થઈ ગઈ · દિવસ લૉક છે'],
  ['Total', 'कुल', 'કુલ'],
]

export const PAYROLL_BREAKDOWN_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}
