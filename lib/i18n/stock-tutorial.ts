import type { Language } from './context'
import type { StockTourKind, StockTourStep } from '../stock-tour'
import { configurationTutorialCopy } from './configuration-tutorial'
export type StockTutorialCopy = { sample: string; sections: string[]; fields: Partial<Record<StockTourStep, readonly [string, string]>>; skip: string; back: string; next: string; finish: string; progress: string }
export const fabricStockTutorialCopy: Record<Language, StockTutorialCopy> = {
en: { ...configurationTutorialCopy.en, sample: "Sample preview · your stock is unchanged", sections: [
  "Understand the balance",
  "Verify opening stock",
  "Correct a balance",
  "History and next action"
], fields: {
  "balance": [
    "Available fabric, by quality",
    "Opening stock + saved production − confirmed dispatches gives available metres. Here 500 + 200 − 100 = 600 m. A dispatch draft does not deduct stock."
  ],
  "tracking": [
    "Check when stock tracking began",
    "Read Stock started on your page. Historical production was not imported. Opening stock adds only physically remaining pre-start fabric, once per quality; do not add production already recorded since tracking began."
  ],
  "openingPending": [
    "Verify what belongs in opening",
    "Of 650 m remaining from before tracking, 150 m committed to historical pending dispatches leaves 500 m to add. Check Dispatch → Earlier dispatch records → Pending Dispatches. If access is restricted, reconcile those commitments with your earlier sales/dispatch records or ask your administrator before saving."
  ],
  "opening": [
    "Record the verified 500 m",
    "Choose Opening stock for the matching Production quality. Enter 500 remaining pre-start metres and a count reference, then review Save stock. This adds 500 m once; it does not replace today’s balance. This preview saves nothing."
  ],
  "correction": [
    "A correction sets today’s total",
    "Use Correct balance on the quality card after verifying the total available now. Unlike opening stock, this sets an absolute total. Saving also closes opening stock for this quality, so verify any missing opening first."
  ],
  "counted": [
    "600 m → 590 m: a −10 m movement",
    "Enter 590 as the verified total, not −10. Give the count reason and review Save stock. The balance becomes 590 m; the −10 m difference and reason remain in history."
  ],
  "finish": [
    "Trace the balance, then act",
    "Movement history shows each change and its Balance after. After Finish, check your tracking start and a quality’s Movement history. If opening is missing, reconcile the pre-start count before Opening stock; if already recorded, use Correct balance only for a verified difference."
  ]
} },
gu: { ...configurationTutorialCopy.gu, sample: "નમૂનો · તમારો સ્ટોક બદલાતો નથી", sections: [
  "બેલેન્સ સમજો",
  "શરૂઆતનો સ્ટોક ચકાસો",
  "સ્ટોક સુધારો",
  "ઇતિહાસ અને આગળનું પગલું"
], fields: {
  "balance": [
    "ક્વોલિટી પ્રમાણે ઉપલબ્ધ કાપડ",
    "શરૂઆતનો સ્ટોક + સાચવેલું ઉત્પાદન − પુષ્ટિ કરેલા ડિસ્પેચ = ઉપલબ્ધ મીટર. અહીં 500 + 200 − 100 = 600 મી. ડિસ્પેચના ડ્રાફ્ટથી સ્ટોક ઘટતો નથી."
  ],
  "tracking": [
    "સ્ટોક ટ્રેકિંગ ક્યારે શરૂ થયું તે જુઓ",
    "પેજ પર સ્ટોક શરૂ થયાની તારીખ જુઓ. જૂનું ઉત્પાદન આપમેળે ઉમેરાયું નથી. દરેક ક્વોલિટી માટે શરૂઆત પહેલાંનું ખરેખર બાકી કાપડ એક જ વાર ઉમેરો; ટ્રેકિંગ પછી નોંધાયેલ ઉત્પાદન ફરી ન ઉમેરો."
  ],
  "openingPending": [
    "શરૂઆતમાં શું ગણવું તે ચકાસો",
    "શરૂઆત પહેલાંના બાકી 650 મીમાંથી જૂના બાકી ડિસ્પેચ માટે નક્કી કરેલા 150 મી બાદ કરતાં 500 મી ઉમેરવાના થાય. ડિસ્પેચ → જૂના ડિસ્પેચ રેકોર્ડ → Pending Dispatches જુઓ. પ્રવેશ મર્યાદિત હોય તો સાચવતાં પહેલાં જૂના વેચાણ/ડિસ્પેચ રેકોર્ડથી આ બાકી જથ્થો મેળવો અથવા એડમિનિસ્ટ્રેટરની મદદ લો."
  ],
  "opening": [
    "ચકાસેલા 500 મી નોંધો",
    "ઉત્પાદનવાળી ક્વોલિટી માટે શરૂઆતનો સ્ટોક ખોલો. શરૂઆત પહેલાંના બાકી 500 મી અને ગણતરીનો સંદર્ભ નાખો, પછી સ્ટોક સાચવતાં પહેલાં તપાસો. આથી એક વાર 500 મી ઉમેરાય છે; આજનું બેલેન્સ બદલાઈને 500 થતું નથી. આ નમૂનો કંઈ સાચવતો નથી."
  ],
  "correction": [
    "સુધારો આજનું કુલ નક્કી કરે છે",
    "હાલના ઉપલબ્ધ કુલની ચકાસણી પછી ક્વોલિટી કાર્ડ પર સ્ટોક સુધારો વાપરો. શરૂઆતના સ્ટોકથી અલગ, આ હાલનું કુલ નક્કી કરે છે. સાચવવાથી આ ક્વોલિટીની શરૂઆતની નોંધ પણ બંધ થાય છે, તેથી બાકી શરૂઆતની નોંધ પહેલાં ચકાસો."
  ],
  "counted": [
    "600 મી → 590 મી: −10 મીની હિલચાલ",
    "ચકાસેલા કુલ તરીકે 590 નાખો, −10 નહીં. ગણતરીનું કારણ આપો અને સ્ટોક સાચવતાં પહેલાં તપાસો. બેલેન્સ 590 મી થશે; −10 મીનો તફાવત અને કારણ ઇતિહાસમાં રહેશે."
  ],
  "finish": [
    "બેલેન્સનો ઇતિહાસ જોઈ આગળ વધો",
    "હિલચાલ ઇતિહાસ દરેક ફેરફાર અને તે પછીનું બેલેન્સ બતાવે છે. ટૂર પૂરો થયા પછી શરૂઆતની તારીખ અને ક્વોલિટીનો સ્ટોક ફેરફારનો ઇતિહાસ જુઓ. શરૂઆત નોંધાઈ ન હોય તો જૂની ગણતરી મેળવીને શરૂઆતનો સ્ટોક નોંધો; નોંધાઈ હોય તો ચકાસેલા તફાવત માટે જ સ્ટોક સુધારો."
  ]
} },
hi: { ...configurationTutorialCopy.hi, sample: "नमूना · आपका स्टॉक नहीं बदलता", sections: [
  "शेष समझें",
  "शुरुआती स्टॉक जाँचें",
  "स्टॉक सुधारें",
  "इतिहास और अगला कदम"
], fields: {
  "balance": [
    "क्वालिटी के अनुसार उपलब्ध कपड़ा",
    "शुरुआती स्टॉक + सहेजा उत्पादन − पुष्टि किए डिस्पैच = उपलब्ध मीटर। यहाँ 500 + 200 − 100 = 600 मी। डिस्पैच ड्राफ्ट से स्टॉक नहीं घटता।"
  ],
  "tracking": [
    "स्टॉक ट्रैकिंग की शुरुआत देखें",
    "पेज पर स्टॉक शुरू होने की तारीख देखें। पुराना उत्पादन अपने आप नहीं जोड़ा गया। हर क्वालिटी के लिए शुरुआत से पहले का बचा कपड़ा एक बार ही जोड़ें; ट्रैकिंग के बाद दर्ज उत्पादन दोबारा न जोड़ें।"
  ],
  "openingPending": [
    "शुरुआत में क्या गिनना है, जाँचें",
    "शुरुआत से पहले के बचे 650 मी में से पुराने लंबित डिस्पैच के लिए तय 150 मी निकालकर 500 मी जोड़ने हैं। डिस्पैच → पुराने डिस्पैच रिकॉर्ड → Pending Dispatches देखें। प्रवेश सीमित हो तो सहेजने से पहले पुराने बिक्री/डिस्पैच रिकॉर्ड से यह मात्रा मिलाएँ या व्यवस्थापक की मदद लें।"
  ],
  "opening": [
    "सत्यापित 500 मी दर्ज करें",
    "उत्पादन वाली क्वालिटी के लिए शुरुआती स्टॉक खोलें। पहले के बचे 500 मी और गिनती संदर्भ डालें, फिर स्टॉक सहेजने से पहले जाँचें। इससे एक बार 500 मी जुड़ते हैं; आज का शेष बदलकर 500 नहीं होता। यह नमूना कुछ नहीं सहेजता।"
  ],
  "correction": [
    "सुधार आज का कुल तय करता है",
    "अभी के उपलब्ध कुल की पुष्टि के बाद क्वालिटी कार्ड पर स्टॉक सुधारें इस्तेमाल करें। शुरुआती स्टॉक से अलग, यह वर्तमान कुल तय करता है। सहेजने से इस क्वालिटी की शुरुआती प्रविष्टि भी बंद होती है, इसलिए छूटी शुरुआती प्रविष्टि पहले जाँचें।"
  ],
  "counted": [
    "600 मी → 590 मी: −10 मी की गतिविधि",
    "सत्यापित कुल के रूप में 590 डालें, −10 नहीं। गिनती का कारण दें और स्टॉक सहेजने से पहले जाँचें। शेष 590 मी होगा; −10 मी का अंतर और कारण इतिहास में रहेंगे।"
  ],
  "finish": [
    "शेष का इतिहास देखकर आगे बढ़ें",
    "गतिविधि इतिहास हर बदलाव और उसके बाद का शेष दिखाता है। टूर पूरा करने के बाद शुरुआत की तारीख और क्वालिटी का स्टॉक बदलाव का इतिहास देखें। शुरुआत दर्ज न हो तो पुराने बचे कपड़े की गिनती मिलाकर शुरुआती स्टॉक दर्ज करें; दर्ज हो तो सत्यापित अंतर पर ही स्टॉक सुधारें।"
  ]
} },
}
/** Optional, step-specific detail shown only in the Fabric Stock tour panel. */
export const fabricStockTutorialHelp: Record<Language, Partial<Record<StockTourStep, readonly [string, string]>>> = {
  "en": {
    "balance": [
      "Production and dispatch changes",
      "Later production edits change stock by the difference, including edits to historical production. Record verified opening before an edit that would otherwise make stock negative. Dispatch reversals appear as separate movements."
    ],
    "tracking": [
      "Historical metres and reminders",
      "Historical production excluded is context, not an amount to copy into opening. Reconcile historical metres without a quality with your physical count. Opening stock not recorded is a reminder, not proof that fabric remains."
    ],
    "openingPending": [
      "Match the older commitment",
      "Match the quality and the metres still pending, not the whole original sale. Exclude only fabric already committed to historical pending dispatches. Do not treat every current dispatch draft as a historical commitment. If the amount is uncertain, resolve it before recording opening."
    ],
    "opening": [
      "Entry rules",
      "Opening from a quality card fixes its name. Otherwise use the Production quality name; case and extra spaces are ignored. Enter non-negative metres with at most two decimal places and a reason of at least three characters. The reason stays with the movement."
    ],
    "correction": [
      "If the balance changes while counting",
      "If stock changes before saving, close the form, Refresh stock and review the current balance before trying again. Refresh also reloads history after production or dispatch changes elsewhere."
    ],
    "counted": [
      "Keep the count traceable",
      "Use a count date or reference and explain the difference. A correction records a stock movement; it does not rewrite the production or dispatch record that caused the difference."
    ],
    "finish": [
      "Find and read older movements",
      "Search qualities filters cards only. A card’s Movement history or the history dropdown filters movements separately. Balance after belongs to that movement, not necessarily today. Load older movements keeps that quality filter. Production links open Production; you can replay this tour from this page."
    ]
  },
  "gu": {
    "balance": [
      "ઉત્પાદન અને ડિસ્પેચમાં ફેરફાર",
      "જૂના ઉત્પાદન સહિત, પછીના ઉત્પાદન સુધારા તફાવત જેટલો સ્ટોક બદલે છે. સ્ટોક નકારાત્મક કરી શકે એવા સુધારા પહેલાં ચકાસેલો શરૂઆતનો સ્ટોક નોંધો. ડિસ્પેચ પરતની હિલચાલ અલગ નોંધાય છે."
    ],
    "tracking": [
      "જૂના મીટર અને યાદ અપાવતી નોંધ",
      "બાકાત રાખેલું જૂનું ઉત્પાદન માત્ર માહિતી છે; તેને શરૂઆતના સ્ટોકમાં સીધું ન નાખો. ક્વોલિટી વિનાના જૂના મીટરને ભૌતિક ગણતરી સાથે મેળવો. શરૂઆતનો સ્ટોક નોંધાયો નથી એ યાદ અપાવે છે, કાપડ બાકી હોવાનો પુરાવો નથી."
    ],
    "openingPending": [
      "જૂના નક્કી કરેલા જથ્થાને મેળવો",
      "ક્વોલિટી અને મોકલવાના હજી બાકી મીટર મેળવો, આખું મૂળ વેચાણ નહીં. ફક્ત જૂના બાકી ડિસ્પેચ માટે પહેલેથી નક્કી કરેલું કાપડ બાકાત રાખો. હાલના દરેક ડિસ્પેચ ડ્રાફ્ટને જૂની પ્રતિબદ્ધતા ન ગણો. જથ્થો અચોક્કસ હોય તો શરૂઆત નોંધતાં પહેલાં ખાતરી કરો."
    ],
    "opening": [
      "નોંધના નિયમો",
      "ક્વોલિટી કાર્ડથી ખોલતાં નામ નક્કી હોય છે. અન્યથા ઉત્પાદનવાળું નામ વાપરો; અંગ્રેજી મોટા-નાના અક્ષર અને વધારાની જગ્યા અવગણાય છે. શૂન્ય કે તેથી વધુ મીટર વધુમાં વધુ બે દશાંશ સાથે અને ઓછામાં ઓછા ત્રણ અક્ષરનું કારણ નાખો. કારણ હિલચાલ સાથે રહે છે."
    ],
    "correction": [
      "ગણતરી દરમિયાન બેલેન્સ બદલાય તો",
      "સાચવતાં પહેલાં સ્ટોક બદલાય તો ફોર્મ બંધ કરો, તાજું કરો વાપરો અને હાલનું બેલેન્સ તપાસીને ફરી પ્રયાસ કરો. અન્ય જગ્યાએ ઉત્પાદન કે ડિસ્પેચ બદલાય પછી રિફ્રેશથી ઇતિહાસ પણ ફરી આવે છે."
    ],
    "counted": [
      "ગણતરીનો સંદર્ભ રાખો",
      "ગણતરીની તારીખ કે સંદર્ભ આપો અને તફાવત સમજાવો. સુધારો સ્ટોકની હિલચાલ નોંધે છે; તફાવતનું કારણ બનેલી ઉત્પાદન કે ડિસ્પેચની મૂળ નોંધ ફરી લખતો નથી."
    ],
    "finish": [
      "જૂની હિલચાલ શોધો અને વાંચો",
      "ક્વોલિટી શોધ ફક્ત કાર્ડ ગાળે છે. કાર્ડનું ઇતિહાસ અથવા ઇતિહાસનું ડ્રોપડાઉન હિલચાલ અલગથી ગાળે છે. નોંધ પછીનું બેલેન્સ આજનું જ હોય તે જરૂરી નથી. જૂની હિલચાલ લોડ કરતાં એ જ ક્વોલિટીનો ફિલ્ટર રહે છે. ઉત્પાદન લિંક ઉત્પાદન ખોલે છે; આ પેજથી ટૂર ફરી જોઈ શકો છો."
    ]
  },
  "hi": {
    "balance": [
      "उत्पादन और डिस्पैच में बदलाव",
      "पुराने उत्पादन सहित, बाद के उत्पादन सुधार अंतर से स्टॉक बदलते हैं। स्टॉक नकारात्मक कर सकने वाले सुधार से पहले सत्यापित शुरुआती स्टॉक दर्ज करें। डिस्पैच वापसी अलग गतिविधि के रूप में दिखती है।"
    ],
    "tracking": [
      "पुराने मीटर और याद दिलाने वाली सूचना",
      "बाहर रखा पुराना उत्पादन केवल जानकारी है; उसे सीधे शुरुआती स्टॉक में न डालें। बिना क्वालिटी के पुराने मीटर भौतिक गिनती से मिलाएँ। शुरुआती स्टॉक दर्ज नहीं होना एक याद है, कपड़ा बचा होने का प्रमाण नहीं।"
    ],
    "openingPending": [
      "पुरानी तय मात्रा मिलाएँ",
      "क्वालिटी और अभी भेजने के लिए बचे मीटर मिलाएँ, पूरी मूल बिक्री नहीं। केवल पुराने लंबित डिस्पैच के लिए पहले से तय कपड़ा निकालें। हर वर्तमान डिस्पैच ड्राफ्ट को पुरानी प्रतिबद्धता न मानें। मात्रा अनिश्चित हो तो शुरुआत दर्ज करने से पहले पुष्टि करें।"
    ],
    "opening": [
      "प्रविष्टि के नियम",
      "क्वालिटी कार्ड से खोलने पर नाम तय रहता है। अन्यथा उत्पादन वाला नाम रखें; अंग्रेजी बड़े-छोटे अक्षर और अतिरिक्त खाली जगह अनदेखी होती है। शून्य या अधिक मीटर अधिकतम दो दशमलव में और कम से कम तीन अक्षर का कारण दें। कारण गतिविधि के साथ रहता है।"
    ],
    "correction": [
      "गिनती के दौरान शेष बदले तो",
      "सहेजने से पहले स्टॉक बदले तो फ़ॉर्म बंद करें, ताज़ा करें इस्तेमाल करें और वर्तमान शेष जाँचकर फिर प्रयास करें। दूसरी जगह उत्पादन या डिस्पैच बदलने के बाद रीफ़्रेश इतिहास भी फिर लाता है।"
    ],
    "counted": [
      "गिनती का संदर्भ रखें",
      "गिनती की तारीख या संदर्भ दें और अंतर समझाएँ। सुधार स्टॉक गतिविधि दर्ज करता है; अंतर पैदा करने वाले उत्पादन या डिस्पैच के मूल रिकॉर्ड को दोबारा नहीं लिखता।"
    ],
    "finish": [
      "पुरानी गतिविधियाँ खोजें और पढ़ें",
      "क्वालिटी खोज केवल कार्ड छाँटती है। कार्ड का स्टॉक बदलाव का इतिहास या इतिहास ड्रॉपडाउन गतिविधियाँ अलग से छाँटता है। प्रविष्टि के बाद का शेष आज का ही हो, जरूरी नहीं। पुरानी गतिविधियाँ लोड करने पर वही क्वालिटी फ़िल्टर रहता है। उत्पादन लिंक उत्पादन खोलता है; इस पेज से टूर फिर देख सकते हैं।"
    ]
  }
}
export const fabricStockPreviewCopy = {
  "en": {
    "quality": "Sample fabric",
    "countReference": "Verified pre-start count",
    "correctionReference": "Physical count: 590 m",
    "openingEquation": "650 m pre-start physical − 150 m historically committed = 500 m opening",
    "trackingStart": "Stock started: 1 September 2026 · sample",
    "trackingNote": "The opening count covers fabric remaining from before this sample date.",
    "balanceEquation": "500 m opening + 200 m production − 100 m confirmed dispatch = 600 m"
  },
  "gu": {
    "quality": "નમૂના કાપડ",
    "countReference": "ચકાસેલી શરૂઆત પહેલાંની ગણતરી",
    "correctionReference": "ભૌતિક ગણતરી: 590 મી",
    "openingEquation": "650 મી જૂનું બાકી કાપડ − 150 મી જૂના ડિસ્પેચ માટે નક્કી = 500 મી શરૂઆત",
    "trackingStart": "સ્ટોક શરૂ: 1 સપ્ટેમ્બર 2026 · નમૂનો",
    "trackingNote": "શરૂઆતની ગણતરી આ નમૂનાની તારીખ પહેલાંના બાકી કાપડની છે.",
    "balanceEquation": "500 મી શરૂઆત + 200 મી ઉત્પાદન − 100 મી પુષ્ટિ કરેલો ડિસ્પેચ = 600 મી"
  },
  "hi": {
    "quality": "नमूना कपड़ा",
    "countReference": "सत्यापित शुरुआती गिनती",
    "correctionReference": "भौतिक गिनती: 590 मी",
    "openingEquation": "650 मी पुराना बचा कपड़ा − 150 मी पुराने डिस्पैच के लिए तय = 500 मी शुरुआती",
    "trackingStart": "स्टॉक शुरू: 1 सितंबर 2026 · नमूना",
    "trackingNote": "शुरुआती गिनती इस नमूना तारीख से पहले के बचे कपड़े की है।",
    "balanceEquation": "500 मी शुरुआती + 200 मी उत्पादन − 100 मी पुष्टि किया डिस्पैच = 600 मी"
  }
}
export const yarnStockTutorialCopy: Record<Language, StockTutorialCopy> = {
en: { ...configurationTutorialCopy.en, sample: fabricStockTutorialCopy.en.sample, sections: [
    "Count owned yarn",
    "Record weights",
    "Prepare dispatch",
    "Reconcile"
], fields: {
    "balance": [
        "Track all yarn still owned",
        "Yarn remaining includes unused yarn plus yarn inside fabric not yet dispatched. Production does not reduce this balance. Confirmed dispatch deducts the yarn using the fabric’s linked costing."
    ],
    "yarn": [
        "Count unused yarn + yarn in fabric",
        "For this yarn: 80 kg unused + 20 kg in undispatched fabric = 100 kg owned. The 20 kg comes from 200 m × 10 kg / 100 m, using this fabric’s verified saved yarn formula. Repeat for each fabric and yarn."
    ],
    "opening": [
        "Start with opening weight",
        "The first weight entry starts tracking. Record existing yarn once per yarn with Opening weight. Use the costing’s yarn name and include yarn in undispatched fabric. Exclude already recorded receipts and yarn covered by legacy pending dispatches. Add a count reference, then Save."
    ],
    "receipt": [
        "Add only the new receipt",
        "Add yarn records newly received kilograms, not today’s total. Use the costing’s yarn name and a receipt reference: 100 kg opening + 20 kg received = 120 kg. Matching names share one balance across warp and weft."
    ],
    "link": [
        "Link the right fabric costing",
        "Choose this fabric quality’s saved costing version and check every yarn’s kg / 100 m. Save with a reason; relinking changes future deductions only. No compatible costing? Use Saved costing to open Cost Estimate, complete named warp and weft layers with calculated weights, save a fresh costing for the same quality, then return and link it."
    ],
    "movement": [
        "Confirm dispatch to deduct yarn",
        "Prepare the fabric’s costing link and enough stock for every required yarn before confirming in Dispatches. Here 100 m × 10 kg / 100 m deducts 10 kg: 120 − 10 = 110 kg. Production and dispatch drafts do not deduct yarn."
    ],
    "correction": [
        "Correct the total still owned",
        "Correct balance takes the verified total, including yarn in undispatched fabric. Enter 108 kg to replace 110 kg, not −2: saving records a −2 kg movement. Explain the count difference in the reason."
    ],
    "finish": [
        "Check history, then prepare your next dispatch",
        "Movement history shows signed changes and the balance after each entry; View dispatch opens the related document. Next, record any missing opening weights and receipts, then link every fabric’s costing before confirming your next dispatch in Dispatches. You can replay this tour."
    ]
} },
gu: { ...configurationTutorialCopy.gu, sample: fabricStockTutorialCopy.gu.sample, sections: [
    "માલિકીનું યાર્ન ગણો",
    "વજન નોંધો",
    "ડિસ્પેચ તૈયાર કરો",
    "હિસાબ મેળવો"
], fields: {
    "balance": [
        "માલિકીનું બધું બાકી યાર્ન",
        "બાકી યાર્નમાં વણવપરાયેલું યાર્ન અને હજી મોકલાયું નથી તે કાપડનું યાર્ન સામેલ છે. ઉત્પાદનથી આ બેલેન્સ ઘટતું નથી. ડિસ્પેચની પુષ્ટિએ કાપડના જોડેલા કોસ્ટિંગ મુજબ યાર્ન કપાય છે."
    ],
    "yarn": [
        "વણવપરાયેલું + કાપડમાં રહેલું યાર્ન",
        "આ યાર્ન માટે: 80 કિલો વણવપરાયેલું + મોકલવાના બાકી કાપડમાં 20 કિલો = માલિકીના 100 કિલો. આ કાપડના ચકાસેલા સાચવેલા સૂત્ર મુજબ 200 મી × 10 કિલો / 100 મી = 20 કિલો. દરેક કાપડ અને યાર્ન માટે આમ ગણો."
    ],
    "opening": [
        "શરૂઆતનું વજન નોંધો",
        "પહેલી વજન નોંધથી ટ્રેકિંગ શરૂ થાય છે. શરૂઆતનું વજન વડે દરેક યાર્નનું હાલનું વજન એક વાર નોંધો. કોસ્ટિંગનું યાર્ન નામ વાપરો અને મોકલવાના બાકી કાપડનું યાર્ન ગણો. નોંધેલી આવક અને જૂના બાકી ડિસ્પેચનું યાર્ન છોડો. ગણતરીનો સંદર્ભ આપી સાચવો."
    ],
    "receipt": [
        "માત્ર નવી આવક ઉમેરો",
        "યાર્ન ઉમેરો વડે નવા મળેલા કિલો નોંધો, આજનું કુલ નહીં. કોસ્ટિંગનું યાર્ન નામ અને રસીદ સંદર્ભ વાપરો: 100 કિલો શરૂઆત + 20 કિલો આવક = 120 કિલો. એક નામના તાણા અને વાણાનું બેલેન્સ એક છે."
    ],
    "link": [
        "યોગ્ય કાપડનું કોસ્ટિંગ જોડો",
        "આ કાપડની ક્વોલિટીનું સાચવેલું કોસ્ટિંગ વર્ઝન પસંદ કરી દરેક યાર્નના કિલો / 100 મી તપાસો. કારણ આપી સાચવો; ફરી જોડવાથી માત્ર આગળની કપાત બદલાય. યોગ્ય કોસ્ટિંગ નથી? સાચવેલું કોસ્ટિંગથી ખર્ચ અંદાજ ખોલી નામવાળા તાણા અને વાણાના સ્તરો તથા ગણાયેલ વજન પૂર્ણ કરો, એ જ ક્વોલિટીનું નવું કોસ્ટિંગ સાચવો, પછી અહીં પાછા આવી જોડો."
    ],
    "movement": [
        "ડિસ્પેચની પુષ્ટિએ યાર્ન કપાય",
        "ડિસ્પેચમાં પુષ્ટિ પહેલાં કાપડનું કોસ્ટિંગ જોડો અને દરેક જરૂરી યાર્નનો પૂરતો સ્ટોક નોંધો. અહીં 100 મી × 10 કિલો / 100 મીથી 10 કિલો કપાય: 120 − 10 = 110 કિલો. ઉત્પાદન અને ડિસ્પેચ ડ્રાફ્ટથી યાર્ન કપાતું નથી."
    ],
    "correction": [
        "માલિકીનું કુલ વજન સુધારો",
        "બેલેન્સ સુધારોમાં મોકલવાના બાકી કાપડના યાર્ન સહિત ચકાસેલું કુલ વજન નાખો. 110 કિલોની જગ્યાએ 108 કિલો નાખો, −2 નહીં: સાચવવાથી −2 કિલોની નોંધ બને છે. ગણતરીના તફાવતનું કારણ લખો."
    ],
    "finish": [
        "ઇતિહાસ તપાસી આગલો ડિસ્પેચ તૈયાર કરો",
        "સ્ટોક ઇતિહાસમાં ચિહ્નવાળા ફેરફાર અને દરેક નોંધ પછીનું બેલેન્સ છે; ડિસ્પેચ જુઓ સંબંધિત દસ્તાવેજ ખોલે છે. હવે બાકી શરૂઆતનું વજન અને આવક નોંધો, દરેક કાપડનું કોસ્ટિંગ જોડો, પછી ડિસ્પેચમાં આગલા ડિસ્પેચની પુષ્ટિ કરો. ટૂર ફરી જોઈ શકો છો."
    ]
} },
hi: { ...configurationTutorialCopy.hi, sample: fabricStockTutorialCopy.hi.sample, sections: [
    "स्वामित्व का धागा गिनें",
    "वजन दर्ज करें",
    "डिस्पैच तैयार करें",
    "हिसाब मिलाएँ"
], fields: {
    "balance": [
        "स्वामित्व का सारा बचा धागा",
        "शेष धागे में बचा हुआ धागा और भेजे नहीं गए कपड़े का धागा शामिल है। उत्पादन से यह शेष कम नहीं होता। डिस्पैच की पुष्टि पर कपड़े की जुड़ी लागत के अनुसार धागा घटता है।"
    ],
    "yarn": [
        "बचा धागा + कपड़े में लगा धागा",
        "इस धागे के लिए: 80 किलो बचा धागा + भेजे नहीं गए कपड़े में 20 किलो = स्वामित्व के 100 किलो। इस कपड़े के सत्यापित सहेजे सूत्र से 200 मी × 10 किलो / 100 मी = 20 किलो। हर कपड़े और धागे के लिए यही गणना करें।"
    ],
    "opening": [
        "शुरुआती वजन दर्ज करें",
        "पहली वजन प्रविष्टि से ट्रैकिंग शुरू होती है। शुरुआती वजन से हर धागे का मौजूदा वजन एक बार दर्ज करें। लागत वाला धागे का नाम रखें और भेजे नहीं गए कपड़े का धागा शामिल करें। दर्ज आवक और पुराने लंबित डिस्पैच का धागा छोड़ें। गिनती का संदर्भ देकर सहेजें।"
    ],
    "receipt": [
        "केवल नई आवक जोड़ें",
        "धागा जोड़ें से नए मिले किलो दर्ज करें, आज का कुल नहीं। लागत वाला धागे का नाम और रसीद संदर्भ रखें: 100 किलो शुरुआती + 20 किलो आवक = 120 किलो। एक नाम का ताना और बाना एक शेष साझा करते हैं।"
    ],
    "link": [
        "सही कपड़े की लागत जोड़ें",
        "इस कपड़े की क्वालिटी का सहेजा लागत संस्करण चुनकर हर धागे के किलो / 100 मी जाँचें। कारण देकर सहेजें; दोबारा जोड़ना केवल आगे की कटौती बदलता है। उपयुक्त लागत नहीं है? सहेजी लागत से लागत अनुमान खोलकर नाम वाले ताने और बाने की परतें और गणना किए वजन पूरे करें, उसी क्वालिटी की नई लागत सहेजें, फिर यहाँ लौटकर जोड़ें।"
    ],
    "movement": [
        "डिस्पैच की पुष्टि पर धागा घटता है",
        "डिस्पैच में पुष्टि से पहले कपड़े की लागत जोड़ें और हर आवश्यक धागे का पर्याप्त स्टॉक दर्ज करें। यहाँ 100 मी × 10 किलो / 100 मी से 10 किलो घटता है: 120 − 10 = 110 किलो। उत्पादन और डिस्पैच ड्राफ्ट धागा नहीं घटाते।"
    ],
    "correction": [
        "स्वामित्व का कुल वजन सुधारें",
        "शेष सुधारें में भेजे नहीं गए कपड़े के धागे सहित सत्यापित कुल डालें। 110 किलो की जगह 108 किलो डालें, −2 नहीं: सहेजने पर −2 किलो की प्रविष्टि बनती है। गिनती के अंतर का कारण लिखें।"
    ],
    "finish": [
        "इतिहास जाँचकर अगला डिस्पैच तैयार करें",
        "स्टॉक इतिहास में चिह्न वाले बदलाव और हर प्रविष्टि के बाद का शेष दिखता है; डिस्पैच देखें संबंधित दस्तावेज खोलता है। अब छूटे शुरुआती वजन और आवक दर्ज करें, हर कपड़े की लागत जोड़ें, फिर डिस्पैच में अगले डिस्पैच की पुष्टि करें। टूर फिर देख सकते हैं।"
    ]
} },
}

