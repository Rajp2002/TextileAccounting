import type { Language } from './context'

// Explicit copy: never infer a tutorial title from potentially untranslated DOM labels.
const en = {
  "sections": [
    "Maintain prices",
    "Find the yarn",
    "Check usage",
    "Update a price",
    "Set the dates",
    "Use the result"
  ],
  "sectionProgress": "Section {current} of {total}",
  "replay": "How Rate Book works · Guided tour",
  "skip": "Skip tour",
  "back": "Back",
  "next": "Next",
  "finish": "Finish",
  "progress": "Tutorial progress",
  "hint": "Read-only tour: your rates, filters and editor values stay as they are.",
  "syncFailed": "Tutorial dismissed. We couldn’t save this to your account yet.",
  "retry": "Retry saving preference",
  "fields": {
    "overview": {
      "title": "Maintain your own yarn prices",
      "description": "Keep supplier-checked ₹/kg prices ready for future estimates. Start with a supplier quote or invoice; you maintain these rates yourself, rather than receiving an automatic market feed."
    },
    "immutabilityNotice": {
      "title": "Recheck the next estimate",
      "description": "Saving a rate updates matching yarn prices in linked Saved Qualities for future estimates. Historical costing snapshots keep their original numbers. After Finish, find a yarn and check its supplier price; then review a fresh estimate in Cost Estimator."
    },
    "activeRatesCount": {
      "title": "Active Yarn Rates & Balance",
      "description": "Track the total number of active yarns monitored in your mill, with an instant breakdown between Warp yarns and Weft yarns."
    },
    "lastReviewedDate": {
      "title": "Market Verification Cadence",
      "description": "Shows when rates were last confirmed against supplier bills or broker rate cards, ensuring quotations don't rely on stale market figures."
    },
    "yarnSearch": {
      "title": "Find one yarn to maintain",
      "description": "Search by yarn name, source or fabric. No matching entry? Use {addRate} with the yarn name used in your quality and the correct Warp or Weft direction."
    },
    "directionFilter": {
      "title": "Find the rates needing attention",
      "description": "Use All, Warp or Weft to narrow the list. Needs Review includes overdue prices and yarns discovered from saved qualities or costings that still need owner confirmation. Clear filters to see other yarns."
    },
    "needsReviewFilter": {
      "title": "Needs Review Filter",
      "description": "Instantly filters to yarns where the review interval has lapsed or newly discovered rates were imported from fabric recipes."
    },
    "confirmAll": {
      "title": "Verify every pending rate first",
      "description": "Confirm All as Current records a review for every pending rate. Use it only after checking all included supplier prices. Confirming a review does not change the price."
    },
    "archivedToggle": {
      "title": "Active vs Archived Rates",
      "description": "Toggle between active manufacturing rates and archived yarns. Archived rates remain accessible for historical reference and can be restored anytime."
    },
    "yarnRow": {
      "title": "Yarn Catalog Entry",
      "description": "Each row represents an active yarn monitored in your mill. It combines current price, market trend, review urgency, and linked fabric recipes into a single scannable line."
    },
    "yarnNameCell": {
      "title": "Check the yarn identity",
      "description": "Check the saved yarn name and its Warp or Weft direction before updating a price. Use the qualities badge to inspect usage; a matching-looking name alone is not proof of which qualities will be updated."
    },
    "rateAndTrend": {
      "title": "Read the change from your last price",
      "description": "The current price is in ₹/kg. The change badge compares it with the previous recorded value: ₹200 to ₹220 is +₹20 (+10%). Initial rate means there is no previous value to compare."
    },
    "reviewStatusBadge": {
      "title": "Separate price dates from review dates",
      "description": "In {advancedEdit}, {effectiveDate} records when the price applies; {reviewDate} records when you checked it. {reviewEvery} sets the next reminder from that review date. These dates do not rewrite old costings or schedule a later price change."
    },
    "linkedQualitiesPopover": {
      "title": "Check which qualities use it",
      "description": "Open the qualities badge to check usage before changing a rate. For example, a quality using “Polyester 75D” needs the matching yarn name. If usage is missing, check that yarn in Saved Qualities; adding a rate alone does not link a recipe."
    },
    "quickReviewAction": {
      "title": "Confirm only a checked price",
      "description": "When the supplier price is unchanged, use the row’s review action to confirm it without changing the value. Confirm All as Current applies to all pending reviews, so check every included rate first. Rate Review opens the pending list."
    },
    "quickEditAction": {
      "title": "Record the supplier’s new price",
      "description": "Example only: your supplier changes ₹200/kg to ₹220/kg. Open {editRate}, enter 220, add a source note, then choose {saveRate}. The +₹20 (+10%) preview compares your saved prices; it is not a live market trend."
    },
    "quickEditPopover": {
      "title": "Inline Price & Trend Preview",
      "description": "Enter the new ₹/kg rate to see instant trend calculations (+/- ₹ and %), add an optional broker or source note, and save with a single click."
    },
    "addRateAction": {
      "title": "Add New Yarn Rates",
      "description": "Click Add Yarn Rate to register new yarn varieties into your catalog with customized review cadences and supplier notes."
    },
    "rateDrawerFields": {
      "title": "Use {advancedEdit} for full details",
      "description": "{advancedEdit} contains dates, Source, notes and {reviewEvery} (30–365 days). Existing yarn names are locked; to rename one, add a replacement rate and intentionally update Saved Qualities. A discovery source stays tied to the original quality or costing."
    },
    "reviewRailWidget": {
      "title": "Check discovered yarns and conflicts",
      "description": "Saving a quality or costing can discover a yarn for owner review. If different prices are found, review their usages before choosing the current rate. This is discovery from your records, not supplier verification."
    },
    "activityAndArchive": {
      "title": "Keep history when retiring a yarn",
      "description": "Use the row menu’s {activity} to inspect recorded prices and reviews. {archiveRate} removes an unused yarn from the active list without changing Saved Qualities or historical costings. Find it under {archivedRates} and choose {restoreRate} when needed."
    }
  },
  "helpTitle": "Rate Book help: reviews, trends and maintenance",
  "principles": [
    "Saving a rate updates matching yarn prices in linked Saved Qualities for future estimates.",
    "Historical costing snapshots keep their original numbers.",
    "Yarns discovered from saved qualities or costings need your supplier-price check."
  ]
}

