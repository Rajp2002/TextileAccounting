import { BASE_PLAN_PHRASES } from "./base-plan-phrases"

export type RuntimeLanguage = "en" | "hi" | "gu"

type LocalLanguage = Exclude<RuntimeLanguage, "en">
type WordTranslations = Record<string, string>

export type FallbackTranslationOptions = {
  /** Localize non-glossary domain words for the Base-plan surfaces. */
  localizeDomainTerms?: boolean
}

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
    review: "समीक्षा",
    run: "रन",
    runs: "रन",
    salary: "salary",
    setup: "सेटअप",
    step: "चरण",
    steps: "चरण",
    tracking: "ट्रैकिंग",
    workflow: "वर्कफ़्लो",
    with: "साथ",
    without: "बिना",
    you: "आपके पास",
    worker: "कारीगर",
    workers: "कारीगर",
    yesterday: "कल",
    your: "आपका",
    again: "फिर",
    acknowledgement: "पुष्टि",
    actual: "वास्तविक",
    adjustment: "समायोजन",
    adds: "जोड़ता है",
    alert: "चेतावनी",
    average: "औसत",
    any: "कोई भी",
    applied: "लागू",
    assumptions: "धारणाएँ",
    based: "आधारित",
    be: "होना",
    below: "नीचे",
    blends: "ब्लेंड",
    blank: "खाली",
    breakdown: "विवरण",
    but: "लेकिन",
    can: "सकता है",
    calculate: "गणना करें",
    calculated: "गणना किया गया",
    calculation: "गणना",
    capacity: "क्षमता",
    category: "श्रेणी",
    captured: "प्राप्त",
    changeable: "बदलने योग्य",
    commission: "कमीशन",
    component: "घटक",
    composition: "संरचना",
    construction: "बनावट",
    contains: "में है",
    costings: "कॉस्टिंग",
    cotton: "कॉटन",
    costing: "costing",
    customer: "ग्राहक",
    data: "डेटा",
    denier: "डेनियर",
    default: "डिफ़ॉल्ट",
    did: "क्या",
    direct: "सीधा",
    displayed: "दिखाया गया",
    each: "हर",
    economics: "लागत और कीमत",
    effective: "प्रभावी",
    either: "या तो",
    expenses: "खर्च",
    expense: "खर्च",
    exporting: "निर्यात करना",
    export: "निर्यात करें",
    fabric: "फैब्रिक",
    feature: "सुविधा",
    full: "पूरा",
    finished: "तैयार",
    final: "अंतिम",
    fixed: "स्थिर",
    future: "भविष्य",
    general: "सामान्य",
    gross: "सकल",
    highlighted: "चिह्नित",
    high: "ऊँचा",
    historical: "ऐतिहासिक",
    incorporated: "कंपनी के रूप में पंजीकृत",
    including: "सहित",
    incomplete: "अधूरा",
    inputs: "इनपुट",
    input: "इनपुट",
    inch: "इंच",
    internal: "अंदरूनी",
    issued: "जारी",
    keep: "रखें",
    label: "लेबल",
    layer: "लेयर",
    later: "बाद में",
    linear: "लीनियर",
    length: "लंबाई",
    lifespan: "उपयोग अवधि",
    looks: "दिखता है",
    manual: "मैनुअल",
    meaning: "अर्थ",
    means: "का अर्थ है",
    method: "तरीका",
    machine: "मशीन",
    machines: "मशीनें",
    material: "सामग्री",
    context: "संदर्भ",
    mean: "अर्थ",
    maybe: "शायद",
    minimum: "न्यूनतम",
    miss: "छूट सकता है",
    number: "संख्या",
    numbers: "आंकड़े",
    only: "केवल",
    one: "एक",
    or: "या",
    output: "उत्पादन",
    overhead: "ओवरहेड",
    per: "प्रति",
    pick: "pick",
    picks: "picks",
    paisa: "पैसा",
    paise: "पैसे",
    plan: "प्लान",
    price: "कीमत",
    pricing: "कीमत",
    profile: "प्रोफ़ाइल",
    privacy: "गोपनीयता",
    payment: "भुगतान",
    payments: "भुगतान",
    pay: "भुगतान करें",
    renew: "नवीनीकरण करें",
    renewal: "रिन्यूअल",
    business: "बिज़नेस",
    role: "भूमिका",
    audit: "ऑडिट",
    focused: "केंद्रित",
    keeps: "रखता है",
    month: "महीना",
    months: "महीने",
    part: "हिस्सा",
    parts: "हिस्से",
    permanent: "स्थायी",
    pilot: "पायलट",
    quantity: "मात्रा",
    rate: "रेट",
    rates: "रेट",
    recipe: "रेसिपी",
    reference: "संदर्भ",
    rename: "नाम बदलें",
    requires: "ज़रूरी है",
    result: "नतीजा",
    recovery: "वसूली",
    relevant: "संबंधित",
    replace: "बदलें",
    reusable: "दोबारा उपयोग योग्य",
    reviewed: "समीक्षा की गई",
    receipt: "रसीद",
    receipts: "रसीद",
    retention: "संग्रह अवधि",
    rules: "नियम",
    section: "खंड",
    sections: "खंड",
    safety: "सुरक्षा",
    scaling: "स्केलिंग",
    set: "सेट करें",
    see: "देखें",
    source: "स्रोत",
    selling: "बिक्री",
    separate: "अलग",
    shown: "दिखाया गया",
    billing: "बिलिंग",
    period: "अवधि",
    annual: "वार्षिक",
    included: "शामिल",
    every: "हर",
    year: "वर्ष",
    snapshot: "स्नैपशॉट",
    snapshots: "स्नैपशॉट",
    special: "विशेष",
    storage: "स्टोरेज",
    standard: "मानक",
    starting: "शुरुआती",
    suite: "सुइट",
    target: "लक्ष्य",
    tax: "टैक्स",
    thread: "धागा",
    threads: "धागे",
    transport: "परिवहन",
    unusual: "असामान्य",
    until: "तक",
    treated: "माना गया",
    then: "फिर",
    this: "यह",
    that: "वह",
    the: "का",
    than: "से",
    greater: "अधिक",
    its: "इसके",
    may: "हो सकता है",
    try: "कोशिश करें",
    used: "उपयोग किया गया",
    unsaved: "सेव नहीं किया गया",
    unusually: "असामान्य रूप से",
    units: "इकाइयाँ",
    organization: "संगठन",
    organisation: "संगठन",
    supported: "समर्थित",
    values: "मान",
    value: "मान",
    version: "वर्जन",
    visible: "दिखाई देने वाला",
    warning: "चेतावनी",
    width: "चौड़ाई",
    where: "जहाँ",
    while: "जबकि",
    working: "काम के",
    weave: "बुनाई",
    wage: "मजदूरी",
    yarn: "यार्न",
    years: "वर्ष",
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
    recorded: "નોંધાયેલ",
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
    review: "સમીક્ષા",
    run: "રન",
    runs: "રન",
    salary: "salary",
    setup: "સેટઅપ",
    step: "પગલું",
    steps: "પગલાં",
    tracking: "ટ્રેકિંગ",
    workflow: "વર્કફ્લો",
    with: "સાથે",
    without: "વિના",
    you: "તમારી પાસે",
    worker: "કારીગર",
    workers: "કારીગરો",
    yesterday: "ગઈકાલે",
    your: "તમારું",
    again: "ફરી",
    acknowledgement: "પુષ્ટિ",
    actual: "વાસ્તવિક",
    adjustment: "સમાયોજન",
    adds: "ઉમેરે છે",
    alert: "ચેતવણી",
    average: "સરેરાશ",
    any: "કોઈપણ",
    applied: "લાગુ",
    assumptions: "ધારણાઓ",
    based: "આધારિત",
    be: "હોવું",
    below: "નીચે",
    blends: "બ્લેન્ડ",
    blank: "ખાલી",
    breakdown: "વિગતો",
    but: "પરંતુ",
    can: "શકે છે",
    calculate: "ગણતરી કરો",
    calculated: "ગણતરી કરેલ",
    calculation: "ગણતરી",
    capacity: "ક્ષમતા",
    category: "શ્રેણી",
    captured: "પ્રાપ્ત",
    changeable: "બદલી શકાય તેવું",
    commission: "કમિશન",
    component: "ઘટક",
    composition: "રચના",
    construction: "રચના",
    contains: "માં છે",
    costings: "કોસ્ટિંગ",
    cotton: "કોટન",
    costing: "costing",
    customer: "ગ્રાહક",
    data: "ડેટા",
    denier: "ડેનિયર",
    default: "ડિફૉલ્ટ",
    did: "શું",
    direct: "સીધો",
    displayed: "દેખાડેલ",
    each: "દરેક",
    economics: "કિંમત અને ખર્ચ",
    effective: "અસરકારક",
    either: "અથવા",
    expenses: "ખર્ચ",
    expense: "ખર્ચ",
    exporting: "એક્સપોર્ટ કરવું",
    export: "એક્સપોર્ટ કરો",
    fabric: "ફેબ્રિક",
    feature: "સુવિધા",
    full: "પૂર્ણ",
    finished: "તૈયાર",
    final: "અંતિમ",
    fixed: "સ્થિર",
    future: "ભવિષ્ય",
    general: "સામાન્ય",
    gross: "કુલ",
    highlighted: "ચિહ્નિત",
    high: "ઊંચો",
    historical: "ઐતિહાસિક",
    incorporated: "કંપની તરીકે નોંધાયેલ",
    including: "સહિત",
    incomplete: "અપૂર્ણ",
    inputs: "ઇનપુટ",
    input: "ઇનપુટ",
    inch: "ઇંચ",
    internal: "આંતરિક",
    issued: "જારી",
    keep: "જાળવો",
    label: "લેબલ",
    layer: "લેયર",
    later: "પછી",
    linear: "લિનિયર",
    length: "લંબાઈ",
    lifespan: "ઉપયોગ અવધિ",
    looks: "દેખાય છે",
    manual: "મેન્યુઅલ",
    meaning: "અર્થ",
    means: "એટલે",
    method: "પદ્ધતિ",
    machine: "મશીન",
    machines: "મશીનો",
    material: "સામગ્રી",
    context: "સંદર્ભ",
    mean: "અર્થ",
    maybe: "કદાચ",
    minimum: "ન્યૂનતમ",
    miss: "છૂટી શકે છે",
    number: "સંખ્યા",
    numbers: "આંકડા",
    only: "ફક્ત",
    one: "એક",
    or: "અથવા",
    output: "ઉત્પાદન",
    overhead: "ઓવરહેડ",
    per: "દર",
    pick: "pick",
    picks: "picks",
    paisa: "પૈસા",
    paise: "પૈસા",
    plan: "પ્લાન",
    price: "કિંમત",
    pricing: "કિંમત",
    profile: "પ્રોફાઇલ",
    privacy: "ગોપનીયતા",
    payment: "ચૂકવણી",
    payments: "ચૂકવણીઓ",
    pay: "ચૂકવો",
    renew: "રિન્યુ કરો",
    business: "બિઝનેસ",
    role: "ભૂમિકા",
    audit: "ઑડિટ",
    focused: "કેન્દ્રિત",
    keeps: "રાખે છે",
    month: "મહિનો",
    months: "મહિના",
    part: "ભાગ",
    parts: "ભાગો",
    permanent: "કાયમી",
    pilot: "પાઇલટ",
    quantity: "જથ્થો",
    rate: "ભાવ",
    rates: "ભાવ",
    recipe: "રેસિપી",
    reference: "સંદર્ભ",
    rename: "નામ બદલો",
    requires: "જરૂરી છે",
    result: "પરિણામ",
    recovery: "વસૂલાત",
    relevant: "સંબંધિત",
    replace: "બદલો",
    reusable: "ફરી વાપરી શકાય તેવી",
    reviewed: "સમીક્ષા કરેલ",
    receipt: "રસીદ",
    receipts: "રસીદ",
    retention: "સંગ્રહ અવધિ",
    rules: "નિયમો",
    section: "વિભાગ",
    sections: "વિભાગો",
    safety: "સલામતી",
    scaling: "સ્કેલિંગ",
    set: "સેટ કરો",
    see: "જુઓ",
    source: "સ્ત્રોત",
    selling: "વેચાણ",
    separate: "અલગ",
    shown: "દર્શાવેલ",
    billing: "બિલિંગ",
    period: "સમયગાળો",
    annual: "વાર્ષિક",
    renewal: "રિન્યુઅલ",
    included: "સામેલ",
    every: "દરેક",
    year: "વર્ષ",
    snapshot: "સ્નૅપશૉટ",
    snapshots: "સ્નૅપશૉટ",
    special: "વિશેષ",
    storage: "સ્ટોરેજ",
    standard: "માનક",
    starting: "શરૂઆતનું",
    suite: "સુઇટ",
    target: "લક્ષ્ય",
    tax: "ટૅક્સ",
    thread: "દોરો",
    threads: "દોરા",
    transport: "ટ્રાન્સપોર્ટ",
    unusual: "અસામાન્ય",
    until: "સુધી",
    treated: "માનવામાં આવેલ",
    then: "પછી",
    this: "આ",
    that: "તે",
    the: "આ",
    than: "કરતાં",
    greater: "વધુ",
    its: "તેના",
    may: "શકે છે",
    try: "પ્રયાસ કરો",
    used: "વપરાયેલ",
    unsaved: "સાચવાયેલ નથી",
    unusually: "અસામાન્ય રીતે",
    units: "એકમો",
    organization: "સંસ્થા",
    organisation: "સંસ્થા",
    supported: "સમર્થિત",
    values: "મૂલ્યો",
    value: "મૂલ્ય",
    version: "વર્ઝન",
    visible: "દેખાતું",
    warning: "ચેતવણી",
    width: "પહોળાઈ",
    where: "જ્યાં",
    while: "જ્યારે",
    working: "કામના",
    weave: "વણાટ",
    wage: "મજૂરી",
    yarn: "યાર્ન",
    years: "વર્ષ",
  },
}

