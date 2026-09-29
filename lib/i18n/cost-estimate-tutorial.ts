import type { Language } from './context'
import type { EstimatorTourStep } from '../estimator-tour'
import { formatTourText } from '../tours/tour-text'

const en = {
    "purpose.title": "Work out cost and price per metre",
    "purpose.body": "Fill the sections from top to bottom; the price updates as you type. Start with the fabric's name.",
    "purpose.detail.paid": "To start from a quality you saved before, choose {c:changeQuality} at the top.",
    "warp.title": "Warp yarn: denier, ends and rate",
    "warp.body": "For each warp yarn enter its denier, total ends and price per kg. Weavly works out the kg used per 100 m and its cost per metre.",
    "warp.detail": "Waste and crimp increase the yarn used; GST is added to the rate. If you know the kg per 100 m, switch the row to manual kg.",
    "warp.detail.paid": "Rates filled from your Yarn Rate Book are marked until you confirm them.",
    "weft.title": "Weft yarn: picks and width",
    "weft.body": "For each weft yarn enter picks per inch, the finished width and its price per kg. Weft use depends on these, not on ends.",
    "weaving.title": "Weaving charge",
    "weaving.body": "Enter what weaving costs you, either per metre or in paisa per pick.",
    "warping.title": "Warping and sizing",
    "warping.body": "Add these charges if you pay for them, in-house or outside. Count each charge once, not again in overhead.",
    "overhead.title": "Factory overhead per metre",
    "overhead.body": "Enter your overhead per metre, or divide monthly expenses by monthly production: ₹60,000 ÷ 30,000 m = ₹2/m.",
    "pricing.title": "Margin, commission and transport",
    "pricing.body": "Set the margin you want and any broker commission and transport. The suggested price includes all three.",
    "live.title": "Read the result",
    "live.body.paid": "{c:liveCost} shows production cost and the suggested price per metre. A cost of ₹100/m at 20% margin gives ₹125/m.",
    "live.body.free": "{c:liveCost} lists what is still missing. On Free, the cost and price appear after you calculate and save.",
    "save.title.paid": "Save a fixed costing",
    "save.body.paid": "{c:saveCosting} keeps today's inputs and price in Saved Costings. {c:saveQuality} also keeps the recipe to reuse later.",
    "save.detail.paid": "Saving again later creates a new version; the earlier one stays as it was.",
    "save.detail.base": "After saving, {c:startProduction} opens Production with this costing ready to activate.",
    "save.title.free": "Calculating and saving uses one costing",
    "save.body.free": "{c:calculateSave} shows your result and keeps it in Saved Costings. Each time uses one of your monthly Free costings.",
    "save.detail.free": "Check every section first; the guide itself never uses a costing.",
    "handoff.title": "Start with your fabric's name",
    "handoff.body": "Type the quality name, then work down the sections. {c:detailed} view shows every input if you need more control.",
    "guide.benefit": "See how to work out a fabric's cost and selling price."
}
type CopyKey = keyof typeof en
const gu: Record<CopyKey, string> = {
    "purpose.title": "પ્રતિ મીટર ખર્ચ અને ભાવ ગણો",
    "purpose.body": "ઉપરથી નીચે વિભાગો ભરો; લખતાં જ ભાવ બદલાય છે. શરૂઆત કાપડના નામથી કરો.",
    "purpose.detail.paid": "પહેલાં સાચવેલી ક્વોલિટીથી શરૂ કરવા ઉપર {c:changeQuality} પસંદ કરો.",
    "warp.title": "તાણા: ડેનિયર, તાર અને ભાવ",
    "warp.body": "દરેક તાણા યાર્ન માટે ડેનિયર, કુલ તાર અને કિલોનો ભાવ લખો. Weavly 100 મીટરે કેટલા કિલો વપરાય અને મીટરદીઠ ખર્ચ ગણે છે.",
    "warp.detail": "વેસ્ટ અને ક્રિમ્પથી વપરાતું યાર્ન વધે છે; ભાવમાં GST ઉમેરાય છે. 100 મીટરે કિલો ખબર હોય તો લાઇન મેન્યુઅલ કિલોમાં ફેરવો.",
    "warp.detail.paid": "તમારી યાર્ન રેટ બુકમાંથી ભરાયેલા ભાવ તમે ખાતરી ન કરો ત્યાં સુધી ચિહ્નિત રહે છે.",
    "weft.title": "ભરણ: પિક્સ અને પહોળાઈ",
    "weft.body": "દરેક ભરણ યાર્ન માટે ઇંચદીઠ પિક્સ, તૈયાર પહોળાઈ અને કિલોનો ભાવ લખો. ભરણનો વપરાશ આના પર આધાર રાખે છે, તાર પર નહીં.",
    "weaving.title": "વીવિંગ ચાર્જ",
    "weaving.body": "વીવિંગનો ખર્ચ મીટરદીઠ અથવા પિકદીઠ પૈસામાં લખો.",
    "warping.title": "વૉર્પિંગ અને સાઇઝિંગ",
    "warping.body": "આ ચાર્જ તમે ચૂકવતા હો તો ઉમેરો, ઘરમાં કે બહાર. દરેક ચાર્જ એક જ વાર ગણો, ફરી ઓવરહેડમાં નહીં.",
    "overhead.title": "મીટરદીઠ ફેક્ટરી ઓવરહેડ",
    "overhead.body": "મીટરદીઠ ઓવરહેડ લખો, અથવા માસિક ખર્ચને માસિક ઉત્પાદનથી ભાગો: ₹60,000 ÷ 30,000 મીટર = ₹2/મીટર.",
    "pricing.title": "માર્જિન, દલાલી અને ભાડું",
    "pricing.body": "તમારે જોઈતું માર્જિન અને દલાલી તથા ભાડું લખો. સૂચવેલા ભાવમાં ત્રણેય આવી જાય છે.",
    "live.title": "પરિણામ વાંચો",
    "live.body.paid": "{c:liveCost}માં ઉત્પાદન ખર્ચ અને સૂચવેલો મીટરદીઠ ભાવ દેખાય છે. ₹100/મીટર ખર્ચ પર 20% માર્જિનથી ₹125/મીટર થાય.",
    "live.body.free": "{c:liveCost}માં હજી ખૂટતું શું છે તે દેખાય છે. Free માં ગણતરી કરી સાચવ્યા પછી ખર્ચ અને ભાવ દેખાય છે.",
    "save.title.paid": "પાકી કોસ્ટિંગ સાચવો",
    "save.body.paid": "{c:saveCosting} આજના ઇનપુટ અને ભાવ સાચવેલી કોસ્ટિંગમાં રાખે છે. {c:saveQuality} રેસીપી પણ પછી વાપરવા રાખે છે.",
    "save.detail.paid": "પછી ફરી સાચવવાથી નવું વર્ઝન બને છે; પહેલાનું જેમ હતું તેમ રહે છે.",
    "save.detail.base": "સાચવ્યા પછી {c:startProduction} ઉત્પાદન ખોલે છે અને આ કોસ્ટિંગ ચાલુ કરવા તૈયાર રાખે છે.",
    "save.title.free": "ગણતરી કરી સાચવવાથી એક કોસ્ટિંગ વપરાય છે",
    "save.body.free": "{c:calculateSave} તમારું પરિણામ બતાવે છે અને સાચવેલી કોસ્ટિંગમાં રાખે છે. દરેક વખતે તમારી માસિક Free કોસ્ટિંગમાંથી એક વપરાય છે.",
    "save.detail.free": "પહેલાં દરેક વિભાગ તપાસો; આ માર્ગદર્શિકા પોતે કોઈ કોસ્ટિંગ વાપરતી નથી.",
    "handoff.title": "તમારા કાપડના નામથી શરૂ કરો",
    "handoff.body": "ક્વોલિટીનું નામ લખો, પછી નીચેના વિભાગો ભરો. વધુ નિયંત્રણ જોઈએ તો {c:detailed} વ્યૂમાં દરેક ઇનપુટ દેખાય છે.",
    "guide.benefit": "કાપડનો ખર્ચ અને વેચાણ ભાવ કેવી રીતે ગણવો તે જુઓ."
}
const hi: Record<CopyKey, string> = {
    "purpose.title": "प्रति मीटर लागत और भाव निकालें",
    "purpose.body": "ऊपर से नीचे हिस्से भरें; लिखते ही भाव बदलता है। शुरुआत कपड़े के नाम से करें।",
    "purpose.detail.paid": "पहले सेव की गई क्वालिटी से शुरू करने के लिए ऊपर {c:changeQuality} चुनें।",
    "warp.title": "ताना: डेनियर, तार और रेट",
    "warp.body": "हर ताना धागे का डेनियर, कुल तार और किलो का रेट लिखें। Weavly 100 मीटर में लगने वाले किलो और मीटर की लागत निकालता है।",
    "warp.detail": "वेस्ट और क्रिम्प से लगने वाला धागा बढ़ता है; रेट में GST जुड़ता है। 100 मीटर के किलो पता हों तो लाइन को मैनुअल किलो पर करें।",
    "warp.detail.paid": "आपकी यार्न रेट बुक से भरे रेट आपके पुष्टि करने तक चिह्नित रहते हैं।",
    "weft.title": "बाना: पिक्स और चौड़ाई",
    "weft.body": "हर बाना धागे के लिए प्रति इंच पिक्स, तैयार चौड़ाई और किलो का रेट लिखें। बाने की खपत इन पर निर्भर है, तार पर नहीं।",
    "weaving.title": "बुनाई शुल्क",
    "weaving.body": "बुनाई की लागत प्रति मीटर या प्रति पिक पैसे में लिखें।",
    "warping.title": "वार्पिंग और साइज़िंग",
    "warping.body": "ये शुल्क आप देते हैं तो जोड़ें, अंदर या बाहर। हर शुल्क एक बार गिनें, ओवरहेड में दोबारा नहीं।",
    "overhead.title": "प्रति मीटर फैक्ट्री ओवरहेड",
    "overhead.body": "प्रति मीटर ओवरहेड लिखें, या मासिक खर्च को मासिक उत्पादन से भाग दें: ₹60,000 ÷ 30,000 मीटर = ₹2/मीटर।",
    "pricing.title": "मार्जिन, दलाली और भाड़ा",
    "pricing.body": "अपना चाहा मार्जिन और दलाली व भाड़ा लिखें। सुझाए भाव में तीनों शामिल होते हैं।",
    "live.title": "नतीजा पढ़ें",
    "live.body.paid": "{c:liveCost} में उत्पादन लागत और सुझाया गया प्रति मीटर भाव दिखता है। ₹100/मीटर लागत पर 20% मार्जिन से ₹125/मीटर बनता है।",
    "live.body.free": "{c:liveCost} में बताता है कि अभी क्या बाकी है। Free में गणना करके सेव करने के बाद लागत और भाव दिखते हैं।",
    "save.title.paid": "पक्की कॉस्टिंग सेव करें",
    "save.body.paid": "{c:saveCosting} आज के इनपुट और भाव सेव की गई कॉस्टिंग में रखता है। {c:saveQuality} रेसिपी को बाद में इस्तेमाल के लिए भी रखता है।",
    "save.detail.paid": "बाद में फिर सेव करने से नया वर्ज़न बनता है; पहला वैसा ही रहता है।",
    "save.detail.base": "सेव करने के बाद {c:startProduction} उत्पादन खोलता है और यह कॉस्टिंग चालू करने के लिए तैयार रखता है।",
    "save.title.free": "गणना करके सेव करने पर एक कॉस्टिंग लगती है",
    "save.body.free": "{c:calculateSave} आपका नतीजा दिखाता है और सेव की गई कॉस्टिंग में रखता है। हर बार आपकी मासिक Free कॉस्टिंग में से एक लगती है।",
    "save.detail.free": "पहले हर हिस्सा जाँचें; यह मार्गदर्शिका खुद कोई कॉस्टिंग नहीं लगाती।",
    "handoff.title": "अपने कपड़े के नाम से शुरू करें",
    "handoff.body": "क्वालिटी का नाम लिखें, फिर नीचे के हिस्से भरें। ज़्यादा नियंत्रण चाहिए तो {c:detailed} व्यू में हर इनपुट दिखता है।",
    "guide.benefit": "कपड़े की लागत और बिक्री भाव कैसे निकालें, यह देखें।"
}

