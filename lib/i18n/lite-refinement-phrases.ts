import type { BasePlanLocalLanguage } from './base-plan-phrases'

/**
 * Hindi and Gujarati for copy added or changed by the Lite refinement sprint
 * (docs/lite-tier/REFINEMENT_SPRINT.md). Kept together so a native reviewer
 * can check them in one place; native review is a release gate and is not done.
 */
const PHRASES: Array<[string, string, string]> = [
  ['Reconnect before saving', 'सेव करने से पहले फिर से कनेक्ट करें', 'સેવ કરતાં પહેલાં ફરી કનેક્ટ કરો'],
  ['Your Cost Estimate and save identity are stored on this device.', 'आपका लागत अनुमान और उसकी सेव पहचान इस डिवाइस पर रखी गई है।', 'તમારો ખર્ચ અંદાજ અને તેની સેવ ઓળખ આ ડિવાઇસ પર રાખેલ છે.'],
  ['This Cost Estimate is kept on this page only. Keep the page open until you reconnect, then save.', 'यह लागत अनुमान केवल इसी पेज पर है। फिर से कनेक्ट होने तक पेज खुला रखें, फिर सेव करें।', 'આ ખર્ચ અંદાજ માત્ર આ પેજ પર જ છે. ફરી કનેક્ટ થાય ત્યાં સુધી પેજ ખુલ્લું રાખો, પછી સેવ કરો.'],
  ['A recovered draft is waiting for your choice, so this Cost Estimate is not stored on this device yet. Keep the page open until you reconnect.', 'एक पुराना ड्राफ्ट आपके चुनाव का इंतज़ार कर रहा है, इसलिए यह लागत अनुमान अभी इस डिवाइस पर नहीं रखा गया है। फिर से कनेक्ट होने तक पेज खुला रखें।', 'એક જૂનો ડ્રાફ્ટ તમારી પસંદગીની રાહ જુએ છે, તેથી આ ખર્ચ અંદાજ હજી આ ડિવાઇસ પર રાખેલ નથી. ફરી કનેક્ટ થાય ત્યાં સુધી પેજ ખુલ્લું રાખો.'],
  ['Browser storage is unavailable, so keep this page open until you reconnect.', 'ब्राउज़र स्टोरेज उपलब्ध नहीं है, इसलिए फिर से कनेक्ट होने तक यह पेज खुला रखें।', 'બ્રાઉઝર સ્ટોરેજ ઉપલબ્ધ નથી, તેથી ફરી કનેક્ટ થાય ત્યાં સુધી આ પેજ ખુલ્લું રાખો.'],
]

export const LITE_REFINEMENT_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}
