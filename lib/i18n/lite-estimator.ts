import type { Language } from './context'

const phrases = {
  help: ['Help', 'મદદ', 'मदद'],
  mode: ['Costing mode', 'કોસ્ટિંગ મોડ', 'कॉस्टिंग मोड'],
  qualities: ['Saved qualities', 'સાચવેલી ક્વોલિટીઓ', 'सहेजी गई क्वालिटियाँ'],
  count: ['{count} saved qualities', '{count} સાચવેલી ક્વોલિટીઓ', '{count} सहेजी गई क्वालिटियाँ'],
  browse: ['Browse saved qualities', 'સાચવેલી ક્વોલિટીઓ જુઓ', 'सहेजी गई क्वालिटियाँ देखें'],
  new: ['New quality', 'નવી ક્વોલિટી', 'नई क्वालिटी'],
  complete: ['Complete inputs', 'માહિતી પૂર્ણ કરો', 'जानकारी पूरी करें'],
  live: ['Live estimate', 'લાઇવ અંદાજ', 'लाइव अनुमान'],
  unsaved: ['Not saved to factory', 'ફેક્ટરીમાં સાચવ્યું નથી', 'फ़ैक्टरी में सहेजा नहीं गया'],
  saved: ['Saved to factory · v{version}', 'ફેક્ટરીમાં સાચવ્યું · v{version}', 'फ़ैक्टरी में सहेजा गया · v{version}'],
  recipe: ['Recipe: {name}', 'રેસીપી: {name}', 'रेसिपी: {name}'],
  sourceVersion: ['Source costing v{version}', 'મૂળ કોસ્ટિંગ v{version}', 'मूल कॉस्टिंग v{version}'],
  viewLabel: ['View live cost. Production ₹{value} per metre. {state}', 'લાઇવ ખર્ચ જુઓ. ઉત્પાદન ₹{value} પ્રતિ મીટર. {state}', 'लाइव लागत देखें। उत्पादन ₹{value} प्रति मीटर। {state}'],
  reviewLabel: ['Review inputs. {count} inputs need attention. {state}', 'માહિતી તપાસો. {count} માહિતીને ધ્યાન આપવાની જરૂર છે. {state}', 'जानकारी जाँचें। {count} जानकारियों पर ध्यान देना आवश्यक है। {state}'],
} as const

export function liteEstimatorText(language: Language, key: keyof typeof phrases, values: Record<string, string | number> = {}) {
  return phrases[key][language === 'gu' ? 1 : language === 'hi' ? 2 : 0]
    .replace(/\{(\w+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name]))
}
