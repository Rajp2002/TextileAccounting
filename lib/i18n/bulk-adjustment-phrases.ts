import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for the payroll "Bulk advance / deduction" pill and its dialog.
 * Kept together so a native reviewer can check them in one place; native review is a
 * release gate and is not done. Phrases other Base screens already translate (Cancel,
 * Back, Review, Workers, Select all, Clear all, Piece rate, 1 worker) are not repeated.
 */
const PHRASES: Array<[string, string, string]> = [
  ['Bulk advance / deduction', 'एक साथ उपाड़ / कटौती', 'એકસાથે ઉપાડ / કપાત'],
  [
    'Record the same amount for several workers at once. Everyone is selected to start with.',
    'एक साथ कई कारीगरों के लिए समान राशि दर्ज करें। शुरुआत में सभी चुने हुए हैं।',
    'એકસાથે ઘણા કારીગરો માટે સમાન રકમ નોંધો. શરૂઆતમાં બધા પસંદ કરેલા છે.',
  ],
  ['Advance', 'उपाड़', 'ઉપાડ'],
  ['Deduction', 'कटौती', 'કપાત'],
  ['{count} workers', '{count} कारीगर', '{count} કારીગર'],
  [
    'Could not record this. Please try again.',
    'यह दर्ज नहीं हो सका। कृपया फिर कोशिश करें।',
    'આ નોંધી શકાયું નથી. કૃપા કરીને ફરી પ્રયાસ કરો.',
  ],
  ['Recorded for 1 worker.', '1 कारीगर के लिए दर्ज हो गया।', '1 કારીગર માટે નોંધાઈ ગયું.'],
  ['Recorded for {count} workers.', '{count} कारीगरों के लिए दर्ज हो गया।', '{count} કારીગરો માટે નોંધાઈ ગયું.'],
  [
    'No active workers to record this for.',
    'इसे दर्ज करने के लिए कोई सक्रिय कारीगर नहीं है।',
    'આ નોંધવા માટે કોઈ સક્રિય કારીગર નથી.',
  ],
  ['Check before recording', 'दर्ज करने से पहले जाँचें', 'નોંધતા પહેલાં તપાસો'],
  ['Type', 'प्रकार', 'પ્રકાર'],
  ['Per worker', 'प्रति कारीगर', 'પ્રતિ કારીગર'],
  ['Total', 'कुल', 'કુલ'],
  ['Reason', 'कारण', 'કારણ'],
  [
    'Each worker gets their own entry. Amounts are recovered through payroll settlement and cannot be removed from this screen.',
    'हर कारीगर की अलग प्रविष्टि बनती है। राशि पेरोल निपटान में वसूल होती है और इस स्क्रीन से हटाई नहीं जा सकती।',
    'દરેક કારીગરની અલગ એન્ટ્રી બને છે. રકમ પેરોલ સેટલમેન્ટમાં વસૂલ થાય છે અને આ સ્ક્રીન પરથી દૂર કરી શકાતી નથી.',
  ],
  ['Recording…', 'दर्ज हो रहा है…', 'નોંધાઈ રહ્યું છે…'],
  ['Record advance', 'उपाड़ दर्ज करें', 'ઉપાડ નોંધો'],
  ['Record deduction', 'कटौती दर्ज करें', 'કપાત નોંધો'],
  ['Amount per worker', 'प्रति कारीगर राशि', 'પ્રતિ કારીગર રકમ'],
  [
    'Enter an amount above 0 with at most two decimals.',
    'दशमलव के अधिकतम दो अंकों के साथ 0 से अधिक राशि लिखें।',
    'વધુમાં વધુ બે દશાંશ સાથે 0 થી વધુ રકમ લખો.',
  ],
  ['Notes (optional)', 'नोट्स (वैकल्पिक)', 'નોંધ (વૈકલ્પિક)'],
  ['e.g. Water bill for October', 'जैसे अक्टूबर का पानी का बिल', 'દા.ત. ઓક્ટોબરનું પાણીનું બિલ'],
  ['Reason (optional)', 'कारण (वैकल्पिक)', 'કારણ (વૈકલ્પિક)'],
  ['e.g. Diwali advance', 'जैसे दिवाली का उपाड़', 'દા.ત. દિવાળીનો ઉપાડ'],
  ['Worker types', 'कारीगर के प्रकार', 'કારીગરના પ્રકાર'],
  ['Piece rate ({count})', 'पीस-रेट ({count})', 'પીસ-રેટ ({count})'],
  ['Fixed monthly ({count})', 'निश्चित मासिक ({count})', 'નિશ્ચિત માસિક ({count})'],
  ['Fixed monthly', 'निश्चित मासिक', 'નિશ્ચિત માસિક'],
  ['Include {name}', '{name} को शामिल करें', '{name}ને સામેલ કરો'],
  ['{amount} for 1 worker', '1 कारीगर के लिए {amount}', '1 કારીગર માટે {amount}'],
  ['{amount} × {count} workers = {total}', '{amount} × {count} कारीगर = {total}', '{amount} × {count} કારીગર = {total}'],
]

export const BULK_ADJUSTMENT_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}
