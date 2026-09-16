import type { Language } from './context'
import type { DispatchTourTopic } from '../dispatch-tour'
import { configurationTutorialCopy } from './configuration-tutorial'
type DispatchCopy = { moreHelp: string; sample: string; sections: string[]; fields: Record<DispatchTourTopic, readonly [string, string]>; skip: string; back: string; next: string; finish: string; progress: string }
export const dispatchTutorialCopy: Record<Language, DispatchCopy> = {
en: { ...configurationTutorialCopy.en, moreHelp: "More help for this step", sample: "Sample preview · no stock or payments are changed", sections: ["Three tracks", "Prepare a draft", "Issue goods", "Record receipt", "Settle the balance", "Next action"], fields: {
  "overview": ["Goods, receipt and money", "Follow three separate tracks: goods leaving the factory, metres acknowledged by the customer, and money received. This sample follows one dispatch from draft to remaining balance."],
  "tabs": [
    "Active and history",
    "Use Active for ongoing transactions and History for archived records. Customer credits remain active until resolved."
  ],
  "search": [
    "Find a dispatch",
    "Search by customer name or challan number, then press Search. Load more retrieves additional records."
  ],
  "status": [
    "Read the statuses",
    "Delivery, receipt differences and payment status are separate. Open a challan to review its details and remaining balance."
  ],
  "new": [
    "Start a draft",
    "New dispatch opens a fresh transaction. Saving or printing a draft does not deduct stock."
  ],
  "quality": ["Choose a ready fabric quality", "In New dispatch, choose one quality and check available metres in Fabric Stock. If yarn tracking applies, first use Yarn Stock → Link costing for this quality and record the required yarn balances."],
  "rate": [
    "Agree a selling rate",
    "Enter the positive agreed selling price per metre. This is the customer price, not the production cost or weaver wage."
  ],
  "parties": ["Customer details and agreed price", "Enter the date, sender and customer names/addresses, and delivery address. Set a positive selling price per metre: ₹40 here. This is the agreed customer price, separate from cost and weaver wage."],
  "terms": [
    "Set payment terms",
    "Enter the agreed full-payment due date and terms, or leave the date blank if none is agreed. Partial payments do not change the date."
  ],
  "optional": [
    "Optional document references",
    "Add transport, vehicle, GST and other references as needed. Tax fields are references; applicable charges use adjustments after issue."
  ],
  "lots": ["Two lots make 100 metres", "Give each lot/taka a unique identifier and positive metres. Here 60 m + 40 m = 100 m; at ₹40/m the fabric value is ₹4,000 before charges. Review the completed lines."],
  "keyboard": [
    "Move through entry quickly",
    "Enter moves from lot ID to metres to the next row. Shift+Enter goes back. Blank rows are not saved; incomplete rows must be completed."
  ],
  "totals": [
    "Review totals and preview",
    "Review lot lines, total sent metres and fabric value in the live preview. Here 100 m × ₹40/m = ₹4,000 before charges."
  ],
  "saveDraft": ["Save and review without moving stock", "Save draft assigns a challan number and keeps it editable. Saving or printing deducts no stock. GST/tax fields are references only; they do not calculate or add charges."],
  "print": [
    "Preview, print or save PDF",
    "Review the document before printing. Printing a draft does not confirm dispatch. The tour does not open printing or download files."
  ],
  "confirm": ["Confirm only when goods leave", "Confirm dispatch has left locks the document and selling rate, and deducts the 100 sent metres once. When yarn tracking applies, it also deducts yarn using the linked costing weights."],
  "yarn": [
    "Understand the yarn deduction",
    "When yarn tracking applies, confirmation uses the linked costing weights. Link the quality and record required yarn balances first. At 10 kg per 100 m, 100 m sent deducts 10 kg; production itself does not deduct yarn."
  ],
  "issued": [
    "Review the issued challan",
    "Check sent metres and the fixed selling rate. Receipt, payment and adjustment actions are now available separately."
  ],
  "receipt": ["Record what the customer acknowledges", "Use Received as sent for a matching delivery. Otherwise use Record / correct receipt and enter the acknowledged total: 98 m in this example. Recording a receipt does not record a payment."],
  "acknowledged": [
    "Acknowledged metres and evidence",
    "Enter the acknowledged metres and optional HTTPS evidence link. A correction to an existing receipt needs a reason."
  ],
  "difference": ["100 sent, 98 accepted: no stock return", "The 2 m difference needs review. Use Review difference to accept 98 m for settlement or mark it disputed, with a reason. Accepting 98 m makes the fabric value ₹3,920; no metres return to stock."],
  "resolve": [
    "Accept or dispute the difference",
    "Accept acknowledged metres for settlement, or mark the difference disputed. Explain the decision; do not treat a receipt shortage as a stock return."
  ],
  "balance": ["Check what remains due", "After accepting 98 m × ₹40 = ₹3,920 and recording ₹2,000 received, ₹1,920 remains before other adjustments. Check the balance separately from delivery and receipt status."],
  "payment": ["Record money actually received", "Record payment with amount, date, method and reference/reason: ₹2,000 here. This records money already received; it does not charge the customer or transfer money."],
  "adjustment": [
    "Add a charge or credit",
    "Use a positive adjustment for a charge and a negative adjustment for a credit, with a reason. Document tax references alone do not add charges."
  ],
  "due": [
    "Read the due-date indicator",
    "Due today, days remaining or overdue describe an outstanding balance. The due date is separate from delivery and receipt status."
  ],
  "changeTerms": [
    "Change agreed payment terms",
    "Record the new agreed date or clear it, and explain the change. Payments and the issued document remain unchanged."
  ],
  "refund": [
    "Resolve customer credit",
    "If payments exceed the amount due, a customer credit/refund due is shown. Record credit refund when money is returned, with date, method and reason."
  ],
  "audit": [
    "Read transaction history",
    "Review the recorded actions and explanations. History preserves the transaction trail as receipts and finances change."
  ],
  "reverseEntry": ["Reverse a financial entry", "In Transaction history, use Reverse entry for an unreversed payment, refund or adjustment and give a reason. The original stays in history. This does not reverse the dispatch or return stock."],
  "reverseDispatch": [
    "Reverse an erroneous dispatch",
    "Only use this when all sent fabric is physically in stock and there is no later receipt or financial activity. Confirm physical stock and give a reason; the original record remains in history."
  ],
  "legacy": ["Earlier dispatch records", "Earlier dispatch records has a separate workflow and may be unavailable for your plan. Use current Delivery challans for the workflow shown here."],
  "finish": ["Return to your next real action", "Close the tour, then choose New dispatch to prepare a real draft. If stock or yarn setup is missing, complete it first. For goods already sent, open the existing challan to record receipt or payment."]
}},
gu: { ...configurationTutorialCopy.gu, moreHelp: "આ પગલાં માટે વધુ મદદ", sample: "નમૂનો · સ્ટોક કે ચુકવણી બદલાતાં નથી", sections: ["ત્રણ સ્થિતિઓ", "ડ્રાફ્ટ તૈયાર કરો", "માલ મોકલો", "પ્રાપ્તી નોંધો", "બાકી રકમ ઉકેલો", "આગળનું કામ"], fields: {
  "overview": ["માલ, પ્રાપ્તી અને નાણાં", "ત્રણ અલગ સ્થિતિઓ અનુસરો: ફેક્ટરીમાંથી નીકળેલો માલ, ગ્રાહકે સ્વીકારેલા મીટર અને મળેલી ચુકવણી. આ નમૂનો એક ડિસ્પેચને ડ્રાફ્ટથી બાકી રકમ સુધી સમજાવે છે."],
  "tabs": [
    "ચાલુ અને ઇતિહાસ",
    "ચાલુ વ્યવહાર માટે Active અને આર્કાઇવ માટે History વાપરો. ગ્રાહક ક્રેડિટ ઉકેલાય ત્યાં સુધી ચાલુ રહે છે."
  ],
  "search": [
    "ડિસ્પેચ શોધો",
    "ગ્રાહક નામ અથવા ચલણ નંબર નાખીને Search દબાવો. Load more વધુ રેકોર્ડ લાવે છે."
  ],
  "status": [
    "સ્થિતિઓ વાંચો",
    "ડિલિવરી, પ્રાપ્તી તફાવત અને ચુકવણી અલગ સ્થિતિઓ છે. ચલણ ખોલીને વિગતો અને બાકી રકમ જુઓ."
  ],
  "new": [
    "ડ્રાફ્ટ શરૂ કરો",
    "New dispatch નવો વ્યવહાર ખોલે છે. ડ્રાફ્ટ સાચવવાથી કે પ્રિન્ટથી સ્ટોક ઘટતો નથી."
  ],
  "quality": ["તૈયાર કાપડ ક્વોલિટી પસંદ કરો", "નવો ડિસ્પેચમાં એક ક્વોલિટી પસંદ કરો અને કાપડ સ્ટોકમાં ઉપલબ્ધ મીટર તપાસો. યાર્ન ટ્રેકિંગ લાગુ હોય તો પહેલાં યાર્ન સ્ટોક → કોસ્ટિંગ જોડોમાં આ ક્વોલિટી જોડો અને જરૂરી યાર્ન બેલેન્સ નોંધો."],
  "rate": [
    "વેચાણ દર નક્કી કરો",
    "સંમત હકારાત્મક પ્રતિ મીટર વેચાણ દર નાખો. આ ગ્રાહકનો ભાવ છે, ઉત્પાદન ખર્ચ કે વણકર મજૂરી નહીં."
  ],
  "parties": ["ગ્રાહક વિગતો અને સંમત ભાવ", "તારીખ, મોકલનાર અને ગ્રાહકનાં નામ/સરનામાં તથા ડિલિવરી સરનામું નાખો. હકારાત્મક પ્રતિ મીટર વેચાણ ભાવ રાખો: અહીં ₹40. આ સંમત ગ્રાહક ભાવ છે, ખર્ચ અને વણકર મજૂરીથી અલગ."],
  "terms": [
    "ચુકવણી શરતો",
    "સંમત પૂર્ણ ચુકવણી તારીખ અને શરતો નાખો; તારીખ નક્કી ન હોય તો ખાલી રાખો. આંશિક ચુકવણી તારીખ બદલતી નથી."
  ],
  "optional": [
    "વૈકલ્પિક સંદર્ભ",
    "જરૂર મુજબ ટ્રાન્સપોર્ટ, વાહન અને GST સંદર્ભ નાખો. ટેક્સ ક્ષેત્રો સંદર્ભ છે; ચાર્જ ઇશ્યૂ પછી એડજસ્ટમેન્ટથી ઉમેરો."
  ],
  "lots": ["બે લોટ મળીને 100 મીટર", "દરેક લોટ/તાકાને અનન્ય ઓળખ અને હકારાત્મક મીટર આપો. અહીં 60 મી + 40 મી = 100 મી; ₹40/મી પ્રમાણે ચાર્જ પહેલાં કાપડ મૂલ્ય ₹4,000 થાય છે. પૂર્ણ પંક્તિઓ તપાસો."],
  "keyboard": [
    "ઝડપી એન્ટ્રી",
    "Enter થી લોટ ઓળખ, મીટર અને આગલી પંક્તિ પર જાઓ. Shift+Enter પાછા જાય છે. ખાલી પંક્તિ સાચવાતી નથી; અધૂરી પંક્તિ પૂર્ણ કરો."
  ],
  "totals": [
    "કુલ અને પૂર્વદર્શન",
    "લોટ, મોકલેલા મીટર અને કાપડ મૂલ્ય તપાસો. અહીં 100 મી × ₹40/મી = ₹4,000, ચાર્જ પહેલાં."
  ],
  "saveDraft": ["સ્ટોક બદલ્યા વિના ડ્રાફ્ટ તપાસો", "ડ્રાફ્ટ સાચવવાથી ચલણ નંબર મળે છે અને તેમાં ફેરફાર કરી શકાય છે. સાચવવાથી કે પ્રિન્ટથી સ્ટોક ઘટતો નથી. GST/ટેક્સ ક્ષેત્રો માત્ર સંદર્ભ છે; ચાર્જ ગણતા કે ઉમેરતા નથી."],
  "print": [
    "પ્રિન્ટ અથવા PDF",
    "પ્રિન્ટ પહેલાં દસ્તાવેજ જુઓ. ડ્રાફ્ટ પ્રિન્ટથી ડિસ્પેચની પુષ્ટિ થતી નથી. ટૂરમાં પ્રિન્ટ કે ડાઉનલોડ નહીં થાય."
  ],
  "confirm": ["માલ નીકળે ત્યારે જ પુષ્ટિ કરો", "ડિસ્પેચ નીકળ્યો તેની પુષ્ટિથી દસ્તાવેજ અને વેચાણ દર સ્થિર થાય છે અને મોકલેલા 100 મીટર એક વખત ઘટે છે. યાર્ન ટ્રેકિંગ લાગુ હોય તો જોડાયેલા કોસ્ટિંગના વજન પ્રમાણે યાર્ન પણ ઘટે છે."],
  "yarn": [
    "યાર્ન કપાત સમજો",
    "યાર્ન ટ્રેકિંગ લાગુ હોય ત્યારે જોડાયેલા કોસ્ટિંગથી કપાત થાય છે. પહેલાં ક્વોલિટી જોડો અને જરૂરી યાર્ન બેલેન્સ નોંધો. 100 મી દીઠ 10 કિલો હોય તો 100 મી મોકલતાં 10 કિલો ઘટે છે; ઉત્પાદનથી નહીં."
  ],
  "issued": [
    "ઇશ્યૂ ચલણ તપાસો",
    "મોકલેલા મીટર અને સ્થિર દર જુઓ. પ્રાપ્તી, ચુકવણી અને એડજસ્ટમેન્ટ અલગથી કરી શકાય છે."
  ],
  "receipt": ["ગ્રાહકે સ્વીકારેલા મીટર નોંધો", "પૂરો માલ મળ્યો હોય તો મોકલ્યા મુજબ પ્રાપ્ત વાપરો. નહીં તો પ્રાપ્તિ નોંધો / સુધારોમાં સ્વીકારેલું કુલ નાખો: આ નમૂનામાં 98 મી. પ્રાપ્તી નોંધવાથી ચુકવણી નોંધાતી નથી."],
  "acknowledged": [
    "સ્વીકારેલા મીટર અને પુરાવો",
    "સ્વીકારેલા મીટર અને વૈકલ્પિક HTTPS પુરાવા લિંક નાખો. અગાઉની પ્રાપ્તી સુધારવા કારણ જોઈએ."
  ],
  "difference": ["100 મોકલ્યા, 98 સ્વીકાર્યા: સ્ટોક પરત નહીં", "2 મી તફાવત તપાસવો જરૂરી છે. તફાવતની સમીક્ષામાં કારણ સાથે પતાવટ માટે 98 મી સ્વીકારો અથવા વિવાદિત રાખો. 98 મી સ્વીકારવાથી કાપડ મૂલ્ય ₹3,920 થાય છે; સ્ટોકમાં મીટર પરત ઉમેરાતા નથી."],
  "resolve": [
    "તફાવત સ્વીકારો અથવા વિવાદ",
    "સમાધાન માટે સ્વીકારેલા મીટર મંજૂર કરો અથવા વિવાદિત રાખો. કારણ આપો; ઘટને સ્ટોક પરત ન ગણો."
  ],
  "balance": ["બાકી રકમ તપાસો", "98 મી × ₹40 = ₹3,920 સ્વીકાર્યા અને ₹2,000 મળ્યા નોંધ્યા પછી અન્ય એડજસ્ટમેન્ટ પહેલાં ₹1,920 બાકી રહે છે. બાકી રકમને ડિલિવરી અને પ્રાપ્તી સ્થિતિથી અલગ તપાસો."],
  "payment": ["ખરેખર મળેલી ચુકવણી નોંધો", "ચુકવણી નોંધોમાં રકમ, તારીખ, પદ્ધતિ અને સંદર્ભ/કારણ આપો: અહીં ₹2,000. આ મળેલા નાણાંની નોંધ છે; ગ્રાહક પાસેથી વસૂલાત કે નાણાં ટ્રાન્સફર થતું નથી."],
  "adjustment": [
    "ચાર્જ અથવા ક્રેડિટ",
    "ચાર્જ માટે હકારાત્મક અને ક્રેડિટ માટે નકારાત્મક એડજસ્ટમેન્ટ કારણ સાથે નાખો. ટેક્સ સંદર્ભ પોતે ચાર્જ ઉમેરતો નથી."
  ],
  "due": [
    "ચુકવણી તારીખ જુઓ",
    "આજે ચૂકવવાનું, બાકી દિવસ કે મોડું થયું તે બાકી રકમ દર્શાવે છે. તારીખ ડિલિવરી અને પ્રાપ્તીથી અલગ છે."
  ],
  "changeTerms": [
    "સંમત શરતો બદલો",
    "નવી સંમત તારીખ નાખો અથવા ખાલી કરો અને કારણ આપો. ચુકવણી અને ઇશ્યૂ દસ્તાવેજ બદલાતા નથી."
  ],
  "refund": [
    "ગ્રાહક ક્રેડિટ ઉકેલો",
    "વધુ ચુકવણી થઈ હોય તો ક્રેડિટ/રિફંડ બાકી દેખાય છે. પૈસા પરત આપ્યા પછી તારીખ, પદ્ધતિ અને કારણ સાથે રિફંડ નોંધો."
  ],
  "audit": [
    "વ્યવહાર ઇતિહાસ",
    "નોંધેલી ક્રિયાઓ અને કારણો જુઓ. પ્રાપ્તી અને નાણાં બદલાય ત્યારે પણ ઇતિહાસ રહે છે."
  ],
  "reverseEntry": ["નાણાકીય નોંધ ઉલટાવો", "વ્યવહાર ઇતિહાસમાં અગાઉ ન ઉલટાવેલી ચુકવણી, રિફંડ કે એડજસ્ટમેન્ટ માટે કારણ સાથે નોંધ ઉલટાવો વાપરો. મૂળ નોંધ ઇતિહાસમાં રહે છે. આથી ડિસ્પેચ ઉલટાતો કે સ્ટોક પરત આવતો નથી."],
  "reverseDispatch": [
    "ભૂલનો ડિસ્પેચ ઉલટાવો",
    "બધું મોકલેલું કાપડ ખરેખર સ્ટોકમાં હોય અને પછીની પ્રાપ્તી કે નાણાકીય પ્રવૃત્તિ ન હોય ત્યારે જ વાપરો. સ્ટોકની પુષ્ટિ અને કારણ આપો; મૂળ રેકોર્ડ રહે છે."
  ],
  "legacy": ["અગાઉના ડિસ્પેચ", "અગાઉના ડિસ્પેચ રેકોર્ડની અલગ પ્રક્રિયા છે અને તમારા પ્લાનમાં ઉપલબ્ધ ન પણ હોય. અહીં બતાવેલી પ્રક્રિયા માટે હાલના ડિલિવરી ચલણ વાપરો."],
  "finish": ["હવે તમારું સાચું કામ શરૂ કરો", "ટૂર બંધ કરીને સાચો ડ્રાફ્ટ બનાવવા નવો ડિસ્પેચ પસંદ કરો. સ્ટોક કે યાર્ન સેટઅપ બાકી હોય તો પહેલાં પૂર્ણ કરો. માલ મોકલી દીધો હોય તો હાલનું ચલણ ખોલીને પ્રાપ્તી કે ચુકવણી નોંધો."]
}},
hi: { ...configurationTutorialCopy.hi, moreHelp: "इस चरण के लिए और मदद", sample: "नमूना · स्टॉक या भुगतान नहीं बदलते", sections: ["तीन स्थितियाँ", "ड्राफ्ट बनाएँ", "माल भेजें", "प्राप्ति दर्ज करें", "बाकी रकम सुलझाएँ", "अगला काम"], fields: {
  "overview": ["माल, प्राप्ति और पैसे", "तीन अलग स्थितियाँ देखें: कारखाने से निकला माल, ग्राहक के स्वीकारे मीटर और मिला भुगतान। यह नमूना एक डिस्पैच को ड्राफ्ट से बाकी रकम तक समझाता है।"],
  "tabs": [
    "सक्रिय और इतिहास",
    "चलते लेनदेन के लिए Active और संग्रहित के लिए History चुनें। ग्राहक क्रेडिट समाधान तक सक्रिय रहता है।"
  ],
  "search": [
    "डिस्पैच खोजें",
    "ग्राहक नाम या चालान नंबर से Search करें। Load more और रिकॉर्ड लाता है।"
  ],
  "status": [
    "स्थितियाँ पढ़ें",
    "डिलिवरी, प्राप्ति अंतर और भुगतान अलग स्थितियाँ हैं। चालान खोलकर विवरण और शेष देखें।"
  ],
  "new": [
    "ड्राफ्ट शुरू करें",
    "New dispatch नया लेनदेन खोलता है। ड्राफ्ट सहेजने या प्रिंट करने से स्टॉक नहीं घटता।"
  ],
  "quality": ["तैयार कपड़ा क्वालिटी चुनें", "नया डिस्पैच में एक क्वालिटी चुनें और कपड़ा स्टॉक में उपलब्ध मीटर जाँचें। धागा ट्रैकिंग लागू हो तो पहले धागा स्टॉक → लागत जोड़ें में इस क्वालिटी को जोड़ें और जरूरी धागा शेष दर्ज करें।"],
  "rate": [
    "बिक्री दर तय करें",
    "सहमत सकारात्मक प्रति मीटर बिक्री दर डालें। यह ग्राहक भाव है, उत्पादन लागत या बुनकर मजदूरी नहीं।"
  ],
  "parties": ["ग्राहक विवरण और सहमत भाव", "तारीख, प्रेषक और ग्राहक के नाम/पते तथा डिलिवरी पता दें। सकारात्मक प्रति मीटर बिक्री भाव रखें: यहाँ ₹40। यह सहमत ग्राहक भाव है, लागत और बुनकर मजदूरी से अलग।"],
  "terms": [
    "भुगतान शर्तें",
    "सहमत पूर्ण भुगतान तारीख और शर्तें दें; तारीख तय न हो तो खाली रखें। आंशिक भुगतान तारीख नहीं बदलता।"
  ],
  "optional": [
    "वैकल्पिक संदर्भ",
    "जरूरत अनुसार परिवहन, वाहन और GST संदर्भ दें। कर क्षेत्र संदर्भ हैं; शुल्क जारी करने के बाद समायोजन से जोड़ें।"
  ],
  "lots": ["दो लॉट मिलकर 100 मीटर", "हर लॉट/ताका को अलग पहचान और सकारात्मक मीटर दें। यहाँ 60 मी + 40 मी = 100 मी; ₹40/मी पर शुल्क से पहले कपड़ा मूल्य ₹4,000 है। पूरी पंक्तियाँ जाँचें।"],
  "keyboard": [
    "तेज प्रविष्टि",
    "Enter लॉट पहचान से मीटर और अगली पंक्ति पर ले जाता है। Shift+Enter पीछे जाता है। खाली पंक्तियाँ नहीं सहेजतीं; अधूरी पूरी करें।"
  ],
  "totals": [
    "कुल और पूर्वावलोकन",
    "लॉट, भेजे मीटर और कपड़ा मूल्य जाँचें। यहाँ 100 मी × ₹40/मी = ₹4,000, शुल्क से पहले।"
  ],
  "saveDraft": ["स्टॉक बदले बिना ड्राफ्ट जाँचें", "ड्राफ्ट सहेजने पर चालान नंबर मिलता है और बदलाव कर सकते हैं। सहेजने या प्रिंट करने से स्टॉक नहीं घटता। GST/कर क्षेत्र केवल संदर्भ हैं; शुल्क गिनते या जोड़ते नहीं।"],
  "print": [
    "प्रिंट या PDF",
    "प्रिंट से पहले दस्तावेज देखें। ड्राफ्ट प्रिंट करना डिस्पैच पुष्टि नहीं है। टूर में प्रिंट या डाउनलोड नहीं होता।"
  ],
  "confirm": ["माल निकलने पर ही पुष्टि करें", "डिस्पैच निकलने की पुष्टि से दस्तावेज और बिक्री दर तय हो जाते हैं और भेजे 100 मीटर एक बार घटते हैं। धागा ट्रैकिंग लागू हो तो जुड़ी लागत के वजन अनुसार धागा भी घटता है।"],
  "yarn": [
    "धागा कटौती समझें",
    "धागा ट्रैकिंग लागू हो तो जुड़ी लागत से कटौती होती है। पहले क्वालिटी जोड़ें और जरूरी शेष दर्ज करें। 100 मी पर 10 किलो हो तो 100 मी भेजने से 10 किलो कटता है; उत्पादन से नहीं।"
  ],
  "issued": [
    "जारी चालान जाँचें",
    "भेजे मीटर और तय दर देखें। प्राप्ति, भुगतान और समायोजन अलग कर सकते हैं।"
  ],
  "receipt": ["ग्राहक के स्वीकारे मीटर दर्ज करें", "पूरा माल मिला हो तो भेजे अनुसार प्राप्त चुनें। अन्यथा प्राप्ति दर्ज / सुधारें में स्वीकारा कुल दें: इस नमूने में 98 मी। प्राप्ति दर्ज करने से भुगतान दर्ज नहीं होता।"],
  "acknowledged": [
    "स्वीकृत मीटर और प्रमाण",
    "स्वीकृत मीटर और वैकल्पिक HTTPS प्रमाण लिंक दें। पुरानी प्राप्ति सुधारने का कारण चाहिए।"
  ],
  "difference": ["100 भेजे, 98 स्वीकारे: स्टॉक वापसी नहीं", "2 मी अंतर की समीक्षा जरूरी है। अंतर की समीक्षा में कारण देकर निपटान के लिए 98 मी स्वीकारें या विवादित रखें। 98 मी स्वीकारने से कपड़ा मूल्य ₹3,920 होता है; स्टॉक में मीटर वापस नहीं जुड़ते।"],
  "resolve": [
    "अंतर स्वीकारें या विवाद करें",
    "निपटान के लिए स्वीकृत मीटर स्वीकारें या अंतर विवादित रखें। कारण दें; कमी को स्टॉक वापसी न मानें।"
  ],
  "balance": ["बाकी रकम जाँचें", "98 मी × ₹40 = ₹3,920 स्वीकारने और ₹2,000 मिले दर्ज करने के बाद अन्य समायोजन से पहले ₹1,920 बाकी है। बाकी रकम को डिलिवरी और प्राप्ति स्थिति से अलग जाँचें।"],
  "payment": ["वास्तव में मिला भुगतान दर्ज करें", "भुगतान दर्ज करें में राशि, तारीख, विधि और संदर्भ/कारण दें: यहाँ ₹2,000। यह मिले पैसे की प्रविष्टि है; ग्राहक से वसूली या पैसे ट्रांसफर नहीं होते।"],
  "adjustment": [
    "शुल्क या क्रेडिट",
    "शुल्क के लिए सकारात्मक और क्रेडिट के लिए नकारात्मक समायोजन कारण सहित दें। कर संदर्भ अपने आप शुल्क नहीं जोड़ता।"
  ],
  "due": [
    "देय तारीख देखें",
    "आज देय, बचे दिन या विलंब शेष राशि के लिए हैं। तारीख डिलिवरी और प्राप्ति स्थिति से अलग है।"
  ],
  "changeTerms": [
    "सहमत शर्तें बदलें",
    "नई सहमत तारीख दें या साफ करें और कारण दें। भुगतान और जारी दस्तावेज नहीं बदलते।"
  ],
  "refund": [
    "ग्राहक क्रेडिट सुलझाएँ",
    "ज्यादा भुगतान हो तो क्रेडिट/रिफंड देय दिखता है। पैसे लौटाने पर तारीख, विधि और कारण सहित रिफंड दर्ज करें।"
  ],
  "audit": [
    "लेनदेन इतिहास",
    "दर्ज क्रियाएँ और कारण देखें। प्राप्ति और वित्त बदलने पर भी इतिहास रहता है।"
  ],
  "reverseEntry": ["वित्तीय प्रविष्टि उलटें", "लेनदेन इतिहास में पहले न उलटे भुगतान, रिफंड या समायोजन पर कारण सहित प्रविष्टि उलटें चुनें। मूल प्रविष्टि इतिहास में रहती है। इससे डिस्पैच नहीं उलटता और स्टॉक वापस नहीं आता।"],
  "reverseDispatch": [
    "गलत डिस्पैच उलटें",
    "सारा भेजा कपड़ा वास्तव में स्टॉक में हो और बाद की प्राप्ति या वित्तीय गतिविधि न हो तभी करें। भौतिक स्टॉक पुष्टि और कारण दें; मूल रिकॉर्ड रहता है।"
  ],
  "legacy": ["पहले के डिस्पैच", "पहले के डिस्पैच रिकॉर्ड की अलग प्रक्रिया है और आपके प्लान में उपलब्ध न भी हो। यहाँ दिखाई प्रक्रिया के लिए वर्तमान डिलिवरी चालान इस्तेमाल करें।"],
  "finish": ["अब अपना असली काम शुरू करें", "टूर बंद करके असली ड्राफ्ट बनाने के लिए नया डिस्पैच चुनें। स्टॉक या धागा सेटअप बाकी हो तो पहले पूरा करें। माल भेज चुके हों तो मौजूदा चालान खोलकर प्राप्ति या भुगतान दर्ज करें।"]
}},
}
