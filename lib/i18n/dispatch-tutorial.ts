import type { Language } from './context'
import type { DispatchTourStep } from '../dispatch-tour'
import { formatTourText } from '../tours/tour-text'

type DispatchCopyKey = Exclude<DispatchTourStep, 'parties' | 'saveDraft'> | 'customer' | 'draft'
type StepCopy = { title: string; body: string; detail?: string }
type DispatchCopy = Record<DispatchCopyKey, StepCopy> & { guide: { benefit: string } }

/** Approved page-spec §F copy; Gujarati/Hindi native review remains pending. */
export const dispatchTutorialCopy: Record<Language, DispatchCopy> = {
    "en": {
        "overview": {
            "title": "One record for goods, receipt and money",
            "body": "Each dispatch follows fabric from your stock to the customer, then what they accept and what they pay."
        },
        "quality": {
            "title": "Choose a quality that has stock",
            "body": "The list shows how many metres of each quality are in stock. Metres come from shifts saved on the Daily Sheet or opening stock."
        },
        "customer": {
            "title": "Customer, address and agreed price",
            "body": "Enter the customer and delivery details and the price per metre you agreed. You type these for each dispatch."
        },
        "lots": {
            "title": "List each lot or taka",
            "body": "Add one line per lot with its metres. Here 60 m + 40 m = 100 m, worth ₹4,000 at ₹40/m."
        },
        "draft": {
            "title": "Save a draft first",
            "body": "{c:saveDraft} keeps the challan without touching stock, so you can check it before the goods leave."
        },
        "confirm": {
            "title": "Confirm when the goods leave",
            "body": "{c:confirmLeft} locks the challan and takes 100 m out of fabric stock. Yarn was already counted when the fabric was produced.",
            "detail": "{c:print} opens the challan to print or save as PDF. A dispatch confirmed by mistake can be reversed while no money is recorded against it."
        },
        "receipt": {
            "title": "Record what the customer accepted",
            "body": "If everything arrived, use {c:receivedAsSent}. Otherwise record the metres accepted, here 98 of 100 m."
        },
        "difference": {
            "title": "A shortfall changes the bill, not stock",
            "body": "The 2 m not accepted do not return to stock. The amount due becomes ₹3,920."
        },
        "payment": {
            "title": "Record money when you receive it",
            "body": "{c:recordPayment} adds a payment. Here ₹2,000 received leaves ₹1,920 due.",
            "detail": "Charges, credits, refunds and a changed due date each have their own button on the dispatch. A wrong payment is corrected with {c:reverseEntry}."
        },
        "handoff": {
            "title": "Start a dispatch when goods are ready",
            "body": "Choose {c:newDispatch} to fill a draft. Open a dispatch in the list to record its receipt or payment."
        },
        "guide": {
            "benefit": "Learn to send fabric, record what arrived and track payment."
        }
    },
    "gu": {
        "overview": {
            "title": "માલ, પ્રાપ્તિ અને પૈસા માટે એક રેકોર્ડ",
            "body": "દરેક ડિસ્પેચ કાપડને તમારા સ્ટોકથી ગ્રાહક સુધી, પછી તે શું સ્વીકારે અને શું ચૂકવે તે સુધી નોંધે છે."
        },
        "quality": {
            "title": "સ્ટોક હોય તે ક્વોલિટી પસંદ કરો",
            "body": "યાદીમાં દરેક ક્વોલિટીના સ્ટોકમાં કેટલા મીટર છે તે દેખાય છે. મીટર દૈનિક શીટમાં સાચવેલી શિફ્ટ કે શરૂઆતના સ્ટોકમાંથી આવે છે."
        },
        "customer": {
            "title": "ગ્રાહક, સરનામું અને નક્કી થયેલો ભાવ",
            "body": "ગ્રાહક અને ડિલિવરીની વિગતો અને નક્કી થયેલો મીટરદીઠ ભાવ લખો. દરેક ડિસ્પેચમાં આ લખવાનું રહે છે."
        },
        "lots": {
            "title": "દરેક લોટ કે તાકો લખો",
            "body": "દરેક લોટ માટે તેના મીટર સાથે એક લાઇન ઉમેરો. અહીં 60 + 40 = 100 મીટર, ₹40/મીટરે ₹4,000 થાય."
        },
        "draft": {
            "title": "પહેલાં ડ્રાફ્ટ સાચવો",
            "body": "{c:saveDraft} સ્ટોકને અડ્યા વગર ચલણ રાખે છે, જેથી માલ નીકળે તે પહેલાં તપાસી શકો."
        },
        "confirm": {
            "title": "માલ નીકળે ત્યારે ખાતરી કરો",
            "body": "{c:confirmLeft} ચલણ લૉક કરે છે અને કાપડના સ્ટોકમાંથી 100 મીટર ઘટાડે છે. યાર્ન તો કાપડ બન્યું ત્યારે જ ગણાઈ ગયું હતું.",
            "detail": "{c:print} ચલણને છાપવા કે PDF તરીકે સાચવવા ખોલે છે. ભૂલથી ખાતરી કરેલો ડિસ્પેચ, તેની સામે પૈસા ન નોંધાયા હોય ત્યાં સુધી ઉલટાવી શકાય."
        },
        "receipt": {
            "title": "ગ્રાહકે શું સ્વીકાર્યું તે નોંધો",
            "body": "બધું પહોંચ્યું હોય તો {c:receivedAsSent} વાપરો. નહીં તો સ્વીકારેલા મીટર નોંધો, અહીં 100 માંથી 98."
        },
        "difference": {
            "title": "ઘટ બિલ બદલે છે, સ્ટોક નહીં",
            "body": "સ્વીકાર ન થયેલા 2 મીટર સ્ટોકમાં પાછા નથી આવતા. લેવાની રકમ ₹3,920 થાય છે."
        },
        "payment": {
            "title": "પૈસા મળે ત્યારે નોંધો",
            "body": "{c:recordPayment} ચુકવણી ઉમેરે છે. અહીં ₹2,000 મળતાં ₹1,920 બાકી રહે છે.",
            "detail": "ચાર્જ, ક્રેડિટ, રિફંડ અને બદલાયેલી છેલ્લી તારીખ માટે ડિસ્પેચ પર અલગ બટન છે. ખોટી ચુકવણી {c:reverseEntry}થી સુધરે છે."
        },
        "handoff": {
            "title": "માલ તૈયાર હોય ત્યારે ડિસ્પેચ શરૂ કરો",
            "body": "ડ્રાફ્ટ ભરવા {c:newDispatch} પસંદ કરો. પ્રાપ્તિ કે ચુકવણી નોંધવા યાદીમાંથી ડિસ્પેચ ખોલો."
        },
        "guide": {
            "benefit": "કાપડ મોકલવું, શું પહોંચ્યું તે નોંધવું અને ચુકવણી તપાસવી શીખો."
        }
    },
    "hi": {
        "overview": {
            "title": "माल, प्राप्ति और पैसे के लिए एक रिकॉर्ड",
            "body": "हर डिस्पैच कपड़े को आपके स्टॉक से ग्राहक तक, फिर वह क्या स्वीकारता है और क्या चुकाता है, तक दर्ज करता है।"
        },
        "quality": {
            "title": "जिस क्वालिटी का स्टॉक हो, उसे चुनें",
            "body": "सूची में हर क्वालिटी के स्टॉक के मीटर दिखते हैं। मीटर दैनिक शीट में सेव शिफ्ट या शुरुआती स्टॉक से आते हैं।"
        },
        "customer": {
            "title": "ग्राहक, पता और तय भाव",
            "body": "ग्राहक और डिलीवरी का विवरण और तय प्रति मीटर भाव लिखें। हर डिस्पैच में ये लिखने होते हैं।"
        },
        "lots": {
            "title": "हर लॉट या ताका लिखें",
            "body": "हर लॉट के लिए उसके मीटर के साथ एक लाइन जोड़ें। यहाँ 60 + 40 = 100 मीटर, ₹40/मीटर पर ₹4,000 होता है।"
        },
        "draft": {
            "title": "पहले ड्राफ्ट सेव करें",
            "body": "{c:saveDraft} स्टॉक को छुए बिना चालान रखता है, ताकि माल निकलने से पहले जाँच सकें।"
        },
        "confirm": {
            "title": "माल निकले तब पुष्टि करें",
            "body": "{c:confirmLeft} चालान लॉक करता है और कपड़े के स्टॉक से 100 मीटर घटाता है। धागा तो कपड़ा बनते समय ही गिना जा चुका है।",
            "detail": "{c:print} चालान को छापने या PDF सेव करने के लिए खोलता है। गलती से पुष्टि किया डिस्पैच, जब तक उस पर पैसा दर्ज न हो, वापस किया जा सकता है।"
        },
        "receipt": {
            "title": "ग्राहक ने क्या स्वीकारा, यह दर्ज करें",
            "body": "सब पहुँचा हो तो {c:receivedAsSent} इस्तेमाल करें। नहीं तो स्वीकारे गए मीटर दर्ज करें, यहाँ 100 में से 98।"
        },
        "difference": {
            "title": "कमी बिल बदलती है, स्टॉक नहीं",
            "body": "स्वीकार न हुए 2 मीटर स्टॉक में वापस नहीं आते। लेने की रकम ₹3,920 हो जाती है।"
        },
        "payment": {
            "title": "पैसा मिले तब दर्ज करें",
            "body": "{c:recordPayment} भुगतान जोड़ता है। यहाँ ₹2,000 मिलने पर ₹1,920 बाकी रहता है।",
            "detail": "शुल्क, क्रेडिट, रिफंड और बदली अंतिम तिथि के लिए डिस्पैच पर अलग बटन हैं। गलत भुगतान {c:reverseEntry} से सुधरता है।"
        },
        "handoff": {
            "title": "माल तैयार हो तब डिस्पैच शुरू करें",
            "body": "ड्राफ्ट भरने के लिए {c:newDispatch} चुनें। प्राप्ति या भुगतान दर्ज करने के लिए सूची से डिस्पैच खोलें।"
        },
        "guide": {
            "benefit": "कपड़ा भेजना, क्या पहुँचा यह दर्ज करना और भुगतान देखना सीखें।"
        }
    }
}

/** The same keys rendered by ChallansClient and ChallanDraftEditor. */
export function dispatchTourControlLabels(t: (key: string) => string) {
    return {
        saveDraft: t('challan.saveDraft'), confirmLeft: t('challan.confirm'),
        print: t('challan.print'), receivedAsSent: t('challan.receivedAsSent'),
        recordPayment: t('challan.payment'), reverseEntry: t('challan.reverse_entry'),
        newDispatch: t('challan.new'),
    }
}

export function dispatchStepCopy(language: Language, step: DispatchTourStep, controls: Record<string, string>) {
    const key = step === 'parties' ? 'customer' : step === 'saveDraft' ? 'draft' : step
    const source = dispatchTutorialCopy[language][key]
    const format = (text: string) => formatTourText(text.replace(/\{c:[^}]+\}/g, token => `“${token}”`), controls)
    return {
        title: format(source.title),
        body: format(source.body),
        ...(source.detail ? { detail: format(source.detail) } : {}),
    }
}
