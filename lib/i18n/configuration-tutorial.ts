import type { Language } from './context'
import type { ConfigurationTourStep } from '../configuration-tour'

export const configurationHelpTopics = ['find', 'picker', 'drag', 'replace', 'remove', 'workers', 'machines', 'inactive'] as const

type Copy = {
    sections: string[]
    sample: string; worker: string; machine: string; inactiveMachine: string
    back: string; next: string; finish: string; skip: string; progress: string
    undoLabel: string; savedLabel: string; dayShiftLabel: string; dailySheetLabel: string
    helpLabel: string; helpIntro: string
    help: Record<typeof configurationHelpTopics[number], readonly [string, string]>
    fields: Record<ConfigurationTourStep, readonly [string, string]>
}

export const configurationTutorialCopy: Record<Language, Copy> = {
    en: {
        sections: ['Worker, machine and shift', 'Prepare the loom', 'Make an assignment', 'Check the result', 'Record production'],
        sample: 'Tour samples · No changes to your factory', worker: 'Sample worker', machine: 'Sample loom', inactiveMachine: 'Sample inactive loom',
        back: 'Back', next: 'Next', finish: 'Finish', skip: 'Skip tour', progress: 'Tour progress',
        undoLabel: 'Undo', savedLabel: 'Worker assigned.', dayShiftLabel: 'Day shift', dailySheetLabel: 'Open Daily Sheet',
        helpLabel: 'Assignment help', helpIntro: 'Filters, picker states and changes to existing assignments.',
        fields: {
            purpose: ['Who works on which loom?', 'Connect a piece-rate worker to a machine and shift so Daily Sheet can attribute its output to the right person. One worker can run several machines; each machine has one primary worker per shift. We will connect Sample worker to Sample loom.'],
            dayShift: ['Choose the shift first', 'This example uses Day shift. Day and Night shift have separate assignments: a day link does not carry into night. Choose the shift you are preparing before choosing a worker.'],
            jobRequired: ['Prepare the loom in Production', 'An active machine needs a production quality before you can assign a worker. Use Set job in Production → Overview & Looms. Choose Activate Quality from a saved costing, then Assign Looms on that quality. Return to Machine Assignments. If the quality is already active, go straight to Assign Looms.'],
            assign: ['Choose the worker', 'Find an active piece-rate worker available for this shift, then use Assign on their card. Here we use Sample worker. On a phone, an already-linked worker shows Change. Use Add worker after the tour if needed; salaried staff do not need machine assignments.'],
            picker: ['Choose saves immediately', 'For Sample worker, choose Sample loom. In the real picker, Choose saves the link immediately; there is no separate Save button. Choosing another machine keeps the worker’s other links. If a machine names another worker, replacement requires confirmation. Close leaves the picker without saving.'],
            connected: ['Check the saved link', 'Sample loom now names Sample worker for Day shift; the assignment count updates. A real save offers Undo in its confirmation. Use it while available to reverse a mistake. Assignment alone creates no production, stock or earnings, and does not rewrite previously saved production or pay.'],
            finish: ['Continue to Daily Sheet', 'Finish restores your original view and removes every sample. Prepare your real shift, then open Production → Daily Sheet to check the date and shift and record metres. Saving production adds fabric stock and worker earnings for Payroll. Replay this tour anytime; Assignment help covers filters and later changes.'],
        },
        help: {
            find: ['Find workers and machines', 'Search filters worker names in the selected shift. Machine type filters also apply in the picker; select a type again or All to clear them. Filters hide rows without changing links. On a phone, switch between Workers and Machines; desktop shows both. The cards show names, shift availability and links; matching line colours trace links on desktop.'],
            picker: ['Understand picker states', 'Current is disabled because this worker is already linked. Another worker’s name means choosing the machine asks to replace them. No production job is disabled: prepare its quality in Production → Overview & Looms → Activate Quality → Assign Looms. Unassigned alone does not mean ready. Close exits without choosing.'],
            drag: ['Assign by dragging on desktop', 'Drag a worker’s round connector onto an eligible machine. The line follows your pointer and valid targets highlight. Dropping on the machine saves immediately; releasing outside cancels. Assign works with a keyboard or phone. Extra links do not remove this worker’s other machines.'],
            replace: ['Replace a primary worker', 'Assign a different worker to the same machine and shift, then confirm replacement. Cancel keeps the original link. Undo in the save confirmation restores the previous assignment while available. Previously saved production and pay retain their saved details.'],
            remove: ['Unlink a worker', 'Use the unlink button beside the machine’s worker to remove that link for the selected shift. This does not delete the worker, machine or saved production. Use Assign to reconnect. Removing a link does not recalculate past earnings.'],
            workers: ['Add or edit workers', 'Add worker opens Workers: choose piece-rate pay and shift availability, then return here. Pay type cannot change later. Monthly staff do not need machine assignments. Manage workers opens the register to edit details, change active status or manage salaried staff.'],
            machines: ['Add or edit machines', 'Add machine opens Machines: choose its type and optional name or custom label. Prepare its quality in Production → Overview & Looms → Activate Quality → Assign Looms, then return here. Manage machines opens the register for edits and activation.'],
            inactive: ['Show inactive records', 'Show inactive reveals inactive workers and machines for reference; they cannot receive new assignments. Activate them in Workers or Machines first. Shift availability, search and type filters still apply. Workers already linked in a shift remain visible even if their availability changed.'],
        },
    },
    gu: {
        sections: ['કારીગર, મશીન અને શિફ્ટ', 'લૂમ તૈયાર કરો', 'ફાળવણી કરો', 'પરિણામ તપાસો', 'ઉત્પાદન નોંધો'],
        sample: 'ટૂરનાં નમૂના · તમારી ફેક્ટરીમાં કોઈ ફેરફાર નહીં', worker: 'નમૂના કારીગર', machine: 'નમૂના લૂમ', inactiveMachine: 'નિષ્ક્રિય નમૂના લૂમ',
        back: 'પાછળ', next: 'આગળ', finish: 'પૂર્ણ કરો', skip: 'ટૂર છોડો', progress: 'ટૂરની પ્રગતિ',
        undoLabel: 'પાછું વાળો', savedLabel: 'કારીગર ફાળવાયો.', dayShiftLabel: 'દિવસની શિફ્ટ', dailySheetLabel: 'Daily Sheet ખોલો',
        helpLabel: 'ફાળવણી માટે મદદ', helpIntro: 'ફિલ્ટર, પસંદગીની સ્થિતિ અને હાલની ફાળવણીમાં ફેરફાર.',
        fields: {
            purpose: ['કયા લૂમ પર કોણ કામ કરે છે?', 'પીસ-રેટ કારીગરને મશીન અને શિફ્ટ સાથે જોડો જેથી Daily Sheet માં તેનું ઉત્પાદન યોગ્ય કારીગરના નામે નોંધાય. એક કારીગર અનેક મશીનો ચલાવી શકે; દરેક શિફ્ટમાં મશીનનો એક મુખ્ય કારીગર હોય છે. આપણે નમૂના કારીગરને નમૂના લૂમ સાથે જોડીશું.'],
            dayShift: ['પહેલાં શિફ્ટ પસંદ કરો', 'આ ઉદાહરણ દિવસની શિફ્ટ માટે છે. દિવસ અને રાતની ફાળવણી અલગ છે: દિવસનું જોડાણ રાતે લાગુ પડતું નથી. કારીગર પસંદ કરતાં પહેલાં જે શિફ્ટ તૈયાર કરવી હોય તે પસંદ કરો.'],
            jobRequired: ['પ્રોડક્શનમાં લૂમ તૈયાર કરો', 'સક્રિય મશીનને કારીગર ફાળવતાં પહેલાં ઉત્પાદનની ક્વોલિટી જરૂરી છે. પ્રોડક્શનમાં કામ પસંદ કરો → Overview & Looms ખોલો. સાચવેલા કોસ્ટિંગમાંથી Activate Quality પસંદ કરો, પછી તે ક્વોલિટી પર Assign Looms કરો. મશીન ફાળવણી પર પાછા આવો. ક્વોલિટી પહેલેથી સક્રિય હોય તો સીધું Assign Looms કરો.'],
            assign: ['કારીગર પસંદ કરો', 'આ શિફ્ટમાં ઉપલબ્ધ સક્રિય પીસ-રેટ કારીગર શોધીને તેના કાર્ડ પર સોંપો પસંદ કરો. અહીં નમૂના કારીગર છે. ફોન પર જોડાયેલા કારીગર માટે બદલો દેખાય છે. કારીગર નથી? ટૂર પછી કારીગર ઉમેરો વાપરો; પગારદાર સ્ટાફને મશીન ફાળવણી જરૂરી નથી.'],
            picker: ['પસંદ કરતાં જ સેવ થાય છે', 'નમૂના કારીગર માટે નમૂના લૂમ પસંદ કરો. સાચી યાદીમાં પસંદ કરો દબાવતાં જ જોડાણ સેવ થાય છે; અલગ સેવ બટન નથી. બીજું મશીન પસંદ કરતાં કારીગરનાં અન્ય જોડાણો રહે છે. મશીન પર બીજા કારીગરનું નામ હોય તો બદલવાની પુષ્ટિ જરૂરી છે. બંધ કરો દ્વારા સેવ કર્યા વગર બહાર નીકળો.'],
            connected: ['સેવ થયેલું જોડાણ તપાસો', 'નમૂના લૂમ પર હવે દિવસની શિફ્ટ માટે નમૂના કારીગર છે; ફાળવણીની ગણતરી બદલાય છે. સાચા સેવની સૂચનામાં પાછું વાળો મળે છે. ઉપલબ્ધ હોય ત્યારે ભૂલ પાછી લો. ફક્ત ફાળવણીથી ઉત્પાદન, સ્ટોક કે કમાણી બનતાં નથી અને અગાઉ સેવ થયેલા ઉત્પાદન કે પગાર બદલાતાં નથી.'],
            finish: ['Daily Sheet તરફ આગળ વધો', 'પૂર્ણ કરો દ્વારા બધા નમૂના હટી તમારો જૂનો દેખાવ પાછો આવે છે. સાચી શિફ્ટ તૈયાર કરીને પ્રોડક્શન → Daily Sheet ખોલો, તારીખ અને શિફ્ટ તપાસો અને મીટર નોંધો. ઉત્પાદન સેવ કરતાં ફેબ્રિક સ્ટોક અને પેરોલ માટે કારીગરની કમાણી ઉમેરાય છે. ટૂર ફરી જોઈ શકો; ફિલ્ટર અને ફેરફારો માટે ફાળવણી માટે મદદ ખોલો.'],
        },
        help: {
            find: ['કારીગર અને મશીન શોધો', 'શોધ પસંદ શિફ્ટમાં કારીગરનાં નામ ગાળે છે. મશીન પ્રકારનાં ફિલ્ટર પસંદગી યાદીમાં પણ લાગુ પડે છે; દૂર કરવા ફરી એ પ્રકાર અથવા બધા પસંદ કરો. ફિલ્ટર જોડાણ બદલ્યા વગર પંક્તિઓ છુપાવે છે. ફોન પર કારીગરો અને મશીનો વચ્ચે બદલો; ડેસ્કટોપ પર બંને દેખાય છે. કાર્ડમાં નામ, શિફ્ટ ઉપલબ્ધતા અને જોડાણો હોય છે; ડેસ્કટોપ પર રેખાના રંગથી જોડાણ ઓળખો.'],
            picker: ['પસંદગીની સ્થિતિ સમજો', 'હાલનું બંધ છે કારણ કે કારીગર પહેલેથી જોડાયેલો છે. બીજા કારીગરનું નામ હોય તો મશીન પસંદ કરતાં બદલવાની પુષ્ટિ માગે છે. પ્રોડક્શન કામ નથી હોય તો પસંદગી બંધ છે: પ્રોડક્શન → Overview & Looms → Activate Quality → Assign Looms માં ક્વોલિટી ગોઠવો. ફક્ત ફાળવેલું ન હોવું પૂરતું નથી. બંધ કરો દ્વારા પસંદ કર્યા વગર બહાર નીકળો.'],
            drag: ['ડેસ્કટોપ પર ખેંચીને ફાળવો', 'કારીગરનો ગોળ કનેક્ટર યોગ્ય મશીન પર ખેંચો. રેખા પોઇન્ટર સાથે ચાલે છે અને યોગ્ય મશીન ઊભરે છે. મશીન પર છોડતાં તરત સેવ થાય; બહાર છોડતાં રદ થાય. કીબોર્ડ કે ફોન પર સોંપો વાપરો. વધારાના જોડાણથી કારીગરનાં અન્ય મશીનો દૂર થતાં નથી.'],
            replace: ['મુખ્ય કારીગર બદલો', 'એ જ મશીન અને શિફ્ટમાં બીજો કારીગર સોંપો અને બદલવાની પુષ્ટિ કરો. રદ કરવાથી જૂનું જોડાણ રહે છે. સેવની સૂચનામાં પાછું વાળો ઉપલબ્ધ હોય ત્યારે અગાઉની ફાળવણી પાછી લાવે છે. અગાઉ સેવ ઉત્પાદન અને પગારની વિગતો જળવાય છે.'],
            remove: ['કારીગરનું જોડાણ દૂર કરો', 'મશીનના કારીગર પાસેનું અનલિંક બટન પસંદ શિફ્ટનું જોડાણ દૂર કરે છે. કારીગર, મશીન કે સેવ ઉત્પાદન કાઢી નાખતું નથી. ફરી જોડવા સોંપો વાપરો. જોડાણ દૂર કરવાથી જૂની કમાણી ફરી ગણાતી નથી.'],
            workers: ['કારીગર ઉમેરો કે વિગતો બદલો', 'કારીગર ઉમેરો દ્વારા કારીગર પેજ ખૂલે છે: પીસ-રેટ પગાર અને શિફ્ટ ઉપલબ્ધતા પસંદ કરીને અહીં પાછા આવો. પગારનો પ્રકાર પછી બદલાતો નથી. પગારદાર સ્ટાફને મશીન ફાળવણી જરૂરી નથી. કારીગરોનું સંચાલન કરો દ્વારા વિગતો, સક્રિય સ્થિતિ અને પગારદાર સ્ટાફ સંભાળો.'],
            machines: ['મશીન ઉમેરો કે વિગતો બદલો', 'મશીન ઉમેરો દ્વારા મશીન પેજ ખૂલે છે: પ્રકાર અને વૈકલ્પિક નામ કે કસ્ટમ લેબલ પસંદ કરો. પ્રોડક્શન → Overview & Looms → Activate Quality → Assign Looms માં ક્વોલિટી ગોઠવી અહીં પાછા આવો. મશીનોનું સંચાલન કરો દ્વારા વિગતો કે સક્રિય સ્થિતિ બદલો.'],
            inactive: ['નિષ્ક્રિય રેકોર્ડ બતાવો', 'નિષ્ક્રિય બતાવો સંદર્ભ માટે કારીગર અને મશીન બતાવે છે; તેમને નવી ફાળવણી આપી શકાતી નથી. પહેલાં કારીગર કે મશીન પેજ પર સક્રિય કરો. શિફ્ટ ઉપલબ્ધતા, શોધ અને પ્રકારના ફિલ્ટર લાગુ રહે છે. શિફ્ટમાં પહેલેથી જોડાયેલા કારીગરની ઉપલબ્ધતા બદલાઈ હોય તોપણ તે દેખાય છે.'],
        },
    },
    hi: {
        sections: ['कारीगर, मशीन और शिफ्ट', 'लूम तैयार करें', 'आवंटन करें', 'परिणाम जाँचें', 'उत्पादन दर्ज करें'],
        sample: 'टूर के नमूने · आपकी फैक्ट्री में कोई बदलाव नहीं', worker: 'नमूना कारीगर', machine: 'नमूना लूम', inactiveMachine: 'निष्क्रिय नमूना लूम',
        back: 'पीछे', next: 'आगे', finish: 'पूरा करें', skip: 'टूर छोड़ें', progress: 'टूर की प्रगति',
        undoLabel: 'पूर्ववत करें', savedLabel: 'कारीगर आवंटित हुआ।', dayShiftLabel: 'दिन की शिफ्ट', dailySheetLabel: 'Daily Sheet खोलें',
        helpLabel: 'आवंटन सहायता', helpIntro: 'फ़िल्टर, चयन की स्थितियाँ और मौजूदा आवंटन में बदलाव।',
        fields: {
            purpose: ['किस लूम पर कौन काम करता है?', 'पीस-रेट कारीगर को मशीन और शिफ्ट से जोड़ें ताकि Daily Sheet उसका उत्पादन सही कारीगर के नाम दर्ज करे। एक कारीगर कई मशीनें चला सकता है; हर शिफ्ट में मशीन का एक मुख्य कारीगर होता है। हम नमूना कारीगर को नमूना लूम से जोड़ेंगे।'],
            dayShift: ['पहले शिफ्ट चुनें', 'यह उदाहरण दिन की शिफ्ट का है। दिन और रात के आवंटन अलग हैं: दिन का लिंक रात में लागू नहीं होता। कारीगर चुनने से पहले वह शिफ्ट चुनें जिसकी तैयारी कर रहे हैं।'],
            jobRequired: ['प्रोडक्शन में लूम तैयार करें', 'सक्रिय मशीन को कारीगर देने से पहले उत्पादन की क्वालिटी चाहिए। प्रोडक्शन में काम चुनें → Overview & Looms खोलें। सेव कॉस्टिंग से Activate Quality चुनें, फिर उस क्वालिटी पर Assign Looms करें। मशीन आवंटन पर लौटें। क्वालिटी पहले से सक्रिय हो तो सीधे Assign Looms करें।'],
            assign: ['कारीगर चुनें', 'इस शिफ्ट में उपलब्ध सक्रिय पीस-रेट कारीगर ढूँढें, फिर उसके कार्ड पर असाइन चुनें। यहाँ नमूना कारीगर है। फ़ोन पर पहले से जुड़े कारीगर के लिए बदलें दिखता है। कारीगर नहीं है? टूर के बाद कारीगर जोड़ें चुनें; वेतनभोगी स्टाफ को मशीन आवंटन नहीं चाहिए।'],
            picker: ['चुनते ही सेव होता है', 'नमूना कारीगर के लिए नमूना लूम चुनें। असली सूची में चुनें दबाते ही लिंक सेव होता है; अलग सेव बटन नहीं है। दूसरी मशीन चुनने से कारीगर के बाकी लिंक बने रहते हैं। मशीन पर दूसरे कारीगर का नाम हो तो बदलने की पुष्टि ज़रूरी है। बंद करें से बिना सेव किए बाहर निकलें।'],
            connected: ['सेव हुआ लिंक जाँचें', 'नमूना लूम पर अब दिन की शिफ्ट के लिए नमूना कारीगर है; आवंटन की गिनती बदलती है। असली सेव की सूचना में पूर्ववत करें मिलता है। उपलब्ध रहते हुए उससे गलती वापस लें। केवल आवंटन से उत्पादन, स्टॉक या कमाई नहीं बनती और पहले सेव उत्पादन या वेतन नहीं बदलते।'],
            finish: ['Daily Sheet पर आगे बढ़ें', 'पूरा करें से सभी नमूने हटकर आपका पुराना दृश्य लौटता है। असली शिफ्ट तैयार करके प्रोडक्शन → Daily Sheet खोलें, तारीख और शिफ्ट जाँचें और मीटर दर्ज करें। उत्पादन सेव करने से फ़ैब्रिक स्टॉक और पेरोल के लिए कारीगर की कमाई जुड़ती है। टूर फिर देख सकते हैं; फ़िल्टर और बाद के बदलावों के लिए आवंटन सहायता खोलें।'],
        },
        help: {
            find: ['कारीगर और मशीन खोजें', 'खोज चुनी शिफ्ट में कारीगरों के नाम छाँटती है। मशीन प्रकार के फ़िल्टर चयन सूची पर भी लागू होते हैं; हटाने के लिए फिर वही प्रकार या सभी चुनें। फ़िल्टर लिंक बदले बिना पंक्तियाँ छिपाते हैं। फ़ोन पर कारीगर और मशीन के बीच बदलें; डेस्कटॉप पर दोनों दिखते हैं। कार्ड में नाम, शिफ्ट उपलब्धता और लिंक हैं; डेस्कटॉप पर रेखाओं के रंग लिंक पहचानने में मदद करते हैं।'],
            picker: ['चयन की स्थितियाँ समझें', 'मौजूदा बंद है क्योंकि कारीगर पहले से जुड़ा है। दूसरे कारीगर का नाम हो तो मशीन चुनने पर बदलने की पुष्टि माँगी जाती है। प्रोडक्शन काम नहीं है तो विकल्प बंद है: प्रोडक्शन → Overview & Looms → Activate Quality → Assign Looms में क्वालिटी तैयार करें। केवल अनावंटित होना पर्याप्त नहीं। बंद करें से बिना चुने बाहर निकलें।'],
            drag: ['डेस्कटॉप पर खींचकर असाइन करें', 'कारीगर का गोल कनेक्टर योग्य मशीन पर खींचें। रेखा पॉइंटर के साथ चलती है और सही मशीन उभरती है। मशीन पर छोड़ते ही सेव होता है; बाहर छोड़ने पर रद्द। कीबोर्ड या फ़ोन पर असाइन इस्तेमाल करें। अतिरिक्त लिंक से कारीगर की बाकी मशीनें नहीं हटतीं।'],
            replace: ['मुख्य कारीगर बदलें', 'उसी मशीन और शिफ्ट में दूसरा कारीगर असाइन करें और बदलाव की पुष्टि करें। रद्द करने पर पुराना लिंक रहता है। सेव की सूचना में पूर्ववत करें उपलब्ध रहने तक पिछला आवंटन लौटा देता है। पहले सेव उत्पादन और वेतन की जानकारी बनी रहती है।'],
            remove: ['कारीगर का लिंक हटाएँ', 'मशीन के कारीगर के पास अनलिंक बटन चुनी शिफ्ट का लिंक हटाता है। इससे कारीगर, मशीन या सेव उत्पादन नहीं मिटते। दोबारा जोड़ने के लिए असाइन चुनें। लिंक हटाने से पिछली कमाई की दोबारा गणना नहीं होती।'],
            workers: ['कारीगर जोड़ें या विवरण बदलें', 'कारीगर जोड़ें से कारीगर पेज खुलता है: पीस-रेट वेतन और शिफ्ट उपलब्धता चुनकर यहाँ लौटें। वेतन का प्रकार बाद में नहीं बदल सकता। वेतनभोगी स्टाफ को मशीन आवंटन नहीं चाहिए। कारीगरों का प्रबंधन करें से विवरण, सक्रिय स्थिति और वेतनभोगी स्टाफ सँभालें।'],
            machines: ['मशीन जोड़ें या विवरण बदलें', 'मशीन जोड़ें से मशीन पेज खुलता है: प्रकार और वैकल्पिक नाम या कस्टम लेबल चुनें। प्रोडक्शन → Overview & Looms → Activate Quality → Assign Looms में क्वालिटी तैयार करके यहाँ लौटें। मशीनों का प्रबंधन करें से विवरण या सक्रिय स्थिति बदलें।'],
            inactive: ['निष्क्रिय रिकॉर्ड दिखाएँ', 'निष्क्रिय दिखाएँ से कारीगर और मशीन संदर्भ के लिए दिखते हैं; उन्हें नया आवंटन नहीं दे सकते। पहले कारीगर या मशीन पेज पर सक्रिय करें। शिफ्ट उपलब्धता, खोज और प्रकार के फ़िल्टर लागू रहते हैं। शिफ्ट में पहले से जुड़े कारीगर की उपलब्धता बदलने पर भी वह दिखता है।'],
        },
    },
}
