import type { Language } from './context'
import type { DispatchTourStep } from '../dispatch-tour'
import { configurationTutorialCopy } from './configuration-tutorial'
type DispatchCopy = { sample: string; sections: string[]; fields: Record<DispatchTourStep, readonly [string, string]>; skip: string; back: string; next: string; finish: string; progress: string }
export const dispatchTutorialCopy: Record<Language, DispatchCopy> = {
en: { ...configurationTutorialCopy.en, sample: "Sample preview · no stock or payments are changed", sections: ["Find dispatches", "Create a draft", "Enter lots and review", "Confirm dispatch", "Record receipt", "Manage settlement", "History and corrections"], fields: {
  "overview": [
    "Delivery challans",
    "Manage fabric dispatches, customer receipts and payments. Yarn deductions follow the linked fabric costing; there is no separate yarn dispatch form."
  ],
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
  "quality": [
    "Choose the fabric quality",
    "Select the stock quality and check available metres. This dispatch uses one quality with multiple lot lines."
  ],
  "rate": [
    "Agree a selling rate",
    "Enter the positive agreed selling price per metre. This is the customer price, not the production cost or weaver wage."
  ],
  "parties": [
    "Sender, customer and delivery",
    "Enter the date, sender name/address, customer name/address and delivery address. Customer details are entered afresh for each transaction."
  ],
  "terms": [
    "Set payment terms",
    "Enter the agreed full-payment due date and terms, or leave the date blank if none is agreed. Partial payments do not change the date."
  ],
  "optional": [
    "Optional document references",
    "Add transport, vehicle, GST and other references as needed. Tax fields are references; applicable charges use adjustments after issue."
  ],
  "lots": [
    "Enter lot lines",
    "Each started row needs a lot/taka identifier and positive metres. Avoid duplicate identifiers. Add or remove lines as needed."
  ],
  "keyboard": [
    "Move through entry quickly",
    "Enter moves from lot ID to metres to the next row. Shift+Enter goes back. Blank rows are not saved; incomplete rows must be completed."
  ],
  "totals": [
    "Review totals and preview",
    "Review lot lines, total sent metres and fabric value in the live preview. Here 100 m × ₹40/m = ₹4,000 before charges."
  ],
  "saveDraft": [
    "Save the draft",
    "Saving assigns a challan number. You can still edit a draft; no stock leaves until dispatch is confirmed."
  ],
  "print": [
    "Preview, print or save PDF",
    "Review the document before printing. Printing a draft does not confirm dispatch. The tour does not open printing or download files."
  ],
  "confirm": [
    "Confirm goods have left",
    "Confirm dispatch has left deducts sent fabric metres once. Issued document details and the selling rate become fixed."
  ],
  "yarn": [
    "Understand the yarn deduction",
    "When yarn tracking applies, confirmation uses the linked costing weights. Link the quality and record required yarn balances first. At 10 kg per 100 m, 100 m sent deducts 10 kg; production itself does not deduct yarn."
  ],
  "issued": [
    "Review the issued challan",
    "Check sent metres and the fixed selling rate. Receipt, payment and adjustment actions are now available separately."
  ],
  "receipt": [
    "Record the receipt",
    "Use Received as sent for a matching delivery, or Record / correct receipt for the customer’s acknowledged total."
  ],
  "acknowledged": [
    "Acknowledged metres and evidence",
    "Enter the acknowledged metres and optional HTTPS evidence link. A correction to an existing receipt needs a reason."
  ],
  "difference": [
    "Review a difference",
    "Here 100 m sent and 98 m acknowledged leave a 2 m difference. Receipt differences never return metres to stock."
  ],
  "resolve": [
    "Accept or dispute the difference",
    "Accept acknowledged metres for settlement, or mark the difference disputed. Explain the decision; do not treat a receipt shortage as a stock return."
  ],
  "balance": [
    "Understand the balance",
    "After accepting 98 m at ₹40/m, the fabric value is ₹3,920. A ₹2,000 payment leaves ₹1,920 before other adjustments."
  ],
  "payment": [
    "Record a payment",
    "Enter amount, date, method and reference/reason. This records a payment received; it does not send money or charge the customer."
  ],
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
  "reverseEntry": [
    "Reverse an eligible entry",
    "Use Reverse entry on eligible financial history entries and provide a reason. The original remains in history; this is different from reversing a dispatch."
  ],
  "reverseDispatch": [
    "Reverse an erroneous dispatch",
    "Only use this when all sent fabric is physically in stock and there is no later receipt or financial activity. Confirm physical stock and give a reason; the original record remains in history."
  ],
  "legacy": [
    "Earlier dispatch records",
    "Earlier dispatch records opens the legacy workspace. These records have their own workflow; this tour covers current delivery challans."
  ],
  "finish": [
    "Ready to dispatch",
    "Prepare and review a draft, confirm when goods leave, record receipt and resolve the balance. Replay this tour whenever needed."
  ]
}},
gu: { ...configurationTutorialCopy.gu, sample: "નમૂનો · સ્ટોક કે ચુકવણી બદલાતાં નથી", sections: ["ડિસ્પેચ શોધો", "ડ્રાફ્ટ બનાવો", "લોટ અને સમીક્ષા", "ડિસ્પેચ પુષ્ટિ", "પ્રાપ્તી નોંધો", "ચુકવણી સંભાળો", "ઇતિહાસ અને સુધારા"], fields: {
  "overview": [
    "ડિલિવરી ચલણ",
    "કાપડ ડિસ્પેચ, ગ્રાહક પ્રાપ્તી અને ચુકવણી સંભાળો. યાર્ન કપાત જોડાયેલા કોસ્ટિંગથી થાય છે; અલગ યાર્ન ડિસ્પેચ ફોર્મ નથી."
  ],
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
  "quality": [
    "કાપડ ક્વોલિટી પસંદ કરો",
    "સ્ટોક ક્વોલિટી અને ઉપલબ્ધ મીટર તપાસો. એક ડિસ્પેચમાં એક ક્વોલિટી અને અનેક લોટ હોય છે."
  ],
  "rate": [
    "વેચાણ દર નક્કી કરો",
    "સંમત હકારાત્મક પ્રતિ મીટર વેચાણ દર નાખો. આ ગ્રાહકનો ભાવ છે, ઉત્પાદન ખર્ચ કે વણકર મજૂરી નહીં."
  ],
  "parties": [
    "મોકલનાર, ગ્રાહક અને ડિલિવરી",
    "તારીખ, મોકલનારનું નામ/સરનામું, ગ્રાહકનું નામ/સરનામું અને ડિલિવરી સરનામું નાખો. દરેક વ્યવહારમાં ગ્રાહક વિગતો ફરી નાખો."
  ],
  "terms": [
    "ચુકવણી શરતો",
    "સંમત પૂર્ણ ચુકવણી તારીખ અને શરતો નાખો; તારીખ નક્કી ન હોય તો ખાલી રાખો. આંશિક ચુકવણી તારીખ બદલતી નથી."
  ],
  "optional": [
    "વૈકલ્પિક સંદર્ભ",
    "જરૂર મુજબ ટ્રાન્સપોર્ટ, વાહન અને GST સંદર્ભ નાખો. ટેક્સ ક્ષેત્રો સંદર્ભ છે; ચાર્જ ઇશ્યૂ પછી એડજસ્ટમેન્ટથી ઉમેરો."
  ],
  "lots": [
    "લોટની પંક્તિઓ",
    "દરેક શરૂ કરેલી પંક્તિમાં લોટ/તાકા ઓળખ અને હકારાત્મક મીટર જોઈએ. ઓળખ ફરી ન લખો. પંક્તિ ઉમેરો અથવા દૂર કરો."
  ],
  "keyboard": [
    "ઝડપી એન્ટ્રી",
    "Enter થી લોટ ઓળખ, મીટર અને આગલી પંક્તિ પર જાઓ. Shift+Enter પાછા જાય છે. ખાલી પંક્તિ સાચવાતી નથી; અધૂરી પંક્તિ પૂર્ણ કરો."
  ],
  "totals": [
    "કુલ અને પૂર્વદર્શન",
    "લોટ, મોકલેલા મીટર અને કાપડ મૂલ્ય તપાસો. અહીં 100 મી × ₹40/મી = ₹4,000, ચાર્જ પહેલાં."
  ],
  "saveDraft": [
    "ડ્રાફ્ટ સાચવો",
    "સાચવવાથી ચલણ નંબર મળે છે. ડ્રાફ્ટ ફેરવી શકાય છે; ડિસ્પેચ પુષ્ટિ પહેલાં સ્ટોક ઘટતો નથી."
  ],
  "print": [
    "પ્રિન્ટ અથવા PDF",
    "પ્રિન્ટ પહેલાં દસ્તાવેજ જુઓ. ડ્રાફ્ટ પ્રિન્ટથી ડિસ્પેચની પુષ્ટિ થતી નથી. ટૂરમાં પ્રિન્ટ કે ડાઉનલોડ નહીં થાય."
  ],
  "confirm": [
    "માલ નીકળ્યાની પુષ્ટિ",
    "પુષ્ટિથી મોકલેલા કાપડના મીટર એક વાર ઘટે છે. ઇશ્યૂ દસ્તાવેજ અને વેચાણ દર સ્થિર થાય છે."
  ],
  "yarn": [
    "યાર્ન કપાત સમજો",
    "યાર્ન ટ્રેકિંગ લાગુ હોય ત્યારે જોડાયેલા કોસ્ટિંગથી કપાત થાય છે. પહેલાં ક્વોલિટી જોડો અને જરૂરી યાર્ન બેલેન્સ નોંધો. 100 મી દીઠ 10 કિલો હોય તો 100 મી મોકલતાં 10 કિલો ઘટે છે; ઉત્પાદનથી નહીં."
  ],
  "issued": [
    "ઇશ્યૂ ચલણ તપાસો",
    "મોકલેલા મીટર અને સ્થિર દર જુઓ. પ્રાપ્તી, ચુકવણી અને એડજસ્ટમેન્ટ અલગથી કરી શકાય છે."
  ],
  "receipt": [
    "પ્રાપ્તી નોંધો",
    "માલ પૂરો મળ્યો હોય તો Received as sent; અન્યથા ગ્રાહકે સ્વીકારેલા કુલ માટે Record / correct receipt વાપરો."
  ],
  "acknowledged": [
    "સ્વીકારેલા મીટર અને પુરાવો",
    "સ્વીકારેલા મીટર અને વૈકલ્પિક HTTPS પુરાવા લિંક નાખો. અગાઉની પ્રાપ્તી સુધારવા કારણ જોઈએ."
  ],
  "difference": [
    "તફાવત તપાસો",
    "અહીં 100 મી મોકલ્યા અને 98 મી સ્વીકાર્યા એટલે 2 મી તફાવત. પ્રાપ્તી તફાવતથી સ્ટોક પાછો ઉમેરાતો નથી."
  ],
  "resolve": [
    "તફાવત સ્વીકારો અથવા વિવાદ",
    "સમાધાન માટે સ્વીકારેલા મીટર મંજૂર કરો અથવા વિવાદિત રાખો. કારણ આપો; ઘટને સ્ટોક પરત ન ગણો."
  ],
  "balance": [
    "બાકી રકમ સમજો",
    "98 મી × ₹40થી ₹3,920 થાય છે. ₹2,000 ચુકવણી પછી અન્ય એડજસ્ટમેન્ટ પહેલાં ₹1,920 બાકી રહે છે."
  ],
  "payment": [
    "ચુકવણી નોંધો",
    "રકમ, તારીખ, પદ્ધતિ અને સંદર્ભ/કારણ નાખો. મળેલી ચુકવણી નોંધાય છે; પૈસા મોકલાતા કે ગ્રાહક પાસેથી વસૂલ થતા નથી."
  ],
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
  "reverseEntry": [
    "પાત્ર નાણાકીય નોંધ ઉલટાવો",
    "પાત્ર નાણાકીય નોંધ પર Reverse entry કારણ સાથે વાપરો. મૂળ નોંધ રહે છે; આ ડિસ્પેચ ઉલટાવવાથી અલગ છે."
  ],
  "reverseDispatch": [
    "ભૂલનો ડિસ્પેચ ઉલટાવો",
    "બધું મોકલેલું કાપડ ખરેખર સ્ટોકમાં હોય અને પછીની પ્રાપ્તી કે નાણાકીય પ્રવૃત્તિ ન હોય ત્યારે જ વાપરો. સ્ટોકની પુષ્ટિ અને કારણ આપો; મૂળ રેકોર્ડ રહે છે."
  ],
  "legacy": [
    "અગાઉના ડિસ્પેચ",
    "Earlier dispatch records જૂનું કાર્યસ્થળ ખોલે છે. તેની અલગ પ્રક્રિયા છે; આ ટૂર હાલના ચલણ માટે છે."
  ],
  "finish": [
    "ડિસ્પેચ માટે તૈયાર",
    "ડ્રાફ્ટ તૈયાર કરીને તપાસો, માલ નીકળે ત્યારે પુષ્ટિ કરો, પ્રાપ્તી નોંધો અને બાકી રકમ ઉકેલો. જરૂર પડે ટૂર ફરી જુઓ."
  ]
}},
hi: { ...configurationTutorialCopy.hi, sample: "नमूना · स्टॉक या भुगतान नहीं बदलते", sections: ["डिस्पैच खोजें", "ड्राफ्ट बनाएँ", "लॉट और समीक्षा", "डिस्पैच पुष्टि", "प्राप्ति दर्ज करें", "भुगतान सँभालें", "इतिहास और सुधार"], fields: {
  "overview": [
    "डिलिवरी चालान",
    "कपड़ा डिस्पैच, ग्राहक प्राप्ति और भुगतान सँभालें। धागा कटौती जुड़ी लागत से होती है; अलग धागा डिस्पैच फॉर्म नहीं है।"
  ],
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
  "quality": [
    "कपड़ा क्वालिटी चुनें",
    "स्टॉक क्वालिटी और उपलब्ध मीटर जाँचें। एक डिस्पैच में एक क्वालिटी और कई लॉट होते हैं।"
  ],
  "rate": [
    "बिक्री दर तय करें",
    "सहमत सकारात्मक प्रति मीटर बिक्री दर डालें। यह ग्राहक भाव है, उत्पादन लागत या बुनकर मजदूरी नहीं।"
  ],
  "parties": [
    "प्रेषक, ग्राहक और डिलिवरी",
    "तारीख, प्रेषक नाम/पता, ग्राहक नाम/पता और डिलिवरी पता दें। हर लेनदेन में ग्राहक विवरण नए सिरे से भरें।"
  ],
  "terms": [
    "भुगतान शर्तें",
    "सहमत पूर्ण भुगतान तारीख और शर्तें दें; तारीख तय न हो तो खाली रखें। आंशिक भुगतान तारीख नहीं बदलता।"
  ],
  "optional": [
    "वैकल्पिक संदर्भ",
    "जरूरत अनुसार परिवहन, वाहन और GST संदर्भ दें। कर क्षेत्र संदर्भ हैं; शुल्क जारी करने के बाद समायोजन से जोड़ें।"
  ],
  "lots": [
    "लॉट पंक्तियाँ",
    "हर शुरू पंक्ति में लॉट/ताका पहचान और सकारात्मक मीटर चाहिए। पहचान दोहराएँ नहीं। पंक्ति जोड़ें या हटाएँ।"
  ],
  "keyboard": [
    "तेज प्रविष्टि",
    "Enter लॉट पहचान से मीटर और अगली पंक्ति पर ले जाता है। Shift+Enter पीछे जाता है। खाली पंक्तियाँ नहीं सहेजतीं; अधूरी पूरी करें।"
  ],
  "totals": [
    "कुल और पूर्वावलोकन",
    "लॉट, भेजे मीटर और कपड़ा मूल्य जाँचें। यहाँ 100 मी × ₹40/मी = ₹4,000, शुल्क से पहले।"
  ],
  "saveDraft": [
    "ड्राफ्ट सहेजें",
    "सहेजने पर चालान नंबर मिलता है। ड्राफ्ट बदल सकते हैं; पुष्टि से पहले स्टॉक नहीं घटता।"
  ],
  "print": [
    "प्रिंट या PDF",
    "प्रिंट से पहले दस्तावेज देखें। ड्राफ्ट प्रिंट करना डिस्पैच पुष्टि नहीं है। टूर में प्रिंट या डाउनलोड नहीं होता।"
  ],
  "confirm": [
    "माल निकलने की पुष्टि",
    "पुष्टि भेजे कपड़े के मीटर एक बार घटाती है। जारी दस्तावेज और बिक्री दर तय हो जाते हैं।"
  ],
  "yarn": [
    "धागा कटौती समझें",
    "धागा ट्रैकिंग लागू हो तो जुड़ी लागत से कटौती होती है। पहले क्वालिटी जोड़ें और जरूरी शेष दर्ज करें। 100 मी पर 10 किलो हो तो 100 मी भेजने से 10 किलो कटता है; उत्पादन से नहीं।"
  ],
  "issued": [
    "जारी चालान जाँचें",
    "भेजे मीटर और तय दर देखें। प्राप्ति, भुगतान और समायोजन अलग कर सकते हैं।"
  ],
  "receipt": [
    "प्राप्ति दर्ज करें",
    "पूरा मिला हो तो Received as sent; अन्यथा ग्राहक का स्वीकृत कुल Record / correct receipt में दें।"
  ],
  "acknowledged": [
    "स्वीकृत मीटर और प्रमाण",
    "स्वीकृत मीटर और वैकल्पिक HTTPS प्रमाण लिंक दें। पुरानी प्राप्ति सुधारने का कारण चाहिए।"
  ],
  "difference": [
    "अंतर जाँचें",
    "यहाँ 100 मी भेजे और 98 मी स्वीकृत तो 2 मी अंतर है। प्राप्ति अंतर से स्टॉक वापस नहीं जुड़ता।"
  ],
  "resolve": [
    "अंतर स्वीकारें या विवाद करें",
    "निपटान के लिए स्वीकृत मीटर स्वीकारें या अंतर विवादित रखें। कारण दें; कमी को स्टॉक वापसी न मानें।"
  ],
  "balance": [
    "शेष समझें",
    "98 मी × ₹40 से ₹3,920 बनते हैं। ₹2,000 भुगतान के बाद अन्य समायोजन से पहले ₹1,920 बचते हैं।"
  ],
  "payment": [
    "भुगतान दर्ज करें",
    "राशि, तारीख, विधि और संदर्भ/कारण दें। मिला भुगतान दर्ज होता है; पैसे भेजे या ग्राहक से वसूले नहीं जाते।"
  ],
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
  "reverseEntry": [
    "योग्य वित्तीय प्रविष्टि उलटें",
    "योग्य वित्तीय प्रविष्टि पर Reverse entry कारण सहित करें। मूल प्रविष्टि रहती है; यह डिस्पैच उलटने से अलग है।"
  ],
  "reverseDispatch": [
    "गलत डिस्पैच उलटें",
    "सारा भेजा कपड़ा वास्तव में स्टॉक में हो और बाद की प्राप्ति या वित्तीय गतिविधि न हो तभी करें। भौतिक स्टॉक पुष्टि और कारण दें; मूल रिकॉर्ड रहता है।"
  ],
  "legacy": [
    "पहले के डिस्पैच",
    "Earlier dispatch records पुराना कार्यस्थल खोलता है। उसकी अलग प्रक्रिया है; यह टूर वर्तमान चालान के लिए है।"
  ],
  "finish": [
    "डिस्पैच को तैयार",
    "ड्राफ्ट बनाकर जाँचें, माल निकलने पर पुष्टि करें, प्राप्ति दर्ज करें और शेष सुलझाएँ। जरूरत पर टूर फिर देखें।"
  ]
}},
}
