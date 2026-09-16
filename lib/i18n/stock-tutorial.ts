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
en: { ...fabricStockTutorialCopy.en, sections: ["Understand yarn inventory", "Opening weight and receipts", "Link fabric costings", "Correct a balance", "Audit and export", "Trace movements"], fields: {
  "balance": [
    "What yarn remaining means",
    "This includes unused yarn and yarn inside undispatched fabric. Production does not reduce it. Confirmed dispatch deducts linked costing weights."
  ],
  "tracking": [
    "Start yarn tracking",
    "The first weight entry starts tracking. Before the next dispatch, link the fabric costing and record all required yarn balances."
  ],
  "yarn": [
    "One balance per yarn",
    "Each yarn has a kilogram balance. Matching names share one balance across warp and weft. This sample is 100 opening + 20 received − 10 dispatched = 110 kg."
  ],
  "opening": [
    "Opening weight",
    "Record existing yarn once per yarn, including yarn in undispatched fabric. Exclude recorded receipts and yarn covered by legacy pending dispatches."
  ],
  "openingQuality": [
    "Match the costing name",
    "Use the yarn name from the costing. Suggested names help keep receipts and dispatch deductions in the same balance."
  ],
  "openingAmount": [
    "Enter the opening kilograms",
    "Enter the existing weight to add. Yarn weights support up to three decimal places."
  ],
  "openingReason": [
    "Explain the opening entry",
    "Enter a reason or count reference of at least three characters. Review before saving; this preview cannot save stock."
  ],
  "receipt": [
    "Add newly received yarn",
    "Add yarn records a new receipt, separate from the one-time opening weight."
  ],
  "receiptAmount": [
    "Enter the receipt weight",
    "Enter the newly received kilograms, not the total balance. A receipt must be greater than zero."
  ],
  "receiptSave": [
    "Review the receipt",
    "Include a receipt reference or reason. If saving is unconfirmed, keep the same details and retry before starting another entry."
  ],
  "formulas": [
    "Yarn used by each fabric",
    "Each fabric needs a linked saved costing. An unlinked quality needs setup before dispatch can deduct the right yarn."
  ],
  "link": [
    "Link a costing",
    "Open Link costing for the fabric quality. This sample preview never changes the real link."
  ],
  "costing": [
    "Choose a compatible version",
    "Choose a saved costing for this quality and check its version. If none has compatible yarn weights, save a fresh costing first."
  ],
  "weights": [
    "Review kilograms per 100 metres",
    "Review warp and weft weights, including costing allowances. A 10 kg per 100 m formula deducts 10 kg for 100 m dispatched."
  ],
  "linkReason": [
    "Explain the formula choice",
    "A reason is required when linking or changing the formula. Keep enough detail to explain the selected costing."
  ],
  "linkSave": [
    "Changes apply going forward",
    "The linked weights are fixed here. Relinking affects future dispatches; past deductions retain their original formula."
  ],
  "correction": [
    "Correct a yarn count",
    "Correct balance records a verified physical total, including yarn in fabric not yet dispatched."
  ],
  "counted": [
    "Enter the total still owned",
    "Enter the verified total, not a difference. Here 108 kg replaces 110 kg, recording a −2 kg correction."
  ],
  "correctionReason": [
    "Explain and save the correction",
    "A reason is required and the difference stays in history. The tour does not submit this correction."
  ],
  "auditDate": [
    "Choose an audit date",
    "View date shows entries recorded through that day in India time. A date before tracking began is not an opening-stock count."
  ],
  "historical": [
    "Historical views are read-only",
    "Opening, receipt, correction and costing-link controls are hidden in a dated view. These balances reflect when entries were recorded."
  ],
  "current": [
    "Return to current stock",
    "Clear the audit date and choose View date to return to current balances and editing controls."
  ],
  "export": [
    "Export balances",
    "Export balances CSV contains yarn balances and a total for the displayed date, with tracking information. It is not a movement-history export. No file is downloaded during this tour."
  ],
  "historyFilter": [
    "Filter movement history",
    "Select a yarn or All yarns. A card’s History button selects that yarn. Load more retrieves older movements for the same date and filter."
  ],
  "movement": [
    "Trace a dispatch deduction",
    "Review signed kilograms, balance after, sent metres and the saved formula. View dispatch opens the related dispatch; reversals appear as separate movements."
  ],
  "finish": [
    "Yarn stock is ready",
    "Record existing yarn and receipts, link fabric costings, then review dispatch deductions and dated balances. Replay the tour whenever needed."
  ]
}},
gu: { ...fabricStockTutorialCopy.gu, sections: ["યાર્ન સ્ટોક સમજો", "શરૂઆત અને આવક", "કોસ્ટિંગ જોડો", "બેલેન્સ સુધારો", "ઓડિટ અને નિકાસ", "હિલચાલ જુઓ"], fields: {
  "balance": [
    "બાકી યાર્નનો અર્થ",
    "વણાયા વગરનું યાર્ન અને મોકલવાના બાકી કાપડનું યાર્ન બંને સામેલ છે. ઉત્પાદનથી ઘટતું નથી. પુષ્ટિ થયેલો ડિસ્પેચ જોડાયેલા કોસ્ટિંગ પ્રમાણે વજન ઘટાડે છે."
  ],
  "tracking": [
    "યાર્ન ટ્રેકિંગ શરૂ કરો",
    "પ્રથમ વજન નોંધથી ટ્રેકિંગ શરૂ થાય છે. આગલા ડિસ્પેચ પહેલાં કાપડનું કોસ્ટિંગ જોડો અને જરૂરી યાર્ન બેલેન્સ નોંધો."
  ],
  "yarn": [
    "દરેક યાર્નનું એક બેલેન્સ",
    "વજન કિલોમાં છે. એક નામના તાણા અને વાણાનું બેલેન્સ એક છે. નમૂનો: 100 શરૂઆત + 20 આવક − 10 ડિસ્પેચ = 110 કિલો."
  ],
  "opening": [
    "શરૂઆતનું વજન",
    "મોકલવાના બાકી કાપડ સહિત હાલનું યાર્ન એક વાર નોંધો. નોંધેલી આવક અને જૂના બાકી ડિસ્પેચનું યાર્ન ફરી ઉમેરશો નહીં."
  ],
  "openingQuality": [
    "કોસ્ટિંગનું નામ મેળવો",
    "કોસ્ટિંગ જેવું યાર્ન નામ વાપરો. સૂચિત નામથી આવક અને કપાત એક બેલેન્સમાં રહે છે."
  ],
  "openingAmount": [
    "શરૂઆતના કિલો નાખો",
    "ઉમેરવાનું હાલનું વજન નાખો. વધુમાં વધુ ત્રણ દશાંશ રાખો."
  ],
  "openingReason": [
    "શરૂઆતની નોંધ સમજાવો",
    "ઓછામાં ઓછા ત્રણ અક્ષરનું કારણ અથવા સંદર્ભ નાખો. સાચવતાં પહેલાં તપાસો; નમૂનો સ્ટોક સાચવતો નથી."
  ],
  "receipt": [
    "નવું મળેલું યાર્ન ઉમેરો",
    "Add yarn નવી આવક નોંધે છે. તે એક વખતના શરૂઆતના વજનથી અલગ છે."
  ],
  "receiptAmount": [
    "આવકનું વજન નાખો",
    "નવું મળેલું વજન નાખો, કુલ બેલેન્સ નહીં. આવક શૂન્યથી વધારે હોવી જોઈએ."
  ],
  "receiptSave": [
    "આવક તપાસો",
    "રસીદ સંદર્ભ અથવા કારણ આપો. સાચવવાની પુષ્ટિ ન થાય તો નવી નોંધ પહેલાં એ જ વિગતો સાથે ફરી પ્રયાસ કરો."
  ],
  "formulas": [
    "કાપડમાં વપરાતું યાર્ન",
    "દરેક કાપડને સાચવેલું કોસ્ટિંગ જોડવું પડે. જોડાણ વગર યોગ્ય ડિસ્પેચ કપાત માટે પહેલાં ગોઠવણી જરૂરી છે."
  ],
  "link": [
    "કોસ્ટિંગ જોડો",
    "ક્વોલિટી માટે Link costing ખોલો. આ નમૂનો સાચું જોડાણ બદલતો નથી."
  ],
  "costing": [
    "યોગ્ય વર્ઝન પસંદ કરો",
    "આ ક્વોલિટીનું કોસ્ટિંગ પસંદ કરીને વર્ઝન તપાસો. યોગ્ય યાર્ન વજન ન હોય તો નવું કોસ્ટિંગ સાચવો."
  ],
  "weights": [
    "100 મીટર દીઠ કિલો જુઓ",
    "કોસ્ટિંગના ભથ્થા સહિત તાણા અને વાણાનું વજન તપાસો. 100 મીટર દીઠ 10 કિલો હોય તો 100 મીટરના ડિસ્પેચમાં 10 કિલો ઘટે છે."
  ],
  "linkReason": [
    "સૂત્ર પસંદગીનું કારણ",
    "સૂત્ર જોડવા અથવા બદલવા કારણ જરૂરી છે. પસંદ કરેલા કોસ્ટિંગનો સંદર્ભ સમજાવો."
  ],
  "linkSave": [
    "ફેરફાર આગળ લાગુ પડે",
    "જોડાયેલ વજન અહીં સ્થિર રહે છે. ફરી જોડવાથી આગળના ડિસ્પેચ બદલાય છે; જૂની કપાતનું સૂત્ર યથાવત રહે છે."
  ],
  "correction": [
    "યાર્ન ગણતરી સુધારો",
    "મોકલવાના બાકી કાપડનું યાર્ન સહિત ચકાસેલું કુલ વજન Correct balance માં નોંધો."
  ],
  "counted": [
    "હાલની માલિકીનું કુલ",
    "કુલ વજન નાખો, તફાવત નહીં. અહીં 110ની જગ્યાએ 108 કિલોથી −2 કિલોનો સુધારો થાય છે."
  ],
  "correctionReason": [
    "કારણ સાથે સુધારો સાચવો",
    "કારણ જરૂરી છે અને તફાવત ઇતિહાસમાં રહે છે. ટૂર આ સુધારો સબમિટ કરતો નથી."
  ],
  "auditDate": [
    "ઓડિટ તારીખ પસંદ કરો",
    "View date ભારતીય સમય મુજબ તે દિવસ સુધી નોંધાયેલી એન્ટ્રી બતાવે છે. ટ્રેકિંગ પહેલાંની તારીખ શરૂઆતની ગણતરી નથી."
  ],
  "historical": [
    "જૂનું દૃશ્ય માત્ર વાંચવા",
    "તારીખવાળા દૃશ્યમાં શરૂઆત, આવક, સુધારો અને કોસ્ટિંગ જોડાણ નિયંત્રણ છુપાય છે. બેલેન્સ નોંધના સમય પર આધારિત છે."
  ],
  "current": [
    "હાલના સ્ટોક પર પાછા",
    "તારીખ ખાલી કરીને View date પસંદ કરો. હાલનું બેલેન્સ અને ફેરફાર નિયંત્રણ પાછાં આવશે."
  ],
  "export": [
    "બેલેન્સ નિકાસ કરો",
    "CSV માં દેખાતી તારીખના યાર્ન બેલેન્સ, કુલ અને ટ્રેકિંગ માહિતી આવે છે; હિલચાલ ઇતિહાસ નહીં. ટૂરમાં ડાઉનલોડ થતું નથી."
  ],
  "historyFilter": [
    "હિલચાલ ઇતિહાસ ગાળો",
    "યાર્ન અથવા બધા યાર્ન પસંદ કરો. કાર્ડનું History તે યાર્ન પસંદ કરે છે. Load more એ જ તારીખ અને ફિલ્ટરની જૂની નોંધ લાવે છે."
  ],
  "movement": [
    "ડિસ્પેચ કપાત તપાસો",
    "કિલોનો ફેરફાર, નોંધ પછીનું બેલેન્સ, મોકલેલા મીટર અને સાચવેલું સૂત્ર જુઓ. View dispatch સંબંધિત ડિસ્પેચ ખોલે છે; પરત અલગ નોંધ છે."
  ],
  "finish": [
    "યાર્ન સ્ટોક તૈયાર",
    "હાલનું યાર્ન અને આવક નોંધો, કોસ્ટિંગ જોડો અને ડિસ્પેચ કપાત તથા તારીખવાળા બેલેન્સ તપાસો. જરૂર પડે ટૂર ફરી જુઓ."
  ]
}},
hi: { ...fabricStockTutorialCopy.hi, sections: ["धागा स्टॉक समझें", "शुरुआत और आवक", "लागत जोड़ें", "शेष सुधारें", "ऑडिट और निर्यात", "गतिविधियाँ देखें"], fields: {
  "balance": [
    "शेष धागे का अर्थ",
    "इसमें बचा धागा और न भेजे गए कपड़े का धागा शामिल है। उत्पादन इसे नहीं घटाता। पुष्टि वाला डिस्पैच जुड़ी लागत के वजन से कटौती करता है।"
  ],
  "tracking": [
    "धागा ट्रैकिंग शुरू करें",
    "पहली वजन प्रविष्टि ट्रैकिंग शुरू करती है। अगले डिस्पैच से पहले कपड़े की लागत जोड़ें और जरूरी धागों का शेष दर्ज करें।"
  ],
  "yarn": [
    "हर धागे का एक शेष",
    "वजन किलो में है। एक नाम के ताने और बाने का शेष साझा है। नमूना: 100 शुरुआती + 20 आवक − 10 डिस्पैच = 110 किलो।"
  ],
  "opening": [
    "शुरुआती वजन",
    "न भेजे गए कपड़े सहित मौजूदा धागा एक बार दर्ज करें। दर्ज आवक और पुराने लंबित डिस्पैच का धागा फिर न जोड़ें।"
  ],
  "openingQuality": [
    "लागत का नाम मिलाएँ",
    "लागत वाला धागा नाम रखें। सुझाए नाम से आवक और कटौती एक शेष में रहती हैं।"
  ],
  "openingAmount": [
    "शुरुआती किलो डालें",
    "जोड़ने वाला मौजूदा वजन डालें। अधिकतम तीन दशमलव रखें।"
  ],
  "openingReason": [
    "शुरुआती प्रविष्टि समझाएँ",
    "कम से कम तीन अक्षर का कारण या संदर्भ दें। सहेजने से पहले जाँचें; नमूना स्टॉक नहीं सहेजता।"
  ],
  "receipt": [
    "नया मिला धागा जोड़ें",
    "Add yarn नई आवक दर्ज करता है। यह एक बार के शुरुआती वजन से अलग है।"
  ],
  "receiptAmount": [
    "आवक वजन डालें",
    "नया मिला वजन डालें, कुल शेष नहीं। आवक शून्य से ज्यादा होनी चाहिए।"
  ],
  "receiptSave": [
    "आवक जाँचें",
    "रसीद संदर्भ या कारण दें। सेव की पुष्टि न हो तो नई प्रविष्टि से पहले उन्हीं विवरणों से फिर प्रयास करें।"
  ],
  "formulas": [
    "कपड़े में इस्तेमाल धागा",
    "हर कपड़े को सहेजी लागत जोड़नी है। बिना जुड़ाव के सही डिस्पैच कटौती के लिए पहले सेटअप चाहिए।"
  ],
  "link": [
    "लागत जोड़ें",
    "क्वालिटी के लिए Link costing खोलें। यह नमूना असली जुड़ाव नहीं बदलता।"
  ],
  "costing": [
    "संगत संस्करण चुनें",
    "इसी क्वालिटी की लागत चुनकर संस्करण जाँचें। संगत धागा वजन न हो तो नई लागत सहेजें।"
  ],
  "weights": [
    "100 मीटर का वजन देखें",
    "लागत के भत्तों सहित ताने और बाने का वजन जाँचें। 100 मीटर पर 10 किलो हो तो 100 मीटर डिस्पैच में 10 किलो कटेगा।"
  ],
  "linkReason": [
    "सूत्र चयन का कारण",
    "सूत्र जोड़ने या बदलने का कारण जरूरी है। चुनी लागत का संदर्भ समझाएँ।"
  ],
  "linkSave": [
    "बदलाव आगे लागू होते हैं",
    "जुड़ा वजन यहाँ तय रहता है। दोबारा जोड़ने से आगे के डिस्पैच बदलते हैं; पुरानी कटौती का सूत्र बना रहता है।"
  ],
  "correction": [
    "धागा गिनती सुधारें",
    "न भेजे गए कपड़े के धागे सहित सत्यापित कुल वजन Correct balance में दर्ज करें।"
  ],
  "counted": [
    "अभी का कुल वजन",
    "कुल वजन डालें, अंतर नहीं। यहाँ 110 की जगह 108 किलो से −2 किलो का सुधार होगा।"
  ],
  "correctionReason": [
    "कारण सहित सुधार सहेजें",
    "कारण जरूरी है और अंतर इतिहास में रहता है। टूर यह सुधार जमा नहीं करता।"
  ],
  "auditDate": [
    "ऑडिट तारीख चुनें",
    "View date भारतीय समय में उस दिन तक दर्ज प्रविष्टियाँ दिखाता है। ट्रैकिंग से पहले की तारीख शुरुआती गिनती नहीं है।"
  ],
  "historical": [
    "पुराना दृश्य केवल पढ़ें",
    "तारीख वाले दृश्य में शुरुआती, आवक, सुधार और लागत जोड़ने के नियंत्रण छिपते हैं। शेष प्रविष्टि दर्ज होने के समय पर आधारित है।"
  ],
  "current": [
    "वर्तमान स्टॉक पर लौटें",
    "तारीख खाली करके View date चुनें। वर्तमान शेष और बदलाव नियंत्रण लौटेंगे।"
  ],
  "export": [
    "शेष निर्यात करें",
    "CSV में दिखती तारीख के धागा शेष, कुल और ट्रैकिंग जानकारी आती है; गतिविधि इतिहास नहीं। टूर में डाउनलोड नहीं होता।"
  ],
  "historyFilter": [
    "गतिविधि इतिहास छाँटें",
    "धागा या सभी धागे चुनें। कार्ड का History वह धागा चुनता है। Load more उसी तारीख और फ़िल्टर की पुरानी प्रविष्टियाँ लाता है।"
  ],
  "movement": [
    "डिस्पैच कटौती जाँचें",
    "किलो बदलाव, प्रविष्टि के बाद शेष, भेजे मीटर और सहेजा सूत्र देखें। View dispatch संबंधित डिस्पैच खोलता है; वापसी अलग प्रविष्टि है।"
  ],
  "finish": [
    "धागे का स्टॉक तैयार",
    "मौजूदा धागा और आवक दर्ज करें, लागत जोड़ें और डिस्पैच कटौती व तारीख वाले शेष जाँचें। जरूरत पर टूर फिर देखें।"
  ]
}},
}
export const stockTutorialCopy: Record<StockTourKind, Record<Language, StockTutorialCopy>> = { 'fabric-stock': fabricStockTutorialCopy, 'yarn-stock': yarnStockTutorialCopy }
