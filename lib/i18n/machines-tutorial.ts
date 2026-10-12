import type { Language } from './context'
import type { MachinesTourStep, MachinesTourCopyKey, MachinesTourExampleLabels } from '../machines-tour'
import { formatTourText } from '../tours/tour-text'

type MachinesCopy = Record<MachinesTourCopyKey, { title: string; body: string; detail?: string }> & {
    sample: string
    guide: { benefit: string }
    example: MachinesTourExampleLabels
    setupTitle: string
    productionLink: string; productionHelp: string
    assignmentsLink: string; assignmentsHelp: string
    helpTitle: string
    help: readonly (readonly [string, string])[]
}
export const machinesTutorialCopy: Record<Language, MachinesCopy> = {
    en: {
        sample: 'Tour samples · Nothing will be saved',
        example: { readyName: 'Sample loom 1', incompleteName: 'Sample loom 2', label: 'Sample Rapier', worker: 'Sample worker', fabric: 'Sample fabric' },
        purpose: {
            title: "One record for each loom",
            body: "Add every loom you run once. Production, assignments and payroll then refer to it by name.",
        },
        details: {
            title: "Name it the way your floor does",
            body: "Choose the machine type and an optional label such as \"Rapier 3\". If you leave the name blank, Weavly numbers it.",
            detail: "Later, {c:edit} lets you rename it or stop offering it for new assignments.",
        },
        readiness: {
            title: "Added is not the same as ready",
            body: "A machine shows {c:needsSetup} until it has a quality to weave and a worker for a shift.",
        },
        quality: {
            title: "First, give it a quality",
            body: "In Production, {c:assignLooms} on a quality puts it on this loom.",
        },
        worker: {
            title: "Then give it a worker",
            body: "In Machine Assignments, choose who runs this loom in each shift.",
        },
        handoff: {
            title: "Add your looms",
            body: "Choose {c:addMachine} once for each loom on your floor.",
        },
        guide: {
            benefit: "See how to add looms and get them ready for production.",
        },
        setupTitle: 'Activating your machine',
        productionLink: "1. Production",
        productionHelp: 'Activate Quality from a saved costing, then use Assign Looms on that quality.',
        assignmentsLink: '2. Machine Assignments',
        assignmentsHelp: 'Choose the shift and use Assign on a registered worker to select the loom.',
        helpTitle: 'Finding, editing and availability',
        help: [
            ['Find a loom', 'Search by name, custom label, type, worker or costing. All machines shows the full register; Active requires worker and costing assignments effective today. Needs setup finds a missing assignment. Check each shift in Machine Assignments.'],
            ['Edit details', 'Use Edit to change name, type or custom label. A name is required when editing. The original machine name remains searchable even when a custom label appears on the card.'],
            ['Availability is separate', 'In Edit, clear Available for new assignments and daily context to stop offering the loom for new worker or quality assignments. Give a short reason before saving; the card then shows an Inactive badge with that reason. Existing assignments are not erased.'],
            ['Review one loom', 'View assignment on a card opens Machine Assignments filtered to that loom. If its quality is missing, complete Production setup first using the link above.'],
        ],
    },
    gu: {
        sample: 'ટૂરના નમૂના · કંઈ સાચવવામાં આવશે નહીં',
        example: { readyName: 'નમૂના લૂમ 1', incompleteName: 'નમૂના લૂમ 2', label: 'નમૂના રેપિયર', worker: 'નમૂના કારીગર', fabric: 'નમૂના કાપડ' },
        purpose: {
            title: "દરેક લૂમ માટે એક રેકોર્ડ",
            body: "તમારો દરેક લૂમ એક વાર ઉમેરો. પછી ઉત્પાદન, ફાળવણી અને પેરોલ તેને નામથી ઓળખે છે.",
        },
        details: {
            title: "ફ્લોર પર કહો છો તેવું નામ આપો",
            body: "મશીનનો પ્રકાર અને \"રેપિયર 3\" જેવું વૈકલ્પિક લેબલ પસંદ કરો. નામ ખાલી રાખો તો Weavly નંબર આપે છે.",
            detail: "પછી {c:edit}થી નામ બદલી શકો કે નવી ફાળવણી માટે બંધ કરી શકો.",
        },
        readiness: {
            title: "ઉમેર્યું એટલે તૈયાર નહીં",
            body: "મશીન પાસે વણવા ક્વોલિટી અને શિફ્ટ માટે કારીગર ન હોય ત્યાં સુધી {c:needsSetup} દેખાય છે.",
        },
        quality: {
            title: "પહેલાં તેને ક્વોલિટી આપો",
            body: "ઉત્પાદનમાં ક્વોલિટી પર {c:assignLooms} તેને આ લૂમ પર મૂકે છે.",
        },
        worker: {
            title: "પછી તેને કારીગર આપો",
            body: "મશીન ફાળવણીમાં દરેક શિફ્ટમાં આ લૂમ કોણ ચલાવે તે પસંદ કરો.",
        },
        handoff: {
            title: "તમારા લૂમ ઉમેરો",
            body: "તમારા ફ્લોરના દરેક લૂમ માટે એક વાર {c:addMachine} પસંદ કરો.",
        },
        guide: {
            benefit: "લૂમ ઉમેરવા અને ઉત્પાદન માટે તૈયાર કરવાનું જુઓ.",
        },
        setupTitle: 'તમારું મશીન સક્રિય કરો',
        productionLink: "1. ઉત્પાદન",
        productionHelp: 'સાચવેલા કોસ્ટિંગથી Activate Quality કરો, પછી તે ક્વોલિટી પર Assign Looms પસંદ કરો.',
        assignmentsLink: '2. મશીન ફાળવણી',
        assignmentsHelp: 'શિફ્ટ પસંદ કરો અને નોંધાયેલા કારીગર પર Assign વડે લૂમ પસંદ કરો.',
        helpTitle: 'શોધ, સંપાદન અને ઉપલબ્ધતા',
        help: [
            ['લૂમ શોધો', 'નામ, કસ્ટમ લેબલ, પ્રકાર, કારીગર કે કોસ્ટિંગથી શોધો. બધા મશીનો આખું રજિસ્ટર બતાવે છે; સક્રિય માટે આજે લાગુ કારીગર અને કોસ્ટિંગ જરૂરી છે. ગોઠવણી જરૂરીમાં ખૂટતી ફાળવણી મળે છે. મશીન ફાળવણીમાં દરેક શિફ્ટ તપાસો.'],
            ['વિગતો બદલો', 'નામ, પ્રકાર કે કસ્ટમ લેબલ બદલવા સંપાદન પસંદ કરો. સંપાદન વખતે નામ જરૂરી છે. કાર્ડ પર કસ્ટમ લેબલ હોય તોપણ મૂળ મશીનના નામથી શોધી શકો છો.'],
            ['ઉપલબ્ધતા અલગ છે', 'સંપાદનમાં નવી ફાળવણી અને દૈનિક સંદર્ભ માટે ઉપલબ્ધનું ચિહ્ન દૂર કરો, જેથી નવી કારીગર કે ક્વોલિટી ફાળવણીમાં લૂમ ન મળે. સાચવતા પહેલાં ટૂંકું કારણ લખો; કાર્ડ પર નિષ્ક્રિય બેજ અને તે કારણ દેખાશે. હાલની ફાળવણી દૂર થતી નથી.'],
            ['એક લૂમની ફાળવણી જુઓ', 'કાર્ડ પર ફાળવણી જુઓ આ લૂમ માટે ફિલ્ટર કરેલું મશીન ફાળવણી બોર્ડ ખોલે છે. ક્વોલિટી ખૂટે તો ઉપરની લિંકથી પહેલાં Production ગોઠવણી કરો.'],
        ],
    },
    hi: {
        sample: 'टूर के नमूने · कुछ भी सहेजा नहीं जाएगा',
        example: { readyName: 'नमूना लूम 1', incompleteName: 'नमूना लूम 2', label: 'नमूना रैपियर', worker: 'नमूना कारीगर', fabric: 'नमूना कपड़ा' },
        purpose: {
            title: "हर लूम के लिए एक रिकॉर्ड",
            body: "अपना हर लूम एक बार जोड़ें। फिर उत्पादन, आवंटन और पेरोल उसे नाम से पहचानते हैं।",
        },
        details: {
            title: "जैसा फ़्लोर पर कहते हैं, वैसा नाम दें",
            body: "मशीन का प्रकार और \"रेपियर 3\" जैसा वैकल्पिक लेबल चुनें। नाम खाली छोड़ें तो Weavly नंबर देता है।",
            detail: "बाद में {c:edit} से नाम बदल सकते हैं या नए आवंटन के लिए बंद कर सकते हैं।",
        },
        readiness: {
            title: "जोड़ा मतलब तैयार नहीं",
            body: "मशीन के पास बुनने को क्वालिटी और शिफ्ट के लिए कारीगर न हो तब तक {c:needsSetup} दिखता है।",
        },
        quality: {
            title: "पहले उसे क्वालिटी दें",
            body: "उत्पादन में क्वालिटी पर {c:assignLooms} उसे इस लूम पर लगाता है।",
        },
        worker: {
            title: "फिर उसे कारीगर दें",
            body: "मशीन आवंटन में हर शिफ्ट में यह लूम कौन चलाए, यह चुनें।",
        },
        handoff: {
            title: "अपने लूम जोड़ें",
            body: "अपने फ़्लोर के हर लूम के लिए एक बार {c:addMachine} चुनें।",
        },
        guide: {
            benefit: "लूम जोड़ना और उत्पादन के लिए तैयार करना देखें।",
        },
        setupTitle: 'अपनी मशीन सक्रिय करें',
        productionLink: "1. उत्पादन",
        productionHelp: 'सहेजी हुई कॉस्टिंग से Activate Quality करें, फिर उस क्वालिटी पर Assign Looms चुनें।',
        assignmentsLink: '2. मशीन आवंटन',
        assignmentsHelp: 'शिफ्ट चुनें और दर्ज कारीगर पर Assign से लूम चुनें।',
        helpTitle: 'खोज, संपादन और उपलब्धता',
        help: [
            ['लूम खोजें', 'नाम, कस्टम लेबल, प्रकार, कारीगर या कॉस्टिंग से खोजें। सभी मशीनें पूरा रजिस्टर दिखाता है; सक्रिय के लिए आज लागू कारीगर और कॉस्टिंग चाहिए। सेटअप आवश्यक में अधूरा आवंटन मिलता है। मशीन आवंटन में हर शिफ्ट जाँचें।'],
            ['विवरण बदलें', 'नाम, प्रकार या कस्टम लेबल बदलने के लिए संपादन चुनें। संपादन में नाम ज़रूरी है। कार्ड पर कस्टम लेबल होने पर भी मूल मशीन नाम से खोज सकते हैं।'],
            ['उपलब्धता अलग है', 'संपादन में नए आवंटन और दैनिक संदर्भ के लिए उपलब्ध का निशान हटाएँ ताकि नए कारीगर या क्वालिटी आवंटन में लूम न आए। सहेजने से पहले छोटा कारण लिखें; कार्ड पर निष्क्रिय बैज और वह कारण दिखेगा। मौजूदा आवंटन नहीं मिटते।'],
            ['एक लूम का आवंटन देखें', 'कार्ड पर आवंटन देखें इस लूम के लिए फ़िल्टर किया हुआ मशीन आवंटन बोर्ड खोलता है। क्वालिटी गायब हो तो ऊपर के लिंक से पहले Production सेटअप पूरा करें।'],
        ],
    },
}

/** Resolve the same labels used by the live header, card and Production controls. */
export function machinesTourControlLabels(tx: (text: string) => string, t: (key: string) => string) {
    return { addMachine: tx('Add machine'), edit: tx('Edit'), needsSetup: tx('Needs setup'), assignLooms: t('production.assignLooms') }
}

export function machinesStepCopy(language: Language, step: MachinesTourStep, controls: Record<string, string>) {
    const copy = machinesTutorialCopy[language][step.slice(3) as MachinesTourCopyKey]
    return {
        title: copy.title,
        body: formatTourText(copy.body, controls),
        ...(copy.detail ? { detail: formatTourText(copy.detail, controls) } : {}),
    }
}
