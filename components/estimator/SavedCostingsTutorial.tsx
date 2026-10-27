'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { CircleHelp } from 'lucide-react'
import { GuideSection, TourInvitation, type GuideTopic } from '@/components/tours/TourInvitation'
import { useTranslation } from '@/lib/i18n/context'
import type { SavedCostingEnding, SavedCostingStep } from '@/lib/saved-costings-tour'

const SavedCostingsTourRuntime = dynamic(() => import('./SavedCostingsTourRuntime'), { ssr: false })
// Existing help remains static; step copy is loaded only with the runtime.
const railCopy = {
  "en": {
    "help": "More help: documents and library",
    "compare": "Compare versions",
    "fields": {
      "freeHelp": [
        "Find a Free snapshot",
        "Search by label or use the date, cost and margin filters. Clear filters if a snapshot is missing. Load more shows older records; refresh the page if loading fails."
      ],
      "filters": [
        "Narrow the library",
        "Filters sort by update date, margin or production cost and restrict margin ranges. Favourites shows starred records; Archived shows archived snapshots. Clear filters if a saved record is missing."
      ],
      "breakdown": [
        "Read the selected breakdown",
        "Choose a version in the list on the left; the highlighted one is shown. The breakdown works out each yarn’s weight and cost from its saved inputs, then adds wastage, weaving and factory expenses, and the margin gives the selling price. Saved numbers do not use today’s rates. Older versions may show only their saved totals."
      ],
      "organize": [
        "Find and maintain records",
        "Star a version for Favourites. Archive snapshot hides it from the active list; restore it from Archived. Archiving is not deletion. On older records that offer it, Check saved numbers checks whether the saved numbers need review."
      ],
      "separateQuality": [
        "Keep another quality separate",
        "Save as separate quality starts a draft for a different quality. Give it a new name in Cost Estimate and save after review. It does not overwrite the original costing."
      ],
      "customer": [
        "Customer-facing quotation",
        "Customer mode shows selling price and customer terms while keeping internal costs, profit and internal notes private. Set the party, validity and optional GST note, and check validation messages before generating. Previewing alone does not send a quotation."
      ],
      "share": [
        "Share after generating",
        "After you generate a customer PDF, Share PDF becomes available for that current document. It opens the device share sheet or WhatsApp fallback; you choose the recipient and send. A handoff does not confirm delivery. Changes to document details require a fresh PDF. This tour does not generate, download or share."
      ]
    }
  },
  "gu": {
    "help": "વધુ મદદ: દસ્તાવેજ અને યાદી",
    "compare": "વર્ઝનની સરખામણી",
    "fields": {
      "freeHelp": [
        "Free સ્નેપશોટ શોધો",
        "લેબલ શોધો અથવા તારીખ, ખર્ચ અને માર્જિનના ફિલ્ટર વાપરો. સ્નેપશોટ ન મળે તો ફિલ્ટર દૂર કરો. Load more થી જૂના રેકોર્ડ જુઓ; લોડ ન થાય તો પેજ રિફ્રેશ કરો."
      ],
      "filters": [
        "યાદી મર્યાદિત કરો",
        "ફિલ્ટરમાં તારીખ, માર્જિન અથવા ઉત્પાદન ખર્ચ મુજબ ક્રમ અને માર્જિનની શ્રેણી પસંદ કરો. Favourites માં સ્ટાર કરેલા અને Archived માં આર્કાઇવ સ્નેપશોટ મળે છે. રેકોર્ડ ન મળે તો ફિલ્ટર દૂર કરો."
      ],
      "breakdown": [
        "પસંદ કરેલી વિગતો વાંચો",
        "ડાબી બાજુની યાદીમાંથી વર્ઝન પસંદ કરો; હાઇલાઇટ થયેલું વર્ઝન બતાવાય છે. વિગતમાં દરેક યાર્નનું વજન અને ખર્ચ તેના સાચવેલા ઇનપુટ પરથી ગણાય છે, પછી વેસ્ટેજ, વણાટ અને ફેક્ટરી ખર્ચ ઉમેરાય છે, અને માર્જિન પરથી વેચાણ ભાવ મળે છે. સાચવેલા આંકડા આજના રેટ વાપરતા નથી. જૂના વર્ઝનમાં ફક્ત સાચવેલા કુલ આંકડા દેખાઈ શકે."
      ],
      "organize": [
        "રેકોર્ડ શોધો અને જાળવો",
        "આવૃત્તિ પર સ્ટાર કરીને તેને Favourites માં મેળવો. Archive snapshot સક્રિય યાદીમાંથી છુપાવે છે; Archived માંથી પાછી લાવો. આ ડિલીટ નથી. જૂના રેકોર્ડ પર Check saved numbers હોય તો સાચવેલા આંકડાની સમીક્ષા જરૂરી છે કે નહીં તે તપાસો."
      ],
      "separateQuality": [
        "બીજી ક્વોલિટી અલગ રાખો",
        "Save as separate quality બીજી ક્વોલિટીનો ડ્રાફ્ટ શરૂ કરે છે. Cost Estimate માં નવું નામ આપો અને તપાસીને સાચવો. મૂળ ગણતરી બદલાતી નથી."
      ],
      "customer": [
        "ગ્રાહક ક્વોટેશન",
        "Customer મોડ વેચાણ ભાવ અને ગ્રાહકની શરતો બતાવે છે; આંતરિક ખર્ચ, નફો અને નોંધો ખાનગી રહે છે. પાર્ટી, માન્યતા અને વૈકલ્પિક GST નોંધ ભરો અને ભૂલો તપાસો. પ્રીવ્યુ જોવાથી ક્વોટેશન મોકલાતું નથી."
      ],
      "share": [
        "બનાવ્યા પછી શેર કરો",
        "ગ્રાહક PDF બનાવ્યા પછી હાલના દસ્તાવેજ માટે Share PDF મળે છે. તે ડિવાઇસ શેર શીટ અથવા WhatsApp ખોલે છે; મેળવનાર અને મોકલવાનું તમે પસંદ કરો. તે ડિલિવરીની પુષ્ટિ નથી. વિગતો બદલાય તો નવો PDF બનાવો. ટૂર ફાઇલ બનાવતો, ડાઉનલોડ કે શેર કરતો નથી."
      ]
    }
  },
  "hi": {
    "help": "और सहायता: दस्तावेज़ और सूची",
    "compare": "वर्ज़न की तुलना",
    "fields": {
      "freeHelp": [
        "Free स्नैपशॉट खोजें",
        "लेबल खोजें या तारीख, लागत और मार्जिन के फ़िल्टर लगाएँ। स्नैपशॉट न मिले तो फ़िल्टर हटाएँ। Load more से पुराने रिकॉर्ड देखें; लोड न हो तो पेज रीफ़्रेश करें।"
      ],
      "filters": [
        "सूची को सीमित करें",
        "फ़िल्टर से तारीख, मार्जिन या उत्पादन लागत के अनुसार क्रम और मार्जिन सीमा चुनें। Favourites में स्टार वाले रिकॉर्ड और Archived में संग्रहित स्नैपशॉट मिलते हैं। रिकॉर्ड न मिले तो फ़िल्टर हटाएँ।"
      ],
      "breakdown": [
        "चुना हुआ विवरण पढ़ें",
        "बाईं ओर की सूची से वर्ज़न चुनें; हाइलाइट वाला वर्ज़न दिखता है। विवरण में हर यार्न का वज़न और लागत उसके सेव किए इनपुट से निकलती है, फिर वेस्टेज, बुनाई और फैक्ट्री खर्च जुड़ते हैं, और मार्जिन से बिक्री मूल्य मिलता है। सेव किए आंकड़े आज के रेट नहीं लेते। पुराने वर्ज़न में सिर्फ़ सेव किए कुल आंकड़े दिख सकते हैं।"
      ],
      "organize": [
        "रिकॉर्ड खोजें और सँभालें",
        "संस्करण पर स्टार लगाकर उसे Favourites में पाएँ। Archive snapshot सक्रिय सूची से छिपाता है; Archived से वापस लाएँ। यह डिलीट नहीं है। पुराने रिकॉर्ड पर Check saved numbers उपलब्ध हो तो उससे पता करें कि सेव आंकड़ों की समीक्षा चाहिए या नहीं।"
      ],
      "separateQuality": [
        "दूसरी क्वालिटी अलग रखें",
        "Save as separate quality दूसरी क्वालिटी का ड्राफ्ट शुरू करता है। Cost Estimate में नया नाम दें और जाँचकर सेव करें। मूल लागत नहीं बदलती।"
      ],
      "customer": [
        "ग्राहक कोटेशन",
        "Customer मोड बिक्री मूल्य और ग्राहक शर्तें दिखाता है; आंतरिक लागत, लाभ और नोट्स निजी रहते हैं। पार्टी, वैधता और वैकल्पिक GST नोट भरें तथा त्रुटियाँ जाँचें। प्रीव्यू देखने से कोटेशन नहीं भेजा जाता।"
      ],
      "share": [
        "बनाने के बाद शेयर करें",
        "ग्राहक PDF बनाने के बाद वर्तमान दस्तावेज़ के लिए Share PDF मिलता है। यह डिवाइस शेयर शीट या WhatsApp खोलता है; प्राप्तकर्ता और भेजना आप चुनते हैं। इससे डिलीवरी की पुष्टि नहीं होती। विवरण बदलें तो नया PDF बनाएँ। टूर कोई फ़ाइल नहीं बनाता, डाउनलोड या शेयर नहीं करता।"
      ]
    }
  }
} as const

