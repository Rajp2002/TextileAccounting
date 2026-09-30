import type { Language } from './context'
import type { SavedCostingEnding, SavedCostingStep } from '@/lib/saved-costings-tour'
import { formatTourText } from '@/lib/tours/tour-text'

const en = {
  "find.title": "Every saved costing is a fixed record",
  "find.body": "Each card is one quality. Its versions keep the inputs and prices from the day you saved them; later yarn rates never change them.",
  "versions.title": "Open the version you mean",
  "versions.body": "Open a quality card to see its versions. Choose {c:viewBreakdown} next to a date to read that version.",
  "versions.detail": "A quality with only one version opens it directly. Archived versions stay under {c:archived}.",
  "economics.title": "Read cost, price and profit",
  "economics.body": "In sample v2, production cost is ₹{cost}/m and the selling price is ₹{price}/m, so you keep ₹{profit} on every metre.",
  "economics.detail": "These numbers come from the inputs saved with v2, not from today's rates. Open the breakdown above them to see yarn, weaving and overhead separately.",
  "reuse.title": "Reuse a version or start a new quality",
  "reuse.body": "{c:use} opens this version in the Cost Estimator so you can change it and save a new version. {c:duplicate} starts a separate quality from it.",
  "reuse.detail": "If the estimator already has unsaved work, Weavly asks before replacing it. Neither button changes this saved version.",
  "internal.title": "Choose who will see the document",
  "internal.body": "{c:internalEstimate} shows your costs and margin. {c:customerQuotation} shows only the price and your terms.",
  "internal.detail": "Previewing sends nothing. After you create a customer PDF you can share it from your phone.",
  "production.title": "Send a version to production",
  "production.body": "{c:activateForProduction} opens Production with this version ready to activate. Nothing is produced until you assign looms and record a shift.",
  "handoff.existing.title": "Open one of your costings",
  "handoff.existing.body": "Choose a quality card to check its latest version before you quote or reuse it.",
  "handoff.empty.title": "Save your first costing",
  "handoff.empty.body": "Choose {c:newCosting} to open the Cost Estimator. Your costing appears here after you save it.",
  "handoff.unavailable.title": "Your list didn't load",
  "handoff.unavailable.body": "Refresh the page to see your saved costings, or choose {c:newCosting} to start a new one.",
  "free.snapshots.title": "Each Free costing is kept here",
  "free.snapshots.body": "Every costing you calculate and save appears here as a fixed record. Opening or exporting it does not use your monthly allowance.",
  "free.snapshots.detail": "Free keeps one version per costing. Paid plans add versions, comparison and reuse.",
  "free.open.title": "Export a costing sheet",
  "free.open.body": "{c:export} on a card opens its cost per metre and selling price as a document you can print or save.",
  "free.handoff.existing.title": "Open one of your costings",
  "free.handoff.existing.body": "Choose a card to check its numbers before you give a price.",
  "free.handoff.empty.title": "Calculate your first costing",
  "free.handoff.empty.body": "Choose {c:newCosting} to open the Cost Estimator. Saved costings appear here.",
  "compare.select.title": "Pick two versions of one quality",
  "compare.select.body": "Turn on {c:compare}, open a quality and tick two versions. Then choose {c:compareCostings}.",
  "compare.result.title": "See what changed",
  "compare.result.body": "Old, New and Change show every figure side by side. Here v2 costs ₹{costChange}/m more than v1.",
  "compare.details.title": "Find the input that caused it",
  "compare.details.body": "Open the calculation details to see which input moved, such as a yarn rate or the weaving charge.",
  "compare.handoff.title": "Compare your own versions",
  "compare.handoff.body": "Choose {c:compare} to start. You need two saved versions of the same quality."
}
type CopyKey = keyof typeof en
const gu: Record<CopyKey, string> = {
  "find.title": "દરેક સાચવેલી કોસ્ટિંગ એક પાકો રેકોર્ડ છે",
  "find.body": "દરેક કાર્ડ એક ક્વોલિટી છે. તેના વર્ઝનમાં સાચવ્યા દિવસના ઇનપુટ અને ભાવ રહે છે; પછીના યાર્નના ભાવ તેને બદલતા નથી.",
  "versions.title": "તમને જોઈતું વર્ઝન ખોલો",
  "versions.body": "વર્ઝન જોવા ક્વોલિટી કાર્ડ ખોલો. તારીખની બાજુમાં {c:viewBreakdown} પસંદ કરીને તે વર્ઝન વાંચો.",
  "versions.detail": "એક જ વર્ઝન હોય તો તે સીધું ખૂલે છે. આર્કાઇવ કરેલા વર્ઝન {c:archived}માં રહે છે.",
  "economics.title": "ખર્ચ, ભાવ અને નફો વાંચો",
  "economics.body": "નમૂના v2માં ઉત્પાદન ખર્ચ ₹{cost}/મીટર અને વેચાણ ભાવ ₹{price}/મીટર છે, એટલે દરેક મીટરે ₹{profit} નફો રહે છે.",
  "economics.detail": "આ આંકડા v2 સાથે સાચવેલા ઇનપુટમાંથી આવે છે, આજના ભાવમાંથી નહીં. યાર્ન, વીવિંગ અને ઓવરહેડ અલગ જોવા ઉપરની વિગત ખોલો.",
  "reuse.title": "વર્ઝન ફરી વાપરો કે નવી ક્વોલિટી શરૂ કરો",
  "reuse.body": "{c:use} આ વર્ઝનને ખર્ચ અંદાજકમાં ખોલે છે, જેથી ફેરફાર કરી નવું વર્ઝન સાચવી શકો. {c:duplicate} તેમાંથી અલગ ક્વોલિટી શરૂ કરે છે.",
  "reuse.detail": "અંદાજકમાં સાચવ્યા વગરનું કામ હોય તો બદલતાં પહેલાં Weavly પૂછે છે. કોઈ બટન આ સાચવેલું વર્ઝન બદલતું નથી.",
  "internal.title": "દસ્તાવેજ કોણ જોશે તે પસંદ કરો",
  "internal.body": "{c:internalEstimate}માં તમારો ખર્ચ અને માર્જિન દેખાય છે. {c:customerQuotation}માં ફક્ત ભાવ અને તમારી શરતો દેખાય છે.",
  "internal.detail": "પ્રીવ્યૂ કરવાથી કંઈ મોકલાતું નથી. ગ્રાહક PDF બનાવ્યા પછી તમે તેને ફોનમાંથી મોકલી શકો છો.",
  "production.title": "વર્ઝનને ઉત્પાદનમાં મોકલો",
  "production.body": "{c:activateForProduction} ઉત્પાદન ખોલે છે અને આ વર્ઝન ચાલુ કરવા તૈયાર રાખે છે. લૂમ ફાળવી શિફ્ટ નોંધો ત્યાં સુધી કંઈ ઉત્પાદન થતું નથી.",
  "handoff.existing.title": "તમારી એક કોસ્ટિંગ ખોલો",
  "handoff.existing.body": "ભાવ આપતાં કે ફરી વાપરતાં પહેલાં ક્વોલિટી કાર્ડ ખોલી તેનું છેલ્લું વર્ઝન તપાસો.",
  "handoff.empty.title": "તમારી પહેલી કોસ્ટિંગ સાચવો",
  "handoff.empty.body": "ખર્ચ અંદાજક ખોલવા {c:newCosting} પસંદ કરો. સાચવ્યા પછી તમારી કોસ્ટિંગ અહીં દેખાશે.",
  "handoff.unavailable.title": "તમારી યાદી લોડ થઈ નથી",
  "handoff.unavailable.body": "સાચવેલી કોસ્ટિંગ જોવા પેજ રિફ્રેશ કરો, અથવા નવી શરૂ કરવા {c:newCosting} પસંદ કરો.",
  "free.snapshots.title": "દરેક Free કોસ્ટિંગ અહીં રહે છે",
  "free.snapshots.body": "તમે ગણેલી અને સાચવેલી દરેક કોસ્ટિંગ અહીં પાકા રેકોર્ડ તરીકે દેખાય છે. તેને ખોલવા કે એક્સપોર્ટ કરવાથી માસિક મર્યાદા વપરાતી નથી.",
  "free.snapshots.detail": "Free માં દરેક કોસ્ટિંગનું એક જ વર્ઝન રહે છે. પેઇડ પ્લાનમાં વર્ઝન, સરખામણી અને ફરી ઉપયોગ મળે છે.",
  "free.open.title": "કોસ્ટિંગ શીટ એક્સપોર્ટ કરો",
  "free.open.body": "કાર્ડ પરનું {c:export} તેનો પ્રતિ મીટર ખર્ચ અને વેચાણ ભાવ છાપી કે સાચવી શકાય તેવા દસ્તાવેજમાં ખોલે છે.",
  "free.handoff.existing.title": "તમારી એક કોસ્ટિંગ ખોલો",
  "free.handoff.existing.body": "ભાવ આપતાં પહેલાં કાર્ડ ખોલી તેના આંકડા તપાસો.",
  "free.handoff.empty.title": "તમારી પહેલી કોસ્ટિંગ ગણો",
  "free.handoff.empty.body": "ખર્ચ અંદાજક ખોલવા {c:newCosting} પસંદ કરો. સાચવેલી કોસ્ટિંગ અહીં દેખાશે.",
  "compare.select.title": "એક ક્વોલિટીના બે વર્ઝન પસંદ કરો",
  "compare.select.body": "{c:compare} ચાલુ કરો, ક્વોલિટી ખોલો અને બે વર્ઝન પર ટિક કરો. પછી {c:compareCostings} પસંદ કરો.",
  "compare.result.title": "શું બદલાયું તે જુઓ",
  "compare.result.body": "જૂનું, નવું અને ફેરફાર દરેક આંકડો બાજુબાજુમાં બતાવે છે. અહીં v2 નો ખર્ચ v1 કરતાં ₹{costChange}/મીટર વધુ છે.",
  "compare.details.title": "ફેરફારનું કારણ બનેલો ઇનપુટ શોધો",
  "compare.details.body": "કયો ઇનપુટ બદલાયો, જેમ કે યાર્નનો ભાવ કે વીવિંગ ચાર્જ, તે જોવા ગણતરીની વિગત ખોલો.",
  "compare.handoff.title": "તમારા પોતાના વર્ઝનની સરખામણી કરો",
  "compare.handoff.body": "શરૂ કરવા {c:compare} પસંદ કરો. એક જ ક્વોલિટીના બે સાચવેલા વર્ઝન જોઈએ."
}
const hi: Record<CopyKey, string> = {
  "find.title": "हर सेव की गई कॉस्टिंग एक पक्का रिकॉर्ड है",
  "find.body": "हर कार्ड एक क्वालिटी है। उसके वर्ज़न में सेव करने वाले दिन के इनपुट और भाव रहते हैं; बाद के धागे के रेट उन्हें नहीं बदलते।",
  "versions.title": "जो वर्ज़न चाहिए, उसे खोलें",
  "versions.body": "वर्ज़न देखने के लिए क्वालिटी कार्ड खोलें। तारीख के पास {c:viewBreakdown} चुनकर वह वर्ज़न पढ़ें।",
  "versions.detail": "एक ही वर्ज़न हो तो वह सीधे खुलता है। आर्काइव किए वर्ज़न {c:archived} में रहते हैं।",
  "economics.title": "लागत, भाव और मुनाफ़ा पढ़ें",
  "economics.body": "नमूना v2 में उत्पादन लागत ₹{cost}/मीटर और बिक्री भाव ₹{price}/मीटर है, यानी हर मीटर पर ₹{profit} मुनाफ़ा बचता है।",
  "economics.detail": "ये आँकड़े v2 के साथ सेव इनपुट से आते हैं, आज के रेट से नहीं। धागा, बुनाई और ओवरहेड अलग देखने के लिए ऊपर का विवरण खोलें।",
  "reuse.title": "वर्ज़न दोबारा इस्तेमाल करें या नई क्वालिटी शुरू करें",
  "reuse.body": "{c:use} इस वर्ज़न को लागत अनुमानक में खोलता है, ताकि आप बदलाव करके नया वर्ज़न सेव कर सकें। {c:duplicate} इससे अलग क्वालिटी शुरू करता है।",
  "reuse.detail": "अनुमानक में बिना सेव किया काम हो तो बदलने से पहले Weavly पूछता है। कोई भी बटन इस सेव वर्ज़न को नहीं बदलता।",
  "internal.title": "दस्तावेज़ कौन देखेगा, यह चुनें",
  "internal.body": "{c:internalEstimate} में आपकी लागत और मार्जिन दिखता है। {c:customerQuotation} में सिर्फ़ भाव और आपकी शर्तें दिखती हैं।",
  "internal.detail": "प्रीव्यू करने से कुछ नहीं भेजा जाता। ग्राहक PDF बनाने के बाद आप उसे फ़ोन से भेज सकते हैं।",
  "production.title": "वर्ज़न को उत्पादन में भेजें",
  "production.body": "{c:activateForProduction} उत्पादन खोलता है और यह वर्ज़न चालू करने के लिए तैयार रखता है। लूम देकर शिफ्ट दर्ज करने तक कुछ उत्पादन नहीं होता।",
  "handoff.existing.title": "अपनी एक कॉस्टिंग खोलें",
  "handoff.existing.body": "भाव देने या दोबारा इस्तेमाल से पहले क्वालिटी कार्ड खोलकर उसका आख़िरी वर्ज़न जाँचें।",
  "handoff.empty.title": "अपनी पहली कॉस्टिंग सेव करें",
  "handoff.empty.body": "लागत अनुमानक खोलने के लिए {c:newCosting} चुनें। सेव करने के बाद आपकी कॉस्टिंग यहाँ दिखेगी।",
  "handoff.unavailable.title": "आपकी सूची लोड नहीं हुई",
  "handoff.unavailable.body": "सेव की गई कॉस्टिंग देखने के लिए पेज रीफ़्रेश करें, या नई शुरू करने के लिए {c:newCosting} चुनें।",
  "free.snapshots.title": "हर Free कॉस्टिंग यहाँ रहती है",
  "free.snapshots.body": "आपकी गिनी और सेव की गई हर कॉस्टिंग यहाँ पक्के रिकॉर्ड के रूप में दिखती है। उसे खोलने या एक्सपोर्ट करने से मासिक सीमा खर्च नहीं होती।",
  "free.snapshots.detail": "Free में हर कॉस्टिंग का एक ही वर्ज़न रहता है। पेड प्लान में वर्ज़न, तुलना और दोबारा इस्तेमाल मिलता है।",
  "free.open.title": "कॉस्टिंग शीट एक्सपोर्ट करें",
  "free.open.body": "कार्ड पर {c:export} उसकी प्रति मीटर लागत और बिक्री भाव को ऐसे दस्तावेज़ में खोलता है जिसे आप छाप या सेव कर सकते हैं।",
  "free.handoff.existing.title": "अपनी एक कॉस्टिंग खोलें",
  "free.handoff.existing.body": "भाव देने से पहले कार्ड खोलकर उसके आँकड़े जाँचें।",
  "free.handoff.empty.title": "अपनी पहली कॉस्टिंग गिनें",
  "free.handoff.empty.body": "लागत अनुमानक खोलने के लिए {c:newCosting} चुनें। सेव की गई कॉस्टिंग यहाँ दिखेंगी।",
  "compare.select.title": "एक क्वालिटी के दो वर्ज़न चुनें",
  "compare.select.body": "{c:compare} चालू करें, क्वालिटी खोलें और दो वर्ज़न पर टिक करें। फिर {c:compareCostings} चुनें।",
  "compare.result.title": "देखें क्या बदला",
  "compare.result.body": "पुराना, नया और बदलाव हर आँकड़ा साथ-साथ दिखाते हैं। यहाँ v2 की लागत v1 से ₹{costChange}/मीटर ज़्यादा है।",
  "compare.details.title": "बदलाव की वजह बना इनपुट खोजें",
  "compare.details.body": "कौन सा इनपुट बदला, जैसे धागे का रेट या बुनाई शुल्क, यह देखने के लिए गणना का विवरण खोलें।",
  "compare.handoff.title": "अपने वर्ज़न की तुलना करें",
  "compare.handoff.body": "शुरू करने के लिए {c:compare} चुनें। एक ही क्वालिटी के दो सेव वर्ज़न चाहिए।"
}
export const savedCostingsTutorialCopy: Record<Language, Record<CopyKey, string>> = { en, gu, hi }

