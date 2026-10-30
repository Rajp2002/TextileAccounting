import type { Language } from './context'

// English, Gujarati, Hindi, following the existing plan and trial dictionaries.
export const planSelectionPhrases = {
  title: ['Choose the right plan for your business', 'તમારા વ્યવસાય માટે યોગ્ય પ્લાન પસંદ કરો', 'अपने व्यवसाय के लिए सही प्लान चुनें'],
  subtitle: ['Start with Free or explore your complete costing desk with Lite.', 'Free સાથે શરૂ કરો અથવા Lite સાથે સંપૂર્ણ કોસ્ટિંગ વ્યવસ્થા અજમાવો.', 'Free से शुरुआत करें या Lite के साथ पूरी कॉस्टिंग व्यवस्था आज़माएँ।'],
  launchOffer: ['Launch offer · 3 months free', 'લોન્ચ ઑફર · 3 મહિના મફત', 'लॉन्च ऑफ़र · 3 महीने मुफ़्त'],
  first90Days: ['For your first 90 days', 'તમારા પ્રથમ 90 દિવસ માટે', 'आपके पहले 90 दिनों के लिए'],
  noPayment: ['Full Lite access. No payment required to start.', 'Lite ની તમામ સુવિધાઓ. શરૂ કરવા કોઈ ચુકવણી જરૂરી નથી.', 'Lite की सभी सुविधाएँ। शुरू करने के लिए भुगतान की ज़रूरत नहीं।'],
  afterTrial: ['After your trial', 'તમારી ટ્રાયલ પછી', 'आपके ट्रायल के बाद'],
  firstYear: ['{amount} / first year, including GST', 'પ્રથમ વર્ષ માટે {amount}, GST સહિત', 'पहले साल के लिए {amount}, GST सहित'],
  details: ['Plan details', 'પ્લાનની વિગતો', 'प्लान विवरण'],
  support: ['Support', 'સપોર્ટ', 'सहायता'],
  planDetails: ['Features & billing details', 'સુવિધાઓ અને બિલિંગની વિગતો', 'सुविधाएँ और बिलिंग विवरण'],
  help: ['Need help? Contact support', 'મદદ જોઈએ છે? સપોર્ટનો સંપર્ક કરો', 'मदद चाहिए? सहायता से संपर्क करें'],
  paymentStatus: ['Payment status', 'ચુકવણીની સ્થિતિ', 'भुगतान की स्थिति'],
  activationError: ['Could not finish setup', 'સેટઅપ પૂર્ણ થઈ શક્યું નથી', 'सेटअप पूरा नहीं हो सका'],
  trialError: ['Could not start your trial', 'તમારી ટ્રાયલ શરૂ થઈ શકી નથી', 'आपका ट्रायल शुरू नहीं हो सका'],
  included: ['Included in Free', 'Free માં સામેલ', 'Free में शामिल'],
  estimatorDescription: ['Calculate fabric costs, margins and break-even selling prices.', 'કાપડનો ખર્ચ, માર્જિન અને બ્રેક-ઈવન વેચાણ ભાવ ગણો.', 'कपड़े की लागत, मार्जिन और ब्रेक-ईवन बिक्री मूल्य की गणना करें।'],
  costingsDescription: ['Review previous costings and export their cost breakdowns.', 'અગાઉની કોસ્ટિંગ જુઓ અને ખર્ચની વિગતો નિકાસ કરો.', 'पिछली कॉस्टिंग देखें और लागत का विवरण निर्यात करें।'],
  qualitiesDescription: ['Save fabric constructions and reuse them for your next enquiry.', 'કાપડની બનાવટ સાચવો અને આગલી પૂછપરછ માટે ફરી વાપરો.', 'कपड़े की बनावट सहेजें और अगली पूछताछ में दोबारा उपयोग करें।'],
  ratesDescription: ['Update yarn rates and keep linked active qualities current.', 'યાર્નના દર અપડેટ કરો અને જોડાયેલી સક્રિય ક્વોલિટીના દર તાજા રાખો.', 'यार्न के दर अपडेट करें और जुड़ी सक्रिय क्वालिटी के दर वर्तमान रखें।'],
  productionDescription: ['Track daily output by quality, machine and shift.', 'ક્વોલિટી, મશીન અને શિફ્ટ પ્રમાણે દૈનિક ઉત્પાદન જુઓ.', 'क्वालिटी, मशीन और शिफ्ट के अनुसार दैनिक उत्पादन देखें।'],
  payrollDescription: ['Review worker earnings, advances and settlements.', 'કામદારની કમાણી, એડવાન્સ અને ચુકવણી જુઓ.', 'कर्मचारियों की कमाई, अग्रिम और भुगतान की समीक्षा करें।'],
  trustTitle: ['Simple, transparent and secure', 'સરળ, પારદર્શક અને સુરક્ષિત', 'सरल, पारदर्शी और सुरक्षित'],
  shortReceipt: ['Receipts', 'રસીદ', 'रसीद'],
  shortRenewal: ['Renewal', 'નવીનીકરણ', 'नवीनीकरण'],
  shortActivation: ['Activation', 'ઍક્ટિવેશન', 'सक्रियण'],
  shortCheckout: ['Checkout', 'ચુકવણી', 'भुगतान'],
  receiptSummary: ['Download payment receipts.', 'ચુકવણીની રસીદ ડાઉનલોડ કરો.', 'भुगतान रसीद डाउनलोड करें।'],
  renewalSummary: ['You stay in control of billing.', 'બિલિંગનું નિયંત્રણ તમારા હાથમાં.', 'बिलिंग का नियंत्रण आपके हाथ में।'],
  activationSummary: ['Access after payment verification.', 'ચુકવણીની ચકાસણી પછી ઍક્સેસ.', 'भुगतान सत्यापन के बाद पहुँच।'],
  checkoutSummary: ['Protected payment processing.', 'સુરક્ષિત ચુકવણી પ્રક્રિયા.', 'सुरक्षित भुगतान प्रक्रिया।'],
  close: ['Got it', 'સમજાઈ ગયું', 'समझ गए'],
} satisfies Record<string, readonly [string, string, string]>

export function planSelectionText(language: Language, key: keyof typeof planSelectionPhrases, values: Record<string, string | number> = {}) {
  return planSelectionPhrases[key][language === 'gu' ? 1 : language === 'hi' ? 2 : 0]
    .replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
