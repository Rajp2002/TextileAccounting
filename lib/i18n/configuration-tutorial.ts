import type { Language } from './context'
import type { ConfigurationTourStep } from '../configuration-tour'

export const configurationHelpTopics = ['find', 'picker', 'drag', 'replace', 'remove', 'workers', 'machines'] as const

type Copy = {
    sample: string; worker: string; machine: string; inactiveMachine: string
    // Still consumed by the legacy machine, payroll and yarn-stock tours.
    back: string; next: string; finish: string; skip: string; progress: string
    undoLabel: string; savedLabel: string; dayShiftLabel: string; dailySheetLabel: string
    helpLabel: string; helpIntro: string
    help: Record<typeof configurationHelpTopics[number], readonly [string, string]>
    steps: Record<ConfigurationTourStep, { title: string; body: string; detail?: string }>
    emptyHandoff: { title: string; body: string }
}

export const configurationTutorialCopy: Record<Language, Copy> = {
    en: {
        back: 'Back', next: 'Next', finish: 'Finish', skip: 'Skip tour', progress: 'Tour progress',
        sample: 'Tour samples · No changes to your factory', worker: 'Sample worker', machine: 'Sample loom', inactiveMachine: 'Sample inactive loom',
        undoLabel: 'Undo', savedLabel: 'Worker assigned.', dayShiftLabel: 'Day shift', dailySheetLabel: 'Open Daily Sheet',
        helpLabel: 'Assignment help', helpIntro: 'Filters, picker states and changes to existing assignments.',
        steps: {
            'ma-purpose': {"title": "Who runs which loom, each shift", "body": "Link each worker to the loom they run. The Daily Sheet then lists each loom with its worker."},
            'ma-shift': {"title": "Choose the shift first", "body": "Day and night are set separately."},
            'ma-job': {"title": "A loom needs a quality first", "body": "A loom marked {c:noJob} has nothing to weave yet. Put a quality on it in Production with {c:assignLooms}."},
            'ma-assign': {"title": "Start from the worker", "body": "{c:assign} next to a worker lists the looms free in this shift."},
            'ma-choose': {"title": "Choosing a loom saves at once", "body": "{c:choose} links the worker to that loom from today. If the loom already has a worker, Weavly asks before replacing.", "detail": "Right after a change, {c:undo} in the message puts it back. On a computer you can also drag from a worker to a loom."},
            'ma-linked': {"title": "Check the link", "body": "The worker and loom now show together for this shift. Their metres are entered on the Daily Sheet."},
            'ma-handoff': {"title": "Link your first worker", "body": "Choose {c:assign} next to a worker and pick their loom."},
        },
        emptyHandoff: {"title": "Add workers first", "body": "Only piece-rate workers can be linked to looms. Choose {c:addWorker} to add one."},
        help: {
            find: ['Find workers and machines', 'Search filters worker names in the selected shift. Machine type filters also apply in the picker; select a type again or All to clear them. Filters hide rows without changing links. On a phone, switch between Workers and Machines; desktop shows both. The cards show names, shift availability and links; matching line colours trace links on desktop.'],
            picker: ['Understand picker states', 'Current is disabled because this worker is already linked. Another worker’s name means choosing the machine asks to replace them. No production job is disabled: prepare its quality in Production → Activate Quality → Assign Looms. Unassigned alone does not mean ready. Close exits without choosing.'],
            drag: ['Assign by dragging on desktop', 'Drag a worker’s round connector onto an eligible machine. The line follows your pointer and valid targets highlight. Dropping on the machine saves immediately; releasing outside cancels. Assign works with a keyboard or phone. Extra links do not remove this worker’s other machines.'],
            replace: ['Replace a primary worker', 'Assign a different worker to the same machine and shift, then confirm replacement. Cancel keeps the original link. Undo in the save confirmation restores the previous assignment while available. Previously saved production and pay retain their saved details.'],
            remove: ['Unlink a worker', 'Use the unlink button beside the machine’s worker to remove that link for the selected shift. This does not delete the worker, machine or saved production. Use Assign to reconnect. Removing a link does not recalculate past earnings.'],
            workers: ['Add or edit workers', 'Add worker opens Workers: choose piece-rate pay and shift availability, then return here. Pay type cannot change later. Monthly staff do not need machine assignments. Manage workers opens the register to edit details, change active status or manage salaried staff.'],
            machines: ['Add or edit machines', 'Add machine opens Machines: choose its type and optional name or custom label. Prepare its quality in Production → Activate Quality → Assign Looms, then return here. Manage machines opens the register for edits and activation.'],
        },
    },
    gu: {
        back: 'પાછળ', next: 'આગળ', finish: 'પૂર્ણ કરો', skip: 'ટૂર છોડો', progress: 'ટૂરની પ્રગતિ',
        sample: 'ટૂરનાં નમૂના · તમારી ફેક્ટરીમાં કોઈ ફેરફાર નહીં', worker: 'નમૂના કારીગર', machine: 'નમૂના લૂમ', inactiveMachine: 'નિષ્ક્રિય નમૂના લૂમ',
        undoLabel: 'પાછું વાળો', savedLabel: 'કારીગર ફાળવાયો.', dayShiftLabel: 'દિવસની શિફ્ટ', dailySheetLabel: 'Daily Sheet ખોલો',
        helpLabel: 'ફાળવણી માટે મદદ', helpIntro: 'ફિલ્ટર, પસંદગીની સ્થિતિ અને હાલની ફાળવણીમાં ફેરફાર.',
        steps: {
            'ma-purpose': {"title": "દરેક શિફ્ટમાં કયો લૂમ કોણ ચલાવે", "body": "દરેક કારીગરને તે ચલાવે તે લૂમ સાથે જોડો. પછી દૈનિક શીટમાં દરેક લૂમ તેના કારીગર સાથે આવે છે."},
            'ma-shift': {"title": "પહેલાં શિફ્ટ પસંદ કરો", "body": "દિવસ અને રાત અલગ નક્કી થાય છે."},
            'ma-job': {"title": "લૂમને પહેલાં ક્વોલિટી જોઈએ", "body": "{c:noJob} લખેલા લૂમ પાસે હજી વણવાનું કંઈ નથી. ઉત્પાદનમાં {c:assignLooms}થી તેના પર ક્વોલિટી મૂકો."},
            'ma-assign': {"title": "કારીગરથી શરૂ કરો", "body": "કારીગરની બાજુમાં {c:assign} આ શિફ્ટના ખાલી લૂમ બતાવે છે."},
            'ma-choose': {"title": "લૂમ પસંદ કરતાં જ સચવાય છે", "body": "{c:choose} આજથી કારીગરને તે લૂમ સાથે જોડે છે. લૂમ પર પહેલેથી કારીગર હોય તો બદલતાં પહેલાં Weavly પૂછે છે.", "detail": "ફેરફાર પછી તરત સંદેશમાં {c:undo} તેને પાછું કરે છે. કમ્પ્યુટર પર કારીગરથી લૂમ સુધી ખેંચીને પણ જોડી શકાય."},
            'ma-linked': {"title": "જોડાણ તપાસો", "body": "હવે આ શિફ્ટ માટે કારીગર અને લૂમ સાથે દેખાય છે. તેમના મીટર દૈનિક શીટમાં નોંધાય છે."},
            'ma-handoff': {"title": "તમારા પહેલા કારીગરને જોડો", "body": "કારીગરની બાજુમાં {c:assign} પસંદ કરો અને તેમનો લૂમ પસંદ કરો."},
        },
        emptyHandoff: {"title": "પહેલાં કારીગરો ઉમેરો", "body": "ફક્ત પીસ રેટ કારીગર લૂમ સાથે જોડાય છે. ઉમેરવા {c:addWorker} પસંદ કરો."},
        help: {
            find: ['કારીગર અને મશીન શોધો', 'શોધ પસંદ શિફ્ટમાં કારીગરનાં નામ ગાળે છે. મશીન પ્રકારનાં ફિલ્ટર પસંદગી યાદીમાં પણ લાગુ પડે છે; દૂર કરવા ફરી એ પ્રકાર અથવા બધા પસંદ કરો. ફિલ્ટર જોડાણ બદલ્યા વગર પંક્તિઓ છુપાવે છે. ફોન પર કારીગરો અને મશીનો વચ્ચે બદલો; ડેસ્કટોપ પર બંને દેખાય છે. કાર્ડમાં નામ, શિફ્ટ ઉપલબ્ધતા અને જોડાણો હોય છે; ડેસ્કટોપ પર રેખાના રંગથી જોડાણ ઓળખો.'],
            picker: ['પસંદગીની સ્થિતિ સમજો', 'હાલનું બંધ છે કારણ કે કારીગર પહેલેથી જોડાયેલો છે. બીજા કારીગરનું નામ હોય તો મશીન પસંદ કરતાં બદલવાની પુષ્ટિ માગે છે. પ્રોડક્શન કામ નથી હોય તો પસંદગી બંધ છે: પ્રોડક્શન → Activate Quality → Assign Looms માં ક્વોલિટી ગોઠવો. ફક્ત ફાળવેલું ન હોવું પૂરતું નથી. બંધ કરો દ્વારા પસંદ કર્યા વગર બહાર નીકળો.'],
            drag: ['ડેસ્કટોપ પર ખેંચીને ફાળવો', 'કારીગરનો ગોળ કનેક્ટર યોગ્ય મશીન પર ખેંચો. રેખા પોઇન્ટર સાથે ચાલે છે અને યોગ્ય મશીન ઊભરે છે. મશીન પર છોડતાં તરત સેવ થાય; બહાર છોડતાં રદ થાય. કીબોર્ડ કે ફોન પર સોંપો વાપરો. વધારાના જોડાણથી કારીગરનાં અન્ય મશીનો દૂર થતાં નથી.'],
            replace: ['મુખ્ય કારીગર બદલો', 'એ જ મશીન અને શિફ્ટમાં બીજો કારીગર સોંપો અને બદલવાની પુષ્ટિ કરો. રદ કરવાથી જૂનું જોડાણ રહે છે. સેવની સૂચનામાં પાછું વાળો ઉપલબ્ધ હોય ત્યારે અગાઉની ફાળવણી પાછી લાવે છે. અગાઉ સેવ ઉત્પાદન અને પગારની વિગતો જળવાય છે.'],
            remove: ['કારીગરનું જોડાણ દૂર કરો', 'મશીનના કારીગર પાસેનું અનલિંક બટન પસંદ શિફ્ટનું જોડાણ દૂર કરે છે. કારીગર, મશીન કે સેવ ઉત્પાદન કાઢી નાખતું નથી. ફરી જોડવા સોંપો વાપરો. જોડાણ દૂર કરવાથી જૂની કમાણી ફરી ગણાતી નથી.'],
            workers: ['કારીગર ઉમેરો કે વિગતો બદલો', 'કારીગર ઉમેરો દ્વારા કારીગર પેજ ખૂલે છે: પીસ-રેટ પગાર અને શિફ્ટ ઉપલબ્ધતા પસંદ કરીને અહીં પાછા આવો. પગારનો પ્રકાર પછી બદલાતો નથી. પગારદાર સ્ટાફને મશીન ફાળવણી જરૂરી નથી. કારીગરોનું સંચાલન કરો દ્વારા વિગતો, સક્રિય સ્થિતિ અને પગારદાર સ્ટાફ સંભાળો.'],
            machines: ['મશીન ઉમેરો કે વિગતો બદલો', 'મશીન ઉમેરો દ્વારા મશીન પેજ ખૂલે છે: પ્રકાર અને વૈકલ્પિક નામ કે કસ્ટમ લેબલ પસંદ કરો. પ્રોડક્શન → Activate Quality → Assign Looms માં ક્વોલિટી ગોઠવી અહીં પાછા આવો. મશીનોનું સંચાલન કરો દ્વારા વિગતો કે સક્રિય સ્થિતિ બદલો.'],
        },
    },
    hi: {
        back: 'पीछे', next: 'आगे', finish: 'पूरा करें', skip: 'टूर छोड़ें', progress: 'टूर की प्रगति',
        sample: 'टूर के नमूने · आपकी फैक्ट्री में कोई बदलाव नहीं', worker: 'नमूना कारीगर', machine: 'नमूना लूम', inactiveMachine: 'निष्क्रिय नमूना लूम',
        undoLabel: 'पूर्ववत करें', savedLabel: 'कारीगर आवंटित हुआ।', dayShiftLabel: 'दिन की शिफ्ट', dailySheetLabel: 'Daily Sheet खोलें',
        helpLabel: 'आवंटन सहायता', helpIntro: 'फ़िल्टर, चयन की स्थितियाँ और मौजूदा आवंटन में बदलाव।',
        steps: {
            'ma-purpose': {"title": "हर शिफ्ट में कौन सा लूम कौन चलाए", "body": "हर कारीगर को उसके लूम से जोड़ें। फिर दैनिक शीट में हर लूम अपने कारीगर के साथ आता है।"},
            'ma-shift': {"title": "पहले शिफ्ट चुनें", "body": "दिन और रात अलग तय होते हैं।"},
            'ma-job': {"title": "लूम को पहले क्वालिटी चाहिए", "body": "{c:noJob} लिखे लूम के पास अभी बुनने को कुछ नहीं। उत्पादन में {c:assignLooms} से उस पर क्वालिटी लगाएँ।"},
            'ma-assign': {"title": "कारीगर से शुरू करें", "body": "कारीगर के पास {c:assign} इस शिफ्ट के खाली लूम दिखाता है।"},
            'ma-choose': {"title": "लूम चुनते ही सेव हो जाता है", "body": "{c:choose} आज से कारीगर को उस लूम से जोड़ता है। लूम पर पहले से कारीगर हो तो बदलने से पहले Weavly पूछता है।", "detail": "बदलाव के तुरंत बाद संदेश में {c:undo} उसे वापस करता है। कंप्यूटर पर कारीगर से लूम तक खींचकर भी जोड़ सकते हैं।"},
            'ma-linked': {"title": "जोड़ जाँचें", "body": "अब इस शिफ्ट के लिए कारीगर और लूम साथ दिखते हैं। उनके मीटर दैनिक शीट में दर्ज होते हैं।"},
            'ma-handoff': {"title": "अपने पहले कारीगर को जोड़ें", "body": "कारीगर के पास {c:assign} चुनें और उसका लूम चुनें।"},
        },
        emptyHandoff: {"title": "पहले कारीगर जोड़ें", "body": "सिर्फ़ पीस रेट कारीगर लूम से जुड़ते हैं। जोड़ने के लिए {c:addWorker} चुनें।"},
        help: {
            find: ['कारीगर और मशीन खोजें', 'खोज चुनी शिफ्ट में कारीगरों के नाम छाँटती है। मशीन प्रकार के फ़िल्टर चयन सूची पर भी लागू होते हैं; हटाने के लिए फिर वही प्रकार या सभी चुनें। फ़िल्टर लिंक बदले बिना पंक्तियाँ छिपाते हैं। फ़ोन पर कारीगर और मशीन के बीच बदलें; डेस्कटॉप पर दोनों दिखते हैं। कार्ड में नाम, शिफ्ट उपलब्धता और लिंक हैं; डेस्कटॉप पर रेखाओं के रंग लिंक पहचानने में मदद करते हैं।'],
            picker: ['चयन की स्थितियाँ समझें', 'मौजूदा बंद है क्योंकि कारीगर पहले से जुड़ा है। दूसरे कारीगर का नाम हो तो मशीन चुनने पर बदलने की पुष्टि माँगी जाती है। प्रोडक्शन काम नहीं है तो विकल्प बंद है: प्रोडक्शन → Activate Quality → Assign Looms में क्वालिटी तैयार करें। केवल अनावंटित होना पर्याप्त नहीं। बंद करें से बिना चुने बाहर निकलें।'],
            drag: ['डेस्कटॉप पर खींचकर असाइन करें', 'कारीगर का गोल कनेक्टर योग्य मशीन पर खींचें। रेखा पॉइंटर के साथ चलती है और सही मशीन उभरती है। मशीन पर छोड़ते ही सेव होता है; बाहर छोड़ने पर रद्द। कीबोर्ड या फ़ोन पर असाइन इस्तेमाल करें। अतिरिक्त लिंक से कारीगर की बाकी मशीनें नहीं हटतीं।'],
            replace: ['मुख्य कारीगर बदलें', 'उसी मशीन और शिफ्ट में दूसरा कारीगर असाइन करें और बदलाव की पुष्टि करें। रद्द करने पर पुराना लिंक रहता है। सेव की सूचना में पूर्ववत करें उपलब्ध रहने तक पिछला आवंटन लौटा देता है। पहले सेव उत्पादन और वेतन की जानकारी बनी रहती है।'],
            remove: ['कारीगर का लिंक हटाएँ', 'मशीन के कारीगर के पास अनलिंक बटन चुनी शिफ्ट का लिंक हटाता है। इससे कारीगर, मशीन या सेव उत्पादन नहीं मिटते। दोबारा जोड़ने के लिए असाइन चुनें। लिंक हटाने से पिछली कमाई की दोबारा गणना नहीं होती।'],
            workers: ['कारीगर जोड़ें या विवरण बदलें', 'कारीगर जोड़ें से कारीगर पेज खुलता है: पीस-रेट वेतन और शिफ्ट उपलब्धता चुनकर यहाँ लौटें। वेतन का प्रकार बाद में नहीं बदल सकता। वेतनभोगी स्टाफ को मशीन आवंटन नहीं चाहिए। कारीगरों का प्रबंधन करें से विवरण, सक्रिय स्थिति और वेतनभोगी स्टाफ सँभालें।'],
            machines: ['मशीन जोड़ें या विवरण बदलें', 'मशीन जोड़ें से मशीन पेज खुलता है: प्रकार और वैकल्पिक नाम या कस्टम लेबल चुनें। प्रोडक्शन → Activate Quality → Assign Looms में क्वालिटी तैयार करके यहाँ लौटें। मशीनों का प्रबंधन करें से विवरण या सक्रिय स्थिति बदलें।'],
        },
    },
}
