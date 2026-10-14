import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for the payroll worker card's Breakdown control and its pay breakdown
 * modal. Native review is a release gate and is not done. Total, Salary, Staff, Piece rate,
 * Inactive, Day shift and Night shift are already translated elsewhere, so they are not
 * repeated here.
 */
const PHRASES: Array<[string, string, string]> = [
  ['Breakdown', 'विवरण', 'વિગત'],
  ['Close', 'बंद करें', 'બંધ કરો'],
  ['Pay', 'भुगतान', 'ચુકવણી'],
  ['Machine', 'मशीन', 'મશીન'],
  ['Rate', 'दर', 'દર'],
  ['Metres', 'मीटर', 'મીટર'],
  ['Worker total (machine not recorded)', 'कारीगर का कुल (मशीन दर्ज नहीं)', 'કારીગરનો કુલ (મશીન નોંધાયેલ નથી)'],
  ['No metres recorded in this period.', 'इस अवधि में कोई मीटर दर्ज नहीं है।', 'આ સમયગાળામાં કોઈ મીટર નોંધાયા નથી.'],
  ['Net pay', 'शुद्ध भुगतान', 'ચોખ્ખી ચુકવણી'],
  ['Paid on {date}', '{date} को भुगतान हुआ', '{date} ના રોજ ચૂકવાયું'],
  ['Not paid yet', 'अभी भुगतान नहीं हुआ', 'હજી ચૂકવાયું નથી'],
  ['Cash', 'नकद', 'રોકડ'],
  ['Bank transfer', 'बैंक ट्रांसफर', 'બેંક ટ્રાન્સફર'],
  ['UPI', 'UPI', 'UPI'],
  ['Cheque', 'चेक', 'ચેક'],
  ['Day & night shift', 'दिन और रात की शिफ्ट', 'દિવસ અને રાતની શિફ્ટ'],
  ['Fixed monthly salary', 'तय मासिक वेतन', 'નક્કી માસિક પગાર'],
  ['Machine pay', 'मशीन से कमाई', 'મશીનથી કમાણી'],
  ['Approved incentives', 'मंज़ूर प्रोत्साहन', 'મંજૂર પ્રોત્સાહન'],
  ['Gross pay', 'कुल कमाई', 'કુલ કમાણી'],
  ['Advance recovery', 'एडवांस वसूली', 'એડવાન્સ વસૂલી'],
  ['No advance to recover.', 'वसूलने के लिए कोई एडवांस नहीं है।', 'વસૂલવા માટે કોઈ એડવાન્સ નથી.'],
  ['{amount} pending in advances and deductions.', 'एडवांस और कटौती में {amount} बाकी है।', 'એડવાન્સ અને કપાતમાં {amount} બાકી છે.'],
  ['{amount} carries forward to the next period.', '{amount} अगली अवधि में आगे जाएगा।', '{amount} આગલા સમયગાળામાં આગળ જશે.'],
  ['Metres by machine', 'मशीन के अनुसार मीटर', 'મશીન મુજબ મીટર'],
  ['1 machine', '1 मशीन', '1 મશીન'],
  ['{count} machines', '{count} मशीनें', '{count} મશીન'],
  ['Salary by month', 'महीने के अनुसार वेतन', 'મહિના મુજબ પગાર'],
  ['Period', 'अवधि', 'સમયગાળો'],
  ['Monthly salary', 'मासिक वेतन', 'માસિક પગાર'],
  ['Days', 'दिन', 'દિવસ'],
  ['month', 'महीना', 'મહિનો'],
  ['No salary days in this period.', 'इस अवधि में वेतन के दिन नहीं हैं।', 'આ સમયગાળામાં પગારના દિવસ નથી.'],
]

export const PAYROLL_BREAKDOWN_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}
