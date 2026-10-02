'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { TourInvitation } from '@/components/tours/TourInvitation'
import { railIcon, railSurface } from '@/components/ui/rail'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import type { RateBookStep } from '@/lib/rate-book-tour'

const RateBookTourRuntime = dynamic(() => import('./RateBookTourRuntime'), { ssr: false })
// Existing product help and principles stay static; step copy loads with the runtime.
export const rateBookHelpCopy = {
  "en": {
    "helpTitle": "Rate Book help: reviews, trends and maintenance",
    "fields": {
      "directionFilter": {
        "title": "Find the rates needing attention",
        "description": "Use All, Warp or Weft to narrow the list. Needs Review includes overdue prices and yarns discovered from saved qualities or costings that still need owner confirmation. Clear filters to see other yarns."
      },
      "quickReviewAction": {
        "title": "Confirm only a checked price",
        "description": "When the supplier price is unchanged, use the row’s review action to confirm it without changing the value. Confirm All as Current applies to all pending reviews, so check every included rate first. Rate Review opens the pending list."
      },
      "rateAndTrend": {
        "title": "Read the change from your last price",
        "description": "The current price is in ₹/kg. The change badge compares it with the previous recorded value: ₹200 to ₹220 is +₹20 (+10%). Initial rate means there is no previous value to compare."
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
    "principles": [
      "Saving a rate updates matching yarn prices in linked Saved Qualities for future estimates.",
      "Historical costing snapshots keep their original numbers.",
      "Yarns discovered from saved qualities or costings need your supplier-price check."
    ]
  },
  "hi": {
    "helpTitle": "रेट बुक सहायता: समीक्षा, भाव का अंतर और रखरखाव",
    "fields": {
      "directionFilter": {
        "title": "समीक्षा वाले भाव खोजें",
        "description": "सभी, ताना या बाना से सूची सीमित करें। समीक्षा आवश्यक में पुराने भाव और सेव की गई क्वालिटी या कॉस्टिंग से मिले अपुष्ट धागे आते हैं। अन्य धागे देखने के लिए फ़िल्टर हटाएँ।"
      },
      "quickReviewAction": {
        "title": "जाँचे हुए भाव की ही पुष्टि करें",
        "description": "सप्लायर का भाव नहीं बदला तो पंक्ति की समीक्षा क्रिया से पुष्टि करें; मूल्य नहीं बदलेगा। सभी को वर्तमान के रूप में पुष्टि करें सभी लंबित रेट पर लागू होता है, इसलिए पहले हर भाव जाँचें। रेट समीक्षा से लंबित सूची खोलें।"
      },
      "rateAndTrend": {
        "title": "पिछले दर्ज भाव से अंतर देखें",
        "description": "वर्तमान भाव ₹/किग्रा में है। बैज पिछले दर्ज मूल्य से तुलना करता है: ₹200 से ₹220 यानी +₹20 (+10%)। शुरुआती रेट का मतलब तुलना के लिए कोई पिछला मूल्य नहीं है।"
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
    "principles": [
      "रेट सेव करने पर जुड़ी सेव की गई क्वालिटीज़ के मेल खाते यार्न भाव आगे के अनुमानों के लिए बदलते हैं।",
      "पुराने कॉस्टिंग स्नैपशॉट अपने मूल आँकड़े रखते हैं।",
      "सेव की गई क्वालिटी या कॉस्टिंग से मिले यार्न का भाव सप्लायर से जाँचना ज़रूरी है।"
    ]
  },
  "gu": {
    "helpTitle": "રેટ બુક સહાય: સમીક્ષા, ભાવનો તફાવત અને જાળવણી",
    "fields": {
      "directionFilter": {
        "title": "સમીક્ષા જોઈતા ભાવ શોધો",
        "description": "બધા, તાણા કે વાણા વડે યાદી નાની કરો. સમીક્ષા જરૂરીમાં જૂના ભાવ અને સેવ કરેલી ક્વોલિટી કે કોસ્ટિંગમાંથી મળેલા અચકાસેલા દોરા આવે છે. બીજા દોરા જોવા ફિલ્ટર દૂર કરો."
      },
      "quickReviewAction": {
        "title": "ચકાસેલા ભાવની જ પુષ્ટિ કરો",
        "description": "સપ્લાયરનો ભાવ ન બદલાયો હોય તો પંક્તિની સમીક્ષા ક્રિયાથી પુષ્ટિ કરો; કિંમત બદલાશે નહીં. બધાને વર્તમાન તરીકે પુષ્ટિ કરો બધા બાકી રેટ પર લાગુ પડે છે, તેથી પહેલાં દરેક ભાવ તપાસો. રેટ સમીક્ષાથી બાકી યાદી ખોલો."
      },
      "rateAndTrend": {
        "title": "પાછલા નોંધેલા ભાવથી તફાવત જુઓ",
        "description": "વર્તમાન ભાવ ₹/કિગ્રામાં છે. બેજ અગાઉ નોંધેલી કિંમત સાથે સરખાવે છે: ₹200થી ₹220 એટલે +₹20 (+10%). શરૂઆતનો રેટ એટલે સરખામણી માટે અગાઉની કિંમત નથી."
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
    "principles": [
      "રેટ સેવ કરતાં જોડાયેલી સેવ કરેલી ક્વોલિટીના મળતા યાર્ન ભાવ આગળના અંદાજ માટે બદલાય છે.",
      "જૂનાં કોસ્ટિંગ સ્નેપશોટ મૂળ આંકડા જ રાખે છે.",
      "સેવ કરેલી ક્વોલિટી કે કોસ્ટિંગમાંથી મળેલા યાર્નનો ભાવ સપ્લાયર પાસે ચકાસવો જરૂરી છે."
    ]
  }
} as const

const helpLabels = {
    advancedEdit: 'Advanced edit', effectiveDate: 'Effective from', reviewDate: 'Review date',
    reviewEvery: 'Review every', activity: 'Activity', archiveRate: 'Archive rate',
    archivedRates: 'Archived rates', restoreRate: 'Restore rate',
} as const

export function formatRateBookHelpText(text: string, tx: (phrase: string) => string) {
    return Object.entries(helpLabels).reduce((result, [token, label]) => result.replaceAll(`{${token}}`, tx(label)), text)
}

export function RateBookHelp() {
    const { language, tx } = useTranslation()
    const copy = rateBookHelpCopy[language]
    return <details data-i18n-skip="true" lang={language} className={cn(railSurface, 'ui-details group text-xs')}>
        <summary className="flex min-h-11 cursor-pointer select-none list-none items-center justify-between gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2.5"><CircleHelp className={railIcon} aria-hidden="true" /><span className="min-w-0">{copy.helpTitle}</span></span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="max-h-[35vh] space-y-2.5 overflow-y-auto border-t border-hairline px-3.5 py-3">
            {Object.entries(copy.fields).map(([field, text]) => <details key={field} className="ui-details rounded-xl border border-hairline/60 bg-surface-soft/60 p-2.5 text-xs">
                <summary className="cursor-pointer font-semibold text-ink">{formatRateBookHelpText(text.title, tx)}</summary>
                <p className="mt-1.5 leading-relaxed text-body">{formatRateBookHelpText(text.description, tx)}</p>
            </details>)}
        </div>
    </details>
}

export function RateBookTutorial({ step, onStepChange, enabled, sampleRow, hasRealRates, userId, orgId, userMetadata, onTourFinish }: {
    step: RateBookStep | null; onStepChange: (step: RateBookStep | null) => void
    enabled: boolean; sampleRow: boolean; hasRealRates: boolean
    userId: string; orgId: string; userMetadata?: Record<string, unknown> | null
    onTourFinish?: () => void
}) {
    const launcher = useRef<HTMLDivElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    return <>
        <div ref={launcher}>
            {enabled && <TourInvitation tourId="rate-book" userId={userId} orgId={orgId} userMetadata={userMetadata}
                align="full" className="w-full" onLaunch={() => {
                    returnFocus.current = launcher.current?.querySelector<HTMLButtonElement>('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]') ?? null
                    onStepChange('rb-purpose')
                }} />}
        </div>
        {step && <RateBookTourRuntime step={step} onStepChange={onStepChange} onDone={onTourFinish}
            sampleRow={sampleRow} hasRealRates={hasRealRates} userId={userId} launcher={launcher} returnFocus={returnFocus} />}
    </>
}
