export type RuntimeLanguage = "en" | "hi" | "gu"

type LocalLanguage = Exclude<RuntimeLanguage, "en">
type WordTranslations = Record<string, string>

type DomainRule = {
  source: RegExp
  variants: Record<LocalLanguage, string[]>
}

const WORD_TRANSLATIONS: Record<LocalLanguage, WordTranslations> = {
  hi: {
    a: "एक",
    about: "के बारे में",
    access: "एक्सेस",
    action: "काम",
    actions: "काम",
    active: "सक्रिय",
    add: "जोड़ें",
    added: "जोड़ा गया",
    after: "बाद",
    all: "सभी",
    amount: "राशि",
    and: "और",
    archive: "आर्काइव",
    archived: "आर्काइव किया गया",
    are: "हैं",
    as: "के रूप में",
    ask: "पूछें",
    assigned: "सौंपा गया",
    attendance: "हाजिरी",
    available: "उपलब्ध",
    back: "वापस",
    balance: "बैलेंस",
    before: "पहले",
    by: "से",
    cancel: "रद्द करें",
    change: "बदलें",
    check: "जांचें",
    choose: "चुनें",
    clear: "साफ करें",
    close: "बंद करें",
    closed: "बंद",
    code: "कोड",
    collect: "वसूल करें",
    complete: "पूरा",
    completed: "पूरा",
    confirm: "पुष्टि करें",
    continue: "जारी रखें",
    create: "बनाएं",
    created: "बनाया गया",
    current: "मौजूदा",
    daily: "दैनिक",
    date: "तारीख",
    day: "दिन",
    days: "दिन",
    delete: "हटाएं",
    deleted: "हटाया गया",
    details: "विवरण",
    done: "पूरा",
    download: "डाउनलोड करें",
    due: "बकाया",
    edit: "बदलें",
    email: "ईमेल",
    empty: "खाली",
    enter: "दर्ज करें",
    error: "त्रुटि",
    expected: "अपेक्षित",
    failed: "विफल",
    filter: "फिल्टर",
    filtered: "फिल्टर किया",
    first: "पहला",
    for: "के लिए",
    found: "मिला",
    from: "से",
    has: "है",
    hidden: "छिपा",
    history: "इतिहास",
    inactive: "निष्क्रिय",
    in: "में",
    invalid: "गलत",
    is: "है",
    last: "आखिरी",
    latest: "नवीनतम",
    list: "सूची",
    loading: "लोड हो रहा है",
    locked: "लॉक",
    log: "दर्ज करें",
    login: "लॉग इन",
    logout: "लॉग आउट",
    manage: "मैनेज करें",
    monthly: "मासिक",
    name: "नाम",
    new: "नया",
    next: "आगे",
    no: "कोई नहीं",
    none: "कोई नहीं",
    not: "नहीं",
    note: "नोट",
    notes: "नोट्स",
    of: "का",
    offline: "ऑफलाइन",
    on: "पर",
    open: "खोलें",
    optional: "वैकल्पिक",
    owner: "मालिक",
    paid: "भुगतान हुआ",
    password: "पासवर्ड",
    pending: "बाकी",
    phone: "फोन",
    please: "कृपया",
    previous: "पिछला",
    printed: "प्रिंट किया गया",
    ready: "तैयार",
    receive: "प्राप्त करें",
    received: "प्राप्त",
    record: "दर्ज करें",
    recorded: "दर्ज हुआ",
    refresh: "रिफ्रेश करें",
    remaining: "बाकी",
    remove: "हटाएं",
    removed: "हटाया गया",
    required: "जरूरी",
    restore: "वापस लाएं",
    save: "सेव करें",
    saved: "सेव हुआ",
    saving: "सेव हो रहा है",
    search: "खोजें",
    select: "चुनें",
    send: "भेजें",
    sent: "भेजा गया",
    settings: "सेटिंग्स",
    show: "दिखाएं",
    start: "शुरू करें",
    status: "स्थिति",
    submit: "जमा करें",
    successfully: "सफलतापूर्वक",
    summary: "सारांश",
    supervisor: "सुपरवाइज़र",
    today: "आज",
    total: "कुल",
    to: "को",
    tomorrow: "कल",
    unable: "नहीं हो सका",
    unlock: "अनलॉक करें",
    update: "अपडेट करें",
    updated: "अपडेट हुआ",
    upload: "अपलोड करें",
    use: "उपयोग करें",
    view: "देखें",
    attention: "ध्यान",
    awaiting: "इंतजार में",
    config: "सेटिंग",
    configure: "सेट करें",
    configured: "सेट किया गया",
    define: "तय करें",
    dispatched: "भेजा गया",
    end: "अंत",
    factory: "फैक्ट्री",
    guide: "गाइड",
    have: "है",
    item: "मामला",
    items: "मामले",
    jump: "जाएं",
    maintenance: "मेंटेनेंस",
    mode: "मोड",
    move: "ले जाएं",
    night: "रात",
    path: "रास्ता",
    production: "उत्पादन",
    prove: "साबित करें",
    review: "देखें",
    run: "रन",
    runs: "रन",
    salary: "salary",
    setup: "सेटअप",
    step: "चरण",
    steps: "चरण",
    tracking: "ट्रैकिंग",
    workflow: "workflow",
    with: "साथ",
    without: "बिना",
    you: "आपके पास",
    worker: "कारीगर",
    workers: "कारीगर",
    yesterday: "कल",
    your: "आपका",
  },
  gu: {
    a: "એક",
    about: "વિશે",
    access: "ઍક્સેસ",
    action: "કામ",
    actions: "કામ",
    active: "સક્રિય",
    add: "ઉમેરો",
    added: "ઉમેરાયું",
    after: "પછી",
    all: "બધા",
    amount: "રકમ",
    and: "અને",
    archive: "આર્કાઇવ",
    archived: "આર્કાઇવ થયું",
    are: "છે",
    as: "તરીકે",
    ask: "પૂછો",
    assigned: "સોંપાયું",
    attendance: "હાજરી",
    available: "ઉપલબ્ધ",
    back: "પાછા",
    balance: "બેલેન્સ",
    before: "પહેલાં",
    by: "દ્વારા",
    cancel: "રદ કરો",
    change: "બદલો",
    check: "ચકાસો",
    choose: "પસંદ કરો",
    clear: "સાફ કરો",
    close: "બંધ કરો",
    closed: "બંધ",
    code: "કોડ",
    collect: "વસૂલ કરો",
    complete: "પૂર્ણ",
    completed: "પૂર્ણ",
    confirm: "ખાતરી કરો",
    continue: "ચાલુ રાખો",
    create: "બનાવો",
    created: "બન્યું",
    current: "હાલનું",
    daily: "દૈનિક",
    date: "તારીખ",
    day: "દિવસ",
    days: "દિવસ",
    delete: "ડિલીટ કરો",
    deleted: "ડિલીટ થયું",
    details: "વિગતો",
    done: "પૂર્ણ",
    download: "ડાઉનલોડ કરો",
    due: "બાકી",
    edit: "ફેરફાર કરો",
    email: "ઈમેઇલ",
    empty: "ખાલી",
    enter: "દાખલ કરો",
    error: "ભૂલ",
    expected: "અપેક્ષિત",
    failed: "નિષ્ફળ",
    filter: "ફિલ્ટર",
    filtered: "ફિલ્ટર કરેલું",
    first: "પહેલું",
    for: "માટે",
    found: "મળ્યું",
    from: "થી",
    has: "છે",
    hidden: "છુપાયેલું",
    history: "ઇતિહાસ",
    inactive: "નિષ્ક્રિય",
    in: "માં",
    invalid: "ખોટું",
    is: "છે",
    last: "છેલ્લું",
    latest: "નવીનતમ",
    list: "યાદી",
    loading: "લોડ થઈ રહ્યું છે",
    locked: "લોક",
    log: "નોંધો",
    login: "લોગ ઇન",
    logout: "લોગ આઉટ",
    manage: "મેનેજ કરો",
    monthly: "માસિક",
    name: "નામ",
    new: "નવું",
    next: "આગળ",
    no: "કોઈ નહીં",
    none: "કોઈ નહીં",
    not: "નહીં",
    note: "નોંધ",
    notes: "નોંધો",
    of: "નું",
    offline: "ઑફલાઇન",
    on: "પર",
    open: "ખોલો",
    optional: "વૈકલ્પિક",
    owner: "માલિક",
    paid: "ચૂકવાયું",
    password: "પાસવર્ડ",
    pending: "બાકી",
    phone: "ફોન",
    please: "મહેરબાની કરીને",
    previous: "પાછલું",
    printed: "પ્રિન્ટ થયું",
    ready: "તૈયાર",
    receive: "પ્રાપ્ત કરો",
    received: "પ્રાપ્ત",
    record: "નોંધો",
    recorded: "નોંધાયું",
    refresh: "રિફ્રેશ કરો",
    remaining: "બાકી",
    remove: "હટાવો",
    removed: "હટાવાયું",
    required: "જરૂરી",
    restore: "પાછું લાવો",
    save: "સેવ કરો",
    saved: "સેવ થયું",
    saving: "સેવ થઈ રહ્યું છે",
    search: "શોધો",
    select: "પસંદ કરો",
    send: "મોકલો",
    sent: "મોકલાયું",
    settings: "સેટિંગ્સ",
    show: "બતાવો",
    start: "શરૂ કરો",
    status: "સ્થિતિ",
    submit: "સબમિટ કરો",
    successfully: "સફળતાપૂર્વક",
    summary: "સારાંશ",
    supervisor: "સુપરવાઇઝર",
    today: "આજે",
    total: "કુલ",
    to: "ને",
    tomorrow: "કાલે",
    unable: "થઈ શક્યું નહીં",
    unlock: "અનલોક કરો",
    update: "અપડેટ કરો",
    updated: "અપડેટ થયું",
    upload: "અપલોડ કરો",
    use: "ઉપયોગ કરો",
    view: "જુઓ",
    attention: "ધ્યાન",
    awaiting: "રાહમાં",
    config: "સેટિંગ",
    configure: "સેટ કરો",
    configured: "સેટ થયું",
    define: "નક્કી કરો",
    dispatched: "મોકલાયું",
    end: "અંત",
    factory: "ફેક્ટરી",
    guide: "ગાઇડ",
    have: "છે",
    item: "મુદ્દો",
    items: "મુદ્દાઓ",
    jump: "જાઓ",
    maintenance: "મેન્ટેનન્સ",
    mode: "મોડ",
    move: "લઈ જાઓ",
    night: "રાત",
    path: "રસ્તો",
    production: "ઉત્પાદન",
    prove: "સાબિત કરો",
    review: "જુઓ",
    run: "રન",
    runs: "રન",
    salary: "salary",
    setup: "સેટઅપ",
    step: "પગલું",
    steps: "પગલાં",
    tracking: "ટ્રેકિંગ",
    workflow: "workflow",
    with: "સાથે",
    without: "વિના",
    you: "તમારી પાસે",
    worker: "કારીગર",
    workers: "કારીગરો",
    yesterday: "ગઈકાલે",
    your: "તમારું",
  },
}

