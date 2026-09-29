import type { Language } from './context'
import type { PayrollTourStep } from '../payroll-tour'
import { formatTourText } from '../tours/tour-text'

/** Fixed page-spec copy, including the owner-approved Payroll addendum. */
export const payrollTutorialCopy = {
    "en": {
        "steps": {
            "pr-period": {
                "title": "Pay one period at a time",
                "body": "Each period follows your pay cycle. Paying a worker and completing the period are separate steps.",
                "detail": "The cycle (for example monthly) is set in Settings → Payroll."
            },
            "pr-readiness": {
                "title": "Fix readiness issues first",
                "body": "Missing production readings or pay setup are listed here. Fix each one on the Daily Sheet or in Workers before paying."
            },
            "pr-earnings": {
                "title": "How gross pay is worked out",
                "body": "Piece-rate pay is metres × wage: 1,000 m × ₹2/m = ₹2,000. A salary is paid for the days worked in the period."
            },
            "pr-recovery": {
                "title": "Advances are recovered from pay",
                "body": "Up to half of gross pay recovers advances and deductions: ₹1,000 of ₹2,000 here, leaving ₹1,000 to pay. Any rest carries forward."
            },
            "pr-settle": {
                "title": "Open the settlement to pay",
                "body": "{c:settlePayroll} lists every worker with the net amount to pay for this period.",
                "detail": "A worker with nothing to pay is closed with {c:resolve} instead of a payment."
            },
            "pr-paid": {
                "title": "Record each payment you made",
                "body": "{c:markPaid} records that you paid the worker in cash, bank or UPI. Weavly does not move any money."
            },
            "pr-complete": {
                "title": "Complete the period last",
                "body": "When every worker is paid or resolved, {c:completePayroll} closes the period and keeps it in records."
            },
            "pr-handoff": {
                "title": "Pay this period's workers",
                "body": "When readiness is clear, open the settlement here and record each payment as you make it."
            },
            "pra-advance": {
                "title": "Record an advance when you give it",
                "body": "{c:addAdvance} on a worker records money given ahead of pay. It is recovered from later pay under the half-of-gross limit."
            },
            "pra-deduction": {
                "title": "Record a deduction with its reason",
                "body": "{c:addDeduction} records an amount to recover, such as damage. It is recovered together with advances, under the same limit."
            },
            "pra-records": {
                "title": "Find past payments",
                "body": "{c:payrollRecords} shows each recorded payment by worker or by machine for the period you pick."
            },
            "pra-export": {
                "title": "Export a period",
                "body": "{c:exportCsv} or {c:exportPdf} downloads the whole period, whatever you have searched."
            },
            "pra-correct": {
                "title": "Correct a mistaken payment record",
                "body": "{c:resolveMistaken} reverses a payment recorded by mistake, with a reason. It does not return any cash."
            },
            "pra-handoff": {
                "title": "Open your payroll records",
                "body": "Choose {c:payrollRecords} to see payments you have already recorded."
            }
        },
        "launcher": "Advances, records and corrections",
        "benefit": "See how to check earnings, record payments and close a pay period.",
        "people": {
            "piece": "Sample weaver",
            "salary": "Sample staff",
            "zero": "Sample worker · no earnings",
            "review": "Sample worker · needs review"
        },
        "calculation": {
            "title": "How pay is calculated",
            "description": "Payroll settlement calculation and advance recovery rules",
            "piece.title": "1. Piece-rate earnings",
            "piece.body": "Piece-rate pay uses saved machine rates multiplied by verified metres produced per machine.",
            "salary.title": "2. Fixed salaries",
            "salary.body": "Fixed salaries accrue by calendar day, accounting for joining/leaving dates and effective-dated salary adjustments.",
            "recovery.title": "3. Advance recovery",
            "recovery.body": "Recovery is capped at the lower of the outstanding advance balance or 50% of gross pay; any remaining balance carries forward to the next pay cycle."
        }
    },
    "gu": {
        "steps": {
            "pr-period": {
                "title": "એક વખતે એક સમયગાળાનો પગાર",
                "body": "દરેક સમયગાળો તમારા પગાર ચક્ર પ્રમાણે છે. કારીગરને ચૂકવવું અને સમયગાળો પૂર્ણ કરવો અલગ પગલાં છે.",
                "detail": "ચક્ર (જેમ કે માસિક) સેટિંગ્સ → પેરોલમાં નક્કી થાય છે."
            },
            "pr-readiness": {
                "title": "પહેલાં તૈયારીની ખામીઓ સુધારો",
                "body": "ખૂટતાં ઉત્પાદન રીડિંગ કે પગાર સેટઅપ અહીં દેખાય છે. ચૂકવતાં પહેલાં દરેકને દૈનિક શીટ કે કારીગરોમાં સુધારો."
            },
            "pr-earnings": {
                "title": "કુલ પગાર કેવી રીતે ગણાય છે",
                "body": "પીસ રેટ પગાર = મીટર × મજૂરી: 1,000 મીટર × ₹2/મીટર = ₹2,000. પગારદારને સમયગાળામાં કામ કરેલા દિવસોનો પગાર મળે છે."
            },
            "pr-recovery": {
                "title": "ઉપાડ પગારમાંથી વસૂલાય છે",
                "body": "કુલ પગારમાંથી વધુમાં વધુ અડધો ઉપાડ અને કપાતમાં જાય: અહીં ₹2,000 માંથી ₹1,000, ચૂકવવાના ₹1,000 રહે. બાકી આગળ જાય છે."
            },
            "pr-settle": {
                "title": "ચૂકવવા સેટલમેન્ટ ખોલો",
                "body": "{c:settlePayroll}માં આ સમયગાળામાં દરેક કારીગરને ચૂકવવાની ચોખ્ખી રકમ દેખાય છે.",
                "detail": "ચૂકવવાનું કંઈ ન હોય તે કારીગરને ચુકવણીને બદલે {c:resolve}થી બંધ કરો."
            },
            "pr-paid": {
                "title": "તમે કરેલી દરેક ચુકવણી નોંધો",
                "body": "{c:markPaid} નોંધે છે કે તમે કારીગરને રોકડ, બેંક કે UPIથી ચૂકવ્યા. Weavly કોઈ પૈસા મોકલતું નથી."
            },
            "pr-complete": {
                "title": "સમયગાળો છેલ્લે પૂર્ણ કરો",
                "body": "દરેક કારીગર ચૂકવાઈ જાય કે બંધ થાય પછી {c:completePayroll} સમયગાળો બંધ કરી રેકોર્ડમાં રાખે છે."
            },
            "pr-handoff": {
                "title": "આ સમયગાળાના કારીગરોને ચૂકવો",
                "body": "તૈયારી પૂરી થાય એટલે અહીં સેટલમેન્ટ ખોલો અને દરેક ચુકવણી કરતાં જ નોંધો."
            },
            "pra-advance": {
                "title": "ઉપાડ આપો ત્યારે નોંધો",
                "body": "કારીગર પર {c:addAdvance} પગાર પહેલાં આપેલા પૈસા નોંધે છે. તે પછીના પગારમાંથી અડધા સુધીની મર્યાદામાં વસૂલાય છે."
            },
            "pra-deduction": {
                "title": "કારણ સાથે કપાત નોંધો",
                "body": "{c:addDeduction} વસૂલવાની રકમ, જેમ કે નુકસાન, નોંધે છે. તે ઉપાડ સાથે એ જ મર્યાદામાં વસૂલાય છે."
            },
            "pra-records": {
                "title": "જૂની ચુકવણીઓ શોધો",
                "body": "{c:payrollRecords}માં પસંદ કરેલા સમયગાળાની દરેક નોંધાયેલી ચુકવણી કારીગર કે મશીન પ્રમાણે દેખાય છે."
            },
            "pra-export": {
                "title": "સમયગાળો એક્સપોર્ટ કરો",
                "body": "{c:exportCsv} કે {c:exportPdf} તમે શું શોધ્યું હોય તે છતાં આખો સમયગાળો ડાઉનલોડ કરે છે."
            },
            "pra-correct": {
                "title": "ખોટો ચુકવણી રેકોર્ડ સુધારો",
                "body": "{c:resolveMistaken} ભૂલથી નોંધાયેલી ચુકવણી કારણ સાથે ઉલટાવે છે. તે કોઈ રોકડ પાછી આપતું નથી."
            },
            "pra-handoff": {
                "title": "તમારા પેરોલ રેકોર્ડ ખોલો",
                "body": "નોંધાયેલી ચુકવણીઓ જોવા {c:payrollRecords} પસંદ કરો."
            }
        },
        "launcher": "ઉપાડ, રેકોર્ડ અને સુધારા",
        "benefit": "કમાણી તપાસવી, ચુકવણી નોંધવી અને પગાર સમયગાળો બંધ કરવો કેવી રીતે તે જુઓ.",
        "people": {
            "piece": "નમૂનાનો વણકર",
            "salary": "નમૂનાનો કર્મચારી",
            "zero": "નમૂનાનો કારીગર · કમાણી નથી",
            "review": "નમૂનાનો કારીગર · સમીક્ષા જરૂરી"
        },
        "calculation": {
            "title": "પગાર કેવી રીતે ગણાય છે",
            "description": "પેરોલ સેટલમેન્ટની ગણતરી અને ઉપાડની વસૂલાતના નિયમો",
            "piece.title": "1. પીસ રેટની કમાણી",
            "piece.body": "પીસ રેટનો પગાર દરેક મશીન માટે સાચવેલા મજૂરી દરને તે મશીન પર બનેલા ચકાસેલા મીટરથી ગુણવાથી ગણાય છે.",
            "salary.title": "2. નિશ્ચિત પગાર",
            "salary.body": "નિશ્ચિત પગાર કૅલેન્ડરના દરેક દિવસ પ્રમાણે ગણાય છે. તેમાં કામે જોડાવાની અને કામ છોડવાની તારીખો તથા જે તારીખથી પગારમાં ફેરફાર લાગુ પડે છે તે ધ્યાનમાં લેવાય છે.",
            "recovery.title": "3. ઉપાડની વસૂલાત",
            "recovery.body": "વસૂલાતની મર્યાદા ઉપાડની બાકી રકમ અને કુલ પગારના 50%માંથી જે ઓછી રકમ હોય તેટલી છે. બાકી રહેલી રકમ આવતા પગાર ચક્રમાં આગળ જાય છે."
        }
    },
    "hi": {
        "steps": {
            "pr-period": {
                "title": "एक बार में एक अवधि का वेतन",
                "body": "हर अवधि आपके वेतन चक्र के अनुसार है। कारीगर को भुगतान करना और अवधि पूरी करना अलग कदम हैं।",
                "detail": "चक्र (जैसे मासिक) सेटिंग्स → पेरोल में तय होता है।"
            },
            "pr-readiness": {
                "title": "पहले तैयारी की कमियाँ ठीक करें",
                "body": "छूटी उत्पादन रीडिंग या वेतन सेटअप यहाँ दिखते हैं। भुगतान से पहले हर एक को दैनिक शीट या कारीगर में ठीक करें।"
            },
            "pr-earnings": {
                "title": "कुल वेतन कैसे निकलता है",
                "body": "पीस रेट वेतन = मीटर × मजदूरी: 1,000 मीटर × ₹2/मीटर = ₹2,000। वेतन वालों को अवधि में काम के दिनों का वेतन मिलता है।"
            },
            "pr-recovery": {
                "title": "उपाड़ वेतन से वसूला जाता है",
                "body": "कुल वेतन का अधिकतम आधा उपाड़ और कटौती में जाता है: यहाँ ₹2,000 में से ₹1,000, देने को ₹1,000 बचते हैं। बाकी आगे जाता है।"
            },
            "pr-settle": {
                "title": "भुगतान के लिए निपटान खोलें",
                "body": "{c:settlePayroll} में इस अवधि में हर कारीगर को देने की शुद्ध रकम दिखती है।",
                "detail": "जिसे कुछ नहीं देना, उस कारीगर को भुगतान के बजाय {c:resolve} से बंद करें।"
            },
            "pr-paid": {
                "title": "अपना किया हर भुगतान दर्ज करें",
                "body": "{c:markPaid} दर्ज करता है कि आपने कारीगर को नकद, बैंक या UPI से भुगतान किया। Weavly कोई पैसा नहीं भेजता।"
            },
            "pr-complete": {
                "title": "अवधि सबसे आख़िर में पूरी करें",
                "body": "हर कारीगर का भुगतान हो जाए या बंद हो जाए, तब {c:completePayroll} अवधि बंद करके रिकॉर्ड में रखता है।"
            },
            "pr-handoff": {
                "title": "इस अवधि के कारीगरों को भुगतान करें",
                "body": "तैयारी पूरी होने पर यहाँ निपटान खोलें और हर भुगतान करते ही दर्ज करें।"
            },
            "pra-advance": {
                "title": "उपाड़ दें तब दर्ज करें",
                "body": "कारीगर पर {c:addAdvance} वेतन से पहले दिए पैसे दर्ज करता है। यह बाद के वेतन से आधे तक की सीमा में वसूला जाता है।"
            },
            "pra-deduction": {
                "title": "कारण के साथ कटौती दर्ज करें",
                "body": "{c:addDeduction} वसूलने की रकम, जैसे नुकसान, दर्ज करता है। यह उपाड़ के साथ उसी सीमा में वसूली जाती है।"
            },
            "pra-records": {
                "title": "पुराने भुगतान खोजें",
                "body": "{c:payrollRecords} में चुनी अवधि का हर दर्ज भुगतान कारीगर या मशीन के अनुसार दिखता है।"
            },
            "pra-export": {
                "title": "अवधि एक्सपोर्ट करें",
                "body": "{c:exportCsv} या {c:exportPdf} आपकी खोज चाहे जो हो, पूरी अवधि डाउनलोड करता है।"
            },
            "pra-correct": {
                "title": "गलत भुगतान रिकॉर्ड सुधारें",
                "body": "{c:resolveMistaken} गलती से दर्ज भुगतान को कारण के साथ वापस करता है। यह कोई नकद वापस नहीं देता।"
            },
            "pra-handoff": {
                "title": "अपने पेरोल रिकॉर्ड खोलें",
                "body": "दर्ज भुगतान देखने के लिए {c:payrollRecords} चुनें।"
            }
        },
        "launcher": "उपाड़, रिकॉर्ड और सुधार",
        "benefit": "कमाई जाँचना, भुगतान दर्ज करना और वेतन अवधि बंद करना देखें।",
        "people": {
            "piece": "नमूना बुनकर",
            "salary": "नमूना कर्मचारी",
            "zero": "नमूना कारीगर · कमाई नहीं",
            "review": "नमूना कारीगर · समीक्षा ज़रूरी"
        },
        "calculation": {
            "title": "वेतन की गणना कैसे होती है",
            "description": "पेरोल निपटान की गणना और उपाड़ की वसूली के नियम",
            "piece.title": "1. पीस रेट की कमाई",
            "piece.body": "हर मशीन की सहेजी गई मजदूरी दर को उस मशीन पर बने कपड़े के जाँचे गए मीटर से गुणा करके पीस रेट वेतन निकाला जाता है।",
            "salary.title": "2. निश्चित वेतन",
            "salary.body": "निश्चित वेतन की गणना कैलेंडर के दिनों के हिसाब से होती है। इसमें काम शुरू करने और छोड़ने की तारीखें तथा वेतन में बदलाव लागू होने की तारीखें ध्यान में रखी जाती हैं।",
            "recovery.title": "3. उपाड़ की वसूली",
            "recovery.body": "वसूली की सीमा बकाया उपाड़ और कुल वेतन के 50% में से जो रकम कम हो, उतनी है। बची रकम अगले वेतन चक्र में आगे ले जाई जाती है।"
        }
    }
} as const

