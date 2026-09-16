import type { Language } from './context'
import type { StockTourKind, StockTourStep } from '../stock-tour'
import { configurationTutorialCopy } from './configuration-tutorial'
export type StockTutorialCopy = { sample: string; sections: string[]; fields: Partial<Record<StockTourStep, readonly [string, string]>>; skip: string; back: string; next: string; finish: string; progress: string }
export const fabricStockTutorialCopy: Record<Language, StockTutorialCopy> = {
en: { ...configurationTutorialCopy.en, sample: "Sample preview · your stock is unchanged", sections: ["Understand the balance", "Find a quality", "Opening stock", "Correct a balance", "Trace movements"], fields: {
  "balance": [
    "Available fabric",
    "Stock is measured in metres by fabric quality. Saved production adds metres; dispatch movements reduce the balance."
  ],
  "tracking": [
    "When tracking started",
    "Historical production was not added automatically. Record physically remaining pre-start fabric once, excluding fabric committed to historical pending dispatches. Later production edits change stock by the difference."
  ],
  "search": [
    "Find a quality",
    "Search quality names to narrow the cards. This does not change the movement history filter."
  ],
  "quality": [
    "Read a quality balance",
    "Each card shows the current metres for one quality. This sample has 500 opening + 200 production − 100 dispatched = 600 m."
  ],
  "openingPending": [
    "Opening stock not recorded",
    "This reminder means no opening entry has been recorded. Check whether pre-start stock remains before adding any; do not add production already counted."
  ],
  "opening": [
    "Record opening stock",
    "Use Opening stock for physically remaining stock from before tracking began, once per quality."
  ],
  "openingQuality": [
    "Use the same quality name",
    "Match the name used in Production. Case and extra spaces are ignored. Opening from a quality card fixes that quality name."
  ],
  "openingAmount": [
    "Enter pre-start metres",
    "Enter the remaining pre-start amount to add, not the total shown today. Fabric supports up to two decimal places."
  ],
  "openingReason": [
    "Explain the opening count",
    "A reason or count reference is required, with at least three characters. It stays with the stock movement."
  ],
  "openingSave": [
    "Review and save opening",
    "Saving adds the opening metres once. This is a read-only example; no stock is saved during the tour."
  ],
  "correction": [
    "Correct a physical count",
    "Open Correct balance on the quality card when a verified count differs from the system balance."
  ],
  "counted": [
    "Enter the verified total",
    "Enter the total available now, not a change amount. Here 590 m replaces 600 m, producing a −10 m movement."
  ],
  "correctionReason": [
    "Keep the correction reason",
    "Explain why the count changed. The difference and reason remain in movement history."
  ],
  "correctionSave": [
    "Review the correction",
    "Saving a correction also closes opening stock for this quality. If stock changes before saving, refresh and review the new balance first."
  ],
  "history": [
    "Follow movement history",
    "History includes opening, production, corrections, dispatches and dispatch reversals. Production links lead back to Production."
  ],
  "historyFilter": [
    "Filter history by quality",
    "Use the history dropdown or a card’s History button. This filters movements separately from the card search."
  ],
  "movement": [
    "Read changes and balances",
    "The signed amount shows the change. Balance after shows stock immediately after that movement, not necessarily today’s stock."
  ],
  "older": [
    "Load older movements",
    "Load older movements appends earlier records for the selected quality. Keep the filter in mind while reviewing."
  ],
  "refresh": [
    "Refresh stock",
    "Refresh reloads current balances and history. Use it after production or dispatch changes elsewhere."
  ],
  "finish": [
    "Fabric stock is ready",
    "Record verified opening stock, review production movements and use Correct balance for physical counts. Replay this tour whenever needed."
  ]
}},
gu: { ...configurationTutorialCopy.gu, sample: "નમૂનો · તમારો સ્ટોક બદલાતો નથી", sections: ["બેલેન્સ સમજો", "ક્વોલિટી શોધો", "શરૂઆતનો સ્ટોક", "બેલેન્સ સુધારો", "હિલચાલ જુઓ"], fields: {
  "balance": [
    "ઉપલબ્ધ કાપડ",
    "સ્ટોક ક્વોલિટી પ્રમાણે મીટરમાં છે. સાચવેલું ઉત્પાદન મીટર ઉમેરે છે; ડિસ્પેચ હિલચાલ સ્ટોક ઘટાડે છે."
  ],
  "tracking": [
    "ટ્રેકિંગ ક્યારે શરૂ થયું",
    "જૂનું ઉત્પાદન આપમેળે ઉમેરાયું નથી. જૂના બાકી ડિસ્પેચ માટે નક્કી કરેલું કાપડ છોડીને, શરૂઆત પહેલાંનું ખરેખર બાકી કાપડ એક વાર નોંધો. પછીના ઉત્પાદન સુધારા તફાવતથી સ્ટોક બદલે છે."
  ],
  "search": [
    "ક્વોલિટી શોધો",
    "નામથી કાર્ડ શોધો. આથી હિલચાલ ઇતિહાસનો ફિલ્ટર બદલાતો નથી."
  ],
  "quality": [
    "ક્વોલિટીનું બેલેન્સ જુઓ",
    "કાર્ડ એક ક્વોલિટીના હાલના મીટર બતાવે છે. નમૂનો: 500 શરૂઆત + 200 ઉત્પાદન − 100 ડિસ્પેચ = 600 મી."
  ],
  "openingPending": [
    "શરૂઆતનો સ્ટોક નોંધાયો નથી",
    "શરૂઆતની નોંધ નથી તે યાદ અપાવે છે. શરૂઆત પહેલાંનું કાપડ બાકી હોય તો જ ઉમેરો; ગણાયેલ ઉત્પાદન ફરી ન ઉમેરો."
  ],
  "opening": [
    "શરૂઆતનો સ્ટોક નોંધો",
    "ટ્રેકિંગ પહેલાંનું ખરેખર બાકી કાપડ દરેક ક્વોલિટી માટે એક વાર નોંધો."
  ],
  "openingQuality": [
    "એકસરખું ક્વોલિટી નામ વાપરો",
    "Production જેવું નામ રાખો. અંગ્રેજી મોટા-નાના અક્ષર અને વધારાની જગ્યાનો ફરક અવગણાય છે. કાર્ડથી ખોલતાં નામ નક્કી હોય છે."
  ],
  "openingAmount": [
    "શરૂઆત પહેલાંના મીટર",
    "ઉમેરવાના જૂના બાકી મીટર નાખો, આજનું કુલ નહીં. વધુમાં વધુ બે દશાંશ ચાલે છે."
  ],
  "openingReason": [
    "ગણતરીનું કારણ આપો",
    "ઓછામાં ઓછા ત્રણ અક્ષરનું કારણ અથવા ગણતરી સંદર્ભ જરૂરી છે. તે હિલચાલ સાથે રહે છે."
  ],
  "openingSave": [
    "તપાસીને શરૂઆત સાચવો",
    "સાચવવાથી શરૂઆતના મીટર એક વાર ઉમેરાય છે. આ માત્ર નમૂનો છે; ટૂરમાં સ્ટોક સાચવાતો નથી."
  ],
  "correction": [
    "ભૌતિક ગણતરી સુધારો",
    "ચકાસેલી ગણતરી બેલેન્સથી અલગ હોય ત્યારે ક્વોલિટી કાર્ડ પર Correct balance ખોલો."
  ],
  "counted": [
    "ચકાસેલું કુલ નાખો",
    "હાલનું કુલ નાખો, તફાવત નહીં. અહીં 600 મીની જગ્યાએ 590 મીથી −10 મીની નોંધ બને છે."
  ],
  "correctionReason": [
    "સુધારાનું કારણ રાખો",
    "ગણતરી કેમ બદલાઈ તે લખો. તફાવત અને કારણ ઇતિહાસમાં રહે છે."
  ],
  "correctionSave": [
    "સુધારો તપાસો",
    "સુધારો સાચવ્યા પછી આ ક્વોલિટીની શરૂઆતની નોંધ પણ બંધ થાય છે. વચ્ચે સ્ટોક બદલાય તો રિફ્રેશ કરીને ફરી તપાસો."
  ],
  "history": [
    "હિલચાલ ઇતિહાસ જુઓ",
    "શરૂઆત, ઉત્પાદન, સુધારા, ડિસ્પેચ અને ડિસ્પેચ પરતની નોંધ હોય છે. ઉત્પાદન લિંક Production ખોલે છે."
  ],
  "historyFilter": [
    "ક્વોલિટીથી ઇતિહાસ ગાળો",
    "ડ્રોપડાઉન અથવા કાર્ડનું History વાપરો. આ ફિલ્ટર કાર્ડ શોધથી અલગ છે."
  ],
  "movement": [
    "ફેરફાર અને બેલેન્સ વાંચો",
    "ચિહ્નવાળી રકમ ફેરફાર બતાવે છે. Balance after તે નોંધ પછીનો સ્ટોક છે, જરૂરી નથી કે આજનો હોય."
  ],
  "older": [
    "જૂની નોંધો જુઓ",
    "Load older movements પસંદ કરેલી ક્વોલિટીની જૂની નોંધો ઉમેરે છે. પસંદ કરેલો ફિલ્ટર ધ્યાનમાં રાખો."
  ],
  "refresh": [
    "સ્ટોક રિફ્રેશ કરો",
    "રિફ્રેશ હાલના બેલેન્સ અને ઇતિહાસ લાવે છે. અન્ય જગ્યાએ ઉત્પાદન કે ડિસ્પેચ બદલ્યા પછી વાપરો."
  ],
  "finish": [
    "કાપડનો સ્ટોક તૈયાર",
    "ચકાસેલો શરૂઆતનો સ્ટોક નોંધો, ઉત્પાદન હિલચાલ જુઓ અને ભૌતિક ગણતરી માટે બેલેન્સ સુધારો. જરૂર પડે ટૂર ફરી જુઓ."
  ]
}},
hi: { ...configurationTutorialCopy.hi, sample: "नमूना · आपका स्टॉक नहीं बदलता", sections: ["शेष समझें", "क्वालिटी खोजें", "शुरुआती स्टॉक", "शेष सुधारें", "गतिविधियाँ देखें"], fields: {
  "balance": [
    "उपलब्ध कपड़ा",
    "स्टॉक क्वालिटी के अनुसार मीटर में है। सहेजा उत्पादन मीटर जोड़ता है; डिस्पैच गतिविधियाँ शेष घटाती हैं।"
  ],
  "tracking": [
    "ट्रैकिंग कब शुरू हुई",
    "पुराना उत्पादन अपने आप नहीं जोड़ा गया। पुराने लंबित डिस्पैच का तय कपड़ा छोड़कर, शुरुआत से पहले का बचा कपड़ा एक बार दर्ज करें। बाद के उत्पादन सुधार अंतर से स्टॉक बदलते हैं।"
  ],
  "search": [
    "क्वालिटी खोजें",
    "नाम से कार्ड खोजें। इससे गतिविधि इतिहास का फ़िल्टर नहीं बदलता।"
  ],
  "quality": [
    "क्वालिटी का शेष देखें",
    "कार्ड एक क्वालिटी के वर्तमान मीटर दिखाता है। नमूना: 500 शुरुआती + 200 उत्पादन − 100 डिस्पैच = 600 मी।"
  ],
  "openingPending": [
    "शुरुआती स्टॉक दर्ज नहीं",
    "यह शुरुआती प्रविष्टि न होने की याद दिलाता है। पहले का कपड़ा बचा हो तभी जोड़ें; गिना गया उत्पादन फिर न जोड़ें।"
  ],
  "opening": [
    "शुरुआती स्टॉक दर्ज करें",
    "ट्रैकिंग से पहले का बचा कपड़ा हर क्वालिटी के लिए एक बार दर्ज करें।"
  ],
  "openingQuality": [
    "एक जैसा क्वालिटी नाम रखें",
    "Production वाला नाम रखें। अंग्रेजी बड़े-छोटे अक्षर और अतिरिक्त खाली जगह का फर्क अनदेखा होता है। कार्ड से खोलने पर नाम तय रहता है।"
  ],
  "openingAmount": [
    "पहले के बचे मीटर",
    "जोड़ने वाले पुराने बचे मीटर डालें, आज का कुल नहीं। अधिकतम दो दशमलव रखें।"
  ],
  "openingReason": [
    "गिनती का कारण दें",
    "कम से कम तीन अक्षर का कारण या गिनती संदर्भ जरूरी है। यह गतिविधि के साथ रहता है।"
  ],
  "openingSave": [
    "जाँचकर शुरुआत सहेजें",
    "सहेजने पर शुरुआती मीटर एक बार जुड़ते हैं। यह केवल नमूना है; टूर में स्टॉक नहीं सहेजा जाता।"
  ],
  "correction": [
    "भौतिक गिनती सुधारें",
    "सत्यापित गिनती शेष से अलग हो तो क्वालिटी कार्ड पर Correct balance खोलें।"
  ],
  "counted": [
    "सत्यापित कुल डालें",
    "वर्तमान कुल डालें, बदलाव की मात्रा नहीं। यहाँ 600 मी के बदले 590 मी डालने पर −10 मी की प्रविष्टि बनती है।"
  ],
  "correctionReason": [
    "सुधार का कारण रखें",
    "गिनती क्यों बदली, लिखें। अंतर और कारण इतिहास में रहते हैं।"
  ],
  "correctionSave": [
    "सुधार जाँचें",
    "सुधार सहेजने से इस क्वालिटी की शुरुआती प्रविष्टि भी बंद होती है। बीच में स्टॉक बदले तो रीफ़्रेश करके फिर जाँचें।"
  ],
  "history": [
    "गतिविधि इतिहास देखें",
    "शुरुआत, उत्पादन, सुधार, डिस्पैच और डिस्पैच वापसी दिखते हैं। उत्पादन लिंक Production खोलता है।"
  ],
  "historyFilter": [
    "क्वालिटी से इतिहास छाँटें",
    "ड्रॉपडाउन या कार्ड का History इस्तेमाल करें। यह फ़िल्टर कार्ड खोज से अलग है।"
  ],
  "movement": [
    "बदलाव और शेष पढ़ें",
    "चिह्न वाली मात्रा बदलाव बताती है। Balance after उस प्रविष्टि के तुरंत बाद का शेष है, जरूरी नहीं आज का हो।"
  ],
  "older": [
    "पुरानी प्रविष्टियाँ देखें",
    "Load older movements चुनी क्वालिटी की पुरानी प्रविष्टियाँ जोड़ता है। चुने फ़िल्टर का ध्यान रखें।"
  ],
  "refresh": [
    "स्टॉक रीफ़्रेश करें",
    "रीफ़्रेश वर्तमान शेष और इतिहास लाता है। दूसरी जगह उत्पादन या डिस्पैच बदलने के बाद इस्तेमाल करें।"
  ],
  "finish": [
    "कपड़े का स्टॉक तैयार",
    "सत्यापित शुरुआती स्टॉक दर्ज करें, उत्पादन गतिविधियाँ देखें और भौतिक गिनती के लिए शेष सुधारें। जरूरत पर टूर फिर देखें।"
  ]
}},
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