const DOMAIN_TERMS = [
  "stock sales",
  "stock sale",
  "market runs",
  "market run",
  "market maal",
  "gross profit",
  "e-way bill",
  "access code",
  "rate per meter",
  "rate per m",
  "piece-rate",
  "piece rate",
  "free trial",
  "trial",
  "subscription",
  "commercials",
  "commercial",
  "payroll",
  "advances",
  "advance",
  "dispatches",
  "dispatch",
  "invoice",
  "invoices",
  "quote",
  "quotes",
  "order",
  "orders",
  "party",
  "parties",
  "supplier",
  "suppliers",
  "margin",
  "revenue",
  "profit",
  "cost",
  "rate",
  "stock",
  "stocks",
  "meters",
  "metres",
  "meter",
  "metre",
  "mtrs",
  "taka",
  "takas",
  "godown",
  "loom",
  "looms",
  "yarn",
  "beam",
  "beams",
  "warp",
  "weft",
  "pick",
  "picks",
  "crimp",
  "sizing",
  "finishing",
  "processing",
  "weaving",
  "fabric",
  "quality",
  "qualities",
  "batch",
  "batches",
  "lot",
  "lots",
  "challan",
  "gst",
  "pf",
  "esi",
  "tds",
  "dpdp",
  "ewb",
  "api",
  "rls",
  "pwa",
  "pdf",
  "csv",
  "upi",
  "qr",
  "whatsapp",
  "razorpay",
  "supabase",
  "weavly",
  "loomi",
]

