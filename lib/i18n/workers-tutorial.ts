import type { Language } from './context'
import type { WorkersTourCopyKey, WorkersHelpStep } from '../workers-tour'

type WorkersCopy = {
    paths: { piece: string; salary: string }
    samples: { worker: string; staff: string; role: string }
    helpTitle: string
    wageLabel: string
    wageSource: string
    qualityWage: string
    salaryBasis: string
    fields: Record<WorkersHelpStep, readonly [string, string]>
    steps: Record<WorkersTourCopyKey, { title: string; body: string }>
}

// Tour copy is transcribed from Workers §F; native-language review remains pending.
// Existing live pay-source text and maintenance help stay unchanged.
export const workersTutorialCopy: Record<Language, WorkersCopy> = {
    en: {
        paths: { piece: "Piece rate", salary: "Monthly salary" },
        samples: { worker: "Sample worker", staff: "Sample staff", role: "Supervisor" },
        helpTitle: 'Worker help: filters, roles and leaving dates',
        wageLabel: 'Wage source',
        wageSource: 'Production quality',
        qualityWage: "Quality weaver wage",
        salaryBasis: "Fixed monthly salary",
        fields: {
            search: ["Find a worker", "Search by worker name or staff role. Search and shift/status filters work together; clear filters if a worker is missing."],
            shiftFilter: ['Filter by availability', 'Choose Day shift or Night shift to include workers available for that shift. Day & night shows only workers available for both.'],
            statusFilter: ['Find active or inactive workers', 'The register starts with active workers. Use All workers or Inactive workers when reviewing someone who has left.'],
            groups: ['Two ways to pay', 'Piece Rate groups workers paid based on production. Fixed Salary groups staff paid a monthly salary. Each group has its own count.'],
            pieceCard: ['Read a worker card', 'The card shows the worker’s name, shift availability and active status. Availability controls which shift they can be assigned to.'],
            salaryReadiness: ['Check salary readiness', 'Salary shows whether pay is configured, without exposing the amount on the card. Payroll is Ready when salary and a joining date are present.'],
            add: ["Add a worker", "Choose Add worker for a new person. Decide the pay type before saving; use the tour to preview either pay path safely."],
            name: ["Worker name", "Enter a recognisable name so you can find the worker in the register and assignment screens."],
            salaryRole: ['Describe the staff role', 'For fixed-salary staff, enter a role such as Supervisor. You can also find staff by searching for this role.'],
            edit: ["Update an existing worker", "Use Edit on a worker card to update details. For salary changes, choose an effective date of today or later; earlier earnings and paid records stay unchanged."],
            lastDay: ['Record the last working day', 'Salary accrues through this date. A last working day is required when deactivating fixed-salary staff.'],
            active: ["Manage active status", "Clear Active worker when the person is no longer active. Use the status filter to find inactive records."],
        },
        steps: {
            paytype: { title: "Choose how this worker is paid", body: "Piece-rate workers earn per metre woven; salaried staff earn a monthly amount. This cannot be changed after saving." },
            availability: { title: "Set the shifts they can work", body: "Day, night or both. Only matching workers can be put on a loom for that shift." },
            wage: { title: "The wage comes from the quality", body: "You do not type a wage here. Each quality's weaver wage, set when it is activated in Production, applies to whoever weaves it." },
            loom: { title: "Put them on a loom", body: "A piece-rate worker earns only when assigned to a loom for a shift, in Machine Assignments." },
            earnings: { title: "Metres become earnings", body: "Saved shifts add metres × wage: 100 m × ₹1.50 = ₹150. Payroll pays it." },
            salary: { title: "Enter the agreed monthly salary", body: "Enter the full monthly amount, here ₹18,000. Payroll works out each period from it." },
            joining: { title: "Salary starts on the joining date", body: "Someone who joins halfway through a 30-day month is paid 15/30 × ₹18,000 = ₹9,000 for it." },
            changes: { title: "Date every change", body: "When the salary changes, set the date it applies from. When someone leaves, set their last working day before marking them inactive." },
            payroll: { title: "Salaries appear in payroll", body: "{c:viewPayroll} opens this worker's pay for the current period." },
            handoff: { title: "Add your workers", body: "Choose {c:addWorker} for each person and pick their pay type carefully." },
        },
    },
    gu: {
        paths: { piece: "પીસ રેટ", salary: "માસિક પગાર" },
        samples: { worker: "નમૂના કારીગર", staff: "નમૂના સ્ટાફ", role: "સુપરવાઇઝર" },
        helpTitle: 'કારીગર મદદ: ફિલ્ટર, ભૂમિકા અને છેલ્લી તારીખ',
        wageLabel: 'વેતનનો સ્ત્રોત',
        wageSource: 'ઉત્પાદનની ક્વોલિટી',
        qualityWage: "ક્વોલિટીનું વણકર વેતન",
        salaryBasis: "નિશ્ચિત માસિક પગાર",
        fields: {
            search: ["કારીગર શોધો", "કારીગરના નામ અથવા સ્ટાફની ભૂમિકાથી શોધો. શોધ અને શિફ્ટ/સ્થિતિ ફિલ્ટર સાથે કામ કરે છે; કારીગર ન દેખાય તો ફિલ્ટર દૂર કરો."],
            shiftFilter: ['ઉપલબ્ધતા પ્રમાણે ફિલ્ટર કરો', 'દિવસ કે રાત્રિની શિફ્ટ પસંદ કરવાથી તે શિફ્ટમાં ઉપલબ્ધ કારીગરો દેખાશે. દિવસ અને રાત્રિ પસંદ કરવાથી બંનેમાં ઉપલબ્ધ કારીગરો જ દેખાશે.'],
            statusFilter: ['સક્રિય કે નિષ્ક્રિય કારીગરો શોધો', 'શરૂઆતમાં સક્રિય કારીગરો દેખાય છે. કામ છોડી ગયેલા કારીગરને જોવા બધા કારીગરો અથવા નિષ્ક્રિય કારીગરો પસંદ કરો.'],
            groups: ['પગારની બે પદ્ધતિ', 'પીસ રેટમાં ઉત્પાદન પ્રમાણે વેતન મેળવનારા કારીગરો છે. નિશ્ચિત પગારમાં માસિક પગારવાળો સ્ટાફ છે. દરેક જૂથની પોતાની સંખ્યા છે.'],
            pieceCard: ['કારીગરનું કાર્ડ સમજો', 'કાર્ડ પર નામ, શિફ્ટ ઉપલબ્ધતા અને સક્રિય સ્થિતિ દેખાય છે. ઉપલબ્ધતા પ્રમાણે શિફ્ટમાં ફાળવણી થઈ શકે છે.'],
            salaryReadiness: ['પગારની તૈયારી જુઓ', 'પગારની રકમ બતાવ્યા વિના તેની ગોઠવણીની સ્થિતિ દેખાય છે. પગાર અને જોડાવાની તારીખ હોય ત્યારે પેરોલ તૈયાર દેખાય છે.'],
            add: ["કારીગર ઉમેરો", "નવી વ્યક્તિ માટે કારીગર ઉમેરો પસંદ કરો. સાચવતા પહેલાં વેતન પદ્ધતિ નક્કી કરો; બંને પદ્ધતિ સલામત રીતે જોવા ટૂર વાપરો."],
            name: ["કારીગરનું નામ", "રજિસ્ટર અને ફાળવણીમાં સરળતાથી ઓળખાય એવું નામ લખો."],
            salaryRole: ['સ્ટાફની ભૂમિકા લખો', 'નિશ્ચિત પગારવાળા સ્ટાફ માટે સુપરવાઇઝર જેવી ભૂમિકા લખો. આ ભૂમિકાથી પણ સ્ટાફ શોધી શકો છો.'],
            edit: ["હાલના કારીગરની વિગતો બદલો", "વિગતો બદલવા કાર્ડ પર સંપાદન પસંદ કરો. પગાર બદલવા આજની કે પછીની લાગુ તારીખ આપો; અગાઉની કમાણી અને ચૂકવેલા રેકોર્ડ બદલાતા નથી."],
            lastDay: ['છેલ્લો કામનો દિવસ', 'આ તારીખ સુધી પગાર ગણાય છે. નિશ્ચિત પગારવાળા સ્ટાફને નિષ્ક્રિય કરતી વખતે છેલ્લો કામનો દિવસ જરૂરી છે.'],
            active: ["સક્રિય સ્થિતિ સંભાળો", "વ્યક્તિ હવે સક્રિય ન હોય ત્યારે સક્રિય કારીગરનું ચિહ્ન દૂર કરો. સ્થિતિ ફિલ્ટરથી નિષ્ક્રિય રેકોર્ડ શોધો."],
        },
        steps: {
            paytype: { title: "આ કારીગરને કેવી રીતે પગાર મળે તે પસંદ કરો", body: "પીસ રેટ કારીગર વણેલા મીટર પ્રમાણે કમાય છે; પગારદાર સ્ટાફ માસિક રકમ કમાય છે. સાચવ્યા પછી આ બદલી શકાતું નથી." },
            availability: { title: "તે કઈ શિફ્ટમાં કામ કરી શકે તે નક્કી કરો", body: "દિવસ, રાત કે બંને. ફક્ત મેળ ખાતા કારીગર જ તે શિફ્ટમાં લૂમ પર મુકાય છે." },
            wage: { title: "મજૂરી ક્વોલિટીમાંથી આવે છે", body: "અહીં મજૂરી લખવાની નથી. ઉત્પાદનમાં ચાલુ કરતી વખતે નક્કી થયેલી ક્વોલિટીની મજૂરી, જે કારીગર તેને વણે તેને લાગુ પડે છે." },
            loom: { title: "તેમને લૂમ પર મૂકો", body: "પીસ રેટ કારીગર મશીન ફાળવણીમાં કોઈ શિફ્ટના લૂમ પર મુકાય ત્યારે જ કમાય છે." },
            earnings: { title: "મીટર કમાણી બને છે", body: "સાચવેલી શિફ્ટ મીટર × મજૂરી ઉમેરે છે: 100 મીટર × ₹1.50 = ₹150. પેરોલ તે ચૂકવે છે." },
            salary: { title: "નક્કી થયેલો માસિક પગાર લખો", body: "આખી માસિક રકમ લખો, અહીં ₹18,000. પેરોલ તેમાંથી દરેક સમયગાળો ગણે છે." },
            joining: { title: "પગાર જોડાયાની તારીખથી શરૂ થાય", body: "30 દિવસના મહિનાની વચ્ચે જોડાનારને તે મહિનાના 15/30 × ₹18,000 = ₹9,000 મળે છે." },
            changes: { title: "દરેક ફેરફારને તારીખ આપો", body: "પગાર બદલાય ત્યારે તે કઈ તારીખથી લાગુ થાય તે લખો. કોઈ છોડે ત્યારે નિષ્ક્રિય કરતાં પહેલાં છેલ્લો કામકાજનો દિવસ લખો." },
            payroll: { title: "પગાર પેરોલમાં દેખાય છે", body: "{c:viewPayroll} આ કારીગરનો ચાલુ સમયગાળાનો પગાર ખોલે છે." },
            handoff: { title: "તમારા કારીગરો ઉમેરો", body: "દરેક વ્યક્તિ માટે {c:addWorker} પસંદ કરો અને પગારનો પ્રકાર ધ્યાનથી પસંદ કરો." },
        },
    },
    hi: {
        paths: { piece: "पीस रेट", salary: "मासिक वेतन" },
        samples: { worker: "नमूना कारीगर", staff: "नमूना स्टाफ", role: "सुपरवाइज़र" },
        helpTitle: 'कारीगर सहायता: फ़िल्टर, भूमिका और अंतिम तारीख',
        wageLabel: 'वेतन का स्रोत',
        wageSource: 'उत्पादन की क्वालिटी',
        qualityWage: "क्वालिटी का बुनकर वेतन",
        salaryBasis: "निश्चित मासिक वेतन",
        fields: {
            search: ["कारीगर खोजें", "कारीगर के नाम या स्टाफ की भूमिका से खोजें। खोज और शिफ्ट/स्थिति फ़िल्टर साथ काम करते हैं; कारीगर न मिले तो फ़िल्टर हटाएँ।"],
            shiftFilter: ['उपलब्धता के अनुसार फ़िल्टर करें', 'दिन या रात की शिफ्ट चुनने पर उस शिफ्ट के लिए उपलब्ध कारीगर दिखेंगे। दिन और रात चुनने पर दोनों में उपलब्ध कारीगर ही दिखेंगे।'],
            statusFilter: ['सक्रिय या निष्क्रिय कारीगर खोजें', 'शुरुआत में सक्रिय कारीगर दिखते हैं। काम छोड़ चुके व्यक्ति को देखने के लिए सभी या निष्क्रिय कारीगर चुनें।'],
            groups: ['वेतन के दो तरीके', 'पीस रेट में उत्पादन के आधार पर वेतन पाने वाले कारीगर हैं। निश्चित वेतन में मासिक वेतन वाला स्टाफ है। हर समूह की अपनी गिनती है।'],
            pieceCard: ['कारीगर का कार्ड समझें', 'कार्ड पर नाम, शिफ्ट उपलब्धता और सक्रिय स्थिति दिखती है। उपलब्धता तय करती है कि किस शिफ्ट में आवंटन हो सकता है।'],
            salaryReadiness: ['वेतन की तैयारी देखें', 'राशि दिखाए बिना वेतन सेटअप की स्थिति दिखती है। वेतन और कार्यग्रहण तिथि मौजूद होने पर पेरोल तैयार दिखता है।'],
            add: ["कारीगर जोड़ें", "नए व्यक्ति के लिए कारीगर जोड़ें चुनें। सहेजने से पहले वेतन प्रकार तय करें; दोनों प्रकार सुरक्षित रूप से देखने के लिए टूर चलाएँ।"],
            name: ["कारीगर का नाम", "ऐसा नाम लिखें जिससे रजिस्टर और आवंटन में कारीगर आसानी से पहचाना जा सके।"],
            salaryRole: ['स्टाफ की भूमिका लिखें', 'निश्चित वेतन वाले स्टाफ के लिए सुपरवाइज़र जैसी भूमिका लिखें। इस भूमिका से भी स्टाफ खोज सकते हैं।'],
            edit: ["मौजूदा कारीगर का विवरण बदलें", "विवरण बदलने के लिए कार्ड पर संपादन चुनें। वेतन बदलाव के लिए आज या बाद की प्रभावी तारीख दें; पिछली कमाई और भुगतान रिकॉर्ड नहीं बदलते।"],
            lastDay: ['अंतिम कार्य दिवस दर्ज करें', 'इस तारीख तक वेतन जुड़ता है। निश्चित वेतन वाले स्टाफ को निष्क्रिय करते समय अंतिम कार्य दिवस ज़रूरी है।'],
            active: ["सक्रिय स्थिति संभालें", "व्यक्ति अब सक्रिय न हो तो सक्रिय कारीगर का निशान हटाएँ। स्थिति फ़िल्टर से निष्क्रिय रिकॉर्ड खोजें।"],
        },
        steps: {
            paytype: { title: "यह कारीगर कैसे वेतन पाता है, यह चुनें", body: "पीस रेट कारीगर बुने मीटर के हिसाब से कमाते हैं; वेतन वाला स्टाफ़ मासिक रकम कमाता है। सेव के बाद यह बदला नहीं जा सकता।" },
            availability: { title: "वह किन शिफ्ट में काम कर सकता है, यह तय करें", body: "दिन, रात या दोनों। सिर्फ़ मेल खाते कारीगर ही उस शिफ्ट में लूम पर लगते हैं।" },
            wage: { title: "मजदूरी क्वालिटी से आती है", body: "यहाँ मजदूरी नहीं लिखनी। उत्पादन में चालू करते समय तय क्वालिटी की मजदूरी, जो कारीगर उसे बुने, उस पर लागू होती है।" },
            loom: { title: "उन्हें लूम पर लगाएँ", body: "पीस रेट कारीगर मशीन आवंटन में किसी शिफ्ट के लूम पर लगने पर ही कमाता है।" },
            earnings: { title: "मीटर कमाई बनते हैं", body: "सेव शिफ्ट मीटर × मजदूरी जोड़ती है: 100 मीटर × ₹1.50 = ₹150। पेरोल यह चुकाता है।" },
            salary: { title: "तय मासिक वेतन लिखें", body: "पूरी मासिक रकम लिखें, यहाँ ₹18,000। पेरोल उससे हर अवधि निकालता है।" },
            joining: { title: "वेतन जुड़ने की तारीख से शुरू होता है", body: "30 दिन के महीने के बीच में जुड़ने वाले को उस महीने के 15/30 × ₹18,000 = ₹9,000 मिलते हैं।" },
            changes: { title: "हर बदलाव को तारीख दें", body: "वेतन बदले तो किस तारीख से लागू हो, यह लिखें। कोई छोड़े तो निष्क्रिय करने से पहले आख़िरी काम का दिन लिखें।" },
            payroll: { title: "वेतन पेरोल में दिखता है", body: "{c:viewPayroll} इस कारीगर का चालू अवधि का वेतन खोलता है।" },
            handoff: { title: "अपने कारीगर जोड़ें", body: "हर व्यक्ति के लिए {c:addWorker} चुनें और वेतन का प्रकार ध्यान से चुनें।" },
        },
    },
}
