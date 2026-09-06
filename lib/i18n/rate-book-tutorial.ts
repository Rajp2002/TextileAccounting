import type { Language } from './context'

// Explicit copy: never infer a tutorial title from potentially untranslated DOM labels.
const en = {
  "sections": [
    "Search & filters",
    "Yarn rate row",
    "Rate details & trends",
    "Fast inline actions",
    "Full rate editor",
    "Review rail & audit"
  ],
  "sectionProgress": "Section {current} of {total}",
  "replay": "How Rate Book works · Guided tour",
  "skip": "Skip tour",
  "back": "Back",
  "next": "Next",
  "finish": "Finish",
  "progress": "Tutorial progress",
  "hint": "Take a look first. You can manage and update your rates after the tour.",
  "syncFailed": "Tutorial dismissed. We couldn’t save this to your account yet.",
  "retry": "Retry saving preference",
  "fields": {
    "overview": {
      "title": "Yarn Rate Book Overview",
      "description": "Your centralized pricing catalog for yarn market rates. Every new fabric estimate and quotation pulls current yarn rates directly from here."
    },
    "immutabilityNotice": {
      "title": "Pricing Safety & Immutability",
      "description": "Rate updates only affect newly created quotes. Your existing costings, saved quality recipes, and historical order records stay 100% locked and audit-safe."
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
      "title": "Instant Search (/)",
      "description": "Quickly find yarns by name (e.g. 30/1000 MUALTI), count/denier, broker name, purchase source, or any saved fabric quality that uses them. Press / anytime to focus."
    },
    "directionFilter": {
      "title": "Warp & Weft Direction Filters",
      "description": "Filter by All, Warp, or Weft with real-time counters to focus on specific yarn varieties during price reviews."
    },
    "needsReviewFilter": {
      "title": "Needs Review Filter",
      "description": "Instantly filters to yarns where the review interval has lapsed or newly discovered rates were imported from fabric recipes."
    },
    "confirmAll": {
      "title": "Confirm All as Current",
      "description": "When multiple rates are due for verification, click Confirm All to instantly verify every pending price in a single click without opening individual forms."
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
      "title": "Yarn Identity & Defaults",
      "description": "Displays the standardized yarn name and direction. Items marked as 'Default for new costings' pre-populate automatically in new fabric calculations."
    },
    "rateAndTrend": {
      "title": "Current Rate & Price Trend",
      "description": "Displays the current rate in ₹/kg. The trend badge displays the rupee and percentage difference compared to the previous recorded price."
    },
    "reviewStatusBadge": {
      "title": "Review Urgency & Effective Date",
      "description": "Color-coded badges (Needs Review, Overdue, Due Soon, Current) highlight review status alongside the date this price took effect."
    },
    "linkedQualitiesPopover": {
      "title": "Linked Fabric Qualities",
      "description": "Click the qualities badge to see every saved fabric recipe that depends on this yarn. Know exactly which products are impacted before updating prices."
    },
    "quickReviewAction": {
      "title": "1-Click Rate Confirmation",
      "description": "If the current supplier price has not changed, click Confirm to record a verified review and reset the reminder clock without opening any forms."
    },
    "quickEditAction": {
      "title": "Quick Inline Rate Editor",
      "description": "Click Edit rate to open a compact popover right in the table row. Update prices in seconds without leaving your list."
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
      "title": "Full Rate Details & Rename Policy",
      "description": "Manage name, category, rate, supplier source, and review intervals (30 to 365 days). Once a yarn is linked to fabric recipes, its name is locked to preserve formula integrity."
    },
    "reviewRailWidget": {
      "title": "Proactive Review Monitor",
      "description": "The review rail keeps pending rate reviews visible and provides quick access to the batch review workflow whenever supplier prices change."
    },
    "activityAndArchive": {
      "title": "Audit History & Soft Archival",
      "description": "Inspect complete price change logs with Surat timestamps and user attribution. Inactive rates can be soft-archived to protect quotation integrity."
    }
  }
}

