import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for the payroll worker card's Breakdown control, its pay breakdown modal
 * and the fixed-salary attendance calendar. Native review is a release gate and is not done.
 * Salary, Staff, Piece rate, Inactive, Day shift and Night shift are already translated
 * elsewhere, so they are not repeated here.
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
  // Pay breakdown modal.
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
  // Fixed-salary attendance calendar.
  ['Days worked', 'काम के दिन', 'કામના દિવસ'],
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