const hi: typeof en = {
  "sections": [
    "भाव बनाए रखें",
    "धागा खोजें",
    "उपयोग जाँचें",
    "भाव बदलें",
    "तारीखें तय करें",
    "परिणाम उपयोग करें"
  ],
  "sectionProgress": "अनुभाग {current} का {total}",
  "replay": "रेट बुक कैसे काम करता है · गाइडेड टूर",
  "skip": "टूर छोड़ें",
  "back": "पीछे",
  "next": "आगे",
  "finish": "समाप्त",
  "progress": "ट्यूटोरियल प्रगति",
  "hint": "यह केवल देखने का टूर है: आपके रेट, फ़िल्टर और संपादक के मान वैसे ही रहेंगे।",
  "syncFailed": "टूर बंद हुआ। आपकी प्राथमिकता अभी खाते में सुरक्षित नहीं हो सकी।",
  "retry": "पुनः प्रयास करें",
  "fields": {
    "overview": {
      "title": "अपने यार्न के भाव बनाए रखें",
      "description": "आगे के अनुमानों के लिए सप्लायर से जाँचे हुए ₹/किग्रा भाव रखें। सप्लायर का कोटेशन या बिल लेकर शुरू करें। ये भाव आप बनाए रखते हैं; बाज़ार से अपने-आप अपडेट नहीं आते।"
    },
    "immutabilityNotice": {
      "title": "अगला अनुमान जाँचें",
      "description": "रेट सेव करने पर जुड़ी सेव की गई क्वालिटीज़ में मेल खाते यार्न के भाव आगे के अनुमानों के लिए बदलते हैं। पुराने कॉस्टिंग स्नैपशॉट अपने मूल आँकड़े रखते हैं। समाप्त के बाद एक धागा खोजकर सप्लायर का भाव जाँचें; फिर लागत अनुमानक में नया अनुमान देखें।"
    },
    "activeRatesCount": {
      "title": "सक्रिय यार्न रेट्स और संतुलन",
      "description": "अपनी मिल में ट्रैक किए जा रहे कुल सक्रिय धागों की संख्या और ताना (Warp) व बाना (Weft) धागों का त्वरित संतुलन देखें।"
    },
    "lastReviewedDate": {
      "title": "बाज़ार सत्यापन अवधि",
      "description": "दर्शाता है कि सप्लायर बिलों से धागे के भाव की अंतिम पुष्टि कब की गई थी, ताकि कोटेशन पुराने भावों पर न बनें।"
    },
    "yarnSearch": {
      "title": "एक धागा खोजें",
      "description": "यार्न के नाम, स्रोत या कपड़े से खोजें। प्रविष्टि नहीं मिली? {addRate} में क्वालिटी में इस्तेमाल किया गया नाम और सही ताना या बाना दिशा चुनें।"
    },
    "directionFilter": {
      "title": "समीक्षा वाले भाव खोजें",
      "description": "सभी, ताना या बाना से सूची सीमित करें। समीक्षा आवश्यक में पुराने भाव और सेव की गई क्वालिटी या कॉस्टिंग से मिले अपुष्ट धागे आते हैं। अन्य धागे देखने के लिए फ़िल्टर हटाएँ।"
    },
    "needsReviewFilter": {
      "title": "समीक्षा योग्य (Needs Review) फ़िल्टर",
      "description": "उन धागों को तुरंत अलग करें जिनकी समीक्षा की तारीख बीत चुकी है या जो नई फैब्रिक क्वालिटी से सिस्टम में आए हैं।"
    },
    "confirmAll": {
      "title": "पहले हर लंबित भाव जाँचें",
      "description": "सभी को वर्तमान के रूप में पुष्टि करें हर लंबित रेट की समीक्षा दर्ज करता है। सभी सप्लायर भाव जाँचने के बाद ही इसे चुनें। समीक्षा की पुष्टि से मूल्य नहीं बदलता।"
    },
    "archivedToggle": {
      "title": "सक्रिय बनाम आर्काइव रेट्स",
      "description": "सक्रिय धागों और आर्काइव किए गए रेट्स के बीच स्विच करें। आर्काइव रेट्स ऑडिट के लिए सुरक्षित रहते हैं और कभी भी रीस्टोर हो सकते हैं।"
    },
    "yarnRow": {
      "title": "यार्न कैटलॉग पंक्ति",
      "description": "प्रत्येक पंक्ति आपकी मिल में ट्रैक किए जा रहे एक धागे का प्रतिनिधित्व करती है। यह वर्तमान भाव, बाज़ार रुझान, समीक्षा स्थिति और जुड़े कपड़ों की जानकारी एक साथ दिखाती है।"
    },
    "yarnNameCell": {
      "title": "धागे की पहचान जाँचें",
      "description": "भाव बदलने से पहले यार्न का सेव किया नाम और ताना या बाना दिशा जाँचें। क्वालिटी बैज से उपयोग देखें; केवल मिलता-जुलता नाम यह साबित नहीं करता कि कौन-सी क्वालिटीज़ अपडेट होंगी।"
    },
    "rateAndTrend": {
      "title": "पिछले दर्ज भाव से अंतर देखें",
      "description": "वर्तमान भाव ₹/किग्रा में है। बैज पिछले दर्ज मूल्य से तुलना करता है: ₹200 से ₹220 यानी +₹20 (+10%)। शुरुआती रेट का मतलब तुलना के लिए कोई पिछला मूल्य नहीं है।"
    },
    "reviewStatusBadge": {
      "title": "भाव और समीक्षा की तारीख अलग रखें",
      "description": "{advancedEdit} में {effectiveDate} बताती है कि भाव कब से लागू है; {reviewDate} बताती है कि आपने कब जाँचा। {reviewEvery} उससे अगला रिमाइंडर तय करता है। ये तारीखें पुराने कॉस्टिंग नहीं बदलतीं और भविष्य के लिए भाव बदलने का समय निर्धारित नहीं करतीं।"
    },
    "linkedQualitiesPopover": {
      "title": "जुड़ी क्वालिटीज़ जाँचें",
      "description": "भाव बदलने से पहले क्वालिटी बैज खोलकर उपयोग देखें। उदाहरण: “Polyester 75D” वाली क्वालिटी के लिए यार्न का नाम मेल खाना चाहिए। उपयोग न दिखे तो सेव की गई क्वालिटीज़ में धागा जाँचें; केवल रेट जोड़ने से रेसिपी नहीं जुड़ती।"
    },
    "quickReviewAction": {
      "title": "जाँचे हुए भाव की ही पुष्टि करें",
      "description": "सप्लायर का भाव नहीं बदला तो पंक्ति की समीक्षा क्रिया से पुष्टि करें; मूल्य नहीं बदलेगा। सभी को वर्तमान के रूप में पुष्टि करें सभी लंबित रेट पर लागू होता है, इसलिए पहले हर भाव जाँचें। रेट समीक्षा से लंबित सूची खोलें।"
    },
    "quickEditAction": {
      "title": "सप्लायर का नया भाव दर्ज करें",
      "description": "सिर्फ उदाहरण: सप्लायर का भाव ₹200/किग्रा से ₹220/किग्रा हुआ। {editRate} खोलें, 220 और स्रोत नोट दर्ज करें, फिर {saveRate} चुनें। +₹20 (+10%) आपके दर्ज भावों का अंतर है, लाइव बाज़ार रुझान नहीं।"
    },
    "quickEditPopover": {
      "title": "इनलाइन मूल्य और ट्रेंड पूर्वावलोकन",
      "description": "नया ₹/किग्रा रेट दर्ज करें, तुरंत ट्रेंड पूर्वावलोकन देखें, ब्रोकर नोट जोड़ें और एक क्लिक में सुरक्षित करें।"
    },
    "addRateAction": {
      "title": "नया यार्न रेट जोड़ें",
      "description": "कैटलॉग में नए धागे जोड़ने, उनकी समीक्षा अवधि और सप्लायर विवरण दर्ज करने के लिए Add Yarn Rate पर क्लिक करें।"
    },
    "rateDrawerFields": {
      "title": "पूरा विवरण {advancedEdit} में देखें",
      "description": "{advancedEdit} में तारीखें, स्रोत, नोट और {reviewEvery} (30–365 दिन) हैं। मौजूदा यार्न का नाम लॉक है; नया नाम चाहिए तो नया रेट जोड़कर सेव की गई क्वालिटीज़ बदलें। खोज का स्रोत मूल क्वालिटी या कॉस्टिंग से जुड़ा रहता है।"
    },
    "reviewRailWidget": {
      "title": "मिले हुए धागे और अलग भाव जाँचें",
      "description": "क्वालिटी या कॉस्टिंग सेव करने से नया यार्न समीक्षा के लिए मिल सकता है। अलग-अलग भाव मिले तो वर्तमान भाव चुनने से पहले उनके उपयोग देखें। यह आपके रिकॉर्ड से मिली जानकारी है, सप्लायर की पुष्टि नहीं।"
    },
    "activityAndArchive": {
      "title": "धागा हटाते समय इतिहास रखें",
      "description": "पंक्ति मेनू की {activity} में दर्ज भाव और समीक्षाएँ देखें। {archiveRate} से धागा सक्रिय सूची से हटता है; सेव की गई क्वालिटीज़ और पुराने कॉस्टिंग नहीं बदलते। {archivedRates} में उसे ढूँढकर {restoreRate} चुनें।"
    }
  },
  "helpTitle": "रेट बुक सहायता: समीक्षा, भाव का अंतर और रखरखाव",
  "principles": [
    "रेट सेव करने पर जुड़ी सेव की गई क्वालिटीज़ के मेल खाते यार्न भाव आगे के अनुमानों के लिए बदलते हैं।",
    "पुराने कॉस्टिंग स्नैपशॉट अपने मूल आँकड़े रखते हैं।",
    "सेव की गई क्वालिटी या कॉस्टिंग से मिले यार्न का भाव सप्लायर से जाँचना ज़रूरी है।"
  ]
}