const hi: typeof en = {
  "sections": [
    "खोज और फ़िल्टर",
    "यार्न रेट पंक्ति",
    "रेट विवरण और रुझान",
    "त्वरित इनलाइन कार्य",
    "विस्तृत रेट संपादक",
    "रिव्यू रेल और ऑडिट"
  ],
  "sectionProgress": "अनुभाग {current} का {total}",
  "replay": "रेट बुक कैसे काम करता है · गाइडेड टूर",
  "skip": "टूर छोड़ें",
  "back": "पीछे",
  "next": "आगे",
  "finish": "समाप्त",
  "progress": "ट्यूटोरियल प्रगति",
  "hint": "पहले देख लें। टूर समाप्त होने के बाद आप अपने रेट्स अपडेट कर सकते हैं।",
  "syncFailed": "टूर बंद हुआ। आपकी प्राथमिकता अभी खाते में सुरक्षित नहीं हो सकी।",
  "retry": "पुनः प्रयास करें",
  "fields": {
    "overview": {
      "title": "यार्न रेट बुक परिचय",
      "description": "यार्न (धागे) के बाज़ार भाव की आपकी केंद्रीय कैटलॉग। हर नए कपड़े की लागत और कोटेशन सीधे यहीं से वर्तमान रेट्स लेते हैं।"
    },
    "immutabilityNotice": {
      "title": "मूल्य सुरक्षा और अपरिवर्तनीयता",
      "description": "रेट अपडेट केवल नए कोटेशन को प्रभावित करते हैं। आपकी पुरानी लागत गणनाएं और सेव की गई क्वालिटी रेसिपी पूरी तरह सुरक्षित और अपरिवर्तित रहती हैं।"
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
      "title": "त्वरित खोज (/)",
      "description": "धागे के नाम (जैसे 30/1000 MUALTI), काउंट/डेनियर, ब्रोकर या सप्लायर के नाम से तुरंत खोजें। खोजने के लिए कभी भी / दबाएं।"
    },
    "directionFilter": {
      "title": "ताना (Warp) और बाना (Weft) फ़िल्टर",
      "description": "रेट समीक्षा के दौरान विशिष्ट धागों पर ध्यान केंद्रित करने के लिए All, Warp या Weft फ़िल्टर का उपयोग करें।"
    },
    "needsReviewFilter": {
      "title": "समीक्षा योग्य (Needs Review) फ़िल्टर",
      "description": "उन धागों को तुरंत अलग करें जिनकी समीक्षा की तारीख बीत चुकी है या जो नई फैब्रिक क्वालिटी से सिस्टम में आए हैं।"
    },
    "confirmAll": {
      "title": "सभी की वर्तमान के रूप में पुष्टि करें",
      "description": "जब कई रेट्स की समीक्षा बाकी हो, तो अलग-अलग फॉर्म खोले बिना एक ही क्लिक में सभी लंबित भावों की एक साथ पुष्टि करने के लिए Confirm All दबाएं।"
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
      "title": "धागे का विवरण और डिफ़ॉल्ट",
      "description": "धागे का नाम और प्रकार देखें। 'Default for new costings' वाले धागे नए कपड़े की गणना में अपने-आप चुने जाते हैं।"
    },
    "rateAndTrend": {
      "title": "वर्तमान रेट और मूल्य रुझान",
      "description": "वर्तमान रेट ₹/किग्रा में देखें। ट्रेंड बैज पिछले रिकॉर्ड किए गए भाव की तुलना में रुपए और प्रतिशत का अंतर दिखाता है।"
    },
    "reviewStatusBadge": {
      "title": "समीक्षा स्थिति और प्रभावी तिथि",
      "description": "रंग-कोडित बैज (Needs Review, Overdue, Due Soon, Current) समीक्षा की तात्कालिकता और मूल्य लागू होने की तारीख दिखाते हैं।"
    },
    "linkedQualitiesPopover": {
      "title": "जुड़ी हुई फैब्रिक क्वालिटीज़",
      "description": "क्वालिटी बैज पर क्लिक करके देखें कि कौन-से कपड़े इस धागे का उपयोग करते हैं, ताकि रेट बदलने से पहले प्रभाव का पता रहे।"
    },
    "quickReviewAction": {
      "title": "1-क्लिक रेट पुष्टि",
      "description": "यदि सप्लायर का रेट नहीं बदला है, तो बिना कोई फॉर्म खोले पुष्टि करने और रिमाइंडर घड़ी रीसेट करने के लिए Confirm दबाएं।"
    },
    "quickEditAction": {
      "title": "त्वरित इनलाइन रेट संपादक",
      "description": "टेबल में सीधे कॉम्पैक्ट पॉपओवर खोलने के लिए Edit rate दबाएं। बिना सूची छोड़े कुछ ही सेकंड में रेट अपडेट करें।"
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
      "title": "पूर्ण विवरण और नाम सुरक्षा नियम",
      "description": "नाम, श्रेणी, रेट, स्रोत और समीक्षा अवधि (30 से 365 दिन) प्रबंधित करें। रेसिपी से जुड़े धागे का नाम फॉर्मूला सुरक्षा के लिए लॉक रहता है।"
    },
    "reviewRailWidget": {
      "title": "सक्रिय समीक्षा मॉनिटर",
      "description": "रिव्यू रेल लंबित समीक्षाओं पर नज़र रखता है और बाज़ार भाव बदलने पर बैच रिव्यू की त्वरित सुविधा देता है।"
    },
    "activityAndArchive": {
      "title": "ऑडिट इतिहास और सुरक्षित आर्काइव",
      "description": "सूरत टाइमस्टैम्प और उपयोगकर्ता विवरण के साथ मूल्य परिवर्तन का पूरा इतिहास देखें। अप्रयुक्त धागों को सुरक्षित रूप से आर्काइव करें।"
    }
  }
}

