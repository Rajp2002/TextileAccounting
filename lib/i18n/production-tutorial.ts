import type { Language } from './context'
import type { ProductionTourStep } from '../production-tour'
import { configurationTutorialCopy } from './configuration-tutorial'
type ProductionCopy = { sample: string; sections: string[]; fields: Record<ProductionTourStep, readonly [string, string]>; skip: string; back: string; next: string; finish: string; progress: string }
export const productionTutorialCopy: Record<Language, ProductionCopy> = {
en: { ...configurationTutorialCopy.en, sample: "Sample preview · your production is unchanged", sections: ["Production overview", "Activate a quality", "Allocate and manage looms", "Record a shift", "Review and save", "History and corrections"], fields: {
  "overview": [
    "Your production workspace",
    "Start with a saved costing, activate its quality, allocate looms, then record machine metres for each shift."
  ],
  "tabs": [
    "Two production views",
    "Overview & Looms manages qualities and loom setup. Daily Sheet records output and shows recent production."
  ],
  "qualities": [
    "Active qualities",
    "Each card identifies a production quality, its costing version, weaver wage and assigned looms."
  ],
  "activate": [
    "Activate a saved quality",
    "Open Activate Quality to choose an existing saved costing. This preview does not create a production job."
  ],
  "costing": [
    "Choose the costing version",
    "Search saved qualities and check the version before activation. Create and maintain the costing in Saved Costings."
  ],
  "wage": [
    "Check the weaver wage",
    "The quality’s weaver wage is used for machine production earnings. It is different from the fabric production cost per metre."
  ],
  "allocate": [
    "Assign looms to the quality",
    "Select the looms that should produce this quality. Existing worker–machine assignments remain unchanged."
  ],
  "loomStates": [
    "Understand loom availability",
    "Available looms can be selected. Currently assigned looms already use this quality. Looms producing another quality are disabled here; use Switch Quality on the loom board."
  ],
  "board": [
    "Read the loom board",
    "Each loom shows its current quality and operators. Running here means a quality is assigned, not a live measurement of machine activity."
  ],
  "filters": [
    "Find a loom",
    "Search by loom or worker and use All, Running or Available to narrow the board."
  ],
  "operators": [
    "Check the shift operators",
    "Review day and night operators separately. A machine needs a worker and production job before output can be allocated correctly."
  ],
  "switchQuality": [
    "Switch quality on a loom",
    "Choose another active quality. The loom’s operator assignments remain unchanged. This preview does not switch a real loom."
  ],
  "deactivate": [
    "Deactivate a quality",
    "Deactivation stops this quality on its assigned looms. Worker–machine assignments and historical production remain intact."
  ],
  "daily": [
    "Open the Daily Sheet",
    "Record production by machine, then review the automatically calculated worker totals."
  ],
  "date": [
    "Choose the production date",
    "Check the date before entering readings. Saved sheets show their historical worker, quality and wage snapshots."
  ],
  "shift": [
    "Choose the shift",
    "Day and night have separate sheets. Confirm the shift and its assigned workers before entering metres."
  ],
  "print": [
    "Collect readings on paper",
    "Print collection sheet prepares a paper register for the selected date and shift. The tour does not open printing or download a file."
  ],
  "reading": [
    "Enter machine metres",
    "Enter each machine’s output against its worker and quality. Enter or the down arrow moves to the next machine in the live sheet."
  ],
  "pending": [
    "Blank means pending",
    "A blank reading remains pending, even after an incomplete save. Show pending helps find machines still awaiting readings."
  ],
  "notRunning": [
    "Zero means not running",
    "Enter 0 or use Not running to account for a stopped machine. Clear it to return to a pending reading."
  ],
  "rollup": [
    "Review worker earnings",
    "Worker totals combine machine output at the applicable weaver rates. Here, 120 m × ₹2/m = ₹240."
  ],
  "workerStatus": [
    "Zero output and absence",
    "Worker statuses include Not entered, Produced, Zero output and Absent / no production. Use zero or absent only when that worker has no production for the shift."
  ],
  "draft": [
    "A draft is not submitted",
    "Draft saved on this device preserves local work. It is not a saved production shift. Discard draft removes local changes."
  ],
  "save": [
    "Review before saving",
    "Check accounted machines, pending readings and total metres. Save machine production submits the shift and updates production earnings."
  ],
  "incomplete": [
    "Saving an incomplete shift",
    "Missing readings remain pending, not zero. Entered production counts towards worker pay. Keep entering returns to the sheet."
  ],
  "history": [
    "Find recent production",
    "Search saved history by date, worker, machine or job. Older worker-only records may have no machine breakdown."
  ],
  "saved": [
    "Saved shifts and paid entries",
    "Saved sheets start locked. Edit production log unlocks eligible corrections; paid worker entries remain protected. If every worker is settled, the sheet stays protected."
  ],
  "correction": [
    "Explain a correction",
    "Enter a reason before unlocking a saved shift. Corrections can change metres and pay. Editing locks again after saving; protected paid entries cannot be changed."
  ],
  "audit": [
    "Review the audit trail",
    "The audit trail keeps the original save and each correction, including who changed it, the reason, and before-and-after metres, rates and earnings."
  ],
  "finish": [
    "Ready to record production",
    "Activate a quality, allocate looms and operators, record the right date and shift, then review and save. Replay this tour whenever needed."
  ]
}},
gu: { ...configurationTutorialCopy.gu, sample: "નમૂનો · તમારું ઉત્પાદન બદલાતું નથી", sections: ["ઉત્પાદન ઝાંખી", "ક્વોલિટી સક્રિય કરો", "લૂમ ફાળવણી", "શિફ્ટ નોંધો", "તપાસો અને સાચવો", "ઇતિહાસ અને સુધારા"], fields: {
  "overview": [
    "તમારું ઉત્પાદન કાર્યસ્થળ",
    "સાચવેલા કોસ્ટિંગથી શરૂ કરો, ક્વોલિટી સક્રિય કરો, લૂમ ફાળવો અને દરેક શિફ્ટના મશીન મીટર નોંધો."
  ],
  "tabs": [
    "ઉત્પાદનના બે દૃશ્યો",
    "Overview & Looms માં ક્વોલિટી અને લૂમ ગોઠવો. Daily Sheet માં ઉત્પાદન નોંધો અને તાજેતરના રેકોર્ડ જુઓ."
  ],
  "qualities": [
    "સક્રિય ક્વોલિટી",
    "દરેક કાર્ડમાં ક્વોલિટી, કોસ્ટિંગ વર્ઝન, વણકર મજૂરી અને ફાળવેલા લૂમ દેખાય છે."
  ],
  "activate": [
    "સાચવેલી ક્વોલિટી સક્રિય કરો",
    "Activate Quality ખોલીને સાચવેલું કોસ્ટિંગ પસંદ કરો. આ નમૂનો વાસ્તવિક ઉત્પાદન જોબ બનાવતો નથી."
  ],
  "costing": [
    "કોસ્ટિંગ વર્ઝન પસંદ કરો",
    "સાચવેલી ક્વોલિટી શોધો અને સક્રિય કરતાં પહેલાં વર્ઝન તપાસો. કોસ્ટિંગ Saved Costings માં બનાવો અને સંભાળો."
  ],
  "wage": [
    "વણકર મજૂરી તપાસો",
    "ક્વોલિટીની વણકર મજૂરીથી મશીન ઉત્પાદનની કમાણી ગણાય છે. આ કાપડના પ્રતિ મીટર ઉત્પાદન ખર્ચથી અલગ છે."
  ],
  "allocate": [
    "ક્વોલિટીને લૂમ ફાળવો",
    "આ ક્વોલિટી બનાવવા માટેના લૂમ પસંદ કરો. હાલની કારીગર–મશીન ફાળવણી યથાવત રહે છે."
  ],
  "loomStates": [
    "લૂમની ઉપલબ્ધતા સમજો",
    "ખાલી લૂમ પસંદ કરી શકાય છે. હાલમાં ફાળવેલા લૂમ આ ક્વોલિટી ચલાવે છે. બીજી ક્વોલિટી બનાવતા લૂમ અહીં પસંદ થતા નથી; બોર્ડ પર Switch Quality વાપરો."
  ],
  "board": [
    "લૂમ બોર્ડ વાંચો",
    "દરેક લૂમની ક્વોલિટી અને ઓપરેટર જુઓ. અહીં Running એટલે ક્વોલિટી ફાળવેલી છે, મશીન ખરેખર ચાલે છે તેનું જીવંત માપ નથી."
  ],
  "filters": [
    "લૂમ શોધો",
    "લૂમ અથવા કારીગરથી શોધો અને All, Running અથવા Available ફિલ્ટર વાપરો."
  ],
  "operators": [
    "શિફ્ટના ઓપરેટર તપાસો",
    "દિવસ અને રાતના ઓપરેટર અલગથી તપાસો. ઉત્પાદન યોગ્ય રીતે ફાળવવા મશીનને કારીગર અને ઉત્પાદન જોબ જરૂરી છે."
  ],
  "switchQuality": [
    "લૂમની ક્વોલિટી બદલો",
    "બીજી સક્રિય ક્વોલિટી પસંદ કરો. ઓપરેટર ફાળવણી યથાવત રહે છે. આ નમૂનો વાસ્તવિક લૂમ બદલતો નથી."
  ],
  "deactivate": [
    "ક્વોલિટી નિષ્ક્રિય કરો",
    "નિષ્ક્રિય કરવાથી તેના લૂમ પર આ ક્વોલિટીનું ઉત્પાદન બંધ થાય છે. કારીગર ફાળવણી અને જૂના રેકોર્ડ યથાવત રહે છે."
  ],
  "daily": [
    "દૈનિક શીટ ખોલો",
    "મશીન પ્રમાણે ઉત્પાદન નોંધો અને આપમેળે ગણાયેલા કારીગરના કુલ આંકડા તપાસો."
  ],
  "date": [
    "ઉત્પાદનની તારીખ પસંદ કરો",
    "રીડિંગ પહેલાં તારીખ તપાસો. સાચવેલી શીટમાં તે સમયના કારીગર, ક્વોલિટી અને મજૂરી દેખાય છે."
  ],
  "shift": [
    "શિફ્ટ પસંદ કરો",
    "દિવસ અને રાતની અલગ શીટ છે. મીટર નોંધતાં પહેલાં શિફ્ટ અને તેના કારીગર તપાસો."
  ],
  "print": [
    "કાગળ પર રીડિંગ એકત્ર કરો",
    "Print collection sheet પસંદ કરેલી તારીખ અને શિફ્ટનું કાગળનું રજીસ્ટર તૈયાર કરે છે. ટૂરમાં પ્રિન્ટ કે ડાઉનલોડ થતું નથી."
  ],
  "reading": [
    "મશીન મીટર નોંધો",
    "મશીનના કારીગર અને ક્વોલિટી સામે ઉત્પાદન નોંધો. વાસ્તવિક શીટમાં Enter અથવા નીચેનો તીર આગલા મશીન પર લઈ જાય છે."
  ],
  "pending": [
    "ખાલી એટલે બાકી",
    "અધૂરી શીટ સાચવ્યા પછી પણ ખાલી રીડિંગ બાકી રહે છે. Show pending થી બાકી મશીનો શોધો."
  ],
  "notRunning": [
    "શૂન્ય એટલે મશીન બંધ",
    "બંધ મશીન માટે 0 નાખો અથવા Not running વાપરો. તેને સાફ કરવાથી રીડિંગ ફરી બાકી થાય છે."
  ],
  "rollup": [
    "કારીગરની કમાણી તપાસો",
    "મશીન ઉત્પાદન અને લાગુ વણકર દરથી કુલ કમાણી ગણાય છે. અહીં 120 મી × ₹2/મી = ₹240."
  ],
  "workerStatus": [
    "શૂન્ય ઉત્પાદન અને ગેરહાજરી",
    "કારીગર સ્થિતિમાં નોંધ્યું નથી, ઉત્પાદન થયું, શૂન્ય ઉત્પાદન અને ગેરહાજર સામેલ છે. શિફ્ટમાં ઉત્પાદન ન હોય ત્યારે જ શૂન્ય કે ગેરહાજર વાપરો."
  ],
  "draft": [
    "ડ્રાફ્ટ સબમિટ થયેલો નથી",
    "આ ઉપકરણ પર સાચવેલો ડ્રાફ્ટ સ્થાનિક કામ રાખે છે; તે સાચવેલી ઉત્પાદન શિફ્ટ નથી. Discard draft સ્થાનિક ફેરફારો દૂર કરે છે."
  ],
  "save": [
    "સાચવતાં પહેલાં તપાસો",
    "ગણાયેલા મશીનો, બાકી રીડિંગ અને કુલ મીટર તપાસો. Save machine production શિફ્ટ સબમિટ કરીને કમાણી અપડેટ કરે છે."
  ],
  "incomplete": [
    "અધૂરી શિફ્ટ સાચવવી",
    "બાકી રીડિંગ શૂન્ય બનતા નથી. નોંધાયેલ ઉત્પાદન પગારમાં ગણાય છે. Keep entering થી શીટ પર પાછા જાઓ."
  ],
  "history": [
    "તાજેતરનું ઉત્પાદન શોધો",
    "તારીખ, કારીગર, મશીન અથવા જોબથી ઇતિહાસ શોધો. જૂના કારીગર આધારિત રેકોર્ડમાં મશીન વિભાજન ન હોઈ શકે."
  ],
  "saved": [
    "સાચવેલી શિફ્ટ અને ચૂકવેલ એન્ટ્રી",
    "સાચવેલી શીટ લૉક હોય છે. Edit production log થી મંજૂર સુધારા ખોલો. ચૂકવેલ એન્ટ્રી સુરક્ષિત રહે છે; બધા કારીગર ચૂકવાઈ ગયા હોય તો શીટ સુરક્ષિત રહે છે."
  ],
  "correction": [
    "સુધારાનું કારણ આપો",
    "શીટ ખોલતાં પહેલાં કારણ લખો. સુધારાથી મીટર અને પગાર બદલાઈ શકે છે. સાચવ્યા પછી ફરી લૉક થાય છે; ચૂકવેલ સુરક્ષિત એન્ટ્રી બદલાતી નથી."
  ],
  "audit": [
    "ઓડિટ ઇતિહાસ તપાસો",
    "મૂળ નોંધ અને દરેક સુધારો રહે છે: કોણે બદલ્યું, કારણ અને પહેલાં તથા પછીના મીટર, દર અને કમાણી."
  ],
  "finish": [
    "ઉત્પાદન નોંધવા તૈયાર",
    "ક્વોલિટી સક્રિય કરો, લૂમ અને ઓપરેટર ફાળવો, યોગ્ય તારીખ અને શિફ્ટ નોંધો, તપાસીને સાચવો. જરૂર પડે ત્યારે ટૂર ફરી જુઓ."
  ]
}},
hi: { ...configurationTutorialCopy.hi, sample: "नमूना · आपका उत्पादन नहीं बदलता", sections: ["उत्पादन अवलोकन", "क्वालिटी सक्रिय करें", "लूम आवंटन", "शिफ्ट दर्ज करें", "जाँचें और सहेजें", "इतिहास और सुधार"], fields: {
  "overview": [
    "आपका उत्पादन कार्यस्थल",
    "सहेजी गई लागत से शुरू करें, क्वालिटी सक्रिय करें, लूम आवंटित करें और हर शिफ्ट के मशीन मीटर दर्ज करें।"
  ],
  "tabs": [
    "उत्पादन के दो दृश्य",
    "Overview & Looms में क्वालिटी और लूम सेटअप सँभालें। Daily Sheet में उत्पादन दर्ज करें और हाल के रिकॉर्ड देखें।"
  ],
  "qualities": [
    "सक्रिय क्वालिटी",
    "हर कार्ड क्वालिटी, लागत संस्करण, बुनकर मजदूरी और आवंटित लूम दिखाता है।"
  ],
  "activate": [
    "सहेजी क्वालिटी सक्रिय करें",
    "Activate Quality खोलकर सहेजी हुई लागत चुनें। यह नमूना असली उत्पादन जॉब नहीं बनाता।"
  ],
  "costing": [
    "लागत संस्करण चुनें",
    "सहेजी क्वालिटी खोजें और सक्रिय करने से पहले संस्करण जाँचें। लागत Saved Costings में बनाएँ और सँभालें।"
  ],
  "wage": [
    "बुनकर मजदूरी जाँचें",
    "क्वालिटी की बुनकर मजदूरी से मशीन उत्पादन की कमाई निकलती है। यह कपड़े की प्रति मीटर उत्पादन लागत से अलग है।"
  ],
  "allocate": [
    "क्वालिटी को लूम आवंटित करें",
    "इस क्वालिटी को बनाने वाले लूम चुनें। मौजूदा कारीगर–मशीन आवंटन बना रहता है।"
  ],
  "loomStates": [
    "लूम उपलब्धता समझें",
    "खाली लूम चुन सकते हैं। वर्तमान आवंटित लूम इसी क्वालिटी पर हैं। दूसरी क्वालिटी बनाने वाले लूम यहाँ नहीं चुन सकते; बोर्ड पर Switch Quality इस्तेमाल करें।"
  ],
  "board": [
    "लूम बोर्ड पढ़ें",
    "हर लूम की क्वालिटी और ऑपरेटर देखें। यहाँ Running का अर्थ क्वालिटी आवंटित होना है, मशीन चलने का लाइव माप नहीं।"
  ],
  "filters": [
    "लूम खोजें",
    "लूम या कारीगर से खोजें और All, Running या Available फ़िल्टर लगाएँ।"
  ],
  "operators": [
    "शिफ्ट ऑपरेटर जाँचें",
    "दिन और रात के ऑपरेटर अलग जाँचें। उत्पादन सही आवंटित होने के लिए मशीन को कारीगर और उत्पादन जॉब चाहिए।"
  ],
  "switchQuality": [
    "लूम की क्वालिटी बदलें",
    "दूसरी सक्रिय क्वालिटी चुनें। ऑपरेटर आवंटन बना रहता है। यह नमूना असली लूम नहीं बदलता।"
  ],
  "deactivate": [
    "क्वालिटी निष्क्रिय करें",
    "निष्क्रिय करने से उसके लूम पर यह क्वालिटी बनना बंद होता है। कारीगर आवंटन और पुराने उत्पादन रिकॉर्ड बने रहते हैं।"
  ],
  "daily": [
    "दैनिक शीट खोलें",
    "मशीन के अनुसार उत्पादन दर्ज करें, फिर अपने आप निकले कारीगर कुल जाँचें।"
  ],
  "date": [
    "उत्पादन तारीख चुनें",
    "रीडिंग से पहले तारीख जाँचें। सहेजी शीट उस समय के कारीगर, क्वालिटी और मजदूरी दिखाती है।"
  ],
  "shift": [
    "शिफ्ट चुनें",
    "दिन और रात की अलग शीट हैं। मीटर दर्ज करने से पहले शिफ्ट और उसके कारीगर जाँचें।"
  ],
  "print": [
    "कागज़ पर रीडिंग लें",
    "Print collection sheet चुनी तारीख और शिफ्ट का कागज़ी रजिस्टर तैयार करता है। टूर में प्रिंट या डाउनलोड नहीं होता।"
  ],
  "reading": [
    "मशीन मीटर दर्ज करें",
    "मशीन के कारीगर और क्वालिटी के सामने उत्पादन दर्ज करें। असली शीट में Enter या नीचे का तीर अगली मशीन पर ले जाता है।"
  ],
  "pending": [
    "खाली मतलब बाकी",
    "अधूरी शीट सहेजने के बाद भी खाली रीडिंग बाकी रहती है। Show pending से बाकी मशीनें खोजें।"
  ],
  "notRunning": [
    "शून्य मतलब मशीन बंद",
    "बंद मशीन के लिए 0 डालें या Not running चुनें। साफ करने से रीडिंग फिर बाकी होती है।"
  ],
  "rollup": [
    "कारीगर की कमाई जाँचें",
    "मशीन उत्पादन और लागू बुनकर दरों से कुल कमाई निकलती है। यहाँ 120 मी × ₹2/मी = ₹240।"
  ],
  "workerStatus": [
    "शून्य उत्पादन और अनुपस्थिति",
    "स्थितियों में दर्ज नहीं, उत्पादन हुआ, शून्य उत्पादन और अनुपस्थित हैं। उस शिफ्ट में उत्पादन न होने पर ही शून्य या अनुपस्थित चुनें।"
  ],
  "draft": [
    "ड्राफ्ट जमा नहीं हुआ है",
    "इस उपकरण पर सहेजा ड्राफ्ट स्थानीय काम रखता है; यह सहेजी उत्पादन शिफ्ट नहीं है। Discard draft स्थानीय बदलाव हटाता है।"
  ],
  "save": [
    "सहेजने से पहले जाँचें",
    "हिसाब की गई मशीनें, बाकी रीडिंग और कुल मीटर जाँचें। Save machine production शिफ्ट जमा करके कमाई अपडेट करता है।"
  ],
  "incomplete": [
    "अधूरी शिफ्ट सहेजना",
    "बाकी रीडिंग शून्य नहीं होतीं। दर्ज उत्पादन वेतन में गिना जाता है। Keep entering से शीट पर लौटें।"
  ],
  "history": [
    "हाल का उत्पादन खोजें",
    "तारीख, कारीगर, मशीन या जॉब से इतिहास खोजें। पुराने कारीगर रिकॉर्ड में मशीन विवरण न भी हो सकता है।"
  ],
  "saved": [
    "सहेजी शिफ्ट और भुगतान वाली एंट्री",
    "सहेजी शीट लॉक होती है। Edit production log से योग्य सुधार खोलें। भुगतान वाली एंट्री सुरक्षित रहती हैं; सभी कारीगरों का भुगतान हो तो शीट सुरक्षित रहती है।"
  ],
  "correction": [
    "सुधार का कारण दें",
    "शीट खोलने से पहले कारण लिखें। सुधार मीटर और वेतन बदल सकता है। सहेजने पर फिर लॉक होता है; सुरक्षित भुगतान वाली एंट्री नहीं बदलतीं।"
  ],
  "audit": [
    "ऑडिट इतिहास जाँचें",
    "मूल सेव और हर सुधार रहता है: किसने बदला, कारण और पहले तथा बाद के मीटर, दर और कमाई।"
  ],
  "finish": [
    "उत्पादन दर्ज करने को तैयार",
    "क्वालिटी सक्रिय करें, लूम और ऑपरेटर आवंटित करें, सही तारीख और शिफ्ट दर्ज करें, जाँचकर सहेजें। जरूरत पर टूर फिर देखें।"
  ]
}},
}