export const yarnStockTutorialHelp: Record<Language, Partial<Record<StockTourStep, readonly [string, string]>>> = {
    "en": {
        "yarn": [
            "Which yarn weights should I count?",
            "Use the verified saved formula that matches each undispatched fabric. Sum this yarn’s warp and weft kg / 100 m, multiply by that fabric’s remaining metres / 100, then add unused kilograms. Check the formula still matches the fabric if you have changed costing versions."
        ],
        "opening": [
            "Entry details and legacy dispatches",
            "Weights allow up to three decimals; reasons need at least three characters. Review legacy pending dispatch records before counting their yarn into opening weight. Do not count that yarn or recorded receipts twice. If opening is already recorded, use Add yarn for a new receipt or Correct balance for a verified total."
        ],
        "receipt": [
            "What if saving is unconfirmed?",
            "A receipt must be greater than zero. Keep the same details and retry an unconfirmed save before starting another entry, so you do not record the delivery twice."
        ],
        "link": [
            "What is saved in the link?",
            "Every warp and weft layer used must have a yarn name and positive calculated kg / 100 m in the saved costing. Review the weights including costing allowances. Linking fixes those weights here; relinking affects future dispatches only. Past deductions keep their original formula."
        ],
        "movement": [
            "Read a movement or reversal",
            "Balance after means the balance immediately after that entry, not necessarily today’s balance. View dispatch opens its document. A dispatch reversal appears as a separate movement."
        ],
        "correction": [
            "If stock changes before you save",
            "Refresh and review the latest balance before retrying a correction. Its reason and signed difference stay in Movement history. Count unused yarn and yarn in undispatched fabric together."
        ],
        "finish": [
            "Dated balances, filters and CSV",
            "Filter Movement history by yarn; a card’s History button selects it. Load more retrieves older entries for that filter and date. Audit date shows entries recorded through that day in India time, with editing controls hidden. Clear the date and choose View date to edit current stock. Dates before tracking are not opening counts. Export balances CSV contains displayed balances, total and tracking information, not movement history."
        ]
    },
    "gu": {
        "yarn": [
            "કયા યાર્નનું વજન ગણવું?",
            "મોકલવાના બાકી દરેક કાપડને મળતું ચકાસેલું સાચવેલું સૂત્ર વાપરો. આ યાર્નના તાણા અને વાણાના કિલો / 100 મી ઉમેરો, તે કાપડના બાકી મીટર / 100થી ગુણો અને વણવપરાયેલા કિલો ઉમેરો. કોસ્ટિંગ વર્ઝન બદલ્યું હોય તો સૂત્ર હજી કાપડ સાથે મળે છે તે તપાસો."
        ],
        "opening": [
            "નોંધની વિગતો અને જૂના ડિસ્પેચ",
            "વજનમાં ત્રણ દશાંશ સુધી અને કારણમાં ઓછામાં ઓછા ત્રણ અક્ષર રાખો. શરૂઆતમાં યાર્ન ગણતાં પહેલાં જૂના બાકી ડિસ્પેચની નોંધો તપાસો. તે યાર્ન કે નોંધેલી આવક બે વાર ન ગણો. શરૂઆત નોંધાઈ હોય તો નવી આવક માટે યાર્ન ઉમેરો અથવા ચકાસેલા કુલ માટે બેલેન્સ સુધારો વાપરો."
        ],
        "receipt": [
            "સાચવવાની પુષ્ટિ ન થાય તો?",
            "આવક શૂન્યથી વધુ હોવી જોઈએ. સાચવવાની પુષ્ટિ ન હોય તો નવી નોંધ કરતાં પહેલાં એ જ વિગતો રાખીને ફરી પ્રયાસ કરો, જેથી એક જ આવક બે વાર ન નોંધાય."
        ],
        "link": [
            "લિંકમાં શું સાચવાય છે?",
            "સાચવેલા કોસ્ટિંગમાં વપરાતા તાણા અને વાણાના દરેક સ્તરનું યાર્ન નામ અને શૂન્યથી વધુ ગણાયેલ કિલો / 100 મી જરૂરી છે. કોસ્ટિંગના ભથ્થાં સહિત વજન તપાસો. જોડેલું વજન અહીં સ્થિર રહે છે; ફરી જોડવાથી માત્ર આગળના ડિસ્પેચ બદલાય. જૂની કપાતમાં જૂનું સૂત્ર રહે છે."
        ],
        "movement": [
            "હિલચાલ કે પરતની નોંધ વાંચો",
            "નોંધ પછી બેલેન્સ એટલે તે નોંધ પછી તરતનું બેલેન્સ, જરૂરી નથી કે આજનું હોય. ડિસ્પેચ જુઓ તેનો દસ્તાવેજ ખોલે છે. ડિસ્પેચ પરતની અલગ નોંધ થાય છે."
        ],
        "correction": [
            "સાચવતાં પહેલાં સ્ટોક બદલાય તો",
            "સુધારો ફરી કરતાં પહેલાં રિફ્રેશ કરીને નવું બેલેન્સ તપાસો. કારણ અને ચિહ્નવાળો તફાવત સ્ટોક ઇતિહાસમાં રહે છે. વણવપરાયેલું અને મોકલવાના બાકી કાપડનું યાર્ન સાથે ગણો."
        ],
        "finish": [
            "તારીખનું બેલેન્સ, ફિલ્ટર અને CSV",
            "સ્ટોક ઇતિહાસ યાર્નથી ગાળો; કાર્ડનું સ્ટોક ઇતિહાસ તે યાર્ન પસંદ કરે છે. વધુ જુઓ એ જ તારીખ અને ફિલ્ટરની જૂની નોંધો લાવે છે. ઓડિટ તારીખ ભારતીય સમય મુજબ તે દિવસ સુધી નોંધાયેલ હિલચાલ બતાવે છે અને ફેરફારનાં નિયંત્રણો છુપાવે છે. હાલનો સ્ટોક સુધારવા તારીખ ખાલી કરી તારીખ જુઓ પસંદ કરો. ટ્રેકિંગ પહેલાંની તારીખ શરૂઆતની ગણતરી નથી. બેલેન્સ CSVમાં દેખાતાં બેલેન્સ, કુલ અને ટ્રેકિંગ વિગતો છે, હિલચાલ ઇતિહાસ નહીં."
        ]
    },
    "hi": {
        "yarn": [
            "किस धागे का वजन गिनें?",
            "भेजे नहीं गए हर कपड़े से मेल खाता सत्यापित सहेजा सूत्र इस्तेमाल करें। इस धागे के ताने और बाने के किलो / 100 मी जोड़ें, उस कपड़े के बचे मीटर / 100 से गुणा करें, फिर बचे हुए धागे के किलो जोड़ें। लागत संस्करण बदला हो तो जाँचें कि सूत्र अब भी कपड़े से मेल खाता है।"
        ],
        "opening": [
            "प्रविष्टि के विवरण और पुराने डिस्पैच",
            "वजन में तीन दशमलव तक और कारण में कम से कम तीन अक्षर रखें। शुरुआती वजन में धागा गिनने से पहले पुराने लंबित डिस्पैच की प्रविष्टियाँ जाँचें। वह धागा या दर्ज आवक दो बार न गिनें। शुरुआत दर्ज हो तो नई आवक के लिए धागा जोड़ें या सत्यापित कुल के लिए शेष सुधारें इस्तेमाल करें।"
        ],
        "receipt": [
            "सहेजने की पुष्टि न हो तो?",
            "आवक शून्य से अधिक होनी चाहिए। सहेजने की पुष्टि न हो तो नई प्रविष्टि शुरू करने से पहले उन्हीं विवरणों से दोबारा प्रयास करें, ताकि एक ही आवक दो बार दर्ज न हो।"
        ],
        "link": [
            "जोड़ने पर क्या सहेजता है?",
            "सहेजी लागत में इस्तेमाल हर ताने और बाने की परत का धागे का नाम और शून्य से अधिक गणना किए किलो / 100 मी जरूरी हैं। लागत के भत्तों सहित वजन जाँचें। जोड़ने पर वजन यहाँ स्थिर रहता है; दोबारा जोड़ना केवल आगे के डिस्पैच पर लागू होता है। पुरानी कटौतियाँ अपना मूल सूत्र रखती हैं।"
        ],
        "movement": [
            "गतिविधि या वापसी पढ़ें",
            "प्रविष्टि के बाद शेष उस प्रविष्टि के तुरंत बाद का शेष है, जरूरी नहीं आज का हो। डिस्पैच देखें उसका दस्तावेज खोलता है। डिस्पैच वापसी अलग प्रविष्टि के रूप में दिखती है।"
        ],
        "correction": [
            "सहेजने से पहले स्टॉक बदले तो",
            "सुधार दोबारा करने से पहले रीफ़्रेश करके नया शेष जाँचें। कारण और चिह्न वाला अंतर स्टॉक इतिहास में रहते हैं। बचा हुआ धागा और भेजे नहीं गए कपड़े का धागा साथ गिनें।"
        ],
        "finish": [
            "तारीख का शेष, फ़िल्टर और CSV",
            "स्टॉक इतिहास को धागे से छाँटें; कार्ड का स्टॉक इतिहास वही धागा चुनता है। और देखें उसी तारीख और फ़िल्टर की पुरानी प्रविष्टियाँ लाता है। ऑडिट तारीख भारतीय समय के अनुसार उस दिन तक दर्ज गतिविधियाँ दिखाती है और बदलाव के नियंत्रण छिपाती है। वर्तमान स्टॉक बदलने के लिए तारीख खाली करके तारीख देखें चुनें। ट्रैकिंग से पहले की तारीख शुरुआती गिनती नहीं है। शेष CSV में दिखते शेष, कुल और ट्रैकिंग विवरण हैं, गतिविधि इतिहास नहीं।"
        ]
    }
}

export const stockTutorialCopy: Record<StockTourKind, Record<Language, StockTutorialCopy>> = { 'fabric-stock': fabricStockTutorialCopy, 'yarn-stock': yarnStockTutorialCopy }
