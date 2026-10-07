import type { Language } from './context'
import type { ProductionOverviewTourStep } from '../production-tour'
import { formatTourText } from '../tours/tour-text'

type StepCopy = { title: string; body: string; detail?: string }
type OverviewCopyKey = 'overview' | 'prereq' | 'activate' | 'looms' | 'handoff'
type ProductionCopy = Record<OverviewCopyKey, StepCopy> & {
    guide: { benefit: string }

}

/** Approved Production §F copy; native Gujarati/Hindi review remains pending. */
export const productionTutorialCopy: Record<Language, ProductionCopy> = {
    "en": {
        "overview": {
            "title": "From costing to daily production",
            "body": "Here a saved costing becomes a quality running on your looms. Metres recorded each shift then add fabric stock and worker pay."
        },
        "prereq": {
            "title": "Four things must exist first",
            "body": "A saved costing, stock of every yarn in it, your machines, and your workers. A quality cannot start while any of its yarns has no stock.",
            "detail": "Costings come from the Cost Estimator, yarn from Yarn Stock, and machines and workers from their own pages."
        },
        "activate": {
            "title": "Activate a quality with its wage",
            "body": "{c:activateQuality} picks a saved costing version and the weaver wage per metre, here ₹2/m. The wage is what workers earn on this quality.",
            "detail": "If a yarn has no stock, Weavly asks you to add it before the quality can start."
        },
        "looms": {
            "title": "Put the quality on looms",
            "body": "{c:assignLooms} ticks the looms that will weave it. A loom weaves one quality at a time."
        },
        "handoff": {
            "title": "Start your first quality",
            "body": "Choose {c:activateQuality} to put a quality on your looms. Then record each shift's metres on the Daily Sheet."
        },
        "guide": {
            "benefit": "See how to put a saved costing on your looms and get ready to record production."
        }
    },
    "gu": {
        "overview": {
            "title": "કોસ્ટિંગથી રોજિંદા ઉત્પાદન સુધી",
            "body": "અહીં સાચવેલી કોસ્ટિંગ તમારા લૂમ પર ચાલતી ક્વોલિટી બને છે. પછી દરેક શિફ્ટમાં નોંધાયેલા મીટર કાપડનો સ્ટોક અને કારીગરનો પગાર ઉમેરે છે."
        },
        "prereq": {
            "title": "પહેલાં આ ચાર વસ્તુ જોઈએ",
            "body": "સાચવેલી કોસ્ટિંગ, તેમાંના દરેક યાર્નનો સ્ટોક, તમારાં મશીનો અને તમારા કારીગરો. કોઈ યાર્નનો સ્ટોક ન હોય ત્યાં સુધી ક્વોલિટી શરૂ ન થાય.",
            "detail": "કોસ્ટિંગ ખર્ચ અંદાજકમાંથી, યાર્ન યાર્નના સ્ટોકમાંથી, અને મશીનો તથા કારીગરો તેમના પોતાના પેજમાંથી આવે છે."
        },
        "activate": {
            "title": "મજૂરી સાથે ક્વોલિટી ચાલુ કરો",
            "body": "{c:activateQuality} સાચવેલી કોસ્ટિંગનું વર્ઝન અને મીટરદીઠ મજૂરી પસંદ કરે છે, અહીં ₹2/મીટર. આ ક્વોલિટી પર કારીગરો આ મજૂરી કમાય છે.",
            "detail": "કોઈ યાર્નનો સ્ટોક ન હોય તો ક્વોલિટી શરૂ થાય તે પહેલાં Weavly તે ઉમેરવાનું કહે છે."
        },
        "looms": {
            "title": "ક્વોલિટીને લૂમ પર મૂકો",
            "body": "{c:assignLooms} તેને વણનારા લૂમ પર ટિક કરે છે. એક લૂમ એક વખતે એક જ ક્વોલિટી વણે છે."
        },
        "handoff": {
            "title": "તમારી પહેલી ક્વોલિટી શરૂ કરો",
            "body": "તમારા લૂમ પર ક્વોલિટી મૂકવા {c:activateQuality} પસંદ કરો. પછી દરેક શિફ્ટના મીટર દૈનિક શીટમાં નોંધો."
        },
        "guide": {
            "benefit": "સાચવેલી કોસ્ટિંગને લૂમ પર મૂકવી અને ઉત્પાદન નોંધવાની તૈયારી કેવી રીતે કરવી તે જુઓ."
        }
    },
    "hi": {
        "overview": {
            "title": "कॉस्टिंग से रोज़ के उत्पादन तक",
            "body": "यहाँ सेव की गई कॉस्टिंग आपके लूम पर चलती क्वालिटी बनती है। फिर हर शिफ्ट में दर्ज मीटर कपड़े का स्टॉक और कारीगर का वेतन जोड़ते हैं।"
        },
        "prereq": {
            "title": "पहले ये चार चीज़ें चाहिए",
            "body": "सेव की गई कॉस्टिंग, उसके हर धागे का स्टॉक, आपकी मशीनें और आपके कारीगर। किसी धागे का स्टॉक न हो तो क्वालिटी शुरू नहीं होती।",
            "detail": "कॉस्टिंग लागत अनुमानक से, धागा धागे के स्टॉक से, और मशीनें व कारीगर अपने-अपने पेज से आते हैं।"
        },
        "activate": {
            "title": "मजदूरी के साथ क्वालिटी चालू करें",
            "body": "{c:activateQuality} सेव कॉस्टिंग का वर्ज़न और प्रति मीटर मजदूरी चुनता है, यहाँ ₹2/मीटर। इस क्वालिटी पर कारीगर यही मजदूरी कमाते हैं।",
            "detail": "किसी धागे का स्टॉक न हो तो क्वालिटी शुरू होने से पहले Weavly उसे जोड़ने को कहता है।"
        },
        "looms": {
            "title": "क्वालिटी को लूम पर लगाएँ",
            "body": "{c:assignLooms} उसे बुनने वाले लूम पर टिक करता है। एक लूम एक बार में एक ही क्वालिटी बुनता है।"
        },
        "handoff": {
            "title": "अपनी पहली क्वालिटी शुरू करें",
            "body": "अपने लूम पर क्वालिटी लगाने के लिए {c:activateQuality} चुनें। फिर हर शिफ्ट के मीटर दैनिक शीट में दर्ज करें।"
        },
        "guide": {
            "benefit": "सेव कॉस्टिंग को लूम पर लगाना और उत्पादन दर्ज करने की तैयारी करना देखें।"
        }
    }
}

/** The same keys as the existing Overview live controls. */
export function productionTourControlLabels(t: (key: string) => string) {
    return {
        activateQuality: t('production.activateQuality'), assignLooms: t('production.assignLooms'),
    }
}

export function productionStepCopy(language: Language, step: ProductionOverviewTourStep, controls: Record<string, string>) {
    const source = productionTutorialCopy[language][step.slice(3) as OverviewCopyKey]
    const format = (text: string) => formatTourText(text.replace(/\{c:[^}]+\}/g, token => `“${token}”`), controls)
    return {
        title: format(source.title), body: format(source.body),
        ...(source.detail ? { detail: format(source.detail) } : {}),
    }
}
