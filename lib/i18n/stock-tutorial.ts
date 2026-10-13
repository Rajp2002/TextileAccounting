import type { Language } from './context'
import type { FabricStockTourStep, YarnStockTourStep } from '../stock-tour'
import { yarnStockText } from './yarn-stock'
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
type YarnCopyKey = YarnStockTourStep extends `ys-${infer Key}` ? Key : never
type YarnStepCopy = { title: string; body: string; detail?: string }
type YarnCopy = Record<YarnCopyKey, YarnStepCopy> & { guide: { benefit: string } }

/** Approved Yarn page-spec §F copy; Gujarati/Hindi native review remains pending. */
export const yarnStockTutorialCopy: Record<Language, YarnCopy> = {
    "en": {
        "balance": {
            "title": "Unused yarn, by yarn",
            "body": "This is yarn on hand that has not been woven yet, in kg. Here 100 kg.",
            "detail": "Yarn already woven into fabric that is still in your stock is not lost. {c:auditInventory} adds it back from each quality's kg per 100 m, so you see all the yarn you own."
        },
        "opening": {
            "title": "Record the yarn you already have",
            "body": "{c:openingWeight} records each yarn's weight once, when you start: here 100 kg."
        },
        "receipt": {
            "title": "Add each new delivery",
            "body": "{c:addYarn} adds a delivery to that yarn: 100 + 20 = 120 kg."
        },
        "link": {
            "title": "Link each fabric to its costing",
            "body": "{c:linkCosting} copies the kg of each yarn per 100 m from a saved costing. Here warp 6 + weft 4 = 10 kg per 100 m."
        },
        "usage": {
            "title": "Saving production uses yarn",
            "body": "When a shift of 200 m is saved, 20 kg is deducted (200 × 10 ÷ 100). Dispatch does not deduct yarn again.",
            "detail": "Those 20 kg now sit inside the 200 m of fabric until it is dispatched; the Stock audit still counts them as your yarn."
        },
        "correct": {
            "title": "After weighing, enter the weighed total",
            "body": "{c:correctBalance} replaces the balance with what you weighed. Enter 98, not −2.",
            "detail": "{c:movementHistory} shows every change. Pick a date to see balances on that day and export them. Use {c:correctBalance} for regular weighing; for a full dated audit of fabric and yarn, kept as a record, use {c:auditInventory}."
        },
        "handoff": {
            "title": "Record the yarn in your godown",
            "body": "Start with each yarn's opening weight, then link your fabric costings so production can deduct yarn."
        },
        "guide": {
            "benefit": "Learn to record yarn, link it to costings and follow what production uses."
        }
    },
    "gu": {
        "balance": {
            "title": "વણવપરાયેલું યાર્ન, યાર્ન પ્રમાણે",
            "body": "આ હાથ પરનું હજી વણાયું ન હોય તેવું યાર્ન છે, કિલોમાં. અહીં 100 કિલો.",
            "detail": "સ્ટોકમાં પડેલા કાપડમાં વણાઈ ગયેલું યાર્ન ખોવાતું નથી. {c:auditInventory} દરેક ક્વોલિટીના 100 મીટરે કિલો પ્રમાણે તે પાછું ઉમેરે છે, જેથી તમારી પાસેનું બધું યાર્ન દેખાય."
        },
        "opening": {
            "title": "તમારી પાસેનું યાર્ન નોંધો",
            "body": "{c:openingWeight} શરૂઆતમાં દરેક યાર્નનું વજન એક વાર નોંધે છે: અહીં 100 કિલો."
        },
        "receipt": {
            "title": "દરેક નવી આવક ઉમેરો",
            "body": "{c:addYarn} તે યાર્નમાં આવક ઉમેરે છે: 100 + 20 = 120 કિલો."
        },
        "link": {
            "title": "દરેક કાપડને તેની કોસ્ટિંગ સાથે જોડો",
            "body": "{c:linkCosting} સાચવેલી કોસ્ટિંગમાંથી 100 મીટરે દરેક યાર્નના કિલો લે છે. અહીં તાણા 6 + ભરણ 4 = 100 મીટરે 10 કિલો."
        },
        "usage": {
            "title": "ઉત્પાદન સાચવવાથી યાર્ન વપરાય છે",
            "body": "200 મીટરની શિફ્ટ સાચવતાં 20 કિલો ઘટે છે (200 × 10 ÷ 100). ડિસ્પેચ ફરી યાર્ન ઘટાડતું નથી.",
            "detail": "એ 20 કિલો ડિસ્પેચ થાય ત્યાં સુધી 200 મીટર કાપડમાં રહે છે; સ્ટોક ઓડિટ તેને હજી તમારું યાર્ન ગણે છે."
        },
        "correct": {
            "title": "વજન કર્યા પછી કુલ વજન લખો",
            "body": "{c:correctBalance} બેલેન્સને તમે તોલેલા વજનથી બદલે છે. 98 લખો, −2 નહીં.",
            "detail": "{c:movementHistory}માં દરેક ફેરફાર દેખાય છે. તારીખ પસંદ કરી તે દિવસનું બેલેન્સ જોઈ એક્સપોર્ટ કરી શકો. નિયમિત વજન માટે {c:correctBalance} વાપરો; કાપડ અને યાર્નનું તારીખ સાથેનું પૂરું ઓડિટ રેકોર્ડ તરીકે રાખવા {c:auditInventory} વાપરો."
        },
        "handoff": {
            "title": "ગોડાઉનનું યાર્ન નોંધો",
            "body": "દરેક યાર્નના શરૂઆતના વજનથી શરૂ કરો, પછી કાપડની કોસ્ટિંગ જોડો જેથી ઉત્પાદન યાર્ન ઘટાડી શકે."
        },
        "guide": {
            "benefit": "યાર્ન નોંધવું, કોસ્ટિંગ સાથે જોડવું અને ઉત્પાદનમાં વપરાશ જોવો શીખો."
        }
    },
    "hi": {
        "balance": {
            "title": "बिना इस्तेमाल धागा, धागे के अनुसार",
            "body": "यह हाथ में पड़ा, अभी न बुना गया धागा है, किलो में। यहाँ 100 किलो।",
            "detail": "स्टॉक में पड़े कपड़े में बुना जा चुका धागा खोता नहीं। {c:auditInventory} हर क्वालिटी के 100 मीटर पर किलो के हिसाब से उसे वापस जोड़ता है, ताकि आपके पास का सारा धागा दिखे।"
        },
        "opening": {
            "title": "आपके पास पड़ा धागा दर्ज करें",
            "body": "{c:openingWeight} शुरुआत में हर धागे का वज़न एक बार दर्ज करता है: यहाँ 100 किलो।"
        },
        "receipt": {
            "title": "हर नई आवक जोड़ें",
            "body": "{c:addYarn} उस धागे में आवक जोड़ता है: 100 + 20 = 120 किलो।"
        },
        "link": {
            "title": "हर कपड़े को उसकी कॉस्टिंग से जोड़ें",
            "body": "{c:linkCosting} सेव कॉस्टिंग से 100 मीटर पर हर धागे के किलो लेता है। यहाँ ताना 6 + बाना 4 = 100 मीटर पर 10 किलो।"
        },
        "usage": {
            "title": "उत्पादन सेव करने से धागा लगता है",
            "body": "200 मीटर की शिफ्ट सेव होने पर 20 किलो घटता है (200 × 10 ÷ 100)। डिस्पैच दोबारा धागा नहीं घटाता।",
            "detail": "वे 20 किलो डिस्पैच होने तक 200 मीटर कपड़े में रहते हैं; स्टॉक ऑडिट उन्हें अब भी आपका धागा गिनता है।"
        },
        "correct": {
            "title": "तौलने के बाद कुल वज़न लिखें",
            "body": "{c:correctBalance} बैलेंस को आपके तौले वज़न से बदलता है। 98 लिखें, −2 नहीं।",
            "detail": "{c:movementHistory} में हर बदलाव दिखता है। तारीख चुनकर उस दिन का बैलेंस देख और एक्सपोर्ट कर सकते हैं। नियमित तौल के लिए {c:correctBalance} इस्तेमाल करें; कपड़े और धागे का तारीख के साथ पूरा ऑडिट रिकॉर्ड के रूप में रखने के लिए {c:auditInventory} इस्तेमाल करें।"
        },
        "handoff": {
            "title": "गोदाम का धागा दर्ज करें",
            "body": "हर धागे के शुरुआती वज़न से शुरू करें, फिर कपड़े की कॉस्टिंग जोड़ें ताकि उत्पादन धागा घटा सके।"
        },
        "guide": {
            "benefit": "धागा दर्ज करना, कॉस्टिंग से जोड़ना और उत्पादन में खपत देखना सीखें।"
        }
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

export function yarnStockTourControlLabels(language: Language, t: (key: string) => string) {
    const text = yarnStockText[language]
    return {
        openingWeight: text.opening,
        addYarn: text.receipt,
        linkCosting: text.link,
        correctBalance: text.correction,
        movementHistory: text.history,
        auditInventory: t('qualityStock.audit'),
    }
}

export function yarnStockStepCopy(language: Language, step: YarnStockTourStep, controls: Record<string, string>) {
    const copy = yarnStockTutorialCopy[language][step.slice(3) as YarnCopyKey]
    const format = (text: string) => formatTourText(text.replace(/\{c:[^}]+\}/g, token => `“${token}”`), controls)
    return {
        title: format(copy.title),
        body: format(copy.body),
        ...(copy.detail ? { detail: format(copy.detail) } : {}),
    }
}
