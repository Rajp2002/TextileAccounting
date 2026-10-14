import type { Language } from './context'
import type { DailySheetTourStep } from '../daily-sheet-tour'
import { formatTourText } from '../tours/tour-text'

type StepCopy = { title: string; body: string; detail?: string }
type CopyKey = 'sheet' | 'shift' | 'reading' | 'pending' | 'earnings' | 'draft' | 'save' | 'correct'
type DailySheetCopy = Record<CopyKey, StepCopy> & { handoff: StepCopy & { empty: StepCopy }; guide: { title: string; benefit: string } }

/** Exact approved Daily Sheet §F copy, including the unchanged U-06 variant. */
export const dailySheetTutorialCopy: Record<Language, DailySheetCopy> = {
    "en": {
        "sheet": {
            "title": "One sheet for each shift",
            "body": "Each day and night shift has its own sheet listing every running loom with its quality and operator.",
            "detail": "{c:printSheet} prints the sheet so readings can be written on the floor and typed in later."
        },
        "shift": {
            "title": "Check the date and shift",
            "body": "Choose the shift you are recording. To check or fix an earlier shift, pick its date; future dates cannot be chosen.",
            "detail": "If that shift was already saved, it opens locked; {c:editSavedLog} unlocks it after you give a reason."
        },
        "reading": {
            "title": "Enter the metres woven this shift",
            "body": "Type what each loom wove in this shift, here 120 m, not the meter's running total.",
            "detail": "Enter or the down arrow moves to the next loom."
        },
        "pending": {
            "title": "Mark looms that did not run",
            "body": "A loom with no reading stays pending. Use {c:notRunning} for a loom that was stopped, so the shift is complete.",
            "detail": "A loom with no operator stays pending; assign one in Machine Assignments or save the shift as incomplete."
        },
        "earnings": {
            "title": "Check each worker's earnings",
            "body": "{c:workerReview} shows metres and pay per worker: 120 m × ₹2/m = ₹240.",
            "detail": "Mark a worker who was absent or produced nothing there, so payroll knows the shift was not missed."
        },
        "draft": {
            "title": "Until you save, it is a draft on this device",
            "body": "Readings are kept only on this phone or computer. Others do not see them and payroll does not use them yet."
        },
        "save": {
            "title": "Save the shift",
            "body": "{c:saveShift} adds 120 m to fabric stock and ₹240 to the worker's earnings.",
            "detail": "If some looms are still pending, Weavly asks whether to save the shift as incomplete."
        },
        "correct": {
            "title": "Correct a saved shift with a reason",
            "body": "{c:editSavedLog} unlocks a saved shift after you give a reason. The change and the reason stay in its history.",
            "detail": "Entries already paid in payroll cannot be changed."
        },
        "handoff": {
            "title": "Record this shift",
            "body": "Enter the first loom's metres. Save when every loom has a reading or is marked not running.",
            "empty": {
                "title": "Add workers and machines first",
                "body": "The sheet lists looms once you have machines, workers and an active quality."
            }
        },
        "guide": {
            "title": "Daily Sheet guide",
            "benefit": "See how to record a shift's metres and save them."
        }
    },
    "gu": {
        "sheet": {
            "title": "દરેક શિફ્ટ માટે એક શીટ",
            "body": "દિવસ અને રાતની દરેક શિફ્ટની પોતાની શીટ હોય છે, જેમાં દરેક ચાલુ લૂમ તેની ક્વોલિટી અને ઓપરેટર સાથે હોય છે.",
            "detail": "{c:printSheet} શીટ છાપે છે, જેથી ફ્લોર પર રીડિંગ લખી પછી અહીં ભરી શકાય."
        },
        "shift": {
            "title": "તારીખ અને શિફ્ટ તપાસો",
            "body": "તમે નોંધો છો તે શિફ્ટ પસંદ કરો. જૂની શિફ્ટ તપાસવા કે સુધારવા તેની તારીખ પસંદ કરો; આગળની તારીખ પસંદ કરી શકાતી નથી.",
            "detail": "એ શિફ્ટ પહેલેથી સાચવી હોય તો તે લૉક ખૂલે છે; કારણ આપ્યા પછી {c:editSavedLog} તેને ખોલે છે."
        },
        "reading": {
            "title": "આ શિફ્ટમાં વણાયેલા મીટર લખો",
            "body": "દરેક લૂમે આ શિફ્ટમાં જે વણ્યું તે લખો, અહીં 120 મીટર, મીટરનો ચાલુ કુલ આંકડો નહીં.",
            "detail": "Enter અથવા નીચેનો તીર આગલા લૂમ પર લઈ જાય છે."
        },
        "pending": {
            "title": "ન ચાલેલા લૂમ ચિહ્નિત કરો",
            "body": "રીડિંગ વગરનો લૂમ બાકી રહે છે. બંધ રહેલા લૂમ માટે {c:notRunning} વાપરો, જેથી શિફ્ટ પૂરી થાય.",
            "detail": "ઓપરેટર વગરનો લૂમ બાકી રહે છે; મશીન ફાળવણીમાં ઓપરેટર આપો અથવા શિફ્ટ અધૂરી તરીકે સાચવો."
        },
        "earnings": {
            "title": "દરેક કારીગરની કમાણી તપાસો",
            "body": "{c:workerReview}માં દરેક કારીગરના મીટર અને પગાર દેખાય છે: 120 મીટર × ₹2/મીટર = ₹240.",
            "detail": "ગેરહાજર કે કંઈ ન બનાવનાર કારીગરને ત્યાં ચિહ્નિત કરો, જેથી પેરોલને ખબર પડે કે શિફ્ટ ચૂકી નથી."
        },
        "draft": {
            "title": "સાચવો નહીં ત્યાં સુધી આ ઉપકરણ પર ડ્રાફ્ટ છે",
            "body": "રીડિંગ ફક્ત આ ફોન કે કમ્પ્યુટર પર રહે છે. બીજાને દેખાતાં નથી અને પેરોલ હજી વાપરતું નથી."
        },
        "save": {
            "title": "શિફ્ટ સાચવો",
            "body": "{c:saveShift} કાપડના સ્ટોકમાં 120 મીટર અને કારીગરની કમાણીમાં ₹240 ઉમેરે છે.",
            "detail": "કેટલાક લૂમ હજી બાકી હોય તો Weavly પૂછે છે કે શિફ્ટ અધૂરી તરીકે સાચવવી કે નહીં."
        },
        "correct": {
            "title": "કારણ સાથે સાચવેલી શિફ્ટ સુધારો",
            "body": "{c:editSavedLog} કારણ આપ્યા પછી સાચવેલી શિફ્ટ ખોલે છે. ફેરફાર અને કારણ તેના ઇતિહાસમાં રહે છે.",
            "detail": "પેરોલમાં ચૂકવાઈ ગયેલી નોંધો બદલી શકાતી નથી."
        },
        "handoff": {
            "title": "આ શિફ્ટ નોંધો",
            "body": "પહેલા લૂમના મીટર લખો. દરેક લૂમનું રીડિંગ થાય કે બંધ ચિહ્નિત થાય એટલે સાચવો.",
            "empty": {
                "title": "પહેલાં કારીગરો અને મશીનો ઉમેરો",
                "body": "મશીનો, કારીગરો અને ચાલુ ક્વોલિટી હોય એટલે શીટમાં લૂમ દેખાય છે."
            }
        },
        "guide": {
            "title": "દૈનિક શીટ માર્ગદર્શિકા",
            "benefit": "શિફ્ટના મીટર નોંધીને કેવી રીતે સાચવવા તે જુઓ."
        }
    },
    "hi": {
        "sheet": {
            "title": "हर शिफ्ट के लिए एक शीट",
            "body": "दिन और रात की हर शिफ्ट की अपनी शीट होती है, जिसमें हर चालू लूम अपनी क्वालिटी और ऑपरेटर के साथ होता है।",
            "detail": "{c:printSheet} शीट छापता है, ताकि फ़्लोर पर रीडिंग लिखकर बाद में यहाँ भरी जा सके।"
        },
        "shift": {
            "title": "तारीख और शिफ्ट जाँचें",
            "body": "आप जो शिफ्ट दर्ज कर रहे हैं, उसे चुनें। पुरानी शिफ्ट जाँचने या सुधारने के लिए उसकी तारीख चुनें; आगे की तारीख नहीं चुनी जा सकती।",
            "detail": "वह शिफ्ट पहले सेव हो चुकी हो तो लॉक खुलती है; कारण देने के बाद {c:editSavedLog} उसे खोलता है।"
        },
        "reading": {
            "title": "इस शिफ्ट में बुने मीटर लिखें",
            "body": "हर लूम ने इस शिफ्ट में जो बुना वह लिखें, यहाँ 120 मीटर, मीटर का चालू कुल नहीं।",
            "detail": "Enter या नीचे का तीर अगले लूम पर ले जाता है।"
        },
        "pending": {
            "title": "न चले लूम चिह्नित करें",
            "body": "बिना रीडिंग का लूम बाकी रहता है। बंद रहे लूम के लिए {c:notRunning} इस्तेमाल करें, ताकि शिफ्ट पूरी हो।",
            "detail": "बिना ऑपरेटर का लूम बाकी रहता है; मशीन आवंटन में ऑपरेटर दें या शिफ्ट अधूरी के रूप में सेव करें।"
        },
        "earnings": {
            "title": "हर कारीगर की कमाई जाँचें",
            "body": "{c:workerReview} में हर कारीगर के मीटर और वेतन दिखते हैं: 120 मीटर × ₹2/मीटर = ₹240।",
            "detail": "ग़ैरहाज़िर या कुछ न बनाने वाले कारीगर को वहाँ चिह्नित करें, ताकि पेरोल को पता रहे कि शिफ्ट छूटी नहीं।"
        },
        "draft": {
            "title": "सेव करने तक यह इस डिवाइस पर ड्राफ्ट है",
            "body": "रीडिंग सिर्फ़ इस फ़ोन या कंप्यूटर पर रहती हैं। दूसरों को नहीं दिखतीं और पेरोल अभी इस्तेमाल नहीं करता।"
        },
        "save": {
            "title": "शिफ्ट सेव करें",
            "body": "{c:saveShift} कपड़े के स्टॉक में 120 मीटर और कारीगर की कमाई में ₹240 जोड़ता है।",
            "detail": "कुछ लूम अभी बाकी हों तो Weavly पूछता है कि शिफ्ट अधूरी के रूप में सेव करें या नहीं।"
        },
        "correct": {
            "title": "कारण के साथ सेव शिफ्ट सुधारें",
            "body": "{c:editSavedLog} कारण देने के बाद सेव शिफ्ट खोलता है। बदलाव और कारण उसके इतिहास में रहते हैं।",
            "detail": "पेरोल में भुगतान हो चुकी एंट्री बदली नहीं जा सकती।"
        },
        "handoff": {
            "title": "यह शिफ्ट दर्ज करें",
            "body": "पहले लूम के मीटर लिखें। हर लूम की रीडिंग हो जाए या बंद चिह्नित हो जाए, तब सेव करें।",
            "empty": {
                "title": "पहले कारीगर और मशीनें जोड़ें",
                "body": "मशीनें, कारीगर और चालू क्वालिटी होने पर शीट में लूम दिखते हैं।"
            }
        },
        "guide": {
            "title": "दैनिक शीट मार्गदर्शिका",
            "benefit": "शिफ्ट के मीटर दर्ज करके सेव करना देखें।"
        }
    }
}

export function dailySheetTourControlLabels(t: (key: string) => string) {
    return { printSheet: t('dailySheet.printSheet'), notRunning: t('dailySheet.notRunning'), workerReview: t('dailySheet.workerReview'), saveShift: t('dailySheet.saveShift'), editSavedLog: t('dailySheet.editSavedLog') }
}

export function dailySheetStepCopy(language: Language, step: DailySheetTourStep, controls: Record<string, string>, empty = false) {
    const source = step === 'ds-handoff' ? empty ? dailySheetTutorialCopy[language].handoff.empty : dailySheetTutorialCopy[language].handoff : dailySheetTutorialCopy[language][step.slice(3) as CopyKey]
    const format = (text: string) => formatTourText(text.replace(/\{c:[^}]+\}/g, token => `“${token}”`), controls)
    return { title: format(source.title), body: format(source.body), ...(source.detail ? { detail: format(source.detail) } : {}) }
}
