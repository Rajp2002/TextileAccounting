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
  ['We could not confirm whether the rate update for {name} was saved. Your proposed rates are kept on this page. Check the saved quality before saving again.', '{name} के लिए दर बदलाव सेव हुआ या नहीं, यह पक्का नहीं हो सका। आपकी प्रस्तावित दरें इसी पेज पर रखी हैं। दोबारा सेव करने से पहले सेव की गई क्वालिटी जाँचें।', '{name} માટે દરનો ફેરફાર સેવ થયો કે નહીં તે પાકું થઈ શક્યું નથી. તમારા સૂચિત દર આ પેજ પર રાખેલ છે. ફરી સેવ કરતાં પહેલાં સેવ કરેલી ક્વોલિટી તપાસો.'],
  ['Check saved rates', 'सेव की गई दरें जाँचें', 'સેવ કરેલા દર તપાસો'],
  ['The rates were not saved. You can save them again.', 'दरें सेव नहीं हुईं। आप उन्हें फिर से सेव कर सकते हैं।', 'દર સેવ થયા નથી. તમે તેને ફરી સેવ કરી શકો છો.'],
  ['The saved quality now has these rates.', 'सेव की गई क्वालिटी में अब यही दरें हैं।', 'સેવ કરેલી ક્વોલિટીમાં હવે આ જ દર છે.'],
  ['This saved quality changed elsewhere and does not have these rates. Close this and reopen the quality to review its current rates.', 'यह सेव की गई क्वालिटी कहीं और बदली गई है और इसमें ये दरें नहीं हैं। इसे बंद करें और मौजूदा दरें देखने के लिए क्वालिटी फिर से खोलें।', 'આ સેવ કરેલી ક્વોલિટી બીજે ક્યાંક બદલાઈ છે અને તેમાં આ દર નથી. આ બંધ કરો અને હાલના દર જોવા ક્વોલિટી ફરી ખોલો.'],
  ['This saved quality is no longer available.', 'यह सेव की गई क्वालिटी अब उपलब्ध नहीं है।', 'આ સેવ કરેલી ક્વોલિટી હવે ઉપલબ્ધ નથી.'],
  ['Could not check right now. Try again.', 'अभी जाँच नहीं हो सकी। फिर से कोशिश करें।', 'હમણાં તપાસ થઈ શકી નથી. ફરી પ્રયાસ કરો.'],
  ['This check is kept only while this page is open.', 'यह जाँच केवल तब तक रहती है जब तक यह पेज खुला है।', 'આ તપાસ માત્ર આ પેજ ખુલ્લું હોય ત્યાં સુધી રહે છે.'],
  ['Discard this proposal', 'यह प्रस्ताव हटाएँ', 'આ પ્રસ્તાવ કાઢી નાખો'],
  ['Not calculated', 'गणना नहीं की गई', 'ગણતરી કરી નથી'],
  ['Saved costings not loaded', 'सेव की गई कॉस्टिंग लोड नहीं हुई', 'સેવ કરેલી કૉસ્ટિંગ લોડ થઈ નથી'],
  ['Saved costings could not be loaded. Nothing was deleted. Try again.', 'सेव की गई कॉस्टिंग लोड नहीं हो सकीं। कुछ भी हटाया नहीं गया है। फिर से कोशिश करें।', 'સેવ કરેલી કૉસ્ટિંગ લોડ થઈ શકી નથી. કંઈ કાઢી નાખ્યું નથી. ફરી પ્રયાસ કરો.'],
  ['Try again', 'फिर से कोशिश करें', 'ફરી પ્રયાસ કરો'],
]

export const LITE_REFINEMENT_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
  hi: Object.fromEntries(PHRASES.map(([source, hi]) => [source, hi])),
  gu: Object.fromEntries(PHRASES.map(([source, , gu]) => [source, gu])),
}
