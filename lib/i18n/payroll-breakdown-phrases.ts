import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for the payroll worker card's Breakdown control and its per-machine
 * panel. Native review is a release gate and is not done. Machine, Rate, Metres and Total
 * are already translated elsewhere, so they are not repeated here.
 */
const PHRASES: Array<[string, string, string]> = [
  ['Breakdown', 'विवरण', 'વિગત'],
  ['Period breakdown', 'अवधि का विवरण', 'સમયગાળાની વિગત'],
  ['Pay', 'भुगतान', 'ચુકવણી'],
  ['Machine', 'मशीन', 'મશીન'],
  ['Rate', 'दर', 'દર'],
  ['Metres', 'मीटर', 'મીટર'],
  ['Worker total (machine not recorded)', 'कारीगर का कुल (मशीन दर्ज नहीं)', 'કારીગરનો કુલ (મશીન નોંધાયેલ નથી)'],
  ['No metres recorded in this period.', 'इस अवधि में कोई मीटर दर्ज नहीं है।', 'આ સમયગાળામાં કોઈ મીટર નોંધાયા નથી.'],
]

export const PAYROLL_BREAKDOWN_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}
