import type { Language } from './context'
import type { RateBookStep } from '@/lib/rate-book-tour'
import { formatTourText } from '@/lib/tours/tour-text'

const en = {
  "purpose.title": "Your own yarn price list",
  "purpose.body": "Keep the price per kg you pay for each warp and weft yarn. New costings suggest these prices; add a yarn with {c:addRate}.",
  "purpose.detail": "Yarns from qualities you save in the Cost Estimator appear here by themselves.",
  "find.title": "Find a yarn",
  "find.body": "Search by yarn name or supplier. {c:needsReview} shows only the prices that are due for a check.",
  "update.title": "Update a price when your supplier changes it",
  "update.body": "{c:editRate} lets you enter the new price and where it came from, such as an invoice. The old price stays in the yarn's history.",
  "update.detail": "Use {c:advancedEdit} to set the date the price applies from and how often Weavly should remind you to recheck it.",
  "review.title": "Recheck prices when reminded",
  "review.body": "A price due for review still has its old value. If your supplier's price is unchanged, confirm it; if it changed, update it.",
  "review.detail": "The bulk confirm button confirms every price that is due, including ones hidden by your search or filters.",
  "usage.title": "See which qualities use a yarn",
  "usage.body": "This column lists the saved qualities that use this yarn. A new price is used by their next costing; costings already saved keep their numbers.",
  "handoff.empty.title": "Add the yarns you buy",
  "handoff.empty.body": "Choose {c:addRate} and enter the name, warp or weft, and the price per kg from your latest bill.",
  "handoff.existing.title": "Check a yarn you bought recently",
  "handoff.existing.body": "Search for it and compare its price with your latest bill.",
  "rows.unavailable": "There are no yarn rows to show yet. Add a yarn first; this step will then point at it.",
  "guide.benefit": "See how to keep your yarn prices up to date."
}
const gu = {
  "purpose.title": "તમારું પોતાનું યાર્ન ભાવપત્રક",
  "purpose.body": "દરેક તાણા અને ભરણ યાર્ન માટે તમે ચૂકવો તે કિલોનો ભાવ રાખો. નવી કોસ્ટિંગમાં આ ભાવ સૂચવાય છે; યાર્ન ઉમેરવા {c:addRate}.",
  "purpose.detail": "ખર્ચ અંદાજકમાં સાચવેલી ક્વોલિટીના યાર્ન અહીં આપોઆપ દેખાય છે.",
  "find.title": "યાર્ન શોધો",
  "find.body": "યાર્નના નામ કે સપ્લાયરથી શોધો. {c:needsReview} ફક્ત તપાસવાના બાકી ભાવ બતાવે છે.",
  "update.title": "સપ્લાયર ભાવ બદલે ત્યારે ભાવ બદલો",
  "update.body": "{c:editRate}થી નવો ભાવ અને તે ક્યાંથી આવ્યો, જેમ કે બિલ, લખી શકો છો. જૂનો ભાવ યાર્નના ઇતિહાસમાં રહે છે.",
  "update.detail": "ભાવ કઈ તારીખથી લાગુ થાય અને Weavly કેટલા દિવસે ફરી તપાસવાનું યાદ કરાવે તે નક્કી કરવા {c:advancedEdit} વાપરો.",
  "review.title": "યાદ અપાય ત્યારે ભાવ ફરી તપાસો",
  "review.body": "તપાસ બાકી હોય તે ભાવ હજી જૂનો જ છે. સપ્લાયરનો ભાવ ન બદલાયો હોય તો ખાતરી કરો; બદલાયો હોય તો સુધારો.",
  "review.detail": "એકસાથે ખાતરીનું બટન બાકી બધા ભાવની ખાતરી કરે છે, તમારી શોધ કે ફિલ્ટરથી છુપાયેલા ભાવની પણ.",
  "usage.title": "યાર્ન કઈ ક્વોલિટીમાં વપરાય છે તે જુઓ",
  "usage.body": "આ કૉલમમાં આ યાર્ન વાપરતી સાચવેલી ક્વોલિટી દેખાય છે. નવો ભાવ તેમની આગલી કોસ્ટિંગમાં વપરાય છે; સાચવેલી કોસ્ટિંગના આંકડા બદલાતા નથી.",
  "handoff.empty.title": "તમે ખરીદો છો તે યાર્ન ઉમેરો",
  "handoff.empty.body": "{c:addRate} પસંદ કરો અને નામ, તાણા કે ભરણ, અને છેલ્લા બિલનો કિલોનો ભાવ લખો.",
  "handoff.existing.title": "હમણાં ખરીદેલું યાર્ન તપાસો",
  "handoff.existing.body": "તેને શોધો અને તેનો ભાવ છેલ્લા બિલ સાથે મેળવો.",
  "rows.unavailable": "હજી બતાવવા કોઈ યાર્ન નથી. પહેલાં યાર્ન ઉમેરો; પછી આ પગલું તેના પર બતાવશે.",
  "guide.benefit": "તમારા યાર્નના ભાવ અદ્યતન કેવી રીતે રાખવા તે જુઓ."
}
const hi = {
  "purpose.title": "आपकी अपनी धागा रेट सूची",
  "purpose.body": "हर ताना और बाना धागे का आपका दिया किलो रेट रखें। नई कॉस्टिंग में यही रेट सुझाए जाते हैं; धागा जोड़ने के लिए {c:addRate}।",
  "purpose.detail": "लागत अनुमानक में सेव की गई क्वालिटी के धागे यहाँ अपने आप दिखते हैं।",
  "find.title": "धागा खोजें",
  "find.body": "धागे के नाम या सप्लायर से खोजें। {c:needsReview} सिर्फ़ जाँच के लिए बाकी रेट दिखाता है।",
  "update.title": "सप्लायर रेट बदले तो रेट बदलें",
  "update.body": "{c:editRate} से नया रेट और वह कहाँ से आया, जैसे बिल, लिख सकते हैं। पुराना रेट धागे के इतिहास में रहता है।",
  "update.detail": "रेट किस तारीख से लागू हो और Weavly कितने दिन में दोबारा जाँचने की याद दिलाए, यह तय करने के लिए {c:advancedEdit} इस्तेमाल करें।",
  "review.title": "याद दिलाने पर रेट दोबारा जाँचें",
  "review.body": "जाँच बाकी वाला रेट अभी पुराना ही है। सप्लायर का रेट नहीं बदला तो पुष्टि करें; बदला तो सुधारें।",
  "review.detail": "एक साथ पुष्टि वाला बटन सभी बाकी रेट की पुष्टि करता है, आपकी खोज या फ़िल्टर से छिपे रेट की भी।",
  "usage.title": "धागा किन क्वालिटी में लगता है, यह देखें",
  "usage.body": "इस कॉलम में यह धागा इस्तेमाल करने वाली सेव क्वालिटी दिखती हैं। नया रेट उनकी अगली कॉस्टिंग में लगता है; सेव कॉस्टिंग के आँकड़े नहीं बदलते।",
  "handoff.empty.title": "जो धागे आप खरीदते हैं, उन्हें जोड़ें",
  "handoff.empty.body": "{c:addRate} चुनें और नाम, ताना या बाना, और पिछले बिल का किलो रेट लिखें।",
  "handoff.existing.title": "हाल में खरीदा धागा जाँचें",
  "handoff.existing.body": "उसे खोजें और उसका रेट पिछले बिल से मिलाएँ।",
  "rows.unavailable": "अभी दिखाने को कोई धागा नहीं है। पहले धागा जोड़ें; फिर यह चरण उसी पर दिखाएगा।",
  "guide.benefit": "अपने धागे के रेट ताज़ा कैसे रखें, यह देखें।"
}

export type RateBookCopyKey = keyof typeof en
export const rateBookTutorialCopy: Record<Language, Record<RateBookCopyKey, string>> = { en, gu, hi }

export function rateBookControlLabels(t: (key: string) => string, tx: (phrase: string) => string) {
    return {
        addRate: t('tourControls.rateBook.addRate'), needsReview: tx('Needs Review'),
        editRate: tx('Edit rate'), advancedEdit: tx('Advanced edit'),
    }
}

export function rateBookStepCopy(language: Language, step: RateBookStep, hasRealRates: boolean, controls: Record<string, string>) {
    const copy = rateBookTutorialCopy[language]
    const key = step === 'rb-handoff' ? `handoff.${hasRealRates ? 'existing' : 'empty'}` : step.slice(3)
    const quoted = Object.fromEntries(Object.entries(controls).map(([name, label]) => [name, `“${label}”`]))
    const text = (suffix: string) => {
        const value = copy[`${key}.${suffix}` as RateBookCopyKey]
        return value ? formatTourText(value, quoted) : undefined
    }
    return { title: text('title')!, body: text('body')!, detail: text('detail'),
        unavailable: ['rb-update', 'rb-review', 'rb-usage'].includes(step) ? copy['rows.unavailable'] : undefined }
}