const BASE_PLAN_ENGLISH_TERMS = new Set([
  'warp',
  'weft',
  'ppi',
  'crimp',
  'waste',
  'pick rate',
  'picks per inch',
  'picks',
  'costing',
  'quotation',
  'trader',
  'margin',
  'gst',
])

const BASE_PLAN_DOMAIN_TRANSLATIONS: Record<LocalLanguage, Record<string, string>> = {
  hi: {
    quality: 'क्वालिटी',
    qualities: 'क्वालिटी',
    cost: 'कॉस्ट',
    costs: 'कॉस्ट',
    rate: 'रेट',
    rates: 'रेट',
    order: 'ऑर्डर',
    orders: 'ऑर्डर',
    party: 'पार्टी',
    parties: 'पार्टी',
    fabric: 'फैब्रिक',
    yarn: 'यार्न',
    beam: 'बीम',
    beams: 'बीम',
    loom: 'लूम',
    looms: 'लूम',
    stock: 'स्टॉक',
    stocks: 'स्टॉक',
    meter: 'मीटर',
    meters: 'मीटर',
    metre: 'मीटर',
    metres: 'मीटर',
    quote: 'कोटेशन',
    quotes: 'कोटेशन',
    dispatch: 'डिस्पैच',
    dispatches: 'डिस्पैच',
    invoice: 'इनवॉइस',
    invoices: 'इनवॉइस',
    run: 'रन',
    runs: 'रन',
    subscription: 'सब्सक्रिप्शन',
  },
  gu: {
    quality: 'ક્વોલિટી',
    qualities: 'ક્વોલિટી',
    cost: 'કોસ્ટ',
    costs: 'કોસ્ટ',
    rate: 'ભાવ',
    rates: 'ભાવ',
    order: 'ઑર્ડર',
    orders: 'ઑર્ડર',
    party: 'પાર્ટી',
    parties: 'પાર્ટી',
    fabric: 'ફેબ્રિક',
    yarn: 'યાર્ન',
    beam: 'બીમ',
    beams: 'બીમ',
    loom: 'લૂમ',
    looms: 'લૂમ',
    stock: 'સ્ટોક',
    stocks: 'સ્ટોક',
    meter: 'મીટર',
    meters: 'મીટર',
    metre: 'મીટર',
    metres: 'મીટર',
    quote: 'કોટેશન',
    quotes: 'કોટેશન',
    dispatch: 'ડિસ્પેચ',
    dispatches: 'ડિસ્પેચ',
    invoice: 'ઇન્વોઇસ',
    invoices: 'ઇન્વોઇસ',
    run: 'રન',
    runs: 'રન',
    subscription: 'સબ્સ્ક્રિપ્શન',
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
  "costing",
  "costings",
  "quotation",
  "quotations",
  "trader",
  "traders",
  "waste",
  "pick rate",
  "picks per inch",
  "ppi",
  "gst",
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

export function translateFallbackUiText(
  source: string,
  language: RuntimeLanguage,
  options: FallbackTranslationOptions = {},
): string | undefined {
  if (language === "en" || !shouldUseFallback(source)) return undefined

  const dictionary = WORD_TRANSLATIONS[language]
  const segments = protectDomainTerms(source, language, options.localizeDomainTerms === true)
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

/**
 * Completes a translated Base-plan string without changing user-entered names,
 * numbers, or the approved Surat factory vocabulary. This is intentionally
 * separate from the legacy fallback so existing non-Base screens keep their
 * established glossary behavior.
 */
export function translateStrictBasePlanText(source: string, language: RuntimeLanguage): string | undefined {
  if (language === "en" || !source) return undefined

  if (language === "hi" || language === "gu") {
    const directPhrase = BASE_PLAN_PHRASES[language]?.[source]
    if (directPhrase) return directPhrase
  }

  const patternedSource = translateStrictBasePlanPattern(source, language) ?? source
  const dictionary = WORD_TRANSLATIONS[language]
  const segments = protectDomainTerms(patternedSource, language, true)
  let translatedAny = patternedSource !== source

  const translated = segments
    .map((segment) => {
      if (segment.protected) {
        translatedAny = translatedAny || segment.text !== source
        return segment.text
      }

      return segment.text.replace(WORD_OR_NUMBER_PATTERN, (part) => {
        if (!ASCII_WORD_PATTERN.test(part)) return part
        const replacement = dictionary[part.toLowerCase()]
        if (!replacement) return part
        translatedAny = true
        return preserveWordCase(part, replacement)
      })
    })
    .join("")

  return translatedAny && translated !== source ? translated : undefined
}

function translateStrictBasePlanPattern(source: string, language: LocalLanguage) {
  const paymentAction = source.match(/^Pay (₹\s*[\d,.]+) & (Activate|Renew)$/i)
  if (paymentAction) {
    const amount = paymentAction[1]
    const action = paymentAction[2].toLowerCase() === "renew"
      ? language === "hi" ? "नवीनीकरण करें" : "રિન્યુ કરો"
      : language === "hi" ? "सक्रिय करें" : "સક્રિય કરો"
    return language === "hi"
      ? `${amount} भुगतान करें और ${action}`
      : `${amount} ચૂકવો અને ${action}`
  }

  const renewFor = source.match(/^Renew for (₹\s*[\d,.]+)$/i)
  if (renewFor) {
    return language === "hi"
      ? `${renewFor[1]} के लिए नवीनीकरण करें`
      : `${renewFor[1]} માટે રિન્યુ કરો`
  }

  const renewalWindow = source.match(/^Renewal opens on (.+) \((\d+) days before expiry\)\. No automatic charge will be made\.$/i)
  if (renewalWindow) {
    return language === "hi"
      ? `रिन्यूअल ${renewalWindow[1]} को खुलेगा (समाप्ति से ${renewalWindow[2]} दिन पहले)। कोई स्वचालित शुल्क नहीं लिया जाएगा।`
      : `રિન્યુઅલ ${renewalWindow[1]}ના રોજ ખુલશે (સમાપ્તિથી ${renewalWindow[2]} દિવસ પહેલાં). કોઈ આપમેળે ચાર્જ લેવામાં આવશે નહીં.`
  }

  const greaterThanZero = source.match(/^(.+?) must be greater than 0\.?$/i)
  if (greaterThanZero) {
    return language === "hi"
      ? `${greaterThanZero[1]} का मान 0 से अधिक होना चाहिए।`
      : `${greaterThanZero[1]} નું માન 0 કરતાં વધુ હોવું જોઈએ.`
  }

  const required = source.match(/^(.+?) is required\.?$/i)
  if (required) {
    return language === "hi"
      ? `${required[1]} ज़रूरी है।`
      : `${required[1]} જરૂરી છે.`
  }

  const invalid = source.match(/^(.+?) is invalid\.?$/i)
  if (invalid) {
    return language === "hi"
      ? `${invalid[1]} मान्य नहीं है।`
      : `${invalid[1]} માન્ય નથી.`
  }

  const quantityStatus = source.match(/^Quantity not set(?:, (.+))?\.?$/i)
  if (quantityStatus) {
    const suffix = quantityStatus[1] ? `, ${quantityStatus[1]}` : ""
    return language === "hi"
      ? `मात्रा सेट नहीं है${suffix}`
      : `જથ્થો સેટ કરેલો નથી${suffix}`
  }

  const pricingAssumptions = source.match(/^Pricing assumptions\. (\d+) active\. (.+?) target margin\. (.+?) commission\.(.*)$/i)
  if (pricingAssumptions) {
    const [, active, margin, commission, suffix] = pricingAssumptions
    return language === "hi"
      ? `कीमत की धारणाएँ। ${active} सक्रिय · ${margin} लक्ष्य margin · ${commission} कमीशन।${suffix}`
      : `કિંમતની ધારણાઓ. ${active} સક્રિય · ${margin} લક્ષ્ય margin · ${commission} કમિશન.${suffix}`
  }

  return undefined
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

function protectDomainTerms(source: string, language?: LocalLanguage, localizeDomainTerms = false) {
  const segments: Array<{ text: string; protected: boolean }> = []
  let lastIndex = 0

  source.replace(SOURCE_DOMAIN_PATTERN, (match, prefix: string, term: string, offset: number) => {
    const termStart = offset + prefix.length
    if (termStart > lastIndex) {
      segments.push({ text: source.slice(lastIndex, termStart), protected: false })
    }
    segments.push({ text: localizeDomainTerms && language ? localizeDomainTerm(term, language) : term, protected: true })
    lastIndex = termStart + term.length
    return match
  })

  if (lastIndex < source.length) {
    segments.push({ text: source.slice(lastIndex), protected: false })
  }

  return segments.length > 0 ? segments : [{ text: source, protected: false }]
}

function localizeDomainTerm(term: string, language: LocalLanguage) {
  const lower = term.toLowerCase()
  if (BASE_PLAN_ENGLISH_TERMS.has(lower)) return term

  const direct = BASE_PLAN_DOMAIN_TRANSLATIONS[language][lower]
  if (direct) return direct

  for (const domainRule of DOMAIN_RULES) {
    if (domainRule.source.test(term)) return domainRule.variants[language][0] ?? term
  }

  return term
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

type TemplatePhrase = { pattern: RegExp; keys: string[]; target: string; literalLength: number }

/**
 * Matches rendered text against phrases written with `{name}` placeholders,
 * such as "Saved {count} qualities", so a sentence built from numbers or names
 * still finds its complete translation. A captured value is translated only
 * when it is itself an exact phrase (a status, a unit); names and numbers pass
 * through unchanged. Text that matches nothing returns undefined and stays in
 * English.
 */
export function createTemplatePhraseMatcher(phrases: Map<string, string>) {
  const templates: TemplatePhrase[] = []

  phrases.forEach((target, source) => {
    const parts = source.split(/(\{\w+\})/g)
    if (parts.length === 1) return
    const literal = parts.filter((part) => !/^\{\w+\}$/.test(part)).join("")
    // A template has to say something on its own; "{count}" or "v{version}"
    // would match unrelated text.
    if ((literal.match(/[A-Za-z]/g) ?? []).length < 4) return
    const keys: string[] = []
    const pattern = parts
      .map((part) => {
        if (/^\{\w+\}$/.test(part)) {
          keys.push(part.slice(1, -1))
          return "(.+?)"
        }
        return escapeRegExp(part).replace(/\s+/g, "\\s+")
      })
      .join("")
    templates.push({ pattern: new RegExp(`^${pattern}$`), keys, target, literalLength: literal.length })
  })

  templates.sort((a, b) => b.literalLength - a.literalLength)

  const match = (source: string, nested: boolean): string | undefined => {
    for (const { pattern, keys, target } of templates) {
      const found = pattern.exec(source)
      if (!found) continue
      const values = new Map(keys.map((key, index) => [key, found[index + 1]]))
      return target.replace(/\{(\w+)\}/g, (token, key: string) => {
        const value = values.get(key)
        if (value === undefined) return token
        // One level down, so "Weft layer 2" inside a message is translated too.
        return phrases.get(value.trim()) ?? (nested ? undefined : match(value, true)) ?? value
      })
    }
    return undefined
  }

  return (source: string) => match(source, false)
}