export const costEstimateTutorialCopy = { en, gu, hi }

/** The same resolvers as the live controls; F.3 scopes only the two save labels. */
export function estimatorControlLabels(t: (key: string) => string, tx: (text: string) => string, existingCosting: boolean) {
    return {
        changeQuality: tx('Change quality'), liveCost: tx('Live cost'),
        saveCosting: existingCosting ? t('tourControls.estimator.saveNewVersion') : t('tourControls.estimator.saveCosting'),
        saveQuality: t('estimator.quality.saveQualityAndCosting'),
        calculateSave: tx('Calculate & save · uses 1 costing'), startProduction: tx('Start Production'), detailed: tx('Detailed'),
    }
}

export function estimatorStepCopy(language: Language, step: EstimatorTourStep, options: {
    freePlan: boolean; productionPipeline: boolean; controls: Record<string, string>
}) {
    const copy = costEstimateTutorialCopy[language]
    const section = step.slice(4)
    const variant = options.freePlan ? 'free' : 'paid'
    const resolve = (key: string) => {
        const text = copy[key as CopyKey]
        return text ? formatTourText(text.replace(/\{c:[^}]+\}/g, token => `“${token}”`), options.controls) : undefined
    }
    const title = resolve(section === 'save' ? `save.title.${variant}` : `${section}.title`)!
    const body = resolve(section === 'save' || section === 'live' ? `${section}.body.${variant}` : `${section}.body`)!
    const details = section === 'purpose' ? [!options.freePlan && resolve('purpose.detail.paid')]
        : section === 'warp' ? [resolve('warp.detail'), !options.freePlan && resolve('warp.detail.paid')]
        : section === 'save' ? [resolve(`save.detail.${variant}`), !options.freePlan && options.productionPipeline && resolve('save.detail.base')]
        : []
    return { title, body, detail: details.filter(Boolean).join(' ') || undefined }
}
