import type { Language } from './context'
import type { FabricStockTourStep } from '../stock-tour'
import { formatTourText } from '../tours/tour-text'
type FabricCopyKey = FabricStockTourStep extends `fs-${infer Key}` ? Key : never
type FabricStepCopy = { title: string; body: string; detail?: string }
type FabricCopy = Record<FabricCopyKey, FabricStepCopy> & { guide: { benefit: string }; sample: string }

/** Approved Fabric page-spec §F copy; Gujarati/Hindi native review remains pending. */
export const fabricStockTutorialCopy: Record<Language, FabricCopy> = {
    "en": {
        "balance": {
            "title": "Fabric ready to send, by quality",
            "body": "Saved shifts add metres and confirmed dispatches remove them. Here 200 m made − 100 m sent = 100 m."
        },
        "pending": {
            "title": "Add the fabric you had before Weavly",
            "body": "A quality marked {c:pending} has no opening stock yet. Count the finished fabric you already had and record it once."
        },
        "opening": {
            "title": "Opening stock is added once",
            "body": "{c:openingStock} adds the counted metres to what production already recorded: 100 + 500 = 600 m. Add a note such as your count date."
        },
        "correct": {
            "title": "After a count, enter the counted total",
            "body": "{c:correctBalance} replaces the balance with what you counted. Enter 590, not −10; Weavly records the −10 m difference.",
            "detail": "Use this for every count. Weavly keeps the difference in the stock history."
        },
        "history": {
            "title": "Trace every change",
            "body": "{c:movementHistory} lists each production, dispatch, opening and correction with the balance after it.",
            "detail": "If a shift was saved on another device, choose {c:refresh} to see it."
        },
        "handoff": {
            "title": "Record fabric you already have",
            "body": "If you had finished fabric before using Weavly, record it here once. From now on, saved shifts add stock by themselves."
        },
        "guide": {
            "benefit": "Learn to record opening fabric, correct a count and trace changes."
        },
        "sample": "Sample preview · your stock is unchanged"
    },
    "gu": {
        "balance": {
            "title": "મોકલવા તૈયાર કાપડ, ક્વોલિટી પ્રમાણે",
            "body": "સાચવેલી શિફ્ટ મીટર ઉમેરે છે અને ખાતરી કરેલા ડિસ્પેચ ઘટાડે છે. અહીં 200 મીટર બન્યું − 100 મીટર ગયું = 100 મીટર."
        },
        "pending": {
            "title": "Weavly પહેલાંનું કાપડ ઉમેરો",
            "body": "{c:pending} લખેલી ક્વોલિટીનો શરૂઆતનો સ્ટોક હજી નોંધાયો નથી. તમારી પાસે પહેલેથી હતું તે તૈયાર કાપડ ગણી એક વાર નોંધો."
        },
        "opening": {
            "title": "શરૂઆતનો સ્ટોક એક જ વાર ઉમેરાય છે",
            "body": "{c:openingStock} ગણેલા મીટર ઉત્પાદનમાં નોંધાયેલા મીટરમાં ઉમેરે છે: 100 + 500 = 600 મીટર. ગણતરીની તારીખ જેવી નોંધ લખો."
        },
        "correct": {
            "title": "ગણતરી પછી ગણેલો કુલ જથ્થો લખો",
            "body": "{c:correctBalance} બેલેન્સને ગણેલા જથ્થાથી બદલે છે. 590 લખો, −10 નહીં; Weavly −10 મીટરનો ફરક નોંધે છે.",
            "detail": "દરેક ગણતરી માટે આ જ વાપરો. Weavly ફરક સ્ટોકના ઇતિહાસમાં રાખે છે."
        },
        "history": {
            "title": "દરેક ફેરફાર તપાસો",
            "body": "{c:movementHistory}માં દરેક ઉત્પાદન, ડિસ્પેચ, શરૂઆતનો સ્ટોક અને સુધારો, પછીના બેલેન્સ સાથે દેખાય છે.",
            "detail": "બીજા ઉપકરણ પર શિફ્ટ સાચવી હોય તો જોવા {c:refresh} પસંદ કરો."
        },
        "handoff": {
            "title": "તમારી પાસેનું કાપડ નોંધો",
            "body": "Weavly વાપરતાં પહેલાં તૈયાર કાપડ હતું તો તેને અહીં એક વાર નોંધો. હવેથી સાચવેલી શિફ્ટ જાતે સ્ટોક ઉમેરશે."
        },
        "guide": {
            "benefit": "શરૂઆતનું કાપડ નોંધવું, ગણતરી સુધારવી અને ફેરફાર તપાસવા શીખો."
        },
        "sample": "નમૂનો · તમારો સ્ટોક બદલાતો નથી"
    },
    "hi": {
        "balance": {
            "title": "भेजने को तैयार कपड़ा, क्वालिटी के अनुसार",
            "body": "सेव शिफ्ट मीटर जोड़ती हैं और पुष्टि किए डिस्पैच घटाते हैं। यहाँ 200 मीटर बना − 100 मीटर गया = 100 मीटर।"
        },
        "pending": {
            "title": "Weavly से पहले का कपड़ा जोड़ें",
            "body": "{c:pending} लिखी क्वालिटी का शुरुआती स्टॉक अभी दर्ज नहीं है। आपके पास पहले से पड़ा तैयार कपड़ा गिनकर एक बार दर्ज करें।"
        },
        "opening": {
            "title": "शुरुआती स्टॉक एक ही बार जुड़ता है",
            "body": "{c:openingStock} गिने हुए मीटर उत्पादन में दर्ज मीटर में जोड़ता है: 100 + 500 = 600 मीटर। गिनती की तारीख जैसा नोट लिखें।"
        },
        "correct": {
            "title": "गिनती के बाद गिना हुआ कुल लिखें",
            "body": "{c:correctBalance} बैलेंस को गिनी हुई मात्रा से बदलता है। 590 लिखें, −10 नहीं; Weavly −10 मीटर का फ़र्क दर्ज करता है।",
            "detail": "हर गिनती के लिए यही इस्तेमाल करें। Weavly फ़र्क स्टॉक के इतिहास में रखता है।"
        },
        "history": {
            "title": "हर बदलाव देखें",
            "body": "{c:movementHistory} में हर उत्पादन, डिस्पैच, शुरुआती स्टॉक और सुधार, उसके बाद के बैलेंस के साथ दिखता है।",
            "detail": "किसी दूसरे डिवाइस पर शिफ्ट सेव हुई हो तो देखने के लिए {c:refresh} चुनें।"
        },
        "handoff": {
            "title": "आपके पास पड़ा कपड़ा दर्ज करें",
            "body": "Weavly इस्तेमाल करने से पहले तैयार कपड़ा था तो उसे यहाँ एक बार दर्ज करें। अब से सेव शिफ्ट खुद स्टॉक जोड़ेंगी।"
        },
        "guide": {
            "benefit": "शुरुआती कपड़ा दर्ज करना, गिनती सुधारना और बदलाव देखना सीखें।"
        },
        "sample": "नमूना · आपका स्टॉक नहीं बदलता"
    }
}