const gu: typeof en = {
  "sections": [
    "ભાવ જાળવો",
    "દોરો શોધો",
    "ઉપયોગ તપાસો",
    "ભાવ બદલો",
    "તારીખો નક્કી કરો",
    "પરિણામ વાપરો"
  ],
  "sectionProgress": "વિભાગ {current} / {total}",
  "replay": "રેટ બુક કેવી રીતે કાર્ય કરે છે · ગાઇડેડ ટૂર",
  "skip": "ટૂર છોડો",
  "back": "પાછળ",
  "next": "આગળ",
  "finish": "પૂર્ણ",
  "progress": "ટ્યુટોરિયલ પ્રગતિ",
  "hint": "આ માત્ર જોવાનો ટૂર છે: તમારા રેટ, ફિલ્ટર અને સંપાદકના મૂલ્યો જેમ છે તેમ રહેશે.",
  "syncFailed": "ટૂર બંધ કરવામાં આવી. તમારી પસંદગી હજુ ખાતામાં સાચવી શકાઈ નથી.",
  "retry": "ફરી પ્રયાસ કરો",
  "fields": {
    "overview": {
      "title": "તમારા યાર્નના ભાવ જાળવો",
      "description": "આગળના અંદાજ માટે સપ્લાયર પાસે ચકાસેલા ₹/કિગ્રા ભાવ રાખો. સપ્લાયરનું ક્વોટેશન કે બિલ લઈને શરૂ કરો. આ ભાવ તમે જાળવો છો; બજારમાંથી આપમેળે અપડેટ આવતા નથી."
    },
    "immutabilityNotice": {
      "title": "આગળનો અંદાજ તપાસો",
      "description": "રેટ સેવ કરતાં જોડાયેલી સેવ કરેલી ક્વોલિટીમાં મળતા યાર્નના ભાવ આગળના અંદાજ માટે બદલાય છે. જૂનાં કોસ્ટિંગ સ્નેપશોટ મૂળ આંકડા જ રાખે છે. પૂર્ણ પછી એક દોરો શોધીને સપ્લાયરનો ભાવ ચકાસો; પછી ખર્ચ અંદાજકમાં નવો અંદાજ જુઓ."
    },
    "activeRatesCount": {
      "title": "સક્રિય યાર્ન રેટ્સ અને સંતુલન",
      "description": "તમારી મિલમાં ટ્રેક થતાં કુલ સક્રિય દોરાઓની સંખ્યા અને તાણા (Warp) તથા વાણા (Weft) દોરાઓનું ત્વરિત સંતુલન જુઓ."
    },
    "lastReviewedDate": {
      "title": "બજાર ચકાસણી સમયગાળો",
      "description": "દર્શાવે છે કે સપ્લાયર બિલ સાથે દોરાના ભાવની છેલ્લી ચકાસણી ક્યારે થઈ હતી, જેથી જૂના ભાવો પર ક્વોટેશન ન બને."
    },
    "yarnSearch": {
      "title": "એક દોરો શોધો",
      "description": "યાર્નના નામ, સ્રોત કે કાપડથી શોધો. નોંધ ન મળી? {addRate} દ્વારા ક્વોલિટીમાં વપરાતું નામ અને યોગ્ય તાણા કે વાણા દિશા પસંદ કરો."
    },
    "directionFilter": {
      "title": "સમીક્ષા જોઈતા ભાવ શોધો",
      "description": "બધા, તાણા કે વાણા વડે યાદી નાની કરો. સમીક્ષા જરૂરીમાં જૂના ભાવ અને સેવ કરેલી ક્વોલિટી કે કોસ્ટિંગમાંથી મળેલા અચકાસેલા દોરા આવે છે. બીજા દોરા જોવા ફિલ્ટર દૂર કરો."
    },
    "needsReviewFilter": {
      "title": "સમીક્ષા લાયક (Needs Review) ફિલ્ટર",
      "description": "જે દોરાઓની સમીક્ષાની તારીખ વીતી ગઈ હોય અથવા નવી ક્વોલિટીમાંથી ઉમેરાયા હોય તેમને તરત અલગ તારવો."
    },
    "confirmAll": {
      "title": "પહેલાં દરેક બાકી ભાવ તપાસો",
      "description": "બધાને વર્તમાન તરીકે પુષ્ટિ કરો દરેક બાકી રેટની સમીક્ષા નોંધે છે. બધા સપ્લાયર ભાવ ચકાસ્યા પછી જ તેનો ઉપયોગ કરો. સમીક્ષાની પુષ્ટિથી કિંમત બદલાતી નથી."
    },
    "archivedToggle": {
      "title": "સક્રિય વિરુદ્ધ આર્કાઇવ રેટ્સ",
      "description": "સક્રિય દોરાઓ અને આર્કાઇવ કરેલા રેટ્સ વચ્ચે સ્વિચ કરો. આર્કાઇવ રેટ્સ ઓડિટ માટે સચવાયેલા રહે છે અને ગમે ત્યારે પુનઃસ્થાપિત કરી શકાય છે."
    },
    "yarnRow": {
      "title": "યાર્ન કેટલોગ પંક્તિ",
      "description": "દરેક પંક્તિ તમારી મિલમાં ટ્રેક થતાં એક દોરાનું પ્રતિનિધિત્વ કરે છે. તે વર્તમાન ભાવ, બજાર વલણ, સમીક્ષા સ્થિતિ અને જોડાયેલા કાપડની માહિતી એકસાથે દર્શાવે છે."
    },
    "yarnNameCell": {
      "title": "દોરાની ઓળખ તપાસો",
      "description": "ભાવ બદલતાં પહેલાં યાર્નનું સેવ કરેલું નામ અને તાણા કે વાણા દિશા તપાસો. ક્વોલિટી બેજથી ઉપયોગ જુઓ; માત્ર સરખું લાગતું નામ કઈ ક્વોલિટી બદલાશે તેનો પુરાવો નથી."
    },
    "rateAndTrend": {
      "title": "પાછલા નોંધેલા ભાવથી તફાવત જુઓ",
      "description": "વર્તમાન ભાવ ₹/કિગ્રામાં છે. બેજ અગાઉ નોંધેલી કિંમત સાથે સરખાવે છે: ₹200થી ₹220 એટલે +₹20 (+10%). શરૂઆતનો રેટ એટલે સરખામણી માટે અગાઉની કિંમત નથી."
    },
    "reviewStatusBadge": {
      "title": "ભાવ અને {reviewDate} અલગ રાખો",
      "description": "{advancedEdit}માં {effectiveDate} ભાવ ક્યારથી લાગુ છે તે બતાવે છે; {reviewDate} તમે ક્યારે ચકાસ્યો તે બતાવે છે. {reviewEvery} તેનાથી આગલું રિમાઇન્ડર નક્કી કરે છે. આ તારીખો જૂનાં કોસ્ટિંગ બદલતી નથી કે ભવિષ્યમાં ભાવ બદલવાનો સમય નક્કી કરતી નથી."
    },
    "linkedQualitiesPopover": {
      "title": "જોડાયેલી ક્વોલિટી તપાસો",
      "description": "ભાવ બદલતાં પહેલાં ક્વોલિટી બેજ ખોલીને ઉપયોગ જુઓ. ઉદાહરણ: “Polyester 75D” વાપરતી ક્વોલિટી માટે યાર્નનું નામ મળવું જોઈએ. ઉપયોગ ન દેખાય તો સેવ કરેલી ક્વોલિટીમાં દોરો તપાસો; માત્ર રેટ ઉમેરવાથી રેસિપી જોડાતી નથી."
    },
    "quickReviewAction": {
      "title": "ચકાસેલા ભાવની જ પુષ્ટિ કરો",
      "description": "સપ્લાયરનો ભાવ ન બદલાયો હોય તો પંક્તિની સમીક્ષા ક્રિયાથી પુષ્ટિ કરો; કિંમત બદલાશે નહીં. બધાને વર્તમાન તરીકે પુષ્ટિ કરો બધા બાકી રેટ પર લાગુ પડે છે, તેથી પહેલાં દરેક ભાવ તપાસો. રેટ સમીક્ષાથી બાકી યાદી ખોલો."
    },
    "quickEditAction": {
      "title": "સપ્લાયરનો નવો ભાવ નોંધો",
      "description": "માત્ર ઉદાહરણ: સપ્લાયરનો ભાવ ₹200/કિગ્રાથી ₹220/કિગ્રા થયો. {editRate} ખોલો, 220 અને સ્રોતની નોંધ દાખલ કરો, પછી {saveRate} પસંદ કરો. +₹20 (+10%) તમારા નોંધેલા ભાવનો તફાવત છે, લાઇવ બજારનું વલણ નહીં."
    },
    "quickEditPopover": {
      "title": "ઇનલાઇન ભાવ અને ટ્રેન્ડ પૂર્વાવલોકન",
      "description": "નવો ₹/કિલો રેટ દાખલ કરો, ત્વરિત ટ્રેન્ડ જુઓ, બ્રોકર નોટ ઉમેરો અને એક ક્લિકમાં સેવ કરો."
    },
    "addRateAction": {
      "title": "નવો યાર્ન રેટ ઉમેરો",
      "description": "કેટલોગમાં નવા દોરા ઉમેરવા, તેમની સમીક્ષા અવધિ અને સપ્લાયર વિગતો નોંધવા માટે Add Yarn Rate પર ક્લિક કરો."
    },
    "rateDrawerFields": {
      "title": "{advancedEdit}માં પૂરી વિગતો જુઓ",
      "description": "{advancedEdit}માં તારીખો, સ્રોત, નોંધો અને {reviewEvery} (30–365 દિવસ) છે. હાલના યાર્નનું નામ લોક છે; નવું નામ જોઈએ તો નવો રેટ ઉમેરીને સેવ કરેલી ક્વોલિટી બદલો. શોધનો સ્રોત મૂળ ક્વોલિટી કે કોસ્ટિંગ સાથે જોડાયેલો રહે છે."
    },
    "reviewRailWidget": {
      "title": "મળેલા દોરા અને જુદા ભાવ તપાસો",
      "description": "ક્વોલિટી કે કોસ્ટિંગ સેવ કરવાથી નવો યાર્ન સમીક્ષા માટે મળી શકે છે. જુદા ભાવ મળે તો વર્તમાન ભાવ પસંદ કરતાં પહેલાં તેમના ઉપયોગ જુઓ. આ તમારા રેકોર્ડમાંથી મળેલી માહિતી છે, સપ્લાયરની પુષ્ટિ નહીં."
    },
    "activityAndArchive": {
      "title": "દોરો દૂર કરતી વખતે ઇતિહાસ રાખો",
      "description": "પંક્તિ મેનૂની {activity}માં નોંધેલા ભાવ અને સમીક્ષાઓ જુઓ. {archiveRate} દોરાને સક્રિય યાદીમાંથી દૂર કરે છે; સેવ કરેલી ક્વોલિટી અને જૂનાં કોસ્ટિંગ બદલાતાં નથી. {archivedRates}માં તેને શોધીને {restoreRate} પસંદ કરો."
    }
  },
  "helpTitle": "રેટ બુક સહાય: સમીક્ષા, ભાવનો તફાવત અને જાળવણી",
  "principles": [
    "રેટ સેવ કરતાં જોડાયેલી સેવ કરેલી ક્વોલિટીના મળતા યાર્ન ભાવ આગળના અંદાજ માટે બદલાય છે.",
    "જૂનાં કોસ્ટિંગ સ્નેપશોટ મૂળ આંકડા જ રાખે છે.",
    "સેવ કરેલી ક્વોલિટી કે કોસ્ટિંગમાંથી મળેલા યાર્નનો ભાવ સપ્લાયર પાસે ચકાસવો જરૂરી છે."
  ]
}

export type RatebookTutorialCopy = typeof en
export type RatebookTutorialField = keyof typeof en.fields

export const rateBookTutorialCopy: Record<Language, RatebookTutorialCopy> = { en, hi, gu }

export function isRatebookTutorialField(field: string): field is RatebookTutorialField {
  return Object.prototype.hasOwnProperty.call(en.fields, field)
}