const gu: typeof en = {
  "sections": [
    "શોધ અને ફિલ્ટર્સ",
    "યાર્ન રેટ પંક્તિ",
    "રેટ વિગતો અને વલણો",
    "ઝડપી ઇનલાઇન ક્રિયાઓ",
    "વિગતવાર રેટ સંપાદક",
    "રિવ્યૂ રેલ અને ઓડિટ"
  ],
  "sectionProgress": "વિભાગ {current} / {total}",
  "replay": "રેટ બુક કેવી રીતે કાર્ય કરે છે · ગાઇડેડ ટૂર",
  "skip": "ટૂર છોડો",
  "back": "પાછળ",
  "next": "આગળ",
  "finish": "પૂર્ણ",
  "progress": "ટ્યુટોરિયલ પ્રગતિ",
  "hint": "પહેલાં જોઈ લો. ટૂર પૂર્ણ થયા પછી તમે તમારા રેટ્સ મેનેજ અને અપડેટ કરી શકશો.",
  "syncFailed": "ટૂર બંધ કરવામાં આવી. તમારી પસંદગી હજુ ખાતામાં સાચવી શકાઈ નથી.",
  "retry": "ફરી પ્રયાસ કરો",
  "fields": {
    "overview": {
      "title": "યાર્ન રેટ બુક પરિચય",
      "description": "યાર્ન (દોરા) ના બજાર ભાવોની તમારી કેન્દ્રીય કેટલોગ. કાપડના દરેક નવા અંદાજ અને ક્વોટેશન માટેના વર્તમાન રેટ સીધા અહીંથી લેવાય છે."
    },
    "immutabilityNotice": {
      "title": "કિંમત સુરક્ષા અને અપરિવર્તનીયતા",
      "description": "રેટ અપડેટ્સ માત્ર નવા ક્વોટેશનને અસર કરે છે. તમારા અગાઉના કોસ્ટિંગ અને સેવ કરેલી ક્વોલિટી રેસિપી સંપૂર્ણપણે સુરક્ષિત અને અપરિવર્તિત રહે છે."
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
      "title": "ત્વરિત શોધ (/)",
      "description": "દોરાના નામ (દા.ત. 30/1000 MUALTI), કાઉન્ટ/ડેનિયર, બ્રોકર કે સપ્લાયરના નામથી ઝડપથી શોધો. શોધવા માટે ગમે ત્યારે / દબાવો."
    },
    "directionFilter": {
      "title": "તાણા (Warp) અને વાણા (Weft) ફિલ્ટર્સ",
      "description": "રેટ રિવ્યૂ દરમિયાન ચોક્કસ દોરાઓ પર ધ્યાન આપવા માટે All, Warp અથવા Weft ફિલ્ટરનો ઉપયોગ કરો."
    },
    "needsReviewFilter": {
      "title": "સમીક્ષા લાયક (Needs Review) ફિલ્ટર",
      "description": "જે દોરાઓની સમીક્ષાની તારીખ વીતી ગઈ હોય અથવા નવી ક્વોલિટીમાંથી ઉમેરાયા હોય તેમને તરત અલગ તારવો."
    },
    "confirmAll": {
      "title": "બધાને વર્તમાન તરીકે પુષ્ટિ કરો",
      "description": "જ્યારે ઘણા રેટ્સની સમીક્ષા બાકી હોય, ત્યારે અલગ-અલગ ફોર્મ ખોલ્યા વિના એક જ ક્લિકમાં તમામ બાકી ભાવોની એકસાથે પુષ્ટિ કરવા માટે Confirm All દબાવો."
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
      "title": "દોરાની વિગત અને ડિફોલ્ટ",
      "description": "દોરાનું નામ અને પ્રકાર જુઓ. 'Default for new costings' વાળા દોરા નવા કાપડના હિસાબમાં આપોઆપ પસંદ થઈ જાય છે."
    },
    "rateAndTrend": {
      "title": "વર્તમાન રેટ અને ભાવ વલણ",
      "description": "વર્તમાન રેટ ₹/કિલોમાં જુઓ. ટ્રેન્ડ બેજ અગાઉ નોંધાયેલા ભાવની સરખામણીમાં રૂપિયા અને ટકાવારીનો તફાવત દર્શાવે છે."
    },
    "reviewStatusBadge": {
      "title": "સમીક્ષા સ્થિતિ અને અમલી તારીખ",
      "description": "કલર-કોડેડ બેજ (Needs Review, Overdue, Due Soon, Current) સમીક્ષાની તાકીદ અને ભાવ લાગુ થયાની તારીખ દર્શાવે છે."
    },
    "linkedQualitiesPopover": {
      "title": "જોડાયેલી ફેબ્રિક ક્વોલિટીઝ",
      "description": "ક્વોલિટી બેજ પર ક્લિક કરીને જુઓ કે કયા કાપડ આ દોરાનો ઉપયોગ કરે છે, જેથી ભાવ બદલતા પહેલાં અસરનો ખ્યાલ આવે."
    },
    "quickReviewAction": {
      "title": "1-ક્લિક રેટ પુષ્ટિ",
      "description": "જો સપ્લાયરનો રેટ બદલાયો ન હોય, તો ફોર્મ ખોલ્યા વિના પુષ્ટિ કરવા અને રિમાઇન્ડર ઘડિયાળ રીસેટ કરવા Confirm દબાવો."
    },
    "quickEditAction": {
      "title": "ઝડપી ઇનલાઇન રેટ સંપાદક",
      "description": "ટેબલની અંદર જ કોમ્પેક્ટ પોપઓવર ખોલવા Edit rate દબાવો. યાદી છોડ્યા વિના સેકન્ડોમાં રેટ અપડેટ કરો."
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
      "title": "સંપૂર્ણ વિગતો અને નામ સુરક્ષા નિયમ",
      "description": "નામ, કેટેગરી, રેટ, સ્ત્રોત અને સમીક્ષા અવધિ (30 થી 365 દિવસ) મેનેજ કરો. રેસિપી સાથે જોડાયેલા દોરાનું નામ ફોર્મ્યુલા સુરક્ષા માટે લૉક રહે છે."
    },
    "reviewRailWidget": {
      "title": "સક્રિય સમીક્ષા મોનિટર",
      "description": "રિવ્યૂ રેલ બાકી સમીક્ષાઓ પર નજર રાખે છે અને બજાર ભાવ બદલાય ત્યારે બેચ રિવ્યૂની ઝડપી સુવિધા આપે છે."
    },
    "activityAndArchive": {
      "title": "ઓડિટ ઇતિહાસ અને સુરક્ષિત આર્કાઇવ",
      "description": "સુરત ટાઇમસ્ટેમ્પ અને વપરાશકર્તા વિગતો સાથે ભાવ ફેરફારનો સંપૂર્ણ ઇતિહાસ જુઓ. બિનઉપયોગી દોરાઓને સુરક્ષિત રીતે આર્કાઇવ કરો."
    }
  }
}

export type RatebookTutorialCopy = typeof en
export type RatebookTutorialField = keyof typeof en.fields

export const rateBookTutorialCopy: Record<Language, RatebookTutorialCopy> = { en, hi, gu }

export function isRatebookTutorialField(field: string): field is RatebookTutorialField {
  return Object.prototype.hasOwnProperty.call(en.fields, field)
}