const SOURCE_DOMAIN_PATTERN = new RegExp(
  `(^|[^A-Za-z0-9])(${DOMAIN_TERMS.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})(?=$|[^A-Za-z0-9])`,
  "gi",
)

const DOMAIN_RULES: DomainRule[] = [
  rule(/\bstock sales?\b/i, {
    hi: ["स्टॉक बिक्री", "स्टॉक सेल", "स्टॉक सेल्स", "स्टॉक"],
    gu: ["સ્ટોક વેચાણ", "સ્ટોક સેલ", "સ્ટોક સેલ્સ", "સ્ટોક"],
  }),
  rule(/\bstocks?\b/i, {
    hi: ["स्टॉक", "स्टाक"],
    gu: ["સ્ટોક"],
  }),
  rule(/\bmeters?\b|\bmetres?\b|\bmtrs?\b/i, {
    hi: ["मीटर", "मीटर्स", "मी.", "मीटरों"],
    gu: ["મીટર", "મીટર્સ", "મી."],
  }),
  rule(/\bmargin\b/i, {
    hi: ["मार्जिन"],
    gu: ["માર્જિન"],
  }),
  rule(/\bmarket runs?\b/i, {
    hi: ["मार्केट रन", "मार्केट रन्स"],
    gu: ["માર્કેટ રન", "માર્કેટ રન્સ"],
  }),
  rule(/\bgross profit\b/i, {
    hi: ["ग्रॉस प्रॉफिट", "सकल लाभ"],
    gu: ["ગ્રોસ પ્રોફિટ", "કુલ નફો"],
  }),
  rule(/\bprofit\b/i, {
    hi: ["प्रॉफिट", "लाभ", "नफा"],
    gu: ["પ્રોફિટ", "નફો"],
  }),
  rule(/\brevenue\b/i, {
    hi: ["रेवेन्यू", "आय"],
    gu: ["રેવન્યુ", "આવક"],
  }),
  rule(/\bcost\b/i, {
    hi: ["कॉस्ट", "लागत"],
    gu: ["કોસ્ટ", "ખર્ચ"],
  }),
  rule(/\brate\b/i, {
    hi: ["रेट", "दर"],
    gu: ["રેટ", "ભાવ", "દર"],
  }),
  rule(/\bcommercials?\b/i, {
    hi: ["कमर्शियल्स", "कमर्शियल"],
    gu: ["કોમર્શિયલ્સ", "કોમર્શિયલ"],
  }),
  rule(/\bpayroll\b/i, {
    hi: ["पेरोल"],
    gu: ["પેરોલ"],
  }),
  rule(/\badvances?\b/i, {
    hi: ["एडवांस", "अग्रिम"],
    gu: ["એડવાન્સ", "અગ્રિમ"],
  }),
  rule(/\bdispatch(?:es)?\b/i, {
    hi: ["डिस्पैच", "रवानगी", "भेजा"],
    gu: ["ડિસ્પેચ", "રવાનગી", "મોકલ્યું"],
  }),
  rule(/\binvoices?\b/i, {
    hi: ["इनवॉइस", "चालान"],
    gu: ["ઇન્વોઇસ", "ચાલાન"],
  }),
  rule(/\bquotes?\b/i, {
    hi: ["कोट्स", "कोट", "उद्धरण"],
    gu: ["કોટ્સ", "કોટ", "ભાવપત્ર"],
  }),
  rule(/\borders?\b/i, {
    hi: ["ऑर्डर", "आदेश"],
    gu: ["ઓર્ડર", "ઑર્ડર"],
  }),
  rule(/\bpart(?:y|ies)\b/i, {
    hi: ["पार्टी", "पार्टियां"],
    gu: ["પાર્ટી", "પાર્ટીઓ"],
  }),
  rule(/\bsuppliers?\b/i, {
    hi: ["सप्लायर", "आपूर्तिकर्ता"],
    gu: ["સપ્લાયર", "પુરવઠાકર્તા"],
  }),
  rule(/\btakas?\b/i, {
    hi: ["ताका", "ताके"],
    gu: ["તાકા", "તાકા"],
  }),
  rule(/\bgodown\b/i, {
    hi: ["गोदाम"],
    gu: ["ગોડાઉન"],
  }),
  rule(/\blooms?\b/i, {
    hi: ["लूम", "लूम्स", "करघा"],
    gu: ["લૂમ", "લૂમ્સ", "સાળ"],
  }),
  rule(/\byarn\b/i, {
    hi: ["यार्न", "सूत"],
    gu: ["યાર્ન", "સૂતર"],
  }),
  rule(/\bbeams?\b/i, {
    hi: ["बीम"],
    gu: ["બીમ"],
  }),
  rule(/\bwarp\b/i, {
    hi: ["वार्प", "ताना"],
    gu: ["વાર્પ", "તાણું"],
  }),
  rule(/\bweft\b/i, {
    hi: ["वेफ्ट", "बाना"],
    gu: ["વેફ્ટ", "વાણું"],
  }),
  rule(/\bpicks?\b/i, {
    hi: ["पिक", "पिक्स"],
    gu: ["પિક", "પિક્સ"],
  }),
  rule(/\bcrimp\b/i, {
    hi: ["क्रिम्प"],
    gu: ["ક્રિમ્પ"],
  }),
  rule(/\bsizing\b/i, {
    hi: ["साइजिंग"],
    gu: ["સાઇઝિંગ"],
  }),
  rule(/\bfinishing\b/i, {
    hi: ["फिनिशिंग"],
    gu: ["ફિનિશિંગ"],
  }),
  rule(/\bprocessing\b/i, {
    hi: ["प्रोसेसिंग", "प्रसंस्करण"],
    gu: ["પ્રોસેસિંગ", "પ્રક્રિયા"],
  }),
  rule(/\bweaving\b/i, {
    hi: ["वीविंग", "बुनाई"],
    gu: ["વીવિંગ", "વણાટ"],
  }),
  rule(/\bfabric\b/i, {
    hi: ["फैब्रिक", "कपड़ा"],
    gu: ["ફેબ્રિક", "કાપડ"],
  }),
  rule(/\bqualit(?:y|ies)\b/i, {
    hi: ["क्वालिटी", "गुणवत्ता"],
    gu: ["ક્વોલિટી", "ગુણવત્તા"],
  }),
  rule(/\bbatch(?:es)?\b/i, {
    hi: ["बैच"],
    gu: ["બેચ"],
  }),
  rule(/\blots?\b/i, {
    hi: ["लॉट"],
    gu: ["લોટ"],
  }),
  rule(/\bchallan\b/i, {
    hi: ["चालान"],
    gu: ["ચલણ", "ચાલાન"],
  }),
]

