import type { Language } from './context'
import type { PayrollTourStep } from '../payroll-tour'
import { configurationTutorialCopy } from './configuration-tutorial'

type PayrollCopy = { sample: string; sections: string[]; fields: Record<PayrollTourStep, readonly [string, string]>; skip: string; back: string; next: string; finish: string; progress: string }
const enFields: PayrollCopy['fields'] = {
  "period": [
    "Choose a payroll period",
    "Use the previous and next controls to choose the period. Check its start and end dates before reviewing settlement."
  ],
  "periodStatus": [
    "Read the period status",
    "Open, In Progress, Ready to Complete and Settled describe the period’s progress. Paying workers and completing the period are separate actions."
  ],
  "summary": [
    "Read the totals",
    "Compare gross earnings, recovery, net pay, paid amounts and outstanding amounts. These sample totals are illustrative and do not change your payroll."
  ],
  "progress": [
    "Track settlement progress",
    "The progress indicator shows how much of the worker settlement process is complete. Remaining obligations must be resolved before completing payroll."
  ],
  "readiness": [
    "Review issues before paying",
    "Payroll readiness checks the earnings included in pay. Resolve production issues before settling affected workers. Fixed salaries do not require production entries."
  ],
  "search": [
    "Find a worker",
    "Search by worker name. During the tour, sample workers replace your live data; your original search and selected period return on exit."
  ],
  "filter": [
    "Filter payment status",
    "Choose All workers, Ready to pay, Needs review, Paid or No earnings. A worker needing review must have their underlying issues resolved first."
  ],
  "piece": [
    "Review production earnings",
    "Piece-rate earnings come from recorded production and its saved rates. Here, 1,000 metres at ₹2 per metre produces ₹2,000 gross earnings."
  ],
  "salary": [
    "Review salary earnings",
    "Review the salary period and calculation separately from production earnings. This sample shows ₹18,000 for 30 of 30 calendar days, with no production required."
  ],
  "recovery": [
    "Understand recovery",
    "This sample has ₹1,000 pending, with ₹500 recovered from ₹2,000 gross pay, leaving ₹1,500 net. Review the actual recovery shown for each worker."
  ],
  "carry": [
    "Check what carries forward",
    "The remaining ₹500 debt stays outstanding after this sample recovery. The outstanding-pay area can also include earlier unpaid work: check each worker’s displayed dates."
  ],
  "advance": [
    "Record an advance",
    "The advance form asks for a worker, amount and optional description. Recorded advances remain pending until recovered through a later settlement. This sample form cannot save."
  ],
  "deduction": [
    "Record a deduction",
    "Choose the worker, reason/category, amount and optional notes. Pending deductions affect later settlement. Review the reason and amount before saving outside the tour."
  ],
  "workspace": [
    "Open the settlement workspace",
    "Settle Payroll opens a workspace for the selected period. Its search and worker-type filters help review outstanding obligations."
  ],
  "breakdown": [
    "Inspect the calculation",
    "Expand a worker to review production, machine, costing and rate details, or salary segments. Check the calculation behind gross earnings before recording payment."
  ],
  "mode": [
    "Choose the payment mode",
    "Record how payment was made: Cash, Bank transfer, UPI or Cheque. Selecting a mode does not initiate a transfer."
  ],
  "paymentDate": [
    "Record the payment date",
    "Use the actual payment date. The date records when payment happened; it is distinct from the earnings period being settled."
  ],
  "note": [
    "Add a payment note",
    "Use the optional note for payment context, such as who handed over cash. This note belongs to the payment record."
  ],
  "confirm": [
    "Review before marking paid",
    "Check the worker, period, gross earnings, recovery and net payable before confirming. Marking paid records a payment; it does not send money. This preview cannot confirm a real payment."
  ],
  "paid": [
    "Understand the paid state",
    "A paid record keeps the settlement details. Review its receipt instead of recording the same payment again. This is a sample paid state only."
  ],
  "complete": [
    "Complete the payroll period",
    "Complete Payroll becomes available once all worker obligations are resolved. Review the confirmation before closing the period. This is separate from marking an individual worker paid."
  ],
  "records": [
    "Open payroll records",
    "Payroll records preserve settled earnings, recoveries and payments. Select a settled period to review its saved details."
  ],
  "workerRecord": [
    "Review records by worker",
    "Expand a worker to see earnings, recovery, carried balance and payment details. The saved record explains how the net payment was calculated."
  ],
  "machineRecord": [
    "Review records by machine",
    "The machine view groups production and worker cost by machine, worker, costing and rate. Use it to trace production-based earnings."
  ],
  "export": [
    "Export a payroll report",
    "Export CSV or Export PDF covers the complete selected period, even when the on-screen search is filtered. Reversed records remain in the CSV audit export but are excluded from the active-payment PDF. This tour downloads nothing."
  ],
  "correction": [
    "Correct a mistaken payment record",
    "A correction is for a payment that was not actually made. Review eligibility and give a reason. Reversing the record does not reverse cash or a bank transfer. No correction runs in this tour."
  ],
  "cycle": [
    "Choose the payroll cycle",
    "Select the cycle you want to review. Check the displayed dates and pay-window status before treating the totals as due wages."
  ],
  "rules": [
    "Understand payroll rules",
    "Cycle start day, pay date day and reminder days determine the payroll schedule. This is a read-only preview; your saved rules stay unchanged."
  ],
  "payWindow": [
    "Check the payment window",
    "The pay-window notice explains when wages become due. A cycle that has not started can show no wages due yet rather than a worker list."
  ],
  "tabs": [
    "Switch worker groups",
    "Use the piece-rate and monthly/daily tabs to review the correct pay basis. Their calculations and available details differ."
  ],
  "fullSettlement": [
    "Review the payment calculation",
    "Mark Paid opens the settlement review. Check base earnings, applicable statutory deductions, adjustments and advance recovery before confirming the net payout."
  ],
  "adjustment": [
    "Review a manual adjustment",
    "Inam / Bonus adds to pay; Kapaat / Deduction reduces it. Choose a reason, amount and note, then review the updated calculation. The sample shows a zero adjustment."
  ],
  "fullRecovery": [
    "Review advance recovery",
    "Compare the recommended recovery with outstanding debt. If changing the recovery amount, review the resulting net payout and remaining debt before confirming."
  ],
  "finalSettlement": [
    "Distinguish final settlement",
    "Mark as Final Settlement belongs to the worker-exit workflow. Read its warning carefully; it is not the same as an ordinary cycle payment or Base’s Complete Payroll."
  ],
  "history": [
    "Review settlement history",
    "Open history to find recorded settlements, narrow the results with its filters and inspect an individual receipt."
  ],
  "receipt": [
    "Inspect a settlement receipt",
    "The receipt shows the saved worker, cycle, earnings, deductions, recovery and net payment. Review these saved values when checking a past payment."
  ],
  "csv": [
    "Export settlement history",
    "Download CSV exports the filtered settlement history. Check the filters first. No CSV is downloaded during this tour."
  ],
  "slip": [
    "Download a payslip",
    "PDF Slip creates a worker’s payslip from their settlement. The tour illustrates the action without generating or downloading a real slip."
  ],
  "whatsapp": [
    "Share a payslip",
    "WhatsApp sends the payslip when the worker and account meet the feature’s requirements. Check the recipient before sending outside the tour. This preview sends no messages."
  ],
  "finish": [
    "Ready to review payroll",
    "Check the period, earnings, recoveries and net amount before recording payment. Finish restores your live page and original selections. You can replay this tour anytime."
  ]
}
const guFields: PayrollCopy['fields'] = {
 period: ['પગારનો સમયગાળો પસંદ કરો', 'અગાઉનો કે આગળનો સમયગાળો પસંદ કરો. સેટલમેન્ટ તપાસતાં પહેલાં શરૂઆત અને અંતની તારીખ જુઓ.'],
 periodStatus: ['સમયગાળાની સ્થિતિ', 'ખુલ્લું, ચાલુ, પૂર્ણ કરવા તૈયાર અને સેટલ થયેલું પ્રગતિ દર્શાવે છે. કારીગરને ચૂકવવું અને સમયગાળો પૂર્ણ કરવો અલગ ક્રિયાઓ છે.'],
 summary: ['કુલ રકમ સમજો', 'કુલ કમાણી, વસૂલાત, ચોખ્ખો પગાર, ચૂકવેલી અને બાકી રકમ સરખાવો. આ નમૂનાની રકમો તમારા પેરોલને બદલતી નથી.'],
 progress: ['સેટલમેન્ટની પ્રગતિ', 'પ્રગતિ સૂચક કારીગરોની પતાવટ કેટલી પૂર્ણ થઈ તે બતાવે છે. પેરોલ પૂર્ણ કરતાં પહેલાં બાકી જવાબદારીઓ ઉકેલો.'],
 readiness: ['ચૂકવણી પહેલાં સમસ્યા તપાસો', 'પેરોલ તૈયારીમાં કમાણીની તપાસ થાય છે. અસરગ્રસ્ત કારીગરને ચૂકવતાં પહેલાં ઉત્પાદનની સમસ્યા ઉકેલો. નિશ્ચિત પગાર માટે ઉત્પાદન નોંધ જરૂરી નથી.'],
 search: ['કારીગર શોધો', 'નામથી શોધો. ટૂરમાં નમૂનાના કારીગરો દેખાય છે; બહાર નીકળતાં મૂળ શોધ અને સમયગાળો પાછાં આવશે.'],
 filter: ['ચૂકવણી સ્થિતિથી ફિલ્ટર કરો', 'બધા, ચૂકવવા તૈયાર, સમીક્ષા જરૂરી, ચૂકવેલા કે કમાણી વગરના કારીગરો પસંદ કરો. સમીક્ષા જરૂરી હોય તો પહેલાં મૂળ સમસ્યા ઉકેલો.'],
 piece: ['ઉત્પાદનની કમાણી', 'નોંધાયેલ ઉત્પાદન અને સાચવેલા દરથી પીસ રેટ કમાણી ગણાય છે. અહીં 1,000 મીટર × ₹2 એટલે ₹2,000 કુલ કમાણી.'],
 salary: ['પગારની કમાણી', 'ઉત્પાદનથી અલગ પગારનો સમયગાળો અને ગણતરી તપાસો. નમૂનામાં 30માંથી 30 દિવસ માટે ₹18,000 છે; ઉત્પાદન જરૂરી નથી.'],
 recovery: ['વસૂલાત સમજો', 'નમૂનામાં ₹1,000 બાકીમાંથી ₹500 વસૂલ થાય છે. ₹2,000 કમાણીમાંથી ₹1,500 ચોખ્ખો પગાર રહે છે. દરેક કારીગરની વાસ્તવિક વસૂલાત તપાસો.'],
 carry: ['આગળ જતી બાકી રકમ', 'વસૂલાત પછી ₹500 દેવું બાકી રહે છે. બાકી પગારમાં અગાઉનું અચૂકવેલું કામ પણ હોઈ શકે છે; કારીગરની તારીખો તપાસો.'],
 advance: ['એડવાન્સ નોંધો', 'કારીગર, રકમ અને વૈકલ્પિક વર્ણન આપો. એડવાન્સ પછીના સેટલમેન્ટમાં વસૂલ થાય ત્યાં સુધી બાકી રહે છે. નમૂનાનું ફોર્મ સાચવી શકતું નથી.'],
 deduction: ['કપાત નોંધો', 'કારીગર, કારણ/શ્રેણી, રકમ અને વૈકલ્પિક નોંધ પસંદ કરો. બાકી કપાત પછીના સેટલમેન્ટને અસર કરે છે. ટૂર બહાર સાચવતાં પહેલાં તપાસો.'],
 workspace: ['સેટલમેન્ટ ખોલો', 'પેરોલ સેટલ કરો પસંદ કરવાથી પસંદ કરેલા સમયગાળાનું કાર્યસ્થળ ખૂલે છે. શોધ અને કારીગરના પ્રકારથી બાકી જવાબદારી તપાસો.'],
 breakdown: ['ગણતરી તપાસો', 'કારીગરને વિસ્તારી ઉત્પાદન, મશીન, કોસ્ટિંગ અને દર કે પગારના ભાગો જુઓ. ચૂકવણી નોંધતાં પહેલાં કુલ કમાણીની ગણતરી તપાસો.'],
 mode: ['ચૂકવણી પદ્ધતિ', 'રોકડ, બેંક ટ્રાન્સફર, UPI કે ચેકમાંથી ચૂકવેલી પદ્ધતિ નોંધો. પદ્ધતિ પસંદ કરવાથી નાણાં મોકલાતાં નથી.'],
 paymentDate: ['ચૂકવણીની તારીખ', 'ખરેખર ચૂકવેલી તારીખ આપો. આ તારીખ કમાણીના સમયગાળાથી અલગ છે.'],
 note: ['ચૂકવણીની નોંધ', 'રોકડ કોણે આપી જેવી માહિતી માટે વૈકલ્પિક નોંધ વાપરો. આ નોંધ ચુકવણીના રેકોર્ડમાં રહે છે.'],
 confirm: ['ચૂકવેલ નોંધતાં પહેલાં તપાસો', 'કારીગર, સમયગાળો, કમાણી, વસૂલાત અને ચોખ્ખી રકમ તપાસો. ચૂકવેલ નોંધવાથી નાણાં મોકલાતાં નથી. આ નમૂનો વાસ્તવિક ચુકવણી નોંધતો નથી.'],
 paid: ['ચૂકવેલી સ્થિતિ', 'ચૂકવેલા રેકોર્ડમાં સેટલમેન્ટની વિગતો રહે છે. ફરી ચૂકવણી નોંધવાને બદલે રસીદ તપાસો. આ માત્ર નમૂનો છે.'],
 complete: ['પેરોલ સમયગાળો પૂર્ણ કરો', 'બધી જવાબદારી ઉકેલાય પછી પેરોલ પૂર્ણ કરી શકાય છે. ખાતરી તપાસો. આ એક કારીગરને ચૂકવેલ નોંધવાથી અલગ છે.'],
 records: ['પેરોલ રેકોર્ડ જુઓ', 'રેકોર્ડમાં સેટલ કરેલી કમાણી, વસૂલાત અને ચુકવણી સાચવાય છે. વિગતો જોવા સેટલ થયેલો સમયગાળો પસંદ કરો.'],
 workerRecord: ['કારીગર પ્રમાણે રેકોર્ડ', 'કારીગરને વિસ્તારી કમાણી, વસૂલાત, બાકી દેવું અને ચુકવણી જુઓ. રેકોર્ડ ચોખ્ખા પગારની ગણતરી સમજાવે છે.'],
 machineRecord: ['મશીન પ્રમાણે રેકોર્ડ', 'મશીન દૃશ્યમાં મશીન, કારીગર, કોસ્ટિંગ અને દર પ્રમાણે ઉત્પાદન અને કારીગર ખર્ચ દેખાય છે. ઉત્પાદનની કમાણી તપાસવા વાપરો.'],
 export: ['પેરોલ અહેવાલ નિકાસ', 'CSV કે PDFમાં આખો પસંદ કરેલો સમયગાળો આવે છે, શોધ ફિલ્ટર હોવા છતાં. ઉલટાવેલા રેકોર્ડ CSVમાં રહે છે, પણ સક્રિય ચુકવણીના PDFમાં નથી આવતા. ટૂર કંઈ ડાઉનલોડ કરતી નથી.'],
 correction: ['ખોટી ચુકવણી નોંધ સુધારો', 'ખરેખર ચુકવણી ન થઈ હોય તેવા રેકોર્ડ માટે સુધારો છે. પાત્રતા તપાસી કારણ આપો. રેકોર્ડ ઉલટાવવાથી રોકડ કે બેંક ચુકવણી પાછી આવતી નથી. ટૂર સુધારો કરતી નથી.'],
 cycle: ['પેરોલ ચક્ર પસંદ કરો', 'સમીક્ષા માટે ચક્ર પસંદ કરો. કુલને ચૂકવવાપાત્ર માનતાં પહેલાં તારીખો અને ચૂકવણી સમયની સ્થિતિ તપાસો.'],
 rules: ['પેરોલ નિયમો', 'ચક્રનો શરૂઆતનો દિવસ, ચૂકવણીનો દિવસ અને યાદ અપાવવાના દિવસો સમયપત્રક નક્કી કરે છે. આ માત્ર નમૂનો છે; સાચવેલા નિયમો બદલાતા નથી.'],
 payWindow: ['ચૂકવણીનો સમય', 'સૂચના પગાર ક્યારે ચૂકવવાપાત્ર થાય તે સમજાવે છે. શરૂ ન થયેલા ચક્રમાં કારીગરોની યાદીને બદલે હજુ પગાર બાકી નથી એવું દેખાઈ શકે છે.'],
 tabs: ['કારીગર જૂથ બદલો', 'પીસ રેટ અને માસિક/દૈનિક ટૅબથી યોગ્ય પગાર આધાર જુઓ. તેમની ગણતરી અને વિગતો અલગ હોય છે.'],
 fullSettlement: ['ચૂકવણીની ગણતરી જુઓ', 'ચૂકવેલ નોંધો સેટલમેન્ટ સમીક્ષા ખોલે છે. મૂળ કમાણી, લાગુ વૈધાનિક કપાત, ફેરફાર અને એડવાન્સ વસૂલાત તપાસો.'],
 adjustment: ['હાથેથી પગાર ફેરફાર', 'ઇનામ/બોનસ પગાર વધારે છે; કપાત ઘટાડે છે. કારણ, રકમ અને નોંધ આપીને ગણતરી તપાસો. નમૂનામાં ફેરફાર શૂન્ય છે.'],
 fullRecovery: ['એડવાન્સ વસૂલાત તપાસો', 'ભલામણ કરેલી વસૂલાત અને બાકી દેવું સરખાવો. વસૂલાત બદલતાં ચોખ્ખો પગાર અને બાકી દેવું ફરી તપાસો.'],
 finalSettlement: ['અંતિમ પતાવટ અલગ છે', 'અંતિમ પતાવટ કારીગરની વિદાય પ્રક્રિયા માટે છે. ચેતવણી વાંચો; આ સામાન્ય ચક્રની ચુકવણી કે Baseના પેરોલ પૂર્ણ કરવા જેવું નથી.'],
 history: ['સેટલમેન્ટ ઇતિહાસ', 'નોંધાયેલા સેટલમેન્ટ શોધવા ઇતિહાસ ખોલો. ફિલ્ટરથી પરિણામ ઓછાં કરો અને રસીદ તપાસો.'],
 receipt: ['સેટલમેન્ટની રસીદ', 'રસીદમાં કારીગર, ચક્ર, કમાણી, કપાત, વસૂલાત અને ચોખ્ખી ચુકવણી છે. અગાઉની ચુકવણી માટે સાચવેલી વિગતો તપાસો.'],
 csv: ['ઇતિહાસની નિકાસ', 'CSV ડાઉનલોડ ફિલ્ટર કરેલા ઇતિહાસની નિકાસ કરે છે. પહેલાં ફિલ્ટર તપાસો. ટૂરમાં CSV ડાઉનલોડ થતું નથી.'],
 slip: ['પગારની સ્લિપ', 'PDF સ્લિપ કારીગરના સેટલમેન્ટ પરથી બને છે. ટૂરમાં વાસ્તવિક સ્લિપ બનતી કે ડાઉનલોડ થતી નથી.'],
 whatsapp: ['પગારની સ્લિપ મોકલો', 'સુવિધાની જરૂરિયાત પૂરી થતી હોય ત્યારે WhatsAppથી સ્લિપ મોકલી શકાય છે. ટૂર બહાર મોકલતાં પ્રાપ્તકર્તા તપાસો. નમૂનો સંદેશ મોકલતો નથી.'],
 finish: ['પેરોલ તપાસવા તૈયાર', 'ચુકવણી નોંધતાં પહેલાં સમયગાળો, કમાણી, વસૂલાત અને ચોખ્ખી રકમ તપાસો. પૂર્ણ કરવાથી મૂળ પાનું અને પસંદગી પાછાં આવે છે. ટૂર ફરી જોઈ શકો છો.'],
}
const hiFields: PayrollCopy['fields'] = {
 period: ['वेतन अवधि चुनें', 'पिछली या अगली अवधि चुनें। निपटान की समीक्षा से पहले शुरुआत और अंत की तारीख जाँचें।'],
 periodStatus: ['अवधि की स्थिति', 'खुला, जारी, पूरा करने को तैयार और निपटाया गया प्रगति बताते हैं। कारीगर को भुगतान और अवधि पूरी करना अलग कार्य हैं।'],
 summary: ['कुल राशि समझें', 'कुल कमाई, वसूली, शुद्ध वेतन, भुगतान और बकाया की तुलना करें। नमूने की राशियाँ आपका पेरोल नहीं बदलतीं।'],
 progress: ['निपटान की प्रगति', 'प्रगति सूचक बताता है कि कारीगरों का निपटान कितना पूरा हुआ। पेरोल पूरा करने से पहले बाकी दायित्व हल करें।'],
 readiness: ['भुगतान से पहले समस्याएँ देखें', 'पेरोल तैयारी में कमाई की जाँच होती है। प्रभावित कारीगर को भुगतान से पहले उत्पादन की समस्या हल करें। निश्चित वेतन के लिए उत्पादन प्रविष्टि आवश्यक नहीं।'],
 search: ['कारीगर खोजें', 'नाम से खोजें। टूर में नमूने दिखते हैं; बाहर निकलने पर मूल खोज और चुनी अवधि वापस आएगी।'],
 filter: ['भुगतान स्थिति से फ़िल्टर करें', 'सभी, भुगतान के लिए तैयार, समीक्षा आवश्यक, भुगतान किए या बिना कमाई वाले कारीगर चुनें। समीक्षा हो तो पहले मूल समस्या हल करें।'],
 piece: ['उत्पादन की कमाई', 'दर्ज उत्पादन और सहेजी दरों से पीस रेट कमाई बनती है। यहाँ 1,000 मीटर × ₹2 से ₹2,000 कुल कमाई है।'],
 salary: ['वेतन की कमाई', 'उत्पादन से अलग वेतन अवधि और गणना जाँचें। नमूने में 30 में से 30 दिनों के लिए ₹18,000 हैं; उत्पादन आवश्यक नहीं।'],
 recovery: ['वसूली समझें', 'नमूने में ₹1,000 बकाया से ₹500 वसूले जाते हैं। ₹2,000 कमाई से ₹1,500 शुद्ध वेतन बचता है। हर कारीगर की वास्तविक वसूली जाँचें।'],
 carry: ['आगे जाने वाला बकाया', 'वसूली के बाद ₹500 ऋण बाकी रहता है। बकाया वेतन में पहले का अवैतनिक काम भी हो सकता है; कारीगर की तारीखें जाँचें।'],
 advance: ['अग्रिम दर्ज करें', 'कारीगर, राशि और वैकल्पिक विवरण दें। बाद के निपटान में वसूली तक अग्रिम बकाया रहता है। नमूना फ़ॉर्म सहेज नहीं सकता।'],
 deduction: ['कटौती दर्ज करें', 'कारीगर, कारण/श्रेणी, राशि और वैकल्पिक नोट चुनें। लंबित कटौती बाद के निपटान पर असर डालती है। टूर के बाहर सहेजने से पहले जाँचें।'],
 workspace: ['निपटान खोलें', 'पेरोल निपटाएँ चुनी अवधि का कार्यक्षेत्र खोलता है। खोज और कारीगर प्रकार के फ़िल्टर से बकाया दायित्व देखें।'],
 breakdown: ['गणना जाँचें', 'कारीगर को खोलकर उत्पादन, मशीन, कॉस्टिंग और दर या वेतन खंड देखें। भुगतान दर्ज करने से पहले कुल कमाई की गणना जाँचें।'],
 mode: ['भुगतान का तरीका', 'नकद, बैंक ट्रांसफ़र, UPI या चेक में वास्तविक तरीका दर्ज करें। तरीका चुनने से पैसे नहीं भेजे जाते।'],
 paymentDate: ['भुगतान की तारीख', 'वास्तविक भुगतान की तारीख दें। यह कमाई की अवधि से अलग है।'],
 note: ['भुगतान का नोट', 'नकद किसने दिया जैसे संदर्भ के लिए वैकल्पिक नोट दें। यह नोट भुगतान रिकॉर्ड में रहता है।'],
 confirm: ['भुगतान दर्ज करने से पहले जाँचें', 'कारीगर, अवधि, कमाई, वसूली और शुद्ध राशि जाँचें। भुगतान किया दर्ज करने से पैसे नहीं भेजे जाते। नमूना वास्तविक भुगतान दर्ज नहीं करता।'],
 paid: ['भुगतान की स्थिति', 'भुगतान रिकॉर्ड में निपटान की जानकारी रहती है। वही भुगतान दोबारा दर्ज करने के बजाय रसीद देखें। यह केवल नमूना है।'],
 complete: ['पेरोल अवधि पूरी करें', 'सभी दायित्व हल होने पर पेरोल पूरा कर सकते हैं। पुष्टि जाँचें। यह एक कारीगर का भुगतान दर्ज करने से अलग है।'],
 records: ['पेरोल रिकॉर्ड खोलें', 'रिकॉर्ड में निपटाई कमाई, वसूली और भुगतान सुरक्षित रहते हैं। विवरण देखने के लिए निपटाई अवधि चुनें।'],
 workerRecord: ['कारीगर के अनुसार रिकॉर्ड', 'कारीगर को खोलकर कमाई, वसूली, बचा ऋण और भुगतान देखें। रिकॉर्ड शुद्ध भुगतान की गणना समझाता है।'],
 machineRecord: ['मशीन के अनुसार रिकॉर्ड', 'मशीन दृश्य में मशीन, कारीगर, कॉस्टिंग और दर के अनुसार उत्पादन और श्रम लागत दिखती है। उत्पादन की कमाई जाँचने के लिए उपयोग करें।'],
 export: ['पेरोल रिपोर्ट निर्यात करें', 'CSV या PDF में पूरी चुनी अवधि आती है, खोज फ़िल्टर होने पर भी। उलटे रिकॉर्ड CSV में रहते हैं, पर सक्रिय भुगतान के PDF में नहीं आते। टूर कुछ डाउनलोड नहीं करता।'],
 correction: ['गलत भुगतान रिकॉर्ड सुधारें', 'सुधार उस भुगतान के लिए है जो वास्तव में नहीं हुआ। पात्रता जाँचकर कारण दें। रिकॉर्ड उलटने से नकद या बैंक भुगतान वापस नहीं आता। टूर सुधार नहीं करता।'],
 cycle: ['पेरोल चक्र चुनें', 'समीक्षा का चक्र चुनें। कुल को देय वेतन मानने से पहले तारीखें और भुगतान समय की स्थिति जाँचें।'],
 rules: ['पेरोल नियम समझें', 'चक्र शुरू होने का दिन, भुगतान दिन और अनुस्मारक दिन समयसारणी तय करते हैं। यह केवल नमूना है; सहेजे नियम नहीं बदलते।'],
 payWindow: ['भुगतान समय जाँचें', 'सूचना बताती है कि वेतन कब देय होगा। शुरू न हुए चक्र में सूची की जगह अभी वेतन देय नहीं दिख सकता है।'],
 tabs: ['कारीगर समूह बदलें', 'पीस रेट और मासिक/दैनिक टैब से सही वेतन आधार देखें। उनकी गणना और विवरण अलग हैं।'],
 fullSettlement: ['भुगतान गणना देखें', 'भुगतान दर्ज करें निपटान समीक्षा खोलता है। मूल कमाई, लागू वैधानिक कटौती, समायोजन और अग्रिम वसूली जाँचें।'],
 adjustment: ['मैनुअल समायोजन देखें', 'इनाम/बोनस वेतन बढ़ाता है; कटौती घटाती है। कारण, राशि और नोट देकर गणना जाँचें। नमूने में समायोजन शून्य है।'],
 fullRecovery: ['अग्रिम वसूली जाँचें', 'सुझाई वसूली और बकाया ऋण की तुलना करें। वसूली बदलते समय शुद्ध भुगतान और बचे ऋण को फिर जाँचें।'],
 finalSettlement: ['अंतिम निपटान अलग है', 'अंतिम निपटान कारीगर के काम छोड़ने की प्रक्रिया के लिए है। चेतावनी पढ़ें; यह सामान्य चक्र भुगतान या Base का पेरोल पूरा करना नहीं है।'],
 history: ['निपटान इतिहास देखें', 'दर्ज निपटान खोजने के लिए इतिहास खोलें। फ़िल्टर से परिणाम सीमित करें और रसीद देखें।'],
 receipt: ['निपटान की रसीद', 'रसीद में कारीगर, चक्र, कमाई, कटौती, वसूली और शुद्ध भुगतान है। पुराने भुगतान के लिए सहेजे विवरण जाँचें।'],
 csv: ['इतिहास निर्यात करें', 'CSV डाउनलोड फ़िल्टर किए इतिहास का निर्यात करता है। पहले फ़िल्टर जाँचें। टूर में CSV डाउनलोड नहीं होता।'],
 slip: ['वेतन पर्ची डाउनलोड करें', 'PDF Slip कारीगर के निपटान से पर्ची बनाता है। टूर वास्तविक पर्ची बनाता या डाउनलोड नहीं करता।'],
 whatsapp: ['वेतन पर्ची भेजें', 'सुविधा की आवश्यकताएँ पूरी होने पर WhatsApp से पर्ची भेज सकते हैं। टूर के बाहर भेजने से पहले प्राप्तकर्ता जाँचें। नमूना संदेश नहीं भेजता।'],
 finish: ['पेरोल समीक्षा के लिए तैयार', 'भुगतान दर्ज करने से पहले अवधि, कमाई, वसूली और शुद्ध राशि जाँचें। समाप्त करने पर मूल पृष्ठ और चयन वापस आते हैं। टूर फिर देख सकते हैं।'],
}
export const payrollTutorialCopy: Record<Language, PayrollCopy> = {
 en: { ...configurationTutorialCopy.en, sample: 'Illustrative payroll preview · Nothing will be saved or sent', sections: ['Period and rules', 'Totals and readiness', 'Worker earnings', 'Advances and deductions', 'Record payment', 'Saved records', 'Finish'], fields: enFields },
 gu: { ...configurationTutorialCopy.gu, sample: 'પેરોલનો નમૂનો · કંઈ સાચવાશે કે મોકલાશે નહીં', sections: ['સમયગાળો અને નિયમો', 'કુલ અને તૈયારી', 'કારીગરની કમાણી', 'એડવાન્સ અને કપાત', 'ચુકવણી નોંધો', 'સાચવેલા રેકોર્ડ', 'પૂર્ણ'], fields: guFields },
 hi: { ...configurationTutorialCopy.hi, sample: 'पेरोल का नमूना · कुछ सहेजा या भेजा नहीं जाएगा', sections: ['अवधि और नियम', 'कुल और तैयारी', 'कारीगर की कमाई', 'अग्रिम और कटौती', 'भुगतान दर्ज करें', 'सहेजे रिकॉर्ड', 'समाप्त'], fields: hiFields },
}