export function payrollTourControlLabels(t: (key: string) => string, currentSettlementLabel?: string) {
    return {
        settlePayroll: t('payroll.settlePayroll'),
        resolve: t('payroll.resolve'),
        markPaid: t('payroll.markPaid'),
        completePayroll: t('payroll.completePayroll'),
        addAdvance: t('payroll.addAdvance'),
        addDeduction: t('payroll.addDeduction'),
        payrollRecords: t('payroll.payrollRecords'),
        exportCsv: t('payroll.exportCsv'),
        exportPdf: t('payroll.exportPdf'),
        resolveMistaken: t('payroll.resolveMistaken'),
        continueSettlement: t('payroll.continueSettlement'),
        viewSettledPayroll: t('payroll.viewSettledPayroll'),
        reviewBeforePaying: t('payroll.reviewBeforePaying'),
        confirmPayment: t('payroll.confirmPayment'),
        viewSettledRecords: t('payroll.viewSettledRecords'),
        ...(currentSettlementLabel ? { settlePayroll: currentSettlementLabel } : {}),
    }
}

export function payrollStepCopy(language: Language, step: PayrollTourStep, controls: Record<string, string>) {
    const copy = payrollTutorialCopy[language].steps[step]
    return {
        title: formatTourText(copy.title, controls),
        body: formatTourText(copy.body, controls),
        ...('detail' in copy ? { detail: formatTourText(copy.detail, controls) } : {}),
    }
}

