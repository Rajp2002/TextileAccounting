import type { Language } from './context'
import type { MachinesTourStep } from '../machines-tour'
import { configurationTutorialCopy } from './configuration-tutorial'

type MachinesCopy = {
    sample: string; sections: string[]
    fields: Record<MachinesTourStep, readonly [string, string]>
    skip: string; back: string; next: string; finish: string; progress: string
}
export const machinesTutorialCopy: Record<Language, MachinesCopy> = {
    en: {
        ...configurationTutorialCopy.en,
        sample: 'Tour samples · Nothing will be saved',
        sections: ['Find machines', 'Read machine cards', 'Add a machine', 'Manage machines', 'Continue setup'],
        fields: {
            search: ['Find a machine', 'Search by machine name, custom label, type, assigned worker or costing. This tour uses samples; your register and filters return when you finish.'],
            filter: ['Filter by readiness', 'All machines shows the full register. Active machines have both a worker and costing assigned. Needs setup finds machines missing either assignment.'],
            identity: ['Recognise a machine', 'Each card shows the custom label when one is set, otherwise the machine name. The machine type appears underneath.'],
            readiness: ['Understand Active', 'Active means both a worker and costing are assigned. It describes setup readiness, not whether the machine is currently running or available for new assignments.'],
            worker: ['Check the worker', 'This area shows the assigned worker. Not assigned means the machine still needs a worker assignment.'],
            costing: ['Check the costing', 'This area shows the assigned costing or fabric quality. A machine needs both this and a worker to show Active.'],
            add: ['Add a machine', 'Use Add machine to register a loom. Next, we will open a read-only sample of the real form without creating a record.'],
            name: ['Name your machine', 'When adding a machine, the name is optional. Leave it blank to generate a name such as Loom #1. When editing an existing machine, a name is required.'],
            type: ['Choose the machine type', 'Choose Jacquard, Power loom, Rapier, Water jet, Air jet, Circular or Other. This type helps identify the machine in the register.'],
            label: ['Add an optional custom label', 'Use a familiar label such as Rapier #1. When supplied, this becomes the name displayed on the machine card. The original machine name is still searchable.'],
            edit: ['Edit machine details', 'Use Edit to change the machine name, type or custom label. Existing machines also have an availability setting.'],
            availability: ['Control availability', 'Clear this setting when the machine should not be available for new assignments and daily context. This is separate from the Active readiness badge, which depends on worker and costing assignments.'],
            assignments: ['Review assignments', 'View assignment opens the assignment board filtered to this machine. After the tour, use it to review the machine’s setup. This preview will not navigate away.'],
            compare: ['Spot incomplete setup', 'This sample is available for assignments but has no worker or costing, so it shows Needs setup. Compare it with the configured sample to see what is missing.'],
            finish: ['Ready to manage your machines', 'Add machines, review readiness and continue to assignments when setup is missing. Finish restores your original register and filters. You can replay this tour anytime.'],
        },
    },
    gu: {
        ...configurationTutorialCopy.gu,
        sample: 'ટૂરના નમૂના · કંઈ સાચવવામાં આવશે નહીં',
        sections: ['મશીન શોધો', 'મશીન કાર્ડ સમજો', 'મશીન ઉમેરો', 'મશીન વ્યવસ્થાપન', 'ગોઠવણી આગળ વધારો'],
        fields: {
            search: ['મશીન શોધો', 'મશીનના નામ, કસ્ટમ લેબલ, પ્રકાર, ફાળવેલા કારીગર કે કોસ્ટિંગથી શોધો. ટૂરમાં નમૂના છે; પૂર્ણ થયા પછી તમારું રજિસ્ટર અને ફિલ્ટર પાછાં આવશે.'],
            filter: ['તૈયારી પ્રમાણે ફિલ્ટર કરો', 'બધા મશીનો આખું રજિસ્ટર બતાવે છે. સક્રિય મશીનોને કારીગર અને કોસ્ટિંગ બંને ફાળવેલા હોય છે. ગોઠવણી જરૂરીમાં કોઈ એક ફાળવણી ખૂટતાં મશીનો મળે છે.'],
            identity: ['મશીન ઓળખો', 'કસ્ટમ લેબલ હોય તો કાર્ડ પર તે દેખાય છે, નહીંતર મશીનનું નામ. નીચે મશીનનો પ્રકાર દેખાય છે.'],
            readiness: ['સક્રિયનો અર્થ સમજો', 'સક્રિય એટલે કારીગર અને કોસ્ટિંગ બંને ફાળવેલાં છે. આ ગોઠવણીની તૈયારી છે, મશીન અત્યારે ચાલે છે કે નવી ફાળવણી માટે ઉપલબ્ધ છે તેનો સંકેત નથી.'],
            worker: ['કારીગર તપાસો', 'અહીં ફાળવેલો કારીગર દેખાય છે. ફાળવેલ નથી એટલે મશીનને હજુ કારીગર ફાળવવાનો છે.'],
            costing: ['કોસ્ટિંગ તપાસો', 'અહીં ફાળવેલું કોસ્ટિંગ અથવા કાપડની ક્વોલિટી દેખાય છે. સક્રિય દેખાવા માટે આ અને કારીગર બંને જરૂરી છે.'],
            add: ['મશીન ઉમેરો', 'લૂમ નોંધવા મશીન ઉમેરો પસંદ કરો. હવે સાચા ફોર્મનો માત્ર જોવા માટેનો નમૂનો ખુલશે; કોઈ રેકોર્ડ બનશે નહીં.'],
            name: ['મશીનનું નામ આપો', 'નવું મશીન ઉમેરતી વખતે નામ વૈકલ્પિક છે. ખાલી રાખવાથી Loom #1 જેવું નામ બનશે. હાલના મશીનમાં ફેરફાર કરતી વખતે નામ જરૂરી છે.'],
            type: ['મશીનનો પ્રકાર પસંદ કરો', 'જેકાર્ડ, પાવર લૂમ, રેપિયર, વોટર જેટ, એર જેટ, સર્ક્યુલર અથવા અન્ય પસંદ કરો. પ્રકાર રજિસ્ટરમાં મશીન ઓળખવામાં મદદ કરે છે.'],
            label: ['વૈકલ્પિક કસ્ટમ લેબલ આપો', 'Rapier #1 જેવું ઓળખીતું લેબલ આપો. આપેલું લેબલ મશીનના કાર્ડ પર નામ તરીકે દેખાશે. મૂળ મશીનના નામથી પણ શોધી શકશો.'],
            edit: ['મશીનની વિગતો બદલો', 'નામ, પ્રકાર કે કસ્ટમ લેબલ બદલવા સંપાદન પસંદ કરો. હાલના મશીનમાં ઉપલબ્ધતાની ગોઠવણી પણ હોય છે.'],
            availability: ['ઉપલબ્ધતા ગોઠવો', 'મશીન નવી ફાળવણી અને દૈનિક સંદર્ભ માટે ઉપલબ્ધ ન હોવું જોઈએ ત્યારે આ ચિહ્ન દૂર કરો. સક્રિય તૈયારી બેજ અલગ છે: તે કારીગર અને કોસ્ટિંગની ફાળવણી પર આધારિત છે.'],
            assignments: ['ફાળવણી જુઓ', 'ફાળવણી જુઓ આ મશીન માટે ફિલ્ટર કરેલું બોર્ડ ખોલે છે. ટૂર પછી મશીનની ગોઠવણી તપાસવા તેનો ઉપયોગ કરો. આ નમૂનો બીજા પાને લઈ જશે નહીં.'],
            compare: ['અધૂરી ગોઠવણી ઓળખો', 'આ નમૂનો ફાળવણી માટે ઉપલબ્ધ છે પણ કારીગર કે કોસ્ટિંગ નથી, તેથી ગોઠવણી જરૂરી દેખાય છે. શું ખૂટે છે તે જોવા ગોઠવેલા નમૂના સાથે સરખાવો.'],
            finish: ['મશીનોનું વ્યવસ્થાપન શરૂ કરો', 'મશીનો ઉમેરો, તૈયારી તપાસો અને ગોઠવણી ખૂટતી હોય તો ફાળવણી પર જાઓ. પૂર્ણ કરવાથી મૂળ રજિસ્ટર અને ફિલ્ટર પાછાં આવશે. ટૂર ફરી જોઈ શકો છો.'],
        },
    },
    hi: {
        ...configurationTutorialCopy.hi,
        sample: 'टूर के नमूने · कुछ भी सहेजा नहीं जाएगा',
        sections: ['मशीन खोजें', 'मशीन कार्ड समझें', 'मशीन जोड़ें', 'मशीन प्रबंधन', 'सेटअप आगे बढ़ाएँ'],
        fields: {
            search: ['मशीन खोजें', 'मशीन के नाम, कस्टम लेबल, प्रकार, आवंटित कारीगर या कॉस्टिंग से खोजें। टूर में नमूने हैं; समाप्त होने पर आपका रजिस्टर और फ़िल्टर वापस आएंगे।'],
            filter: ['तैयारी के अनुसार फ़िल्टर करें', 'सभी मशीनें पूरा रजिस्टर दिखाता है। सक्रिय मशीनों में कारीगर और कॉस्टिंग दोनों आवंटित हैं। सेटअप आवश्यक में कोई एक आवंटन गायब होने वाली मशीनें मिलती हैं।'],
            identity: ['मशीन पहचानें', 'कस्टम लेबल होने पर कार्ड पर वही दिखता है, वरना मशीन का नाम। नीचे मशीन का प्रकार दिखता है।'],
            readiness: ['सक्रिय का अर्थ समझें', 'सक्रिय का अर्थ है कारीगर और कॉस्टिंग दोनों आवंटित हैं। यह सेटअप की तैयारी है, मशीन अभी चल रही है या नए आवंटन के लिए उपलब्ध है इसका संकेत नहीं।'],
            worker: ['कारीगर जाँचें', 'यहाँ आवंटित कारीगर दिखता है। आवंटित नहीं का अर्थ है मशीन को अभी कारीगर आवंटन की ज़रूरत है।'],
            costing: ['कॉस्टिंग जाँचें', 'यहाँ आवंटित कॉस्टिंग या कपड़े की क्वालिटी दिखती है। सक्रिय दिखने के लिए इसके साथ कारीगर भी ज़रूरी है।'],
            add: ['मशीन जोड़ें', 'लूम दर्ज करने के लिए मशीन जोड़ें चुनें। अब असली फ़ॉर्म का केवल देखने योग्य नमूना खुलेगा; कोई रिकॉर्ड नहीं बनेगा।'],
            name: ['मशीन का नाम दें', 'नई मशीन जोड़ते समय नाम वैकल्पिक है। खाली छोड़ने पर Loom #1 जैसा नाम बनेगा। मौजूदा मशीन का संपादन करते समय नाम ज़रूरी है।'],
            type: ['मशीन का प्रकार चुनें', 'जैक्वार्ड, पावर लूम, रैपियर, वॉटर जेट, एयर जेट, सर्कुलर या अन्य चुनें। प्रकार रजिस्टर में मशीन पहचानने में मदद करता है।'],
            label: ['वैकल्पिक कस्टम लेबल दें', 'Rapier #1 जैसा परिचित लेबल दें। दिया हुआ लेबल मशीन कार्ड पर नाम के रूप में दिखेगा। मूल मशीन नाम से भी खोज सकते हैं।'],
            edit: ['मशीन का विवरण बदलें', 'नाम, प्रकार या कस्टम लेबल बदलने के लिए संपादन चुनें। मौजूदा मशीनों में उपलब्धता की सेटिंग भी होती है।'],
            availability: ['उपलब्धता तय करें', 'जब मशीन नए आवंटन और दैनिक संदर्भ के लिए उपलब्ध नहीं होनी चाहिए, यह निशान हटाएँ। सक्रिय तैयारी बैज अलग है: वह कारीगर और कॉस्टिंग के आवंटन पर निर्भर है।'],
            assignments: ['आवंटन देखें', 'आवंटन देखें इस मशीन के लिए फ़िल्टर किया हुआ बोर्ड खोलता है। टूर के बाद मशीन का सेटअप जाँचने के लिए इसका उपयोग करें। यह नमूना दूसरे पृष्ठ पर नहीं ले जाएगा।'],
            compare: ['अधूरा सेटअप पहचानें', 'यह नमूना आवंटन के लिए उपलब्ध है लेकिन इसमें कारीगर या कॉस्टिंग नहीं है, इसलिए सेटअप आवश्यक दिखता है। क्या गायब है यह देखने के लिए तैयार नमूने से तुलना करें।'],
            finish: ['मशीन प्रबंधन शुरू करें', 'मशीनें जोड़ें, तैयारी जाँचें और सेटअप अधूरा हो तो आवंटन पर जाएँ। समाप्त करने पर मूल रजिस्टर और फ़िल्टर वापस आएंगे। टूर दोबारा देख सकते हैं।'],
        },
    },
}
