import type { Language } from './context'
import type { MachinesTourStep, MachinesTourExampleLabels } from '../machines-tour'
import { configurationTutorialCopy } from './configuration-tutorial'

type MachinesCopy = {
    sample: string; sections: string[]
    example: MachinesTourExampleLabels
    fields: Record<MachinesTourStep, readonly [string, string]>
    setupTitle: string
    productionLink: string; productionHelp: string
    assignmentsLink: string; assignmentsHelp: string
    helpTitle: string
    help: readonly (readonly [string, string])[]
    skip: string; back: string; next: string; finish: string; progress: string
}
export const machinesTutorialCopy: Record<Language, MachinesCopy> = {
    en: {
        ...configurationTutorialCopy.en,
        sample: 'Tour samples · Nothing will be saved',
        sections: ['Register a loom', 'Enter details', 'Recognise the result', 'Check readiness', 'Set the quality', 'Assign the worker'],
        example: { readyName: 'Sample loom 1', incompleteName: 'Sample loom 2', label: 'Sample Rapier', worker: 'Sample worker', fabric: 'Sample fabric' },
        fields: {
            purpose: ['One record for each physical loom', 'Use Add machine to register a loom so you can attach its fabric quality and worker before recording output. No costing or worker is needed to register it. This walkthrough uses read-only examples; your register and filters return on exit.'],
            details: ['Identify the loom', 'For this example, choose Rapier and name it Sample loom 1. A new loom can have a blank name; Weavly generates one such as Loom #1. The optional custom label Sample Rapier is the name your team will see. Add machine saves the real form.'],
            label: ['Recognise the saved record', 'With that custom label, the card reads Sample Rapier instead of Sample loom 1. Without a label, it shows the machine name. Registration creates the loom record; the worker and quality shown on this configured example require separate setup.'],
            readiness: ['Registered does not mean ready', 'Sample loom 2 is registered but has no worker or costing, so it shows Needs setup. Active requires both assignments effective today, in at least one shift. It does not confirm both shifts, physical running or availability for new assignments.'],
            production: ['First, give the loom a quality', 'Open Production → Overview & Looms. Use Activate Quality to choose a saved costing, then Assign Looms on that quality to select this loom and its start date. If no costing exists, save one in Cost Estimator first.'],
            assignments: ['Then assign its worker', 'Add the worker in Workers if needed. Open Machine Assignments, select Day or Night, then use Assign on the worker to choose the loom. Repeat for the other shift if needed. Finish restores your register; start with Add machine or the setup links below. Replay is always available.'],
        },
        setupTitle: 'After registering a loom',
        productionLink: '1. Production → Overview & Looms',
        productionHelp: 'Activate Quality from a saved costing, then use Assign Looms on that quality.',
        assignmentsLink: '2. Machine Assignments',
        assignmentsHelp: 'Choose the shift and use Assign on a registered worker to select the loom.',
        helpTitle: 'Finding, editing and availability',
        help: [
            ['Find a loom', 'Search by name, custom label, type, worker or costing. All machines shows the full register; Active requires worker and costing assignments effective today. Needs setup finds a missing assignment. Check each shift in Machine Assignments.'],
            ['Edit details', 'Use Edit to change name, type or custom label. A name is required when editing. The original machine name remains searchable even when a custom label appears on the card.'],
            ['Availability is separate', 'In Edit, clear Available for new assignments and daily context to stop offering the loom for new worker or quality assignments. This does not change its Active readiness badge or erase existing assignments.'],
            ['Review one loom', 'View assignment on a card opens Machine Assignments filtered to that loom. If its quality is missing, complete Production setup first using the link above.'],
        ],
    },
    gu: {
        ...configurationTutorialCopy.gu,
        sample: 'ટૂરના નમૂના · કંઈ સાચવવામાં આવશે નહીં',
        sections: ['લૂમ નોંધો', 'વિગતો આપો', 'પરિણામ ઓળખો', 'તૈયારી તપાસો', 'ક્વોલિટી ગોઠવો', 'કારીગર ફાળવો'],
        example: { readyName: 'નમૂના લૂમ 1', incompleteName: 'નમૂના લૂમ 2', label: 'નમૂના રેપિયર', worker: 'નમૂના કારીગર', fabric: 'નમૂના કાપડ' },
        fields: {
            purpose: ['દરેક વાસ્તવિક લૂમ માટે એક નોંધ', 'મશીન ઉમેરો વડે લૂમ નોંધો, જેથી ઉત્પાદન નોંધતા પહેલાં તેની ક્વોલિટી અને કારીગર ફાળવી શકો. નોંધણી માટે કોસ્ટિંગ કે કારીગર જરૂરી નથી. આ માત્ર જોવા માટેના નમૂના છે; બહાર નીકળતાં તમારું રજિસ્ટર અને ફિલ્ટર પાછાં આવશે.'],
            details: ['લૂમની ઓળખ આપો', 'આ ઉદાહરણમાં Rapier પસંદ કરો અને નામ નમૂના લૂમ 1 આપો. નવા લૂમનું નામ ખાલી રાખો તો Weavly Loom #1 જેવું નામ આપે છે. વૈકલ્પિક કસ્ટમ લેબલ નમૂના રેપિયર તમારી ટીમને દેખાશે. સાચા ફોર્મમાં મશીન ઉમેરો દબાવવાથી નોંધ સાચવાય છે.'],
            label: ['સાચવેલી નોંધ ઓળખો', 'કસ્ટમ લેબલ આપવાથી કાર્ડ પર નમૂના લૂમ 1 ને બદલે નમૂના રેપિયર દેખાય છે. લેબલ વિના મશીનનું નામ દેખાય છે. નોંધણીથી લૂમની નોંધ બને છે; આ તૈયાર નમૂનામાં દેખાતા કારીગર અને ક્વોલિટી માટે અલગ ગોઠવણી જરૂરી છે.'],
            readiness: ['નોંધાયેલું એટલે તૈયાર નહીં', 'નમૂના લૂમ 2 નોંધાયેલું છે, પણ કારીગર કે કોસ્ટિંગ નથી, એટલે ગોઠવણી જરૂરી દેખાય છે. સક્રિય માટે આજે લાગુ ક્વોલિટી અને ઓછામાં ઓછી એક શિફ્ટમાં કારીગર જરૂરી છે. તે બંને શિફ્ટ, મશીન ચાલે છે કે નવી ફાળવણી માટે ઉપલબ્ધ છે તેની ખાતરી નથી.'],
            production: ['પહેલાં લૂમને ક્વોલિટી આપો', 'Production → Overview & Looms ખોલો. Activate Quality વડે સાચવેલું કોસ્ટિંગ પસંદ કરો, પછી તે ક્વોલિટી પર Assign Looms વડે આ લૂમ અને શરૂઆતની તારીખ પસંદ કરો. કોસ્ટિંગ ન હોય તો પહેલાં Cost Estimator માં એક સાચવો.'],
            assignments: ['પછી કારીગર ફાળવો', 'જરૂર હોય તો કારીગરોમાં કારીગર ઉમેરો. મશીન ફાળવણી ખોલો, દિવસ કે રાત પસંદ કરો, પછી કારીગર પર Assign વડે લૂમ પસંદ કરો. જરૂર હોય તો બીજી શિફ્ટ માટે પણ કરો. પૂર્ણ કરતાં રજિસ્ટર પાછું આવશે; મશીન ઉમેરો અથવા નીચેની ગોઠવણી લિંકથી શરૂ કરો. ટૂર ફરી જોઈ શકો છો.'],
        },
        setupTitle: 'લૂમ નોંધ્યા પછી',
        productionLink: '1. Production → Overview & Looms',
        productionHelp: 'સાચવેલા કોસ્ટિંગથી Activate Quality કરો, પછી તે ક્વોલિટી પર Assign Looms પસંદ કરો.',
        assignmentsLink: '2. મશીન ફાળવણી',
        assignmentsHelp: 'શિફ્ટ પસંદ કરો અને નોંધાયેલા કારીગર પર Assign વડે લૂમ પસંદ કરો.',
        helpTitle: 'શોધ, સંપાદન અને ઉપલબ્ધતા',
        help: [
            ['લૂમ શોધો', 'નામ, કસ્ટમ લેબલ, પ્રકાર, કારીગર કે કોસ્ટિંગથી શોધો. બધા મશીનો આખું રજિસ્ટર બતાવે છે; સક્રિય માટે આજે લાગુ કારીગર અને કોસ્ટિંગ જરૂરી છે. ગોઠવણી જરૂરીમાં ખૂટતી ફાળવણી મળે છે. મશીન ફાળવણીમાં દરેક શિફ્ટ તપાસો.'],
            ['વિગતો બદલો', 'નામ, પ્રકાર કે કસ્ટમ લેબલ બદલવા સંપાદન પસંદ કરો. સંપાદન વખતે નામ જરૂરી છે. કાર્ડ પર કસ્ટમ લેબલ હોય તોપણ મૂળ મશીનના નામથી શોધી શકો છો.'],
            ['ઉપલબ્ધતા અલગ છે', 'સંપાદનમાં નવી ફાળવણી અને દૈનિક સંદર્ભ માટે ઉપલબ્ધનું ચિહ્ન દૂર કરો, જેથી નવી કારીગર કે ક્વોલિટી ફાળવણીમાં લૂમ ન મળે. તેનાથી સક્રિય તૈયારી બેજ બદલાતો નથી કે હાલની ફાળવણી દૂર થતી નથી.'],
            ['એક લૂમની ફાળવણી જુઓ', 'કાર્ડ પર ફાળવણી જુઓ આ લૂમ માટે ફિલ્ટર કરેલું મશીન ફાળવણી બોર્ડ ખોલે છે. ક્વોલિટી ખૂટે તો ઉપરની લિંકથી પહેલાં Production ગોઠવણી કરો.'],
        ],
    },
    hi: {
        ...configurationTutorialCopy.hi,
        sample: 'टूर के नमूने · कुछ भी सहेजा नहीं जाएगा',
        sections: ['लूम दर्ज करें', 'विवरण दें', 'परिणाम पहचानें', 'तैयारी जाँचें', 'क्वालिटी तय करें', 'कारीगर आवंटित करें'],
        example: { readyName: 'नमूना लूम 1', incompleteName: 'नमूना लूम 2', label: 'नमूना रैपियर', worker: 'नमूना कारीगर', fabric: 'नमूना कपड़ा' },
        fields: {
            purpose: ['हर वास्तविक लूम का एक रिकॉर्ड', 'मशीन जोड़ें से लूम दर्ज करें ताकि उत्पादन दर्ज करने से पहले उसकी क्वालिटी और कारीगर तय कर सकें। पंजीकरण के लिए कॉस्टिंग या कारीगर ज़रूरी नहीं। ये केवल देखने योग्य नमूने हैं; बाहर निकलने पर आपका रजिस्टर और फ़िल्टर वापस आएंगे।'],
            details: ['लूम की पहचान दें', 'इस उदाहरण में Rapier चुनें और नाम नमूना लूम 1 दें। नए लूम का नाम खाली हो तो Weavly Loom #1 जैसा नाम देता है। वैकल्पिक कस्टम लेबल नमूना रैपियर आपकी टीम को दिखेगा। असली फ़ॉर्म में मशीन जोड़ें दबाने पर रिकॉर्ड सहेजा जाता है।'],
            label: ['सहेजा हुआ रिकॉर्ड पहचानें', 'इस कस्टम लेबल से कार्ड पर नमूना लूम 1 की जगह नमूना रैपियर दिखता है। लेबल के बिना मशीन का नाम दिखता है। पंजीकरण से लूम का रिकॉर्ड बनता है; इस तैयार नमूने में दिख रहे कारीगर और क्वालिटी के लिए अलग सेटअप चाहिए।'],
            readiness: ['दर्ज होने का अर्थ तैयार होना नहीं', 'नमूना लूम 2 दर्ज है पर कारीगर या कॉस्टिंग नहीं है, इसलिए सेटअप आवश्यक दिखता है। सक्रिय के लिए आज लागू क्वालिटी और कम से कम एक शिफ्ट में कारीगर चाहिए। इससे दोनों शिफ्ट, मशीन के चलने या नए आवंटन के लिए उपलब्ध होने की पुष्टि नहीं होती।'],
            production: ['पहले लूम को क्वालिटी दें', 'Production → Overview & Looms खोलें। Activate Quality से सहेजी हुई कॉस्टिंग चुनें, फिर उस क्वालिटी पर Assign Looms से यह लूम और शुरू होने की तारीख चुनें। कॉस्टिंग न हो तो पहले Cost Estimator में एक सहेजें।'],
            assignments: ['फिर कारीगर आवंटित करें', 'ज़रूरत हो तो कारीगर में नया कारीगर जोड़ें। मशीन आवंटन खोलें, दिन या रात चुनें, फिर कारीगर पर Assign से लूम चुनें। ज़रूरत हो तो दूसरी शिफ्ट के लिए दोहराएँ। समाप्त करने पर रजिस्टर वापस आएगा; मशीन जोड़ें या नीचे के सेटअप लिंक से शुरू करें। टूर दोबारा देख सकते हैं।'],
        },
        setupTitle: 'लूम दर्ज करने के बाद',
        productionLink: '1. Production → Overview & Looms',
        productionHelp: 'सहेजी हुई कॉस्टिंग से Activate Quality करें, फिर उस क्वालिटी पर Assign Looms चुनें।',
        assignmentsLink: '2. मशीन आवंटन',
        assignmentsHelp: 'शिफ्ट चुनें और दर्ज कारीगर पर Assign से लूम चुनें।',
        helpTitle: 'खोज, संपादन और उपलब्धता',
        help: [
            ['लूम खोजें', 'नाम, कस्टम लेबल, प्रकार, कारीगर या कॉस्टिंग से खोजें। सभी मशीनें पूरा रजिस्टर दिखाता है; सक्रिय के लिए आज लागू कारीगर और कॉस्टिंग चाहिए। सेटअप आवश्यक में अधूरा आवंटन मिलता है। मशीन आवंटन में हर शिफ्ट जाँचें।'],
            ['विवरण बदलें', 'नाम, प्रकार या कस्टम लेबल बदलने के लिए संपादन चुनें। संपादन में नाम ज़रूरी है। कार्ड पर कस्टम लेबल होने पर भी मूल मशीन नाम से खोज सकते हैं।'],
            ['उपलब्धता अलग है', 'संपादन में नए आवंटन और दैनिक संदर्भ के लिए उपलब्ध का निशान हटाएँ ताकि नए कारीगर या क्वालिटी आवंटन में लूम न आए। इससे सक्रिय तैयारी बैज नहीं बदलता और मौजूदा आवंटन नहीं मिटते।'],
            ['एक लूम का आवंटन देखें', 'कार्ड पर आवंटन देखें इस लूम के लिए फ़िल्टर किया हुआ मशीन आवंटन बोर्ड खोलता है। क्वालिटी गायब हो तो ऊपर के लिंक से पहले Production सेटअप पूरा करें।'],
        ],
    },
}
