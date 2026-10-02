import type { Language } from './i18n/context'

export type UpgradePlan = 'free' | 'lite' | 'base'
export type UpgradeFeature = 'estimator' | 'costings' | 'qualities' | 'rates' | 'production' | 'payroll'

export const UPGRADE_FEATURE_IMAGES: Record<UpgradeFeature, { src: string; width: number; height: number }> = {
  estimator: { src: '/images/plans/estimator.png', width: 496, height: 265 },
  costings: { src: '/images/plans/costings.png', width: 1100, height: 370 },
  qualities: { src: '/images/plans/qualities.png', width: 636, height: 324 },
  rates: { src: '/images/plans/rates.png', width: 976, height: 574 },
  production: { src: '/images/plans/production.svg', width: 640, height: 440 },
  payroll: { src: '/images/plans/payroll.svg', width: 640, height: 440 },
}

export const UPGRADE_PLAN_FEATURES: Record<UpgradePlan, readonly UpgradeFeature[]> = {
  free: ['estimator', 'costings'],
  lite: ['estimator', 'costings', 'qualities', 'rates'],
  base: ['estimator', 'costings', 'qualities', 'rates', 'production', 'payroll'],
}

// English, Gujarati, Hindi. Keep limits and sample labels explicit in every language.
const phrases = {
  title: ['Choose your plan', 'તમારો પ્લાન પસંદ કરો', 'अपना प्लान चुनें'],
  intro: ['Explore each feature to see what your plan includes.', 'તમારા પ્લાનમાં શું મળે છે તે જાણવા દરેક સુવિધા જુઓ.', 'हर सुविधा देखकर जानें कि आपके प्लान में क्या शामिल है।'],
  freeFit: ['For occasional costings', 'ક્યારેક કોસ્ટિંગ કરવા માટે', 'कभी-कभी कॉस्टिंग करने के लिए'],
  liteFit: ['Your complete costing desk', 'તમારી સંપૂર્ણ કોસ્ટિંગ વ્યવસ્થા', 'आपकी पूरी कॉस्टिंग व्यवस्था'],
  baseFit: ['Costing, production and payroll', 'કોસ્ટિંગ, ઉત્પાદન અને પગાર', 'कॉस्टिंग, उत्पादन और वेतन'],
  current: ['Current plan', 'હાલનો પ્લાન', 'मौजूदा प्लान'],
  selected: ['Selected', 'પસંદ કરેલ', 'चयनित'],
  continueFree: ['Continue with Free', 'Free સાથે ચાલુ રાખો', 'Free के साथ जारी रखें'],
  comparison: ['Included for comparison', 'સરખામણી માટે દર્શાવેલ', 'तुलना के लिए दिखाया गया'],
  previous: ['Previous feature', 'પાછલી સુવિધા', 'पिछली सुविधा'],
  next: ['Next feature', 'આગલી સુવિધા', 'अगली सुविधा'],
  featureCount: ['Feature {current} of {total}', 'સુવિધા {current} / {total}', 'सुविधा {current} / {total}'],
  sample: ['Feature preview · example data', 'સુવિધાની ઝલક · નમૂનાની માહિતી', 'सुविधा की झलक · उदाहरण डेटा'],
  picture: ['{feature} feature preview', '{feature} સુવિધાની ઝલક', '{feature} सुविधा की झलक'],
  enlarge: ['Enlarge picture', 'ચિત્ર મોટું કરો', 'चित्र बड़ा करें'],
  close: ['Close picture', 'ચિત્ર બંધ કરો', 'चित्र बंद करें'],
  swipe: ['Use the arrows or swipe the picture to explore.', 'જોવા માટે તીર વાપરો અથવા ચિત્ર પર સ્વાઇપ કરો.', 'देखने के लिए तीर दबाएँ या चित्र पर स्वाइप करें।'],
  firstYear: ['first year', 'પ્રથમ વર્ષ', 'पहला वर्ष'],
  renewal: ['{amount} / year to renew', 'નવીનીકરણ માટે {amount} / વર્ષ', 'नवीनीकरण के लिए {amount} / वर्ष'],
  tax: ['GST included · manual annual renewal', 'GST સામેલ · જાતે વાર્ષિક નવીનીકરણ', 'GST शामिल · स्वयं वार्षिक नवीनीकरण'],
  freePrice: ['No subscription fee', 'સબ્સ્ક્રિપ્શન ફી નથી', 'कोई सदस्यता शुल्क नहीं'],
  estimator: ['Cost Estimator', 'કોસ્ટ એસ્ટિમેટર', 'लागत अनुमानक'],
  costings: ['Saved Costings', 'સાચવેલી કોસ્ટિંગ', 'सहेजी गई कॉस्टिंग'],
  qualities: ['Saved Qualities', 'સાચવેલી ક્વોલિટી', 'सहेजी गई क्वालिटी'],
  rates: ['Rate Book', 'રેટ બુક', 'रेट बुक'],
  production: ['Production', 'ઉત્પાદન', 'उत्पादन'],
  payroll: ['Payroll', 'પગાર', 'वेतन'],
  create: ['Calculate fabric costs and selling prices.', 'કાપડનો ખર્ચ અને વેચાણ ભાવ ગણો.', 'कपड़े की लागत और बिक्री मूल्य की गणना करें।'],
  limit: ['Create 2 costings per month.', 'દર મહિને 2 કોસ્ટિંગ બનાવો.', 'हर महीने 2 कॉस्टिंग बनाएँ।'],
  noQuality: ['Reusable saved qualities are not included.', 'ફરી વાપરી શકાય તેવી સાચવેલી ક્વોલિટી સામેલ નથી.', 'दोबारा उपयोग करने योग्य सहेजी गई क्वालिटी शामिल नहीं हैं।'],
  unlimited: ['Create unlimited costings.', 'અમર્યાદિત કોસ્ટિંગ બનાવો.', 'असीमित कॉस्टिंग बनाएँ।'],
  reuse: ['Save a quality and reuse its construction inputs.', 'ક્વોલિટી સાચવો અને તેની બનાવટની માહિતી ફરી વાપરો.', 'क्वालिटी सहेजें और उसकी बनावट की जानकारी दोबारा उपयोग करें।'],
  updated: ['Use updated quality rates for your next costing.', 'આગલી કોસ્ટિંગમાં ક્વોલિટીના અપડેટ થયેલા દર વાપરો.', 'अगली कॉस्टिंग में क्वालिटी के अपडेट किए गए दर उपयोग करें।'],
  freeHistory: ['Completed costings are saved automatically.', 'પૂર્ણ કોસ્ટિંગ આપમેળે સાચવાય છે.', 'पूरी कॉस्टिंग अपने आप सहेजी जाती हैं।'],
  viewExport: ['View the breakdown and export your cost sheet.', 'ખર્ચની વિગત જુઓ અને કોસ્ટ શીટ નિકાસ કરો.', 'लागत विवरण देखें और कॉस्ट शीट निर्यात करें।'],
  noAllowance: ['Viewing and export do not use your monthly allowance.', 'જોવા અને નિકાસમાં માસિક ભથ્થું વપરાતું નથી.', 'देखने और निर्यात करने से मासिक सीमा खर्च नहीं होती।'],
  paidHistory: ['Keep costing records and their original figures.', 'કોસ્ટિંગ રેકોર્ડ અને તેના મૂળ આંકડા સાચવો.', 'कॉस्टिंग रिकॉर्ड और उनके मूल आँकड़े रखें।'],
  recalculate: ['Reopen a costing to reuse or recalculate it.', 'ફરી વાપરવા કે ગણવા કોસ્ટિંગ ફરી ખોલો.', 'दोबारा उपयोग या गणना के लिए कॉस्टिंग फिर खोलें।'],
  construction: ['Store warp, weft and fabric construction details.', 'તાણા, વાણ અને કાપડની બનાવટની વિગતો સાચવો.', 'ताना, बाना और कपड़े की बनावट का विवरण सहेजें।'],
  startQuality: ['Start repeat enquiries from a saved quality.', 'ફરી આવતી પૂછપરછ સાચવેલી ક્વોલિટીથી શરૂ કરો.', 'दोहराई गई पूछताछ सहेजी गई क्वालिटी से शुरू करें।'],
  linkRates: ['Link yarns to Rate Book to keep rates current.', 'દર તાજા રાખવા યાર્નને રેટ બુક સાથે જોડો.', 'दर वर्तमान रखने के लिए यार्न को रेट बुक से जोड़ें।'],
  updateRate: ['Update a yarn rate once in Rate Book.', 'રેટ બુકમાં યાર્નનો દર એક વાર અપડેટ કરો.', 'रेट बुक में यार्न का दर एक बार अपडेट करें।'],
  linked: ['Linked active qualities receive the new rate automatically.', 'જોડાયેલી સક્રિય ક્વોલિટીમાં નવો દર આપમેળે લાગુ થાય છે.', 'जुड़ी सक्रिय क्वालिटी में नया दर अपने आप लागू होता है।'],
  snapshots: ['Previous saved costings keep their original figures.', 'અગાઉની સાચવેલી કોસ્ટિંગના આંકડા યથાવત રહે છે.', 'पहले की सहेजी गई कॉस्टिंग के आँकड़े वही रहते हैं।'],
  jobs: ['Activate a saved costing and assign it to looms.', 'સાચવેલી કોસ્ટિંગ સક્રિય કરો અને લૂમને સોંપો.', 'सहेजी गई कॉस्टिंग सक्रिय करें और लूम को सौंपें।'],
  metres: ['Track output by quality, machine and shift.', 'ક્વોલિટી, મશીન અને શિફ્ટ પ્રમાણે ઉત્પાદન જુઓ.', 'क्वालिटी, मशीन और शिफ्ट के अनुसार उत्पादन देखें।'],
  daily: ['Record daily output against machines and workers.', 'મશીન અને કામદાર મુજબ દૈનિક ઉત્પાદન નોંધો.', 'मशीन और कर्मचारी के अनुसार दैनिक उत्पादन दर्ज करें।'],
  earnings: ['Calculate piece-rate earnings from production logs.', 'ઉત્પાદન નોંધમાંથી પીસ-રેટ કમાણી ગણો.', 'उत्पादन लॉग से पीस-रेट कमाई की गणना करें।'],
  advances: ['Include worker advances and recoveries.', 'કામદારની એડવાન્સ અને વસૂલી સામેલ કરો.', 'कर्मचारियों के अग्रिम और वसूली शामिल करें।'],
  settlements: ['Review net pay and record settlements.', 'ચોખ્ખો પગાર તપાસો અને ચુકવણી નોંધો.', 'शुद्ध वेतन की समीक्षा करें और भुगतान दर्ज करें।'],
  everythingInFree: ['Everything in Free, plus:', 'Free ની તમામ સુવિધાઓ ઉપરાંત:', 'Free की सभी सुविधाओं के अलावा:'],
  everythingInLite: ['Everything in Lite, plus:', 'Lite ની તમામ સુવિધાઓ ઉપરાંત:', 'Lite की सभी सुविधाओं के अलावा:'],
  viewPreview: ['View preview', 'ઝલક જુઓ', 'झलक देखें'],
  watchDemo: ['Watch demo', 'ડેમો જુઓ', 'डेमो देखें'],
  watchFeatureDemo: ['Watch {feature} demo', '{feature} નો ડેમો જુઓ', '{feature} का डेमो देखें'],
  closePreview: ['Close preview', 'ઝલક બંધ કરો', 'झलक बंद करें'],
  demoHelp: ['{language} narration · captions available', '{language} વર્ણન · કૅપ્શન ઉપલબ્ધ', '{language} में वर्णन · कैप्शन उपलब्ध'],
  demoNarrationLanguage: ['Narration language', 'વર્ણનની ભાષા', 'वर्णन की भाषा'],
  demoScreenLanguage: ['Screen recording in English', 'સ્ક્રીન રેકોર્ડિંગ અંગ્રેજીમાં છે', 'स्क्रीन रिकॉर्डिंग अंग्रेज़ी में है'],
  demoPlanNote: ['Recorded in Weavly Base. Availability is shown in each plan’s feature list.', 'Weavly Base માં રેકોર્ડ કરેલ. ઉપલબ્ધ સુવિધાઓ દરેક પ્લાનની યાદીમાં દર્શાવેલ છે.', 'Weavly Base में रिकॉर्ड किया गया। उपलब्ध सुविधाएँ हर प्लान की सूची में दी गई हैं।'],
  demoTranscript: ['Read walkthrough', 'ડેમોનું વર્ણન વાંચો', 'डेमो का विवरण पढ़ें'],
  demoUnavailable: ['The video could not load. Open the video directly or read the walkthrough.', 'વિડિયો લોડ થઈ શક્યો નથી. વિડિયો સીધો ખોલો અથવા વર્ણન વાંચો.', 'वीडियो लोड नहीं हो सका। वीडियो सीधे खोलें या विवरण पढ़ें।'],
  openVideo: ['Open video', 'વિડિયો ખોલો', 'वीडियो खोलें'],
  enlargePreview: ['Enlarge preview', 'મોટું કરીને જુઓ', 'बड़ा करके देखें'],
  upgradeToLite: ['Upgrade to Lite', 'Lite માં અપગ્રેડ કરો', 'Lite में अपग्रेड करें'],
  upgradeToBase: ['Upgrade to Base', 'Base માં અપગ્રેડ કરો', 'Base में अपग्रेड करें'],
  chooseLite: ['Choose Lite', 'Lite પસંદ કરો', 'Lite चुनें'],
  chooseBase: ['Choose Base', 'Base પસંદ કરો', 'Base चुनें'],
  includedInBase: ['Included in your Base plan', 'તમારા Base પ્લાનમાં સામેલ છે', 'आपके Base प्लान में शामिल है'],
  freeForever: ['Free forever', 'કાયમ માટે ફ્રી', 'हमेशा के लिए फ्री'],
  twoEstimatesPerMonth: ['2 cost estimates / month', 'મહિને 2 કોસ્ટ એસ્ટિમેટ', 'हर महीने 2 लागत अनुमान'],
  unlimitedEstimates: ['Unlimited cost estimates', 'અમર્યાદિત કોસ્ટ એસ્ટિમેટ્સ', 'असीमित लागत अनुमान'],
  savedQualitiesLibrary: ['Reusable saved qualities library', 'ફરી વાપરી શકાય તેવી ક્વોલિટી લાઇબ્રેરી', 'पुन: प्रयोज्य सहेजी गई क्वालिटी लाइब्रेरी'],
  rateBookYarnLinking: ['Rate Book with live yarn linking', 'લાઇવ યાર્ન લિંકિંગ સાથે રેટ બુક', 'लाइव यार्न लिंकिंग के साथ रेट बुक'],
  productionLoomTracking: ['Production job cards & loom tracking', 'ઉત્પાદન જોબ કાર્ડ અને લૂમ ટ્રેકિંગ', 'उत्पादन जॉब कार्ड और लूम ट्रैकिंग'],
  payrollPieceRate: ['Piece-rate worker earnings & settlements', 'પીસ-રેટ કામદાર કમાણી અને ચુકવણી', 'पीस-रेट कर्मचारी कमाई और भुगतान'],
  backToBilling: ['Back to Billing', 'બિલિંગ પર પાછા જાઓ', 'बिलिंग पर वापस जाएँ'],
  backToEstimator: ['Back to Estimator', 'એસ્ટિમેટર પર પાછા જાઓ', 'अनुमानक पर वापस जाएँ'],
  backToWorkspace: ['Back to Workspace', 'વર્કસ્પેસ પર પાછા જાઓ', 'कार्यक्षेत्र पर वापस जाएँ'],
  explorePlans: ['Explore plans', 'પ્લાન જુઓ', 'प्लान देखें'],
  compareAllPlans: ['Compare all plans', 'તમામ પ્લાનની સરખામણી કરો', 'सभी प्लान की तुलना करें'],
  upgradeYourPlan: ['Upgrade your plan', 'તમારો પ્લાન અપગ્રેડ કરો', 'अपना प्लान अपग्रेड करें'],
  upgradeSubtitle: ['Unlock unlimited costings, saved qualities, and production tools.', 'અમર્યાદિત કોસ્ટિંગ, ક્વોલિટી અને ઉત્પાદન ટૂલ્સ મેળવો.', 'असीमित कॉस्टिंग, सहेजी गई क्वालिटी और उत्पादन उपकरण प्राप्त करें।'],
} satisfies Record<string, readonly [string, string, string]>

export type UpgradeText = keyof typeof phrases

export function upgradeText(language: Language, key: UpgradeText, values: Record<string, string | number> = {}) {
  return phrases[key][language === 'gu' ? 1 : language === 'hi' ? 2 : 0]
    .replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

export function upgradeFeatureBullets(plan: UpgradePlan, feature: UpgradeFeature): readonly UpgradeText[] {
  switch (feature) {
    case 'estimator': return plan === 'free' ? ['create', 'limit', 'noQuality'] : ['unlimited', 'reuse', 'updated']
    case 'costings': return plan === 'free' ? ['freeHistory', 'viewExport', 'noAllowance'] : ['paidHistory', 'recalculate', 'viewExport']
    case 'qualities': return ['construction', 'startQuality', 'linkRates']
    case 'rates': return ['updateRate', 'linked', 'snapshots']
    case 'production': return ['jobs', 'metres', 'daily']
    case 'payroll': return ['earnings', 'advances', 'settlements']
  }
}
