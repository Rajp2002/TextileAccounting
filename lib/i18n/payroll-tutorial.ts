import type { Language } from './context'
import type { PayrollTourStep, PayrollTourVariant } from '../payroll-tour'
import { configurationTutorialCopy } from './configuration-tutorial'

type PayrollCopy = {
    sample: string
    sections: string[]
    fields: Record<PayrollTourStep, readonly [string, string]>
    help: string
    helpDescription: Record<PayrollTourVariant, string>
    people: { piece: string; salary: string; zero: string; review: string }
    skip: string; back: string; next: string; finish: string; progress: string
}
const enFields: PayrollCopy['fields'] = {
  "period": [
    "Know what this period owes",
    "Payroll connects earnings, debt recovery and recorded payments. Choose the dates and check Open, In Progress, Ready to Complete or Settled. Paying a worker and completing the period are separate actions."
  ],
  "readiness": [
    "Resolve readiness issues first",
    "Use Review in Payroll readiness to open the affected Production entry. Correct missing or inconsistent production details before paying that worker. Fixed salaries use the worker’s dated salary history, not production entries."
  ],
  "earnings": [
    "Check how gross pay was earned",
    "In Settle Payroll, expand a worker: 1,000 m × the saved ₹2/m wage = ₹2,000. Salary uses dated calendar-day segments; this completed-month sample is ₹18,000 × 30/30. Check each worker’s actual dates, including earlier unpaid work."
  ],
  "recovery": [
    "Apply the Base recovery rule",
    "Recovery is the lower of pending debt and 50% of gross. With ₹1,000 debt and ₹2,000 gross, recover ₹1,000: net pay ₹1,000, debt carried ₹0. Any debt above the cap carries forward."
  ],
  "obligations": [
    "Resolve a genuine zero-earning worker",
    "In Settle Payroll, check that ₹0 gross is correct before choosing Resolve. This marks the worker resolved for this period without recording a payment; completion saves that resolution. ₹0 remaining alone does not mean every obligation is resolved."
  ],
  "paymentDetails": [
    "Record how and when you paid",
    "In Settle Payroll, choose Mark as paid for the worker. Record the actual payment method and date; add an optional note. The payment date can differ from the earnings period. Pay outside Weavly—these fields do not transfer money."
  ],
  "confirm": [
    "Review before marking paid",
    "Check the worker, period, gross earnings, recovery and net payable before confirming. Marking paid records a payment; it does not send money. This preview cannot confirm a real payment."
  ],
  "paid": [
    "Check the saved payment result",
    "The sample weaver is now Paid: ₹1,000 cash, ₹1,000 debt recovered, ₹0 carried. Open the paid record to check its details instead of recording the payment again. Other workers’ obligations still need their own review."
  ],
  "complete": [
    "Close the period separately",
    "When every worker is paid or resolved, the period is Ready to Complete. Choose Complete Payroll and review the confirmation to mark it Settled. This closes the period; marking one worker Paid does not."
  ],
  "finish": [
    "Review your real payroll next",
    "Finish restores your selected period, search and page position. Check the real worker dates and earnings, then open the payment review. More payroll help beside the tour launcher covers reports and maintenance; both walkthroughs can be replayed."
  ],
  "cycle": [
    "Review what this cycle owes",
    "Payroll turns worker earnings into a reviewed payment record. Select the cycle and check its dates and pay-window notice before treating wages as due. A future cycle can show no wages due yet."
  ],
  "fullEarnings": [
    "Review the worker’s pay basis",
    "Use Piece rate or Monthly / Daily and open the worker’s calculation. The sample weaver earned 1,000 m × ₹2 = ₹2,000. For salaried or daily workers, check the displayed attendance, payable days and applicable deductions."
  ],
  "fullSettlement": [
    "Review the payment calculation",
    "Mark Paid opens the settlement review. Check base earnings, applicable statutory deductions, adjustments and advance recovery before confirming the net payout."
  ],
  "fullRecovery": [
    "Review recovery and remaining debt",
    "Ordinary recovery is recommended up to 50% of adjusted gross, limited by debt. This sample has no adjustments or statutory deductions: ₹2,000 gross − ₹1,000 recovery = ₹1,000 net, ₹0 debt left. Changing recovery changes both net pay and remaining debt."
  ],
  "mode": [
    "Choose the payment mode",
    "Record how payment was made: Cash, Bank transfer, UPI or Cheque. Selecting a mode does not initiate a transfer."
  ],
  "finalSettlement": [
    "Keep ordinary pay separate from worker exit",
    "Leave Mark as Final Settlement unchecked for an ordinary payment. It belongs to worker exit, changes the recovery limit and can make the worker inactive. Read the warning before using it; it is not period completion."
  ],
  "advance": [
    "Record an advance",
    "The advance form asks for a worker, amount and optional description. Recorded advances remain pending until recovered through a later settlement. This sample form cannot save."
  ],
  "deduction": [
    "Record a deduction",
    "Use Add deduction for the worker, then enter a reason/category, amount and optional notes. In Base, this joins pending advance debt for the same capped recovery at settlement; it is not Full’s immediate pay adjustment."
  ],
  "records": [
    "Trace a recorded payment",
    "Open Payroll records and select a settled period. Expand a worker to see saved earnings, recovery, carried debt and payment details. These explain the recorded net amount."
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
  "rules": [
    "Understand payroll rules",
    "Cycle start day, pay date day and reminder days determine the payroll schedule. This is a read-only preview; your saved rules stay unchanged."
  ],
  "adjustment": [
    "Review a manual adjustment",
    "Inam / Bonus adds to pay; Kapaat / Deduction reduces it. Choose a reason, amount and note, then review the updated calculation. The sample shows a zero adjustment."
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
  ]
}
const guFields: PayrollCopy['fields'] = {
  "period": [
    "આ સમયગાળાનો પગાર સમજો",
    "પેરોલ કમાણી, દેવાની વસૂલાત અને ચૂકવણીની નોંધ જોડે છે. તારીખો અને ખુલ્લું, ચાલુ, પૂર્ણ કરવા તૈયાર કે સેટલ થયેલું સ્થિતિ તપાસો. કારીગરને ચૂકવવું અને સમયગાળો પૂર્ણ કરવો અલગ ક્રિયાઓ છે."
  ],
  "readiness": [
    "પહેલાં તૈયારીની સમસ્યા ઉકેલો",
    "પેરોલ તૈયારીમાં સમીક્ષા પસંદ કરી સંબંધિત ઉત્પાદન નોંધ ખોલો. કારીગરને ચૂકવતાં પહેલાં અધૂરી કે અસંગત વિગતો સુધારો. નિશ્ચિત પગાર કારીગરના તારીખવાળા પગાર ઇતિહાસથી ગણાય છે, ઉત્પાદનથી નહીં."
  ],
  "earnings": [
    "કુલ કમાણીની ગણતરી તપાસો",
    "પેરોલ સેટલ કરોમાં કારીગરની વિગતો ખોલો: 1,000 મીટર × સાચવેલો ₹2/મીટર વેતન = ₹2,000. પગાર તારીખ પ્રમાણે કેલેન્ડર દિવસોથી ગણાય છે; પૂર્ણ મહિનાના નમૂનામાં ₹18,000 × 30/30 છે. અગાઉના અચૂકવેલા કામ સહિત વાસ્તવિક તારીખો તપાસો."
  ],
  "recovery": [
    "બેઝનો વસૂલાત નિયમ",
    "બાકી દેવું અને કુલ કમાણીના 50%માંથી ઓછી રકમ વસૂલ થાય છે. ₹1,000 દેવું અને ₹2,000 કમાણી હોય તો ₹1,000 વસૂલાત: ચોખ્ખો પગાર ₹1,000, આગળનું દેવું ₹0. મર્યાદાથી વધેલું દેવું આગળ જાય છે."
  ],
  "obligations": [
    "ખરેખર શૂન્ય કમાણી હોય ત્યારે ઉકેલો",
    "પેરોલ સેટલ કરોમાં ઉકેલો પસંદ કરતાં પહેલાં ₹0 કુલ કમાણી સાચી છે તે તપાસો. ચુકવણી નોંધ્યા વિના આ સમયગાળા માટે કારીગર ઉકેલાયેલ ગણાય છે; સમયગાળો પૂર્ણ કરતાં તે સાચવાય છે. માત્ર ₹0 બાકી હોવાથી બધી જવાબદારી ઉકેલાઈ એવું નથી."
  ],
  "paymentDetails": [
    "ક્યારે અને કેવી રીતે ચૂકવ્યું તે નોંધો",
    "પેરોલ સેટલ કરોમાં કારીગર માટે ચૂકવેલ નોંધો પસંદ કરો. વાસ્તવિક પદ્ધતિ અને તારીખ આપો; ઇચ્છો તો નોંધ ઉમેરો. ચુકવણી તારીખ કમાણીના સમયગાળાથી અલગ હોઈ શકે છે. પૈસા Weavly બહાર ચૂકવો—આ વિગતો નાણાં મોકલતી નથી."
  ],
  "confirm": [
    "ચૂકવેલ નોંધતાં પહેલાં તપાસો",
    "કારીગર, સમયગાળો, કમાણી, વસૂલાત અને ચોખ્ખી રકમ તપાસો. ચૂકવેલ નોંધવાથી નાણાં મોકલાતાં નથી. આ નમૂનો વાસ્તવિક ચુકવણી નોંધતો નથી."
  ],
  "paid": [
    "સાચવેલી ચુકવણીનું પરિણામ",
    "નમૂનાનો વણકર હવે ચૂકવેલ છે: ₹1,000 રોકડ, ₹1,000 દેવું વસૂલ, ₹0 આગળ. ફરી ચુકવણી નોંધવાને બદલે ચૂકવેલો રેકોર્ડ ખોલી વિગતો તપાસો. બીજા કારીગરોની જવાબદારી અલગથી તપાસવી પડે છે."
  ],
  "complete": [
    "સમયગાળો અલગથી પૂર્ણ કરો",
    "દરેક કારીગર ચૂકવેલ કે ઉકેલાયેલ હોય ત્યારે સમયગાળો પૂર્ણ કરવા તૈયાર થાય છે. પેરોલ પૂર્ણ કરો પસંદ કરી ખાતરી તપાસો જેથી સેટલ થયેલું બને. એક કારીગરને ચૂકવેલ નોંધવાથી સમયગાળો પૂર્ણ થતો નથી."
  ],
  "finish": [
    "હવે વાસ્તવિક પેરોલ તપાસો",
    "પૂર્ણ કરવાથી પસંદ કરેલો સમયગાળો, શોધ અને પૃષ્ઠની સ્થિતિ પાછાં આવે છે. વાસ્તવિક તારીખો અને કમાણી તપાસી ચુકવણી સમીક્ષા ખોલો. ટૂરની બાજુમાં વધુ પેરોલ મદદમાં અહેવાલ અને જાળવણી છે; બંને ટૂર ફરી જોઈ શકો છો."
  ],
  "cycle": [
    "આ ચક્રમાં શું ચૂકવવાનું છે",
    "પેરોલ કારીગરની કમાણીમાંથી તપાસેલો ચુકવણી રેકોર્ડ બનાવે છે. પગાર ચૂકવવાપાત્ર માનતાં પહેલાં ચક્ર, તારીખો અને ચૂકવણી સમયની સૂચના તપાસો. ભવિષ્યના ચક્રમાં હજુ પગાર બાકી નથી એવું દેખાઈ શકે છે."
  ],
  "fullEarnings": [
    "કારીગરના પગારનો આધાર તપાસો",
    "પીસ રેટ કે માસિક/દૈનિક પસંદ કરી કારીગરની ગણતરી ખોલો. નમૂનાના વણકરે 1,000 મીટર × ₹2 = ₹2,000 કમાયા. પગારદાર કે દૈનિક કારીગર માટે હાજરી, ચૂકવવાપાત્ર દિવસો અને લાગુ કપાત તપાસો."
  ],
  "fullSettlement": [
    "ચૂકવણીની ગણતરી જુઓ",
    "ચૂકવેલ નોંધો સેટલમેન્ટ સમીક્ષા ખોલે છે. મૂળ કમાણી, લાગુ વૈધાનિક કપાત, ફેરફાર અને એડવાન્સ વસૂલાત તપાસો."
  ],
  "fullRecovery": [
    "વસૂલાત અને બાકી દેવું તપાસો",
    "સામાન્ય વસૂલાત સુધારેલી કુલ કમાણીના 50% સુધી, દેવાની મર્યાદામાં સૂચવાય છે. નમૂનામાં સમાયોજન કે વૈધાનિક કપાત નથી: ₹2,000 કમાણી − ₹1,000 વસૂલાત = ₹1,000 ચોખ્ખો પગાર, ₹0 દેવું. વસૂલાત બદલવાથી પગાર અને બાકી દેવું બંને બદલાય છે."
  ],
  "mode": [
    "ચૂકવણી પદ્ધતિ",
    "રોકડ, બેંક ટ્રાન્સફર, UPI કે ચેકમાંથી ચૂકવેલી પદ્ધતિ નોંધો. પદ્ધતિ પસંદ કરવાથી નાણાં મોકલાતાં નથી."
  ],
  "finalSettlement": [
    "સામાન્ય પગાર અને કારીગરની વિદાય અલગ",
    "સામાન્ય ચુકવણી માટે અંતિમ સેટલમેન્ટ પસંદ ન કરો. તે કારીગરની વિદાય માટે છે, વસૂલાતની મર્યાદા બદલે છે અને કારીગરને નિષ્ક્રિય કરી શકે છે. વાપરતાં પહેલાં ચેતવણી વાંચો; તે સમયગાળો પૂર્ણ કરવાની ક્રિયા નથી."
  ],
  "advance": [
    "એડવાન્સ નોંધો",
    "કારીગર, રકમ અને વૈકલ્પિક વર્ણન આપો. એડવાન્સ પછીના સેટલમેન્ટમાં વસૂલ થાય ત્યાં સુધી બાકી રહે છે. નમૂનાનું ફોર્મ સાચવી શકતું નથી."
  ],
  "deduction": [
    "કપાત નોંધો",
    "કારીગર માટે કપાત ઉમેરો પસંદ કરી કારણ/શ્રેણી, રકમ અને વૈકલ્પિક નોંધ આપો. બેઝમાં તે બાકી એડવાન્સ દેવામાં જોડાઈ સેટલમેન્ટમાં એ જ મર્યાદાથી વસૂલ થાય છે; તે ફુલનું તરત પગારમાં સમાયોજન નથી."
  ],
  "records": [
    "નોંધાયેલી ચુકવણી તપાસો",
    "પેરોલ રેકોર્ડ ખોલી સેટલ થયેલો સમયગાળો પસંદ કરો. કારીગરની વિગતોમાં સાચવેલી કમાણી, વસૂલાત, આગળનું દેવું અને ચુકવણી જુઓ. તે નોંધાયેલી ચોખ્ખી રકમ સમજાવે છે."
  ],
  "machineRecord": [
    "મશીન પ્રમાણે રેકોર્ડ",
    "મશીન દૃશ્યમાં મશીન, કારીગર, કોસ્ટિંગ અને દર પ્રમાણે ઉત્પાદન અને કારીગર ખર્ચ દેખાય છે. ઉત્પાદનની કમાણી તપાસવા વાપરો."
  ],
  "export": [
    "પેરોલ અહેવાલ નિકાસ",
    "CSV કે PDFમાં આખો પસંદ કરેલો સમયગાળો આવે છે, શોધ ફિલ્ટર હોવા છતાં. ઉલટાવેલા રેકોર્ડ CSVમાં રહે છે, પણ સક્રિય ચુકવણીના PDFમાં નથી આવતા. ટૂર કંઈ ડાઉનલોડ કરતી નથી."
  ],
  "correction": [
    "ખોટી ચુકવણી નોંધ સુધારો",
    "ખરેખર ચુકવણી ન થઈ હોય તેવા રેકોર્ડ માટે સુધારો છે. પાત્રતા તપાસી કારણ આપો. રેકોર્ડ ઉલટાવવાથી રોકડ કે બેંક ચુકવણી પાછી આવતી નથી. ટૂર સુધારો કરતી નથી."
  ],
  "rules": [
    "પેરોલ નિયમો",
    "ચક્રનો શરૂઆતનો દિવસ, ચૂકવણીનો દિવસ અને યાદ અપાવવાના દિવસો સમયપત્રક નક્કી કરે છે. આ માત્ર નમૂનો છે; સાચવેલા નિયમો બદલાતા નથી."
  ],
  "adjustment": [
    "હાથેથી પગાર ફેરફાર",
    "ઇનામ/બોનસ પગાર વધારે છે; કપાત ઘટાડે છે. કારણ, રકમ અને નોંધ આપીને ગણતરી તપાસો. નમૂનામાં ફેરફાર શૂન્ય છે."
  ],
  "history": [
    "સેટલમેન્ટ ઇતિહાસ",
    "નોંધાયેલા સેટલમેન્ટ શોધવા ઇતિહાસ ખોલો. ફિલ્ટરથી પરિણામ ઓછાં કરો અને રસીદ તપાસો."
  ],
  "receipt": [
    "સેટલમેન્ટની રસીદ",
    "રસીદમાં કારીગર, ચક્ર, કમાણી, કપાત, વસૂલાત અને ચોખ્ખી ચુકવણી છે. અગાઉની ચુકવણી માટે સાચવેલી વિગતો તપાસો."
  ],
  "csv": [
    "ઇતિહાસની નિકાસ",
    "CSV ડાઉનલોડ ફિલ્ટર કરેલા ઇતિહાસની નિકાસ કરે છે. પહેલાં ફિલ્ટર તપાસો. ટૂરમાં CSV ડાઉનલોડ થતું નથી."
  ],
  "slip": [
    "પગારની સ્લિપ",
    "PDF સ્લિપ કારીગરના સેટલમેન્ટ પરથી બને છે. ટૂરમાં વાસ્તવિક સ્લિપ બનતી કે ડાઉનલોડ થતી નથી."
  ],
  "whatsapp": [
    "પગારની સ્લિપ મોકલો",
    "સુવિધાની જરૂરિયાત પૂરી થતી હોય ત્યારે WhatsAppથી સ્લિપ મોકલી શકાય છે. ટૂર બહાર મોકલતાં પ્રાપ્તકર્તા તપાસો. નમૂનો સંદેશ મોકલતો નથી."
  ]
}
const hiFields: PayrollCopy['fields'] = {
  "period": [
    "इस अवधि का देय वेतन समझें",
    "पेरोल कमाई, ऋण वसूली और दर्ज भुगतान जोड़ता है। तारीखें और खुला, जारी, पूरा करने को तैयार या निपटाया गया स्थिति जाँचें। कारीगर को भुगतान और अवधि पूरी करना अलग क्रियाएँ हैं।"
  ],
  "readiness": [
    "पहले तैयारी की समस्या सुलझाएँ",
    "पेरोल तैयारी में समीक्षा चुनकर संबंधित उत्पादन प्रविष्टि खोलें। भुगतान से पहले अधूरी या असंगत जानकारी सुधारें। निश्चित वेतन कारीगर के तारीख वाले वेतन इतिहास से आता है, उत्पादन से नहीं।"
  ],
  "earnings": [
    "सकल कमाई की गणना जाँचें",
    "पेरोल निपटाएँ में कारीगर का विवरण खोलें: 1,000 मीटर × सहेजी गई ₹2/मीटर मजदूरी = ₹2,000। वेतन तारीख के अनुसार कैलेंडर दिनों से बनता है; पूरे महीने के नमूने में ₹18,000 × 30/30 है। पहले के अवैतनिक काम सहित वास्तविक तारीखें जाँचें।"
  ],
  "recovery": [
    "बेस का वसूली नियम",
    "बकाया ऋण और सकल कमाई के 50% में से कम राशि वसूल होती है। ₹1,000 ऋण और ₹2,000 कमाई पर ₹1,000 वसूली: शुद्ध वेतन ₹1,000, आगे का ऋण ₹0। सीमा से अधिक ऋण आगे जाता है।"
  ],
  "obligations": [
    "वास्तव में शून्य कमाई हो तो हल करें",
    "पेरोल निपटाएँ में हल करें चुनने से पहले ₹0 सकल कमाई सही होने की जाँच करें। बिना भुगतान दर्ज किए कारीगर इस अवधि के लिए हल माना जाता है; अवधि पूरी करने पर यह सहेजता है। केवल ₹0 बाकी होने से सभी दायित्व हल नहीं होते।"
  ],
  "paymentDetails": [
    "कब और कैसे भुगतान किया, दर्ज करें",
    "पेरोल निपटाएँ में कारीगर के लिए भुगतान दर्ज करें चुनें। वास्तविक तरीका और तारीख भरें; वैकल्पिक नोट जोड़ें। भुगतान की तारीख कमाई की अवधि से अलग हो सकती है। पैसे Weavly के बाहर दें—ये फ़ील्ड पैसे नहीं भेजते।"
  ],
  "confirm": [
    "भुगतान दर्ज करने से पहले जाँचें",
    "कारीगर, अवधि, कमाई, वसूली और शुद्ध राशि जाँचें। भुगतान किया दर्ज करने से पैसे नहीं भेजे जाते। नमूना वास्तविक भुगतान दर्ज नहीं करता।"
  ],
  "paid": [
    "सहेजे भुगतान का परिणाम",
    "नमूना बुनकर अब भुगतान किया गया है: ₹1,000 नकद, ₹1,000 ऋण वसूल, ₹0 आगे। दोबारा भुगतान दर्ज करने के बजाय भुगतान का रिकॉर्ड खोलकर जाँचें। दूसरे कारीगरों के दायित्व अलग से जाँचने हैं।"
  ],
  "complete": [
    "अवधि अलग से पूरी करें",
    "हर कारीगर का भुगतान या समाधान होने पर अवधि पूरा करने को तैयार होती है। पेरोल पूरा करें चुनकर पुष्टि जाँचें ताकि निपटाया गया बने। एक कारीगर का भुगतान दर्ज करने से अवधि पूरी नहीं होती।"
  ],
  "finish": [
    "अब वास्तविक पेरोल जाँचें",
    "समाप्त करने पर चुनी अवधि, खोज और पृष्ठ की स्थिति लौटती है। वास्तविक तारीखें और कमाई जाँचकर भुगतान समीक्षा खोलें। टूर के पास अधिक पेरोल सहायता में रिपोर्ट और रखरखाव हैं; दोनों टूर दोबारा देख सकते हैं।"
  ],
  "cycle": [
    "इस चक्र में क्या देय है",
    "पेरोल कारीगर की कमाई से जाँचा हुआ भुगतान रिकॉर्ड बनाता है। वेतन देय मानने से पहले चक्र, तारीखें और भुगतान समय की सूचना जाँचें। भविष्य के चक्र में अभी वेतन देय नहीं दिख सकता है।"
  ],
  "fullEarnings": [
    "कारीगर के वेतन का आधार जाँचें",
    "पीस रेट या मासिक/दैनिक चुनकर गणना खोलें। नमूना बुनकर ने 1,000 मीटर × ₹2 = ₹2,000 कमाए। वेतनभोगी या दैनिक कारीगर की उपस्थिति, देय दिन और लागू कटौती जाँचें।"
  ],
  "fullSettlement": [
    "भुगतान गणना देखें",
    "भुगतान दर्ज करें निपटान समीक्षा खोलता है। मूल कमाई, लागू वैधानिक कटौती, समायोजन और अग्रिम वसूली जाँचें।"
  ],
  "fullRecovery": [
    "वसूली और बचा ऋण जाँचें",
    "सामान्य वसूली समायोजित सकल कमाई के 50% तक, ऋण की सीमा में सुझाई जाती है। नमूने में समायोजन या वैधानिक कटौती नहीं है: ₹2,000 कमाई − ₹1,000 वसूली = ₹1,000 शुद्ध वेतन, ₹0 ऋण। वसूली बदलने से वेतन और बचा ऋण दोनों बदलते हैं।"
  ],
  "mode": [
    "भुगतान का तरीका",
    "नकद, बैंक ट्रांसफ़र, UPI या चेक में वास्तविक तरीका दर्ज करें। तरीका चुनने से पैसे नहीं भेजे जाते।"
  ],
  "finalSettlement": [
    "सामान्य भुगतान और कारीगर की विदाई अलग",
    "सामान्य भुगतान में अंतिम निपटान न चुनें। यह कारीगर की विदाई के लिए है, वसूली सीमा बदलता है और कारीगर को निष्क्रिय कर सकता है। उपयोग से पहले चेतावनी पढ़ें; यह अवधि पूरी करना नहीं है।"
  ],
  "advance": [
    "अग्रिम दर्ज करें",
    "कारीगर, राशि और वैकल्पिक विवरण दें। बाद के निपटान में वसूली तक अग्रिम बकाया रहता है। नमूना फ़ॉर्म सहेज नहीं सकता।"
  ],
  "deduction": [
    "कटौती दर्ज करें",
    "कारीगर के लिए कटौती जोड़ें चुनकर कारण/श्रेणी, राशि और वैकल्पिक नोट दें। बेस में यह बकाया अग्रिम ऋण में जुड़कर निपटान में उसी सीमा से वसूल होती है; यह फुल का तुरंत वेतन समायोजन नहीं है।"
  ],
  "records": [
    "दर्ज भुगतान का विवरण देखें",
    "पेरोल रिकॉर्ड खोलकर निपटाई गई अवधि चुनें। कारीगर के विवरण में सहेजी कमाई, वसूली, आगे का ऋण और भुगतान देखें। ये दर्ज शुद्ध राशि समझाते हैं।"
  ],
  "machineRecord": [
    "मशीन के अनुसार रिकॉर्ड",
    "मशीन दृश्य में मशीन, कारीगर, कॉस्टिंग और दर के अनुसार उत्पादन और श्रम लागत दिखती है। उत्पादन की कमाई जाँचने के लिए उपयोग करें।"
  ],
  "export": [
    "पेरोल रिपोर्ट निर्यात करें",
    "CSV या PDF में पूरी चुनी अवधि आती है, खोज फ़िल्टर होने पर भी। उलटे रिकॉर्ड CSV में रहते हैं, पर सक्रिय भुगतान के PDF में नहीं आते। टूर कुछ डाउनलोड नहीं करता।"
  ],
  "correction": [
    "गलत भुगतान रिकॉर्ड सुधारें",
    "सुधार उस भुगतान के लिए है जो वास्तव में नहीं हुआ। पात्रता जाँचकर कारण दें। रिकॉर्ड उलटने से नकद या बैंक भुगतान वापस नहीं आता। टूर सुधार नहीं करता।"
  ],
  "rules": [
    "पेरोल नियम समझें",
    "चक्र शुरू होने का दिन, भुगतान दिन और अनुस्मारक दिन समयसारणी तय करते हैं। यह केवल नमूना है; सहेजे नियम नहीं बदलते।"
  ],
  "adjustment": [
    "मैनुअल समायोजन देखें",
    "इनाम/बोनस वेतन बढ़ाता है; कटौती घटाती है। कारण, राशि और नोट देकर गणना जाँचें। नमूने में समायोजन शून्य है।"
  ],
  "history": [
    "निपटान इतिहास देखें",
    "दर्ज निपटान खोजने के लिए इतिहास खोलें। फ़िल्टर से परिणाम सीमित करें और रसीद देखें।"
  ],
  "receipt": [
    "निपटान की रसीद",
    "रसीद में कारीगर, चक्र, कमाई, कटौती, वसूली और शुद्ध भुगतान है। पुराने भुगतान के लिए सहेजे विवरण जाँचें।"
  ],
  "csv": [
    "इतिहास निर्यात करें",
    "CSV डाउनलोड फ़िल्टर किए इतिहास का निर्यात करता है। पहले फ़िल्टर जाँचें। टूर में CSV डाउनलोड नहीं होता।"
  ],
  "slip": [
    "वेतन पर्ची डाउनलोड करें",
    "PDF Slip कारीगर के निपटान से पर्ची बनाता है। टूर वास्तविक पर्ची बनाता या डाउनलोड नहीं करता।"
  ],
  "whatsapp": [
    "वेतन पर्ची भेजें",
    "सुविधा की आवश्यकताएँ पूरी होने पर WhatsApp से पर्ची भेज सकते हैं। टूर के बाहर भेजने से पहले प्राप्तकर्ता जाँचें। नमूना संदेश नहीं भेजता।"
  ]
}
export const payrollTutorialCopy: Record<Language, PayrollCopy> = {
    en: {
        ...configurationTutorialCopy.en,
        "sample": "Illustrative payroll preview · Nothing will be saved or sent",
        "sections": [
            "Period and rules",
            "Readiness",
            "Worker earnings",
            "Advances and deductions",
            "Record payment",
            "Saved records",
            "Finish"
        ],
        "help": "More payroll help",
        "helpDescription": {
            "base": "Optional tour: advances, deductions, reports and payment corrections.",
            "full": "Optional tour: rules, adjustments, history and payslips."
        },
        "people": {
            "piece": "Sample weaver",
            "salary": "Sample staff",
            "zero": "Sample worker · no earnings",
            "review": "Sample worker · needs review"
        },
        fields: enFields,
    },
    gu: {
        ...configurationTutorialCopy.gu,
        "sample": "પેરોલનો નમૂનો · કંઈ સાચવાશે કે મોકલાશે નહીં",
        "sections": [
            "સમયગાળો અને નિયમો",
            "તૈયારી",
            "કારીગરની કમાણી",
            "એડવાન્સ અને કપાત",
            "ચુકવણી નોંધો",
            "સાચવેલા રેકોર્ડ",
            "પૂર્ણ"
        ],
        "help": "વધુ પેરોલ મદદ",
        "helpDescription": {
            "base": "વૈકલ્પિક ટૂર: એડવાન્સ, કપાત, અહેવાલ અને ચુકવણી સુધારા.",
            "full": "વૈકલ્પિક ટૂર: નિયમો, સમાયોજન, ઇતિહાસ અને પગાર પત્રક."
        },
        "people": {
            "piece": "નમૂનાનો વણકર",
            "salary": "નમૂનાનો કર્મચારી",
            "zero": "નમૂનાનો કારીગર · કમાણી નથી",
            "review": "નમૂનાનો કારીગર · સમીક્ષા જરૂરી"
        },
        fields: guFields,
    },
    hi: {
        ...configurationTutorialCopy.hi,
        "sample": "पेरोल का नमूना · कुछ सहेजा या भेजा नहीं जाएगा",
        "sections": [
            "अवधि और नियम",
            "तैयारी",
            "कारीगर की कमाई",
            "अग्रिम और कटौती",
            "भुगतान दर्ज करें",
            "सहेजे रिकॉर्ड",
            "समाप्त"
        ],
        "help": "अधिक पेरोल सहायता",
        "helpDescription": {
            "base": "वैकल्पिक टूर: अग्रिम, कटौती, रिपोर्ट और भुगतान सुधार।",
            "full": "वैकल्पिक टूर: नियम, समायोजन, इतिहास और वेतन पर्चियाँ।"
        },
        "people": {
            "piece": "नमूना बुनकर",
            "salary": "नमूना कर्मचारी",
            "zero": "नमूना कारीगर · कमाई नहीं",
            "review": "नमूना कारीगर · समीक्षा ज़रूरी"
        },
        fields: hiFields,
    },
}

/** Explicit preview labels avoid relying on legacy phrase fallbacks for teaching controls. */
const previewLabelRows = [
    ['Advance recovery', 'એડવાન્સ વસૂલાત', 'अग्रिम वसूली'],
    ['Net amount payable', 'ચૂકવવાપાત્ર ચોખ્ખી રકમ', 'देय शुद्ध राशि'],
    ['Payment method', 'ચૂકવણી પદ્ધતિ', 'भुगतान तरीका'],
    ['Payment mode', 'ચૂકવણી પદ્ધતિ', 'भुगतान तरीका'],
    ['Payment date', 'ચૂકવણીની તારીખ', 'भुगतान की तारीख'],
    ['Note (optional)', 'નોંધ (વૈકલ્પિક)', 'नोट (वैकल्पिक)'],
    ['Paid in cash by owner', 'માલિકે રોકડમાં ચૂકવ્યું', 'मालिक ने नकद दिया'],
    ['In Progress', 'ચાલુ', 'जारी'],
    ['Remaining to settle', 'પતાવટ માટે બાકી', 'निपटान के लिए बाकी'],
    ['Settle Payroll', 'પેરોલ સેટલ કરો', 'पेरोल निपटाएँ'],
    ['Pay window', 'ચૂકવણીનો સમય', 'भुगतान का समय'],
    ['Pay day', 'ચૂકવણીનો દિવસ', 'भुगतान का दिन'],
    ['Edit rules', 'નિયમો સુધારો', 'नियम बदलें'],
    ['Payroll readiness', 'પેરોલ તૈયારી', 'पेरोल तैयारी'],
    ['Review required', 'સમીક્ષા જરૂરી', 'समीक्षा ज़रूरी'],
    ['Mark as paid', 'ચૂકવેલ નોંધો', 'भुगतान दर्ज करें'],
    ['Mark Paid', 'ચૂકવેલ નોંધો', 'भुगतान दर्ज करें'],
    ['Fixed monthly salary', 'નિશ્ચિત માસિક પગાર', 'निश्चित मासिक वेतन'],
    ['Monthly / Daily', 'માસિક / દૈનિક', 'मासिक / दैनिक'],
    ['Resolve', 'ઉકેલો', 'हल करें'],
    ['Resolved (₹0)', 'ઉકેલાયેલ (₹0)', 'हल किया (₹0)'],
    ['Base Earnings', 'મૂળ કમાણી', 'मूल कमाई'],
    ['Manual Adjustment', 'મેન્યુઅલ સમાયોજન', 'मैनुअल समायोजन'],
    ['Statutory deductions', 'વૈધાનિક કપાત', 'वैधानिक कटौती'],
    ['Ready to Complete', 'પૂર્ણ કરવા તૈયાર', 'पूरा करने को तैयार'],
    ['All worker obligations resolved', 'બધા કારીગરોની જવાબદારી ઉકેલાઈ', 'सभी कारीगरों के दायित्व हल हुए'],
    ['Complete Payroll', 'પેરોલ પૂર્ણ કરો', 'पेरोल पूरा करें'],
    ['Record advance', 'એડવાન્સ નોંધો', 'अग्रिम दर्ज करें'],
    ['Reason / Category', 'કારણ / શ્રેણી', 'कारण / श्रेणी'],
    ['Record deduction', 'કપાત નોંધો', 'कटौती दर्ज करें'],
    ['Pay period', 'પગારનો સમયગાળો', 'वेतन अवधि'],
    ['Export CSV', 'CSV નિકાસ', 'CSV निर्यात'],
    ['Export PDF', 'PDF નિકાસ', 'PDF निर्यात'],
    ['Cycle start day', 'ચક્રનો શરૂઆતનો દિવસ', 'चक्र का शुरुआती दिन'],
    ['Pay date day', 'ચૂકવણીનો દિવસ', 'भुगतान का दिन'],
    ['Reminder days', 'યાદ અપાવવાના દિવસો', 'याद दिलाने के दिन'],
    ['Adjustment Type', 'સમાયોજનનો પ્રકાર', 'समायोजन का प्रकार'],
    ['Inam / Bonus', 'ઇનામ / બોનસ', 'इनाम / बोनस'],
    ['Add Adjustment', 'સમાયોજન ઉમેરો', 'समायोजन जोड़ें'],
    ['Settlement history', 'સેટલમેન્ટ ઇતિહાસ', 'निपटान इतिहास'],
    ['Settlement receipt', 'સેટલમેન્ટ રસીદ', 'निपटान रसीद'],
    ['Download CSV', 'CSV ડાઉનલોડ કરો', 'CSV डाउनलोड करें'],
    ['Payroll rules', 'પેરોલ નિયમો', 'पेरोल नियम'],
    ['Reverse a mistaken payment record?', 'ખોટી ચુકવણીનો રેકોર્ડ ઉલટાવવો છે?', 'गलत भुगतान रिकॉर्ड उलटना है?'],
    ['Record worker advance', 'કારીગરનો એડવાન્સ નોંધો', 'कारीगर का अग्रिम दर्ज करें'],
    ['Record worker deduction', 'કારીગરની કપાત નોંધો', 'कारीगर की कटौती दर्ज करें'],
] as const
export const payrollPreviewLabels: Record<Language, Record<string, string>> = {
    en: Object.fromEntries(previewLabelRows.map(([en]) => [en, en])),
    gu: Object.fromEntries(previewLabelRows.map(([en, gu]) => [en, gu])),
    hi: Object.fromEntries(previewLabelRows.map(([en, , hi]) => [en, hi])),
}