export const fabricStockPreviewCopy = {
  "en": {
    "quality": "Sample fabric",
    "countReference": "Verified pre-start count",
    "correctionReference": "Physical count: 590 m",
  },
  "gu": {
    "quality": "નમૂના કાપડ",
    "countReference": "ચકાસેલી શરૂઆત પહેલાંની ગણતરી",
    "correctionReference": "ભૌતિક ગણતરી: 590 મી",
  },
  "hi": {
    "quality": "नमूना कपड़ा",
    "countReference": "सत्यापित शुरुआती गिनती",
    "correctionReference": "भौतिक गिनती: 590 मी",
  }
}

export function fabricStockTourControlLabels(t: (key: string) => string) {
    return {
        pending: t('qualityStock.pending'),
        openingStock: t('qualityStock.opening'),
        correctBalance: t('qualityStock.correct'),
        movementHistory: t('qualityStock.history'),
        refresh: t('qualityStock.refresh'),
    }
}

export function fabricStockStepCopy(language: Language, step: FabricStockTourStep, controls: Record<string, string>) {
    const copy = fabricStockTutorialCopy[language][step.slice(3) as FabricCopyKey]
    const format = (text: string) => formatTourText(text.replace(/\{c:[^}]+\}/g, token => `“${token}”`), controls)
    return {
        title: format(copy.title),
        body: format(copy.body),
        ...(copy.detail ? { detail: format(copy.detail) } : {}),
    }
}