/** Explicit, complete Base preview labels; no word-by-word fallback. */
const previewLabelRows = [
    [
        "Advance recovery",
        "એડવાન્સ વસૂલાત",
        "अग्रिम वसूली"
    ],
    [
        "Net amount payable",
        "ચૂકવવાપાત્ર ચોખ્ખી રકમ",
        "देय शुद्ध राशि"
    ],
    [
        "Payment method",
        "ચૂકવણી પદ્ધતિ",
        "भुगतान तरीका"
    ],
    [
        "Note (optional)",
        "નોંધ (વૈકલ્પિક)",
        "नोट (वैकल्पिक)"
    ],
    [
        "In Progress",
        "ચાલુ",
        "जारी"
    ],
    [
        "Remaining to settle",
        "પતાવટ માટે બાકી",
        "निपटान के लिए बाकी"
    ],
    [
        "Payroll readiness",
        "પેરોલ તૈયારી",
        "पेरोल तैयारी"
    ],
    [
        "Review required",
        "સમીક્ષા જરૂરી",
        "समीक्षा ज़रूरी"
    ],
    [
        "Fixed monthly salary",
        "નિશ્ચિત માસિક પગાર",
        "निश्चित मासिक वेतन"
    ],
    [
        "Resolved (₹0)",
        "ઉકેલાયેલ (₹0)",
        "हल किया (₹0)"
    ],
    [
        "Ready to Complete",
        "પૂર્ણ કરવા તૈયાર",
        "पूरा करने को तैयार"
    ],
    [
        "All worker obligations resolved",
        "બધા કારીગરોની જવાબદારી ઉકેલાઈ",
        "सभी कारीगरों के दायित्व हल हुए"
    ],
    [
        "Record advance",
        "એડવાન્સ નોંધો",
        "अग्रिम दर्ज करें"
    ],
    [
        "Reason / Category",
        "કારણ / શ્રેણી",
        "कारण / श्रेणी"
    ],
    [
        "Record deduction",
        "કપાત નોંધો",
        "कटौती दर्ज करें"
    ],
    [
        "Pay period",
        "પગારનો સમયગાળો",
        "वेतन अवधि"
    ],
    [
        "Reverse a mistaken payment record?",
        "ખોટી ચુકવણીનો રેકોર્ડ ઉલટાવવો છે?",
        "गलत भुगतान रिकॉर्ड उलटना है?"
    ],
    [
        "Record worker advance",
        "કારીગરનો એડવાન્સ નોંધો",
        "कारीगर का अग्रिम दर्ज करें"
    ],
    [
        "Record worker deduction",
        "કારીગરની કપાત નોંધો",
        "कारीगर की कटौती दर्ज करें"
    ],
    [
        "Machines",
        "મશીનો",
        "मशीनें"
    ],
    [
        "Workers",
        "કારીગરો",
        "कारीगर"
    ],
    [
        "Payroll",
        "પેરોલ",
        "पेरोल"
    ],
    [
        "Gross earnings",
        "કુલ કમાણી",
        "कुल कमाई"
    ],
    [
        "Balance carried",
        "આગળની બાકી રકમ",
        "आगे का बकाया"
    ],
    [
        "Worker",
        "કારીગર",
        "कारीगर"
    ],
    [
        "Reason for reversal",
        "રેકોર્ડ પાછો લેવાનું કારણ",
        "रिकॉर्ड वापस लेने का कारण"
    ],
    [
        "I confirm this payment was not actually made.",
        "હું પુષ્ટિ કરું છું કે આ ચુકવણી ખરેખર કરવામાં આવી ન હતી.",
        "मैं पुष्टि करता हूँ कि यह भुगतान वास्तव में नहीं किया गया था।"
    ],
    [
        "Record reversal",
        "રેકોર્ડ પાછો લેવાની નોંધ કરો",
        "रिकॉर्ड वापसी दर्ज करें"
    ],
    [
        "Description",
        "વર્ણન",
        "विवरण"
    ],
    [
        "Amount",
        "રકમ",
        "राशि"
    ]
] as const
export const payrollPreviewLabels: Record<Language, Record<string, string>> = {
    en: Object.fromEntries(previewLabelRows.map(([en]) => [en, en])),
    gu: Object.fromEntries(previewLabelRows.map(([en, gu]) => [en, gu])),
    hi: Object.fromEntries(previewLabelRows.map(([en, , hi]) => [en, hi])),
}
