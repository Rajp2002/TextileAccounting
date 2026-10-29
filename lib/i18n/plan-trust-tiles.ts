import type { Language } from './context'

export type PlanTrustTopic = 'receipt' | 'renewal' | 'activation' | 'checkout'

type Phrase = readonly [string, string, string]

/** Longer explanations shown when a billing trust tile on the plan chooser is opened. Order: en, gu, hi. */
const details = {
  receipt: [
    [
      'Every successful payment gets a payment receipt (PDF). You can open or download it any time from Billing.',
      'દરેક સફળ ચુકવણી માટે ચુકવણીની રસીદ (PDF) મળે છે. તમે તેને Billing માંથી ગમે ત્યારે ખોલી કે ડાઉનલોડ કરી શકો છો.',
      'हर सफल भुगतान के लिए भुगतान रसीद (PDF) मिलती है। आप इसे Billing से कभी भी खोल या डाउनलोड कर सकते हैं।',
    ],
    [
      'The receipt confirms that the money was received. Keep it for your records.',
      'રસીદ પુષ્ટિ કરે છે કે રકમ મળી ગઈ છે. તેને તમારા રેકોર્ડ માટે સાચવી રાખો.',
      'रसीद पुष्टि करती है कि रकम मिल गई है। इसे अपने रिकॉर्ड के लिए संभालकर रखें।',
    ],
    [
      'It is not a GST tax invoice. This pilot does not issue GST tax invoices yet, so you cannot claim input tax credit on it.',
      'આ GST ટૅક્સ ઇન્વૉઇસ નથી. આ પાયલટમાં હજી GST ટૅક્સ ઇન્વૉઇસ મળતું નથી, તેથી તેના પર ઇનપુટ ટૅક્સ ક્રેડિટ લઈ શકાશે નહીં.',
      'यह GST टैक्स इनवॉइस नहीं है। इस पायलट में अभी GST टैक्स इनवॉइस नहीं मिलता, इसलिए इस पर इनपुट टैक्स क्रेडिट नहीं लिया जा सकता।',
    ],
  ],
  renewal: [
    [
      'Each payment gives you 365 days of access. Nothing is charged automatically: Weavly keeps no card and sets up no bank mandate.',
      'દરેક ચુકવણીથી 365 દિવસની ઍક્સેસ મળે છે. આપમેળે કંઈ કપાતું નથી: Weavly કોઈ કાર્ડ સાચવતું નથી અને બૅન્ક મેન્ડેટ બનાવતું નથી.',
      'हर भुगतान से 365 दिन की पहुँच मिलती है। अपने आप कुछ नहीं कटता: Weavly कोई कार्ड नहीं रखता और बैंक मैंडेट नहीं बनाता।',
    ],
    [
      'Renewal opens 30 days before your year ends. Pay from Billing whenever you are ready. The renewal price is shown on each plan card.',
      'તમારું વર્ષ પૂરું થવાના 30 દિવસ પહેલાં નવીનીકરણ શરૂ થાય છે. તમે તૈયાર હો ત્યારે Billing માંથી ચુકવણી કરો. નવીનીકરણની કિંમત દરેક પ્લાન કાર્ડ પર બતાવી છે.',
      'आपका साल खत्म होने से 30 दिन पहले नवीनीकरण शुरू होता है। जब आप तैयार हों तब Billing से भुगतान करें। नवीनीकरण की कीमत हर प्लान कार्ड पर दिखाई गई है।',
    ],
    [
      'If you do not renew, the paid features stop after the year ends.',
      'જો તમે નવીનીકરણ ન કરો, તો વર્ષ પૂરું થયા પછી પેઇડ સુવિધાઓ બંધ થઈ જાય છે.',
      'अगर आप नवीनीकरण नहीं करते, तो साल खत्म होने के बाद पेड सुविधाएँ बंद हो जाती हैं।',
    ],
  ],
  activation: [
    [
      'As soon as Razorpay confirms your payment, Weavly verifies it and unlocks your plan automatically, usually within a few seconds.',
      'Razorpay તમારી ચુકવણીની પુષ્ટિ કરે કે તરત Weavly તેની ચકાસણી કરીને તમારો પ્લાન આપમેળે શરૂ કરે છે, સામાન્ય રીતે થોડી સેકન્ડમાં.',
      'Razorpay आपके भुगतान की पुष्टि करते ही Weavly उसकी जाँच करके आपका प्लान अपने आप शुरू कर देता है, आमतौर पर कुछ सेकंड में।',
    ],
    [
      'There is no manual approval and no call to wait for.',
      'કોઈ મેન્યુઅલ મંજૂરી નથી અને કોઈ કૉલની રાહ જોવાની જરૂર નથી.',
      'कोई मैनुअल मंज़ूरी नहीं है और किसी कॉल का इंतज़ार नहीं करना पड़ता।',
    ],
    [
      'If the window closes before it finishes, come back to this page. It checks the payment again and continues.',
      'જો તે પૂરું થાય તે પહેલાં વિન્ડો બંધ થઈ જાય, તો આ પેજ પર પાછા આવો. તે ચુકવણી ફરી તપાસીને આગળ વધે છે.',
      'अगर पूरा होने से पहले विंडो बंद हो जाए, तो इस पेज पर वापस आएँ। यह भुगतान फिर से जाँचकर आगे बढ़ता है।',
    ],
  ],
  checkout: [
    [
      'You pay inside Razorpay’s checkout window using UPI, card or net banking, with bank-grade encryption.',
      'તમે Razorpay ની ચુકવણી વિન્ડોમાં UPI, કાર્ડ કે નેટ બૅન્કિંગથી બૅન્ક સ્તરના એન્ક્રિપ્શન સાથે ચુકવણી કરો છો.',
      'आप Razorpay की भुगतान विंडो में UPI, कार्ड या नेट बैंकिंग से बैंक स्तर के एन्क्रिप्शन के साथ भुगतान करते हैं।',
    ],
    [
      'Weavly never sees or stores your card, UPI or bank details.',
      'Weavly તમારી કાર્ડ, UPI કે બૅન્કની વિગતો ક્યારેય જોતું કે સાચવતું નથી.',
      'Weavly आपके कार्ड, UPI या बैंक की जानकारी कभी नहीं देखता और न ही रखता है।',
    ],
    [
      'Every payment is checked against Razorpay’s signature before your plan changes.',
      'તમારો પ્લાન બદલાય તે પહેલાં દરેક ચુકવણી Razorpay ની સહી સાથે તપાસવામાં આવે છે.',
      'आपका प्लान बदलने से पहले हर भुगतान को Razorpay के हस्ताक्षर से जाँचा जाता है।',
    ],
  ],
} satisfies Record<PlanTrustTopic, readonly Phrase[]>

const labels = {
  learnMore: ['Learn more', 'વધુ જાણો', 'और जानें'],
  close: ['Got it', 'સમજાઈ ગયું', 'समझ गया'],
} satisfies Record<string, Phrase>

function pick(language: Language, phrase: Phrase) {
  return phrase[language === 'gu' ? 1 : language === 'hi' ? 2 : 0]
}

export function planTrustDetails(language: Language, topic: PlanTrustTopic): string[] {
  return details[topic].map(phrase => pick(language, phrase))
}

export function planTrustLabel(language: Language, key: keyof typeof labels): string {
  return pick(language, labels[key])
}