/** Resolve the same keys/calls used by the live controls. */
export function savedCostingControlLabels(t: (key: string) => string, tx: (text: string) => string, free = false) {
    return {
        viewBreakdown: tx('View breakdown'), archived: t('tourControls.savedCostings.archived'),
        use: t('tourControls.savedCostings.use'), duplicate: tx('Duplicate'),
        internalEstimate: tx('Internal Cost Estimate'), customerQuotation: tx('Customer Quotation'),
        activateForProduction: tx('Activate for Production'), newCosting: free ? tx('New Costing') : t('common.new_costing'),
        export: tx('Export'), compare: tx('Compare'), compareCostings: t('common.compare_costings'),
    }
}

export function savedCostingStepCopy(language: Language, step: SavedCostingStep, options: {
    free: boolean; ending: SavedCostingEnding; controls: Record<string, string>; values: Record<string, string>
}) {
    const key = step === 'finish'
        ? options.free && options.ending !== 'unavailable' ? `free.handoff.${options.ending}` : `handoff.${options.ending}`
        : ({ snapshots: 'free.snapshots', freeSelect: 'free.open', compareSelect: 'compare.select', comparison: 'compare.result', comparisonDetails: 'compare.details', compareHandoff: 'compare.handoff' } as Partial<Record<SavedCostingStep, string>>)[step] ?? step
    const copy = savedCostingsTutorialCopy[language]
    const text = (suffix: string) => {
        const raw = copy[`${key}.${suffix}` as CopyKey]
        return raw ? formatTourText(raw.replace(/\{c:[^}]+\}/g, token => `“${token}”`), options.controls, options.values) : undefined
    }
    return { title: text('title')!, body: text('body')!, detail: text('detail'), unavailable: step === 'finish' || step === 'compareHandoff' ? text('body') : undefined }
}
