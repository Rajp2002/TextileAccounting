import type { Language } from './context'

// Tuples are [English, Gujarati, Hindi], the same order as lib/i18n/free-mobile-entry.ts.
export const liteTrialPhrases = {
  startTrial: ['Start 3-month free trial', '3 મહિનાની મફત ટ્રાયલ શરૂ કરો', '3 महीने का मुफ़्त ट्रायल शुरू करें'],
  trialPayNow: ['Or pay now: ₹2,999 for the first year', 'અથવા હમણાં ચૂકવો: પહેલા વર્ષ માટે ₹2,999', 'या अभी भुगतान करें: पहले साल के लिए ₹2,999'],
  trialDisclosure: [
    '90 days of Lite free, no payment needed. After that, pay ₹2,999 for the first year (incl. GST) to stay on Lite, or continue on Free.',
    'Lite 90 દિવસ મફત, કોઈ ચુકવણીની જરૂર નથી. ત્યારબાદ Lite પર રહેવા માટે પહેલા વર્ષનો ₹2,999 (GST સહિત) ચૂકવો, અથવા Free પર ચાલુ રાખો.',
    '90 दिन Lite मुफ़्त, किसी भुगतान की ज़रूरत नहीं। उसके बाद Lite पर बने रहने के लिए पहले साल का ₹2,999 (GST सहित) चुकाएँ, या Free पर जारी रखें।',
  ],
  trialNotAvailable: ['Your free trial is not available for this account.', 'આ ખાતા માટે તમારી મફત ટ્રાયલ ઉપલબ્ધ નથી.', 'इस खाते के लिए आपका मुफ़्त ट्रायल उपलब्ध नहीं है।'],
  trialBannerDays: ['Lite trial: {days} days left', 'Lite ટ્રાયલ: {days} દિવસ બાકી', 'Lite ट्रायल: {days} दिन बाकी'],
  trialBannerOneDay: ['Lite trial: 1 day left', 'Lite ટ્રાયલ: 1 દિવસ બાકી', 'Lite ट्रायल: 1 दिन बाकी'],
  trialBannerLastDay: ['Lite trial ends today', 'Lite ટ્રાયલ આજે પૂરી થાય છે', 'Lite ट्रायल आज खत्म हो रहा है'],
  trialSubscribe: ['Subscribe to keep Lite', 'Lite ચાલુ રાખવા સબ્સ્ક્રાઇબ કરો', 'Lite जारी रखने के लिए सदस्यता लें'],
  trialEndsOn: ['Free trial ends {date}', 'મફત ટ્રાયલ {date} ના રોજ પૂરી થાય છે', 'मुफ़्त ट्रायल {date} को खत्म होगा'],
  trialEndedTitle: ['Your Lite trial has ended', 'તમારી Lite ટ્રાયલ પૂરી થઈ ગઈ છે', 'आपका Lite ट्रायल खत्म हो गया है'],
  trialEndedBody: [
    'You are now on Free. Subscribe to Lite to get your saved qualities and rate book back.',
    'હવે તમે Free પર છો. તમારી સાચવેલી ક્વોલિટી અને રેટ બુક પાછી મેળવવા Lite માટે સબ્સ્ક્રાઇબ કરો.',
    'अब आप Free पर हैं। अपनी सहेजी गई क्वालिटियाँ और रेट बुक वापस पाने के लिए Lite की सदस्यता लें।',
  ],
  trialDismiss: ['Dismiss', 'હટાવો', 'हटाएँ'],
} satisfies Record<string, readonly [string, string, string]>

export function liteTrialText(language: Language, key: keyof typeof liteTrialPhrases, values: Record<string, string | number> = {}) {
  return liteTrialPhrases[key][language === 'gu' ? 1 : language === 'hi' ? 2 : 0].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
