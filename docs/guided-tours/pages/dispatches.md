# P12 Dispatches (and P13 print view) — tour specification

Status: specified, not implemented. Implementation: **GT-07** (first replica tour; introduces the live handoff for replicas, EC-18). Gujarati/Hindi: native review pending.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/stock-and-dispatch.md`](../audit/stock-and-dispatch.md) §0, §4.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Routes | `/owner/dispatches` → `ChallansClient.tsx` inside `DispatchGuidedTour`; print view `/owner/dispatches/[id]/print` (`ChallanPrint.tsx`, opened in a new tab) |
| Entitlement | `production` capability (Base). Owner role. |
| Tour today | `components/dispatches/DispatchGuidedTour.tsx` (hides the live page, renders `DispatchTourPreview`), `components/tours/DispatchTutorial.tsx`, steps `lib/dispatch-tour.ts` (11 steps + 22 help topics), copy `lib/i18n/dispatch-tutorial.ts`, sample numbers `dispatchTourExample`. |
| Anchors today | Replica only: `[data-dispatch-tour="<step>"]`. None on the live page. |
| Prerequisites for real use | Fabric stock for the quality (saved production or opening stock). Customer details are typed per dispatch (no party master). |
| Consequential actions | Save draft (no stock change), Confirm dispatch has left (deducts fabric metres), Received as sent / Record receipt, Record payment, adjustments, refunds, Reverse erroneous dispatch, Reverse entry. |
| Business rule (current migrations) | Confirm deducts **fabric** metres only; yarn is deducted when production is saved (`20260920000000_unified_inventory_audit_architecture.sql:446`; latest `mutate_delivery_challan` in `20260926132412…sql` never touches yarn). Owner confirmed on 2026-09-27 that production deducts yarn (U-04). |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| DP-1 | **Blocker** | Tour | The confirm step and its help say confirmation deducts yarn and production does not: the opposite of the current rule, and it contradicts the Yarn Stock tour. | CODE-VERIFIED `lib/i18n/dispatch-tutorial.ts:52-56` (+ gu 147-151, hi 242-246); pinned by `__tests__/dispatch-tour.test.ts:36` |
| DP-2 | Major | Tour | Help topic `legacy` describes "Earlier dispatch records", a retired screen. | CODE-VERIFIED `dispatch-tutorial.ts:98`; no route |
| DP-3 | Major | Tour | The live page is hidden for the whole tour and nothing points back to the real "New dispatch". | CODE-VERIFIED `DispatchGuidedTour.tsx:39` |
| DP-4 | Major | Tour | At ≥1440px the replica is not in the workspace width, so the pinned rail can paint over it; the panel docks up to ~330px from the dialog it explains. | OBSERVED (harness) 1440×900; SD-08 |
| DP-5 | Minor | Tour | 22 help topics under "More help for this step"; step `parties` implies a party record that does not exist; receipt replica puts "Received as sent" inside the dialog (live: a toolbar button); Gujarati/Hindi copy quotes English UI labels. | CODE-VERIFIED audit §4.3, §4.6 |
| DP-6 | Major | Product | Pending retry key not scoped by org, no discard (PI-10). | CODE-VERIFIED `ChallansClient.tsx:141-161` |

What works: the replica has no handlers, links, prints or storage, and every control is disabled (pinned by `dispatch-tour-preview.test.tsx`); the worked numbers are consistent.

## C. Learning outcomes and coverage

After the tour the owner can: (1) explain that a dispatch follows goods, receipt and money; (2) know stock must exist first; (3) create a draft with quality, customer, price and lots; (4) confirm only when goods leave, knowing that fabric stock drops then; (5) print the challan; (6) record what the customer accepted and what it does to the bill; (7) record money received and read the balance; (8) start a real dispatch.

| Requirement | Destination |
| --- | --- |
| Three tracks: goods, receipt, money | `dp-overview` |
| Prerequisite: fabric stock for the quality | `dp-quality` |
| Customer details typed each time; agreed price | `dp-customer` |
| Lots/taka with metres; value | `dp-lots` |
| Draft moves no stock; print for the driver | `dp-draft` |
| Confirm deducts fabric only; yarn already counted at production | `dp-confirm` |
| Print / save PDF (P13) | `dp-confirm` detail |
| Reverse a mistaken dispatch | `dp-confirm` detail |
| Receipt: received as sent vs a shortfall | `dp-receipt` |
| Shortfall changes the bill, not stock | `dp-difference` |
| Payments, balance due, due date | `dp-payment` (+ detail: adjustments, refunds, reverse entry, payment terms) |
| Active / History tabs, search, load more | Omitted: standard list controls |
| Next action | `dp-handoff` |

## D. Structure

Ten steps. The replica shows a sample dispatch moving through its life in the order it happens. `balance` and the 22 help topics are removed; their essential facts moved into bodies and More detail. The last step is the live handoff: the replica disappears and the real page shows.

EC-18 for this page: the replica renders inside `<div className="dispatch-workspace-shell …">`; `hidden={step !== null && step !== 'handoff'}`.

## E. Steps

Replica steps use the existing `DispatchTourPreview` surfaces (`dispatchTourSurface`); the `draft`, `confirm`, `receipt` and `payment` surfaces are sample dialogs (PS-SAMPLE-DIALOG, DR-15 reserved column; context = the preview `DialogContent` `[data-dispatch-tour-preview="true"]`).

| # | Step id (was) | Preset | Anchor | Surface | Acceptance |
| --- | --- | --- | --- | --- | --- |
| 1 | `overview` | PS-SAMPLE | `[data-dispatch-tour="overview"]` | page card | Rail does not paint over the card at 1440 |
| 2 | `quality` | PS-SAMPLE-DIALOG | `[data-dispatch-tour="quality"]` | draft dialog | Panel beside the dialog |
| 3 | `parties` (content "customer") | PS-SAMPLE-DIALOG | `[data-dispatch-tour="parties"]` | draft dialog | |
| 4 | `lots` | PS-SAMPLE-DIALOG | `[data-dispatch-tour="lots"]` | draft dialog | 60 + 40 = 100 m; ₹4,000 |
| 5 | `saveDraft` (content "draft") | PS-SAMPLE-DIALOG | `[data-dispatch-tour="saveDraft"]` | draft dialog | |
| 6 | `confirm` | PS-SAMPLE-DIALOG | `[data-dispatch-tour="confirm"]` | confirm dialog | Copy says fabric only (DP-1) |
| 7 | `receipt` | PS-SAMPLE-DIALOG | `[data-dispatch-tour="receipt"]` | receipt dialog; the replica shows "Received as sent" as a separate button above the dialog form, matching the live toolbar | 98 of 100 m |
| 8 | `difference` | PS-SAMPLE | `[data-dispatch-tour="difference"]` | detail card | ₹3,920 |
| 9 | `payment` | PS-SAMPLE-DIALOG | `[data-dispatch-tour="payment"]` | payment dialog | ₹2,000 paid, ₹1,920 due |
| 10 | `handoff` *(new; replaces `balance` and `finish`)* | PS-HANDOFF | `[data-tour-anchor="dispatch.new"]` *(proposed on both "New dispatch" buttons, `ChallansClient.tsx:288-294`)* | live page | Done focuses the visible New dispatch |

`dispatchTourExample` loses `yarnKgPer100` and `yarnDeduction` (DP-1); the test at `__tests__/dispatch-tour.test.ts:53` changes accordingly.

## F. Copy

Step id → copy key: same name, except `parties` → `customer` and `saveDraft` → `draft`.

Keys in `lib/i18n/dispatch-tutorial.ts` (rewritten; `dispatchTourHelp` and all help-topic copy removed).

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `overview.title` | One record for goods, receipt and money | માલ, પ્રાપ્તિ અને પૈસા માટે એક રેકોર્ડ | माल, प्राप्ति और पैसे के लिए एक रिकॉर्ड |
| `overview.body` | Each dispatch follows fabric from your stock to the customer, then what they accept and what they pay. | દરેક ડિસ્પેચ કાપડને તમારા સ્ટોકથી ગ્રાહક સુધી, પછી તે શું સ્વીકારે અને શું ચૂકવે તે સુધી નોંધે છે. | हर डिस्पैच कपड़े को आपके स्टॉक से ग्राहक तक, फिर वह क्या स्वीकारता है और क्या चुकाता है, तक दर्ज करता है। |
| `quality.title` | Choose a quality that has stock | સ્ટોક હોય તે ક્વોલિટી પસંદ કરો | जिस क्वालिटी का स्टॉक हो, उसे चुनें |
| `quality.body` | The list shows how many metres of each quality are in stock. Metres come from shifts saved on the Daily Sheet or opening stock. | યાદીમાં દરેક ક્વોલિટીના સ્ટોકમાં કેટલા મીટર છે તે દેખાય છે. મીટર દૈનિક શીટમાં સાચવેલી શિફ્ટ કે શરૂઆતના સ્ટોકમાંથી આવે છે. | सूची में हर क्वालिटी के स्टॉक के मीटर दिखते हैं। मीटर दैनिक शीट में सेव शिफ्ट या शुरुआती स्टॉक से आते हैं। |
| `customer.title` | Customer, address and agreed price | ગ્રાહક, સરનામું અને નક્કી થયેલો ભાવ | ग्राहक, पता और तय भाव |
| `customer.body` | Enter the customer and delivery details and the price per metre you agreed. You type these for each dispatch. | ગ્રાહક અને ડિલિવરીની વિગતો અને નક્કી થયેલો મીટરદીઠ ભાવ લખો. દરેક ડિસ્પેચમાં આ લખવાનું રહે છે. | ग्राहक और डिलीवरी का विवरण और तय प्रति मीटर भाव लिखें। हर डिस्पैच में ये लिखने होते हैं। |
| `lots.title` | List each lot or taka | દરેક લોટ કે તાકો લખો | हर लॉट या ताका लिखें |
| `lots.body` | Add one line per lot with its metres. Here 60 m + 40 m = 100 m, worth ₹4,000 at ₹40/m. | દરેક લોટ માટે તેના મીટર સાથે એક લાઇન ઉમેરો. અહીં 60 + 40 = 100 મીટર, ₹40/મીટરે ₹4,000 થાય. | हर लॉट के लिए उसके मीटर के साथ एक लाइन जोड़ें। यहाँ 60 + 40 = 100 मीटर, ₹40/मीटर पर ₹4,000 होता है। |
| `draft.title` | Save a draft first | પહેલાં ડ્રાફ્ટ સાચવો | पहले ड्राफ्ट सेव करें |
| `draft.body` | {c:saveDraft} keeps the challan without touching stock, so you can check it before the goods leave. | {c:saveDraft} સ્ટોકને અડ્યા વગર ચલણ રાખે છે, જેથી માલ નીકળે તે પહેલાં તપાસી શકો. | {c:saveDraft} स्टॉक को छुए बिना चालान रखता है, ताकि माल निकलने से पहले जाँच सकें। |
| `confirm.title` | Confirm when the goods leave | માલ નીકળે ત્યારે ખાતરી કરો | माल निकले तब पुष्टि करें |
| `confirm.body` | {c:confirmLeft} locks the challan and takes 100 m out of fabric stock. Yarn was already counted when the fabric was produced. | {c:confirmLeft} ચલણ લૉક કરે છે અને કાપડના સ્ટોકમાંથી 100 મીટર ઘટાડે છે. યાર્ન તો કાપડ બન્યું ત્યારે જ ગણાઈ ગયું હતું. | {c:confirmLeft} चालान लॉक करता है और कपड़े के स्टॉक से 100 मीटर घटाता है। धागा तो कपड़ा बनते समय ही गिना जा चुका है। |
| `confirm.detail` | {c:print} opens the challan to print or save as PDF. A dispatch confirmed by mistake can be reversed while no money is recorded against it. | {c:print} ચલણને છાપવા કે PDF તરીકે સાચવવા ખોલે છે. ભૂલથી ખાતરી કરેલો ડિસ્પેચ, તેની સામે પૈસા ન નોંધાયા હોય ત્યાં સુધી ઉલટાવી શકાય. | {c:print} चालान को छापने या PDF सेव करने के लिए खोलता है। गलती से पुष्टि किया डिस्पैच, जब तक उस पर पैसा दर्ज न हो, वापस किया जा सकता है। |
| `receipt.title` | Record what the customer accepted | ગ્રાહકે શું સ્વીકાર્યું તે નોંધો | ग्राहक ने क्या स्वीकारा, यह दर्ज करें |
| `receipt.body` | If everything arrived, use {c:receivedAsSent}. Otherwise record the metres accepted, here 98 of 100 m. | બધું પહોંચ્યું હોય તો {c:receivedAsSent} વાપરો. નહીં તો સ્વીકારેલા મીટર નોંધો, અહીં 100 માંથી 98. | सब पहुँचा हो तो {c:receivedAsSent} इस्तेमाल करें। नहीं तो स्वीकारे गए मीटर दर्ज करें, यहाँ 100 में से 98। |
| `difference.title` | A shortfall changes the bill, not stock | ઘટ બિલ બદલે છે, સ્ટોક નહીં | कमी बिल बदलती है, स्टॉक नहीं |
| `difference.body` | The 2 m not accepted do not return to stock. The amount due becomes ₹3,920. | સ્વીકાર ન થયેલા 2 મીટર સ્ટોકમાં પાછા નથી આવતા. લેવાની રકમ ₹3,920 થાય છે. | स्वीकार न हुए 2 मीटर स्टॉक में वापस नहीं आते। लेने की रकम ₹3,920 हो जाती है। |
| `payment.title` | Record money when you receive it | પૈસા મળે ત્યારે નોંધો | पैसा मिले तब दर्ज करें |
| `payment.body` | {c:recordPayment} adds a payment. Here ₹2,000 received leaves ₹1,920 due. | {c:recordPayment} ચુકવણી ઉમેરે છે. અહીં ₹2,000 મળતાં ₹1,920 બાકી રહે છે. | {c:recordPayment} भुगतान जोड़ता है। यहाँ ₹2,000 मिलने पर ₹1,920 बाकी रहता है। |
| `payment.detail` | Charges, credits, refunds and a changed due date each have their own button on the dispatch. A wrong payment is corrected with {c:reverseEntry}. | ચાર્જ, ક્રેડિટ, રિફંડ અને બદલાયેલી છેલ્લી તારીખ માટે ડિસ્પેચ પર અલગ બટન છે. ખોટી ચુકવણી {c:reverseEntry}થી સુધરે છે. | शुल्क, क्रेडिट, रिफंड और बदली अंतिम तिथि के लिए डिस्पैच पर अलग बटन हैं। गलत भुगतान {c:reverseEntry} से सुधरता है। |
| `handoff.title` | Start a dispatch when goods are ready | માલ તૈયાર હોય ત્યારે ડિસ્પેચ શરૂ કરો | माल तैयार हो तब डिस्पैच शुरू करें |
| `handoff.body` | Choose {c:newDispatch} to fill a draft. Open a dispatch in the list to record its receipt or payment. | ડ્રાફ્ટ ભરવા {c:newDispatch} પસંદ કરો. પ્રાપ્તિ કે ચુકવણી નોંધવા યાદીમાંથી ડિસ્પેચ ખોલો. | ड्राफ्ट भरने के लिए {c:newDispatch} चुनें। प्राप्ति या भुगतान दर्ज करने के लिए सूची से डिस्पैच खोलें। |
| `guide.benefit` | Learn to send fabric, record what arrived and track payment. | કાપડ મોકલવું, શું પહોંચ્યું તે નોંધવું અને ચુકવણી તપાસવી શીખો. | कपड़ा भेजना, क्या पहुँचा यह दर्ज करना और भुगतान देखना सीखें। |

### Control tokens

Resolve each from `ChallansClient.tsx` / `ChallanDraftEditor.tsx` at its render site. The root is `data-i18n-skip`, so the displayed label is exactly the resolver's value.

| Token | Expected source | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- |
| `saveDraft` | `challan.*` key used by the Save draft button | ડ્રાફ્ટ સાચવો | ड्राफ्ट सेव करें | Use the existing key (Hindi value "ड्राफ्ट सहेजें" stays if that is the key's value) |
| `confirmLeft` | key used by "Confirm dispatch has left" | ડિસ્પેચ નીકળ્યાની ખાતરી કરો | डिस्पैच निकलने की पुष्टि करें | Use key; if a literal, add key |
| `print` | "Preview / Print / Save PDF" link (~550-567) | જુઓ / છાપો / PDF સાચવો | देखें / छापें / PDF सेव करें | Use key; if a literal, add key |
| `receivedAsSent` | toolbar button (~716-727) | મોકલ્યા મુજબ મળ્યું | भेजे अनुसार मिला | Use key; if a literal, add key |
| `recordPayment` | toolbar button | ચુકવણી નોંધો | भुगतान दर्ज करें | Use key |
| `reverseEntry` | history row button | નોંધ ઉલટાવો | प्रविष्टि वापस लें | Use key |
| `newDispatch` | `challan.new` | નવો ડિસ્પેચ | नया डिस्पैच | none |

Hard-coded English in the detail panel ("Metres Breakdown", "Financial Summary", "Payment Terms", "Lot Breakdown", "Rs") is not named by the tour and stays out of scope (PI-13).

## G. State variants

| Variant | Behavior |
| --- | --- |
| No qualities with stock | Replica unchanged; `quality.body` already names where stock comes from. Handoff still points at New dispatch (the live button exists; the draft form explains the empty list). |
| Dispatches exist | Same tour. |
| A live draft or operation dialog is open | Launcher sits under the modal; tour cannot start until it is closed. |
| A pending retry exists (New dispatch disabled) | Handoff anchor is visible but disabled; Done focuses the launcher instead (§5.4). |
| Replay | Compact launcher. |

## H. Comprehension check

"You loaded 100 metres of 60g georgette on a tempo this morning. What do you do in Weavly before it leaves, and what do you do when the buyer says only 98 metres were fine?" Expected: New dispatch → quality, customer, price, lots → Save draft → Confirm dispatch has left (fabric stock drops by 100 m); later Record receipt of 98 m (bill becomes 98 × rate; stock unchanged).

## P13 Print view: no tour

`/owner/dispatches/[id]/print` is a single-purpose print page with one control ("Print / Save as PDF") opened in a new tab from a dispatch. A tour would repeat the button's label. It is covered by `confirm.detail`.

## I. Implementation notes for GT-07

- Introduce the replica handoff (EC-18) generically enough for GT-08..GT-12 to reuse: the wrapper computes `isHandoff(step)`; the preview renders nothing on the handoff step.
- Delete the help-topic UI in `DispatchTutorial` and `dispatchTourHelp`; update `dispatch-tutorial-panel.test.tsx` deliberately.
- Harness scenario `dispatch` at the four viewports, plus one with `REDUCED_MOTION=1`.