const WORD_OR_NUMBER_PATTERN = /(\{[A-Za-z0-9_]+\}|₹\s*\d[\d,.]*|\d[\d,.]*(?:st|nd|rd|th|%|\/[A-Za-z]+)?|[A-Za-z][A-Za-z'-]*|[^\w{}]+)/gi
const ASCII_WORD_PATTERN = /^[A-Za-z][A-Za-z'-]*$/
const SOURCE_NUMBER_TOKEN_PATTERN = /₹\s*\d[\d,.]*|\d[\d,.]*(?:st|nd|rd|th|%|\/[A-Za-z]+)?/gi

export function translateFallbackUiText(source: string, language: RuntimeLanguage): string | undefined {
  if (language === "en" || !shouldUseFallback(source)) return undefined

  const dictionary = WORD_TRANSLATIONS[language]
  const segments = protectDomainTerms(source)
  let translatedAny = false

  const translated = segments
    .map((segment) => {
      if (segment.protected) return segment.text

      return segment.text.replace(WORD_OR_NUMBER_PATTERN, (part) => {
        if (!ASCII_WORD_PATTERN.test(part)) return part
        const lower = part.toLowerCase()
        const replacement = dictionary[lower]
        if (!replacement) return part
        translatedAny = true
        return preserveWordCase(part, replacement)
      })
    })
    .join("")

  return translatedAny && translated !== source ? translated : undefined
}

export function applyTranslationGuards(source: string, target: string, language: RuntimeLanguage) {
  if (language === "en" || !target) return target

  let guarded = restoreSourceNumberTokens(source, target)
  const replacements: Array<{ variant: string; replacement: string }> = []

  for (const domainRule of DOMAIN_RULES) {
    const sourceMatch = source.match(domainRule.source)
    if (!sourceMatch) continue

    const replacement = sourceMatch[0]
    for (const variant of domainRule.variants[language]) {
      replacements.push({ variant, replacement })
    }
  }

  replacements
    .sort((a, b) => b.variant.length - a.variant.length)
    .forEach(({ variant, replacement }) => {
      guarded = replaceLocalizedVariant(guarded, variant, replacement)
    })

  return guarded
}

function rule(source: RegExp, variants: Record<LocalLanguage, string[]>): DomainRule {
  return { source, variants }
}

function shouldUseFallback(source: string) {
  const trimmed = source.trim()
  if (!trimmed || trimmed.length > 140 || !/[A-Za-z]/.test(trimmed)) return false
  if (/https?:\/\/|www\.|@/.test(trimmed)) return false
  if (/^[A-Z0-9_-]{8,}$/.test(trimmed)) return false

  const words = trimmed.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
  if (words.length === 0 || words.length > 14) return false

  const knownWords = words.filter((word) => {
    const lower = word.toLowerCase()
    return lower in WORD_TRANSLATIONS.hi || isDomainTerm(word)
  })

  return knownWords.length > 0
}

function protectDomainTerms(source: string) {
  const segments: Array<{ text: string; protected: boolean }> = []
  let lastIndex = 0

  source.replace(SOURCE_DOMAIN_PATTERN, (match, prefix: string, term: string, offset: number) => {
    const termStart = offset + prefix.length
    if (termStart > lastIndex) {
      segments.push({ text: source.slice(lastIndex, termStart), protected: false })
    }
    segments.push({ text: term, protected: true })
    lastIndex = termStart + term.length
    return match
  })

  if (lastIndex < source.length) {
    segments.push({ text: source.slice(lastIndex), protected: false })
  }

  return segments.length > 0 ? segments : [{ text: source, protected: false }]
}

function isDomainTerm(word: string) {
  const lower = word.toLowerCase()
  return DOMAIN_TERMS.includes(lower)
}

function replaceLocalizedVariant(source: string, variant: string, replacement: string) {
  return source.replace(new RegExp(escapeRegExp(variant), "g"), replacement)
}

function restoreSourceNumberTokens(source: string, target: string) {
  const sourceTokens = source.match(SOURCE_NUMBER_TOKEN_PATTERN) ?? []
  let guarded = target

  for (const token of sourceTokens) {
    if (guarded.includes(token)) continue

    const numericPart = token.match(/\d[\d,.]*/)?.[0]
    if (!numericPart) continue

    guarded = guarded.replace(
      new RegExp(`${escapeRegExp(numericPart)}\\s*(?:वीं|वाँ|वा|મી|મો|મું)?`, "g"),
      token,
    )
  }

  return guarded
}

function preserveWordCase(source: string, replacement: string) {
  if (source.toUpperCase() === source) return replacement.toUpperCase()
  if (source[0]?.toUpperCase() === source[0]) {
    return `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`
  }
  return replacement
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