/** "More help: documents and library" as a Guide topic. Free lists fewer fields. */
export function useSavedCostingsHelpTopic(free = false): GuideTopic {
    const { language } = useTranslation()
    const copy = railCopy[language]
    const helpFields = free ? [copy.fields.freeHelp, copy.fields.customer, copy.fields.share]
        : [copy.fields.filters, copy.fields.breakdown, copy.fields.organize, copy.fields.separateQuality, copy.fields.customer, copy.fields.share]
    return {
        id: 'saved-costings-help', icon: CircleHelp, title: copy.help, lang: language, i18nSkip: true,
        content: helpFields.map(([title, description]) => <GuideSection key={title} title={title}>{description}</GuideSection>),
    }
}

/**
 * The Saved Costings Guide: the main tour and help, all from one header button.
 * `topics` adds the page's other help (archive policy) after these.
 */
export function SavedCostingsTutorial({ step, onStepChange, onComplete, free = false, production = false, ending = 'empty', topics = [], userId, orgId, userMetadata }: {
    step: SavedCostingStep | null; onStepChange: (step: SavedCostingStep | null) => void; onComplete?: () => void
    free?: boolean; production?: boolean; ending?: SavedCostingEnding
    topics?: readonly GuideTopic[]
    userId?: string; orgId?: string; userMetadata?: Record<string, unknown> | null
}) {
    const help = useSavedCostingsHelpTopic(free)
    const launcher = useRef<HTMLDivElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const guideButton = () => launcher.current?.querySelector<HTMLButtonElement>('[data-tour-control="guide"]') ?? null

    return <>
        <div ref={launcher} data-costing-tour="guide" className="contents">
            <TourInvitation tourId="saved-costings" userId={userId} orgId={orgId} userMetadata={userMetadata}
                topics={[help, ...topics]}
                onLaunch={() => {
                    returnFocus.current = guideButton()
                    onStepChange(free ? 'snapshots' : 'find')
                }} />
        </div>
        {step && <SavedCostingsTourRuntime step={step} onStepChange={onStepChange} onComplete={onComplete} free={free} production={production} comparison={false} ending={ending} userId={userId} launcher={launcher} returnFocus={returnFocus} />}
    </>
}
