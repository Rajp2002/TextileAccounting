import type { Language } from './context'
import type { ProductionTourStep } from '../production-tour'
import { configurationTutorialCopy } from './configuration-tutorial'
type ProductionCopy = { sample: string; details: string; sections: string[]; fields: Record<ProductionTourStep, readonly [string, string]>; skip: string; back: string; next: string; finish: string; progress: string }
export const productionTutorialCopy: Record<Language, ProductionCopy> = {
en: { ...configurationTutorialCopy.en, sample: "Sample preview · your production is unchanged", sections: ["Prepare", "Record", "Manage setup", "History & corrections"], details: "Setup, history & corrections", fields: {
  "overview": [
    "Turn shift output into stock and earnings",
    "Record each loom’s shift output once. A saved shift adds fabric stock and worker earnings; Payroll handles payment. This sample leaves your real work unchanged."
  ],
  "activate": [
    "Choose the quality and wage",
    "In Overview & Looms → Activate Quality, check the costing version and Weaver wage before choosing Activate. Our sample uses ₹2/m for worker pay; the ₹40/m production cost is a different figure."
  ],
  "allocate": [
    "Connect the quality to its looms",
    "Choose Assign Looms on the active quality, select available looms, then confirm the allocation. A loom needs an active quality before its output can be recorded."
  ],
  "loomStates": [
    "Understand loom availability",
    "Available looms can be selected. Currently assigned looms already use this quality. Looms producing another quality are disabled here; use Switch Quality on the loom board."
  ],
  "board": [
    "Find a loom and check its setup",
    "Running means a quality is assigned, not a live reading of machine activity. Search by loom or worker; All, Running and Available filter the board. Check the quality and each shift’s operator."
  ],
  "operators": [
    "Connect an operator for each shift",
    "Open Manage Workers on the loom, choose Day Shift or Night Shift, then Assign the operator. Machine Assignments also manages these connections. Check the quality and operator before entering output."
  ],
  "switchQuality": [
    "Move a loom to another quality version",
    "First activate the required costing version in Overview & Looms → Activate Quality. Then choose it in Switch Quality on the loom. Operators stay assigned; previously saved sheets keep their original quality and wage."
  ],
  "deactivate": [
    "Deactivate a quality",
    "Deactivation stops this quality on its assigned looms. Worker–machine assignments and historical production remain intact."
  ],
  "date": [
    "Choose the sheet to record",
    "Open Daily Sheet and check Date and Shift first. Day and night have separate sheets and operators; saved sheets retain the workers, quality and wage used at that time."
  ],
  "print": [
    "Collect readings on paper",
    "Print collection sheet prepares a paper register for the selected date and shift. The tour does not open printing or download a file."
  ],
  "reading": [
    "Enter this shift’s output",
    "For the sample loom and operator, enter 120 m produced during this shift. Use shift output, not a cumulative meter reading. Enter or the down arrow moves to the next machine."
  ],
  "pending": [
    "Decide: pending or stopped?",
    "Leave a reading blank only when it is still pending. Enter 0 or choose Not running for a stopped loom. Clearing 0 makes it pending again; Show pending finds unfinished readings."
  ],
  "rollup": [
    "Check the worker’s earnings",
    "120 m × ₹2/m Weaver wage = ₹240 in gross earnings. Review the worker roll-up before saving. Payroll then applies advances and other adjustments before payment."
  ],
  "workerStatus": [
    "Zero output and absence",
    "Worker statuses include Not entered, Produced, Zero output and Absent / no production. Use zero or absent only when that worker has no production for the shift."
  ],
  "draft": [
    "A local draft is not a saved shift",
    "Draft saved on this device keeps unfinished work locally. It has not updated stock or payroll. Discard draft removes those local edits; Save machine production submits the shift."
  ],
  "save": [
    "Submit the checked shift",
    "Review metres and pending rows, then use Save machine production. These 120 m add 120 m to Fabric Stock and ₹240 to gross earnings. Blank rows stay pending even if you choose Save incomplete shift."
  ],
  "incomplete": [
    "Saving an incomplete shift",
    "Missing readings remain pending, not zero. Entered production counts towards worker pay. Keep entering returns to the sheet."
  ],
  "history": [
    "Find recent production",
    "In Daily Sheet, search Recent production by date, worker, machine or job, then choose View log. Older worker-only records may have no machine breakdown."
  ],
  "saved": [
    "Saved shifts and paid entries",
    "Saved sheets start locked. Edit production log unlocks eligible corrections; paid worker entries remain protected. If every worker is settled, the sheet stays protected."
  ],
  "correction": [
    "Give a correction reason",
    "Use Edit production log and enter a reason to unlock eligible rows. Correcting 120 m to 125 m adds 5 m to stock and ₹10 to earnings. Saving locks the sheet again; paid entries stay protected."
  ],
  "audit": [
    "Review before and after",
    "The audit trail keeps the original save and each correction: who changed it, why, and the metres, rates and earnings before and after. Finish returns to your work; replay this walkthrough beside the main tour."
  ],
  "finish": [
    "Take the next real action",
    "After Finish, complete missing setup or open Daily Sheet to record a shift. After saving, check Fabric Stock and settle earnings in Payroll. Replay Setup, history & corrections beside the tour for later changes."
  ],
  "prerequisites": [
    "Prepare missing records first",
    "Create a saved costing in Cost Estimator; check its version in Saved Costings. Add operators in Workers and looms in Machines. Then return here to connect the quality, loom and operator."
  ]
}},
gu: { ...configurationTutorialCopy.gu, sample: "નમૂનો · તમારું ઉત્પાદન બદલાતું નથી", sections: ["તૈયારી", "ઉત્પાદન નોંધો", "સેટઅપ સંભાળો", "ઇતિહાસ અને સુધારા"], details: "સેટઅપ, ઇતિહાસ અને સુધારા", fields: {
  "overview": [
    "શિફ્ટના ઉત્પાદનથી સ્ટોક અને કમાણી",
    "દરેક લૂમનું શિફ્ટ ઉત્પાદન એક વાર નોંધો. સાચવેલી શિફ્ટથી કાપડનો સ્ટોક અને કારીગરની કમાણી વધે છે; ચુકવણી Payroll માં થાય છે. આ નમૂનો તમારું વાસ્તવિક કામ બદલતો નથી."
  ],
  "activate": [
    "ક્વોલિટી અને મજૂરી પસંદ કરો",
    "Overview & Looms → Activate Quality માં કોસ્ટિંગ વર્ઝન અને Weaver wage તપાસીને Activate પસંદ કરો. નમૂનામાં કારીગરની મજૂરી ₹2/મી છે; ₹40/મી ઉત્પાદન ખર્ચ અલગ છે."
  ],
  "allocate": [
    "ક્વોલિટીને લૂમ સાથે જોડો",
    "સક્રિય ક્વોલિટી પર Assign Looms પસંદ કરો, ઉપલબ્ધ લૂમ પસંદ કરીને ફાળવણીની પુષ્ટિ કરો. ઉત્પાદન નોંધવા લૂમ સાથે સક્રિય ક્વોલિટી જોડાયેલી હોવી જરૂરી છે."
  ],
  "loomStates": [
    "લૂમની ઉપલબ્ધતા સમજો",
    "ખાલી લૂમ પસંદ કરી શકાય છે. હાલમાં ફાળવેલા લૂમ આ ક્વોલિટી ચલાવે છે. બીજી ક્વોલિટી બનાવતા લૂમ અહીં પસંદ થતા નથી; બોર્ડ પર Switch Quality વાપરો."
  ],
  "board": [
    "લૂમ શોધીને સેટઅપ તપાસો",
    "Running એટલે ક્વોલિટી ફાળવેલી છે, મશીન ચાલે છે તેનું જીવંત માપ નહીં. લૂમ કે કારીગરથી શોધો; All, Running અને Available થી બોર્ડ ફિલ્ટર કરો. ક્વોલિટી અને દરેક શિફ્ટનો ઓપરેટર તપાસો."
  ],
  "operators": [
    "દરેક શિફ્ટનો ઓપરેટર જોડો",
    "લૂમ પર Manage Workers ખોલો, Day Shift અથવા Night Shift પસંદ કરીને ઓપરેટર માટે Assign કરો. Machine Assignments માં પણ આ જોડાણ સંભાળી શકાય છે. ઉત્પાદન પહેલાં ક્વોલિટી અને ઓપરેટર તપાસો."
  ],
  "switchQuality": [
    "લૂમ પર ક્વોલિટીનું વર્ઝન બદલો",
    "પહેલાં Overview & Looms → Activate Quality માં જરૂરી કોસ્ટિંગ વર્ઝન સક્રિય કરો. પછી લૂમ પર Switch Quality માં તેને પસંદ કરો. ઓપરેટર ફાળવણી રહે છે; જૂની સાચવેલી શીટમાં મૂળ ક્વોલિટી અને મજૂરી રહે છે."
  ],
  "deactivate": [
    "ક્વોલિટી નિષ્ક્રિય કરો",
    "નિષ્ક્રિય કરવાથી તેના લૂમ પર આ ક્વોલિટીનું ઉત્પાદન બંધ થાય છે. કારીગર ફાળવણી અને જૂના રેકોર્ડ યથાવત રહે છે."
  ],
  "date": [
    "નોંધવાની શીટ પસંદ કરો",
    "Daily Sheet ખોલીને પહેલાં Date અને Shift તપાસો. દિવસ અને રાતની શીટ અને ઓપરેટર અલગ છે; સાચવેલી શીટમાં તે સમયના કારીગર, ક્વોલિટી અને મજૂરી રહે છે."
  ],
  "print": [
    "કાગળ પર રીડિંગ એકત્ર કરો",
    "Print collection sheet પસંદ કરેલી તારીખ અને શિફ્ટનું કાગળનું રજીસ્ટર તૈયાર કરે છે. ટૂરમાં પ્રિન્ટ કે ડાઉનલોડ થતું નથી."
  ],
  "reading": [
    "આ શિફ્ટનું ઉત્પાદન નોંધો",
    "નમૂનાના લૂમ અને ઓપરેટર માટે આ શિફ્ટમાં બનેલા 120 મી નોંધો. શિફ્ટનું ઉત્પાદન લખો, મીટરનું સંચિત રીડિંગ નહીં. Enter અથવા નીચેનો તીર આગલા મશીન પર લઈ જાય છે."
  ],
  "pending": [
    "બાકી છે કે લૂમ બંધ છે?",
    "રીડિંગ બાકી હોય ત્યારે જ ખાલી રાખો. બંધ લૂમ માટે 0 નાખો અથવા Not running પસંદ કરો. 0 સાફ કરવાથી ફરી બાકી થાય છે; Show pending થી અધૂરી નોંધો શોધો."
  ],
  "rollup": [
    "કારીગરની કમાણી તપાસો",
    "120 મી × ₹2/મી Weaver wage = ₹240 કુલ કમાણી. સાચવતાં પહેલાં કારીગરના કુલ આંકડા તપાસો. Payroll માં ચુકવણી પહેલાં એડવાન્સ અને અન્ય ફેરફારો લાગુ પડે છે."
  ],
  "workerStatus": [
    "શૂન્ય ઉત્પાદન અને ગેરહાજરી",
    "કારીગર સ્થિતિમાં નોંધ્યું નથી, ઉત્પાદન થયું, શૂન્ય ઉત્પાદન અને ગેરહાજર સામેલ છે. શિફ્ટમાં ઉત્પાદન ન હોય ત્યારે જ શૂન્ય કે ગેરહાજર વાપરો."
  ],
  "draft": [
    "સ્થાનિક ડ્રાફ્ટ સાચવેલી શિફ્ટ નથી",
    "Draft saved on this device અધૂરું કામ આ ઉપકરણ પર રાખે છે. સ્ટોક કે પગાર હજી અપડેટ થયા નથી. Discard draft સ્થાનિક ફેરફારો દૂર કરે છે; Save machine production શિફ્ટ સબમિટ કરે છે."
  ],
  "save": [
    "તપાસેલી શિફ્ટ સબમિટ કરો",
    "મીટર અને બાકી પંક્તિઓ તપાસીને Save machine production કરો. આ 120 મીથી Fabric Stock માં 120 મી અને કુલ કમાણીમાં ₹240 ઉમેરાય છે. Save incomplete shift કર્યા પછી પણ ખાલી પંક્તિઓ બાકી રહે છે."
  ],
  "incomplete": [
    "અધૂરી શિફ્ટ સાચવવી",
    "બાકી રીડિંગ શૂન્ય બનતા નથી. નોંધાયેલ ઉત્પાદન પગારમાં ગણાય છે. Keep entering થી શીટ પર પાછા જાઓ."
  ],
  "history": [
    "તાજેતરનું ઉત્પાદન શોધો",
    "Daily Sheet માં Recent production ને તારીખ, કારીગર, મશીન અથવા જોબથી શોધીને View log પસંદ કરો. જૂના કારીગર આધારિત રેકોર્ડમાં મશીન વિભાજન ન હોઈ શકે."
  ],
  "saved": [
    "સાચવેલી શિફ્ટ અને ચૂકવેલ એન્ટ્રી",
    "સાચવેલી શીટ લૉક હોય છે. Edit production log થી મંજૂર સુધારા ખોલો. ચૂકવેલ એન્ટ્રી સુરક્ષિત રહે છે; બધા કારીગર ચૂકવાઈ ગયા હોય તો શીટ સુરક્ષિત રહે છે."
  ],
  "correction": [
    "સુધારાનું કારણ આપો",
    "Edit production log માં કારણ આપીને મંજૂર પંક્તિઓ ખોલો. 120 મીને 125 મી કરવાથી સ્ટોકમાં 5 મી અને કમાણીમાં ₹10 ઉમેરાય છે. સાચવતાં શીટ ફરી લૉક થાય છે; ચૂકવેલી એન્ટ્રી સુરક્ષિત રહે છે."
  ],
  "audit": [
    "પહેલાં અને પછીના આંકડા તપાસો",
    "ઓડિટ ઇતિહાસમાં મૂળ નોંધ અને દરેક સુધારો રહે છે: કોણે, શા માટે બદલ્યું અને પહેલાં તથા પછીના મીટર, દર અને કમાણી. Finish થી તમારા કામ પર પાછા જાઓ; મુખ્ય ટૂર પાસે આ માર્ગદર્શન ફરી જુઓ."
  ],
  "finish": [
    "હવે વાસ્તવિક કામ શરૂ કરો",
    "Finish પછી બાકી સેટઅપ પૂરું કરો અથવા શિફ્ટ નોંધવા Daily Sheet ખોલો. સાચવ્યા પછી Fabric Stock તપાસો અને Payroll માં ચુકવણી કરો. પછીના ફેરફારો માટે ટૂર પાસે સેટઅપ, ઇતિહાસ અને સુધારા ફરી જુઓ."
  ],
  "prerequisites": [
    "પહેલાં જરૂરી રેકોર્ડ બનાવો",
    "Cost Estimator માં કોસ્ટિંગ સાચવો; Saved Costings માં તેનું વર્ઝન તપાસો. Workers માં ઓપરેટર અને Machines માં લૂમ ઉમેરો. પછી અહીં આવી ક્વોલિટી, લૂમ અને ઓપરેટરને જોડો."
  ]
}},
hi: { ...configurationTutorialCopy.hi, sample: "नमूना · आपका उत्पादन नहीं बदलता", sections: ["तैयारी", "उत्पादन दर्ज करें", "सेटअप सँभालें", "इतिहास और सुधार"], details: "सेटअप, इतिहास और सुधार", fields: {
  "overview": [
    "शिफ्ट के उत्पादन से स्टॉक और कमाई",
    "हर लूम का शिफ्ट उत्पादन एक बार दर्ज करें। सहेजी शिफ्ट से कपड़े का स्टॉक और कारीगर की कमाई बढ़ती है; भुगतान Payroll में होता है। यह नमूना आपका असली काम नहीं बदलता।"
  ],
  "activate": [
    "क्वालिटी और मजदूरी चुनें",
    "Overview & Looms → Activate Quality में लागत संस्करण और Weaver wage जाँचकर Activate चुनें। नमूने में कारीगर की मजदूरी ₹2/मी है; ₹40/मी उत्पादन लागत अलग है।"
  ],
  "allocate": [
    "क्वालिटी को लूम से जोड़ें",
    "सक्रिय क्वालिटी पर Assign Looms चुनें, उपलब्ध लूम चुनकर आवंटन की पुष्टि करें। उत्पादन दर्ज करने के लिए लूम से सक्रिय क्वालिटी जुड़ी होनी चाहिए।"
  ],
  "loomStates": [
    "लूम उपलब्धता समझें",
    "खाली लूम चुन सकते हैं। वर्तमान आवंटित लूम इसी क्वालिटी पर हैं। दूसरी क्वालिटी बनाने वाले लूम यहाँ नहीं चुन सकते; बोर्ड पर Switch Quality इस्तेमाल करें।"
  ],
  "board": [
    "लूम खोजकर सेटअप जाँचें",
    "Running मतलब क्वालिटी आवंटित है, मशीन चलने का लाइव माप नहीं। लूम या कारीगर से खोजें; All, Running और Available से बोर्ड फ़िल्टर करें। क्वालिटी और हर शिफ्ट का ऑपरेटर जाँचें।"
  ],
  "operators": [
    "हर शिफ्ट का ऑपरेटर जोड़ें",
    "लूम पर Manage Workers खोलें, Day Shift या Night Shift चुनकर ऑपरेटर के लिए Assign करें। Machine Assignments में भी ये संबंध सँभाल सकते हैं। उत्पादन से पहले क्वालिटी और ऑपरेटर जाँचें।"
  ],
  "switchQuality": [
    "लूम पर क्वालिटी का संस्करण बदलें",
    "पहले Overview & Looms → Activate Quality में जरूरी लागत संस्करण सक्रिय करें। फिर लूम पर Switch Quality में उसे चुनें। ऑपरेटर आवंटन बना रहता है; पुरानी सहेजी शीट में मूल क्वालिटी और मजदूरी रहती है।"
  ],
  "deactivate": [
    "क्वालिटी निष्क्रिय करें",
    "निष्क्रिय करने से उसके लूम पर यह क्वालिटी बनना बंद होता है। कारीगर आवंटन और पुराने उत्पादन रिकॉर्ड बने रहते हैं।"
  ],
  "date": [
    "दर्ज करने वाली शीट चुनें",
    "Daily Sheet खोलकर पहले Date और Shift जाँचें। दिन और रात की शीट और ऑपरेटर अलग हैं; सहेजी शीट में उस समय के कारीगर, क्वालिटी और मजदूरी रहती है।"
  ],
  "print": [
    "कागज़ पर रीडिंग लें",
    "Print collection sheet चुनी तारीख और शिफ्ट का कागज़ी रजिस्टर तैयार करता है। टूर में प्रिंट या डाउनलोड नहीं होता।"
  ],
  "reading": [
    "इस शिफ्ट का उत्पादन दर्ज करें",
    "नमूने के लूम और ऑपरेटर के लिए इस शिफ्ट में बने 120 मी दर्ज करें। शिफ्ट का उत्पादन लिखें, मीटर की कुल जमा रीडिंग नहीं। Enter या नीचे का तीर अगली मशीन पर ले जाता है।"
  ],
  "pending": [
    "बाकी है या लूम बंद है?",
    "रीडिंग बाकी हो तभी खाली छोड़ें। बंद लूम के लिए 0 डालें या Not running चुनें। 0 मिटाने से फिर बाकी होता है; Show pending से अधूरी रीडिंग खोजें।"
  ],
  "rollup": [
    "कारीगर की कमाई जाँचें",
    "120 मी × ₹2/मी Weaver wage = ₹240 कुल कमाई। सहेजने से पहले कारीगर का कुल जाँचें। Payroll में भुगतान से पहले एडवांस और दूसरे समायोजन लागू होते हैं।"
  ],
  "workerStatus": [
    "शून्य उत्पादन और अनुपस्थिति",
    "स्थितियों में दर्ज नहीं, उत्पादन हुआ, शून्य उत्पादन और अनुपस्थित हैं। उस शिफ्ट में उत्पादन न होने पर ही शून्य या अनुपस्थित चुनें।"
  ],
  "draft": [
    "स्थानीय ड्राफ्ट सहेजी शिफ्ट नहीं है",
    "Draft saved on this device अधूरा काम इस उपकरण पर रखता है। स्टॉक या वेतन अभी अपडेट नहीं हुआ। Discard draft स्थानीय बदलाव हटाता है; Save machine production शिफ्ट जमा करता है।"
  ],
  "save": [
    "जाँची हुई शिफ्ट जमा करें",
    "मीटर और बाकी पंक्तियाँ जाँचकर Save machine production चुनें। इन 120 मी से Fabric Stock में 120 मी और कुल कमाई में ₹240 जुड़ते हैं। Save incomplete shift के बाद भी खाली पंक्तियाँ बाकी रहती हैं।"
  ],
  "incomplete": [
    "अधूरी शिफ्ट सहेजना",
    "बाकी रीडिंग शून्य नहीं होतीं। दर्ज उत्पादन वेतन में गिना जाता है। Keep entering से शीट पर लौटें।"
  ],
  "history": [
    "हाल का उत्पादन खोजें",
    "Daily Sheet में Recent production को तारीख, कारीगर, मशीन या जॉब से खोजकर View log चुनें। पुराने कारीगर रिकॉर्ड में मशीन विवरण न भी हो सकता है।"
  ],
  "saved": [
    "सहेजी शिफ्ट और भुगतान वाली एंट्री",
    "सहेजी शीट लॉक होती है। Edit production log से योग्य सुधार खोलें। भुगतान वाली एंट्री सुरक्षित रहती हैं; सभी कारीगरों का भुगतान हो तो शीट सुरक्षित रहती है।"
  ],
  "correction": [
    "सुधार का कारण दें",
    "Edit production log में कारण देकर योग्य पंक्तियाँ खोलें। 120 मी को 125 मी करने से स्टॉक में 5 मी और कमाई में ₹10 जुड़ते हैं। सहेजने पर शीट फिर लॉक होती है; भुगतान वाली एंट्री सुरक्षित रहती हैं।"
  ],
  "audit": [
    "पहले और बाद के आँकड़े जाँचें",
    "ऑडिट इतिहास में मूल सेव और हर सुधार रहता है: किसने, क्यों बदला और पहले तथा बाद के मीटर, दर और कमाई। Finish से अपने काम पर लौटें; मुख्य टूर के पास यह मार्गदर्शन फिर देखें।"
  ],
  "finish": [
    "अब असली काम शुरू करें",
    "Finish के बाद बाकी सेटअप पूरा करें या शिफ्ट दर्ज करने के लिए Daily Sheet खोलें। सहेजने के बाद Fabric Stock जाँचें और Payroll में भुगतान करें। बाद के बदलावों के लिए टूर के पास सेटअप, इतिहास और सुधार फिर देखें।"
  ],
  "prerequisites": [
    "पहले जरूरी रिकॉर्ड बनाएँ",
    "Cost Estimator में लागत सहेजें; Saved Costings में उसका संस्करण जाँचें। Workers में ऑपरेटर और Machines में लूम जोड़ें। फिर यहाँ लौटकर क्वालिटी, लूम और ऑपरेटर जोड़ें।"
  ]
}},
}
