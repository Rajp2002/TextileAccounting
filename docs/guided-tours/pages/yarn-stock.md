# P10 Yarn Stock — tour specification

Status: specified, not implemented. Implementation: **GT-09**. Gujarati/Hindi: native review pending.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/stock-and-dispatch.md`](../audit/stock-and-dispatch.md) §2.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/stock/yarn` → `YarnStockClient.tsx` inside `StockGuidedTour kind="yarn-stock"` |
| Entitlement | `production` (Base). Owner role. |
| Tour today | Same wrapper and tutorial as Fabric Stock; `YarnStockTourPreview.tsx`; steps `yarnStockTourSteps`; copy in `lib/i18n/stock-tutorial.ts`; numbers `yarnStockExample`. |
| Live controls | Header: "Audit Inventory" link (hard-coded, ~107), Refresh, Opening weight, Add yarn; yarn cards: Add yarn, Correct balance, Movement history; "Yarn used by each fabric" with Link costing; audit date + CSV. Labels from `yarnStockText[language]` (`lib/i18n/yarn-stock.ts`; complete in en/gu/hi). |
| Rules | Saving production deducts yarn at the linked kg per 100 m; dispatch does not deduct yarn (`20260920000000…sql:446`; **owner confirmed for production, 2026-09-27**). Yarn woven into fabric that is still in stock is **still yarn the owner owns**: the Stock audit adds it back from each quality's kg per 100 m (Loose yarn + Yarn in fabric = Total), and the Yarn Stock page itself shows loose yarn only (`InventoryAuditClient.tsx:298-325, 375-379`; owner rule D-19, 2026-09-27). Routine weighing uses Correct balance; the Stock audit is the full dated record (owner rule D-20, 2026-09-27). |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| YS-1 | Major | Tour | The invitation promises to "audit dispatch deductions" (retired rule; contradicts this tour's own body). | CODE-VERIFIED `lib/i18n/tour-invitations.ts:27` (+ gu 62, hi 97) |
| YS-2 | Major | Tour | Live page hidden, no handoff; rail over the replica at ≥1440. | CODE-VERIFIED; OBSERVED (harness) |
| YS-3 | Major | Tour | Panel covers step 2's target at 1024 and 1280 (Hindi). | OBSERVED (harness) `yarn-stock-hi-1280x800` s2, `-en-1024x768` s2 |
| YS-4 | Minor | Tour | Replica order and cards differ from the live page (no Audit Inventory, Refresh or header buttons; audit date placed last); the `yarn` step's "120 − 20 = 100" asks owners to reason about yarn in undispatched fabric. | CODE-VERIFIED audit §2.3 |
| YS-5 | Minor | Tour | Terms: ભરણ vs વાણો, યાર્ન vs સૂત; "Audit Inventory" English in both languages. | CODE-VERIFIED audit §2.6 |

## C. Learning outcomes and coverage

After the tour the owner can: (1) read unused yarn per yarn in kg; (2) record opening weight once; (3) add each delivery; (4) link each fabric quality to its costing so production can deduct yarn; (5) know production deducts yarn and dispatch does not; (6) correct after weighing; (7) know where history, dated view and CSV are.

| Requirement | Destination |
| --- | --- |
| Loose yarn per yarn on this page; yarn inside unsold fabric still counts as owned and is added back in the Stock audit (D-19) | `ys-balance` (+ detail), `ys-usage` (+ detail) |
| Opening weight, once | `ys-opening` |
| Deliveries: Add yarn | `ys-receipt` |
| Link costing: kg per 100 m (6 + 4 = 10) | `ys-link` |
| Production deducts yarn (200 m × 10 ÷ 100 = 20 kg); dispatch does not | `ys-usage` |
| Correction = weighed total; Correct balance for regular weighing, "Audit Inventory" for a full dated audit kept as a record (D-20) | `ys-correct` (+ detail) |
| Movement history, dated view, CSV | `ys-correct` detail |
| Next action | `ys-handoff` |

## D. Structure

Seven steps following a delivery through to production. `yarn` and `finish` are removed; `movement` becomes `ys-usage`. Replica inside `stock-workspace-shell`; handoff unhides the live page (EC-18). Replica section order is changed to match the live page (header actions, balance, yarn cards, "Yarn used by each fabric", history).

Numbers (`yarnStockExample`): opening 100 kg, receipt 20 kg, warp 6 + weft 4 = 10 kg per 100 m, 200 m produced → 20 kg used, balance 100 kg, counted 98 kg. Remove `unused`/`embodied`/`undispatchedMetres` from the core copy (kept only if the balance card still displays them).

## E. Steps

| # | Step id | Preset | Anchor | Surface |
| --- | --- | --- | --- | --- |
| 1 | `ys-balance` (was `balance`) | PS-SAMPLE | `[data-stock-tour="balance"]` | page |
| 2 | `ys-opening` (was `opening`) | PS-SAMPLE-DIALOG | `[data-stock-tour="opening"]` / `[data-stock-tour-preview="true"]` | opening dialog |
| 3 | `ys-receipt` (was `receipt`) | PS-SAMPLE-DIALOG | `[data-stock-tour="receipt"]` / same | receipt dialog |
| 4 | `ys-link` (was `link`) | PS-SAMPLE-DIALOG | `[data-stock-tour="link"]` / same | link dialog |
| 5 | `ys-usage` (was `movement`) | PS-SAMPLE | `[data-stock-tour="movement"]` | page, history row "Production −20 kg" |
| 6 | `ys-correct` (was `correction`) | PS-SAMPLE-DIALOG | `[data-stock-tour="correction"]` / same | correction dialog |
| 7 | `ys-handoff` | PS-HANDOFF | `[data-tour-anchor="yarn.opening"]` *(proposed on the header "Opening weight" button)* | live page |

## F. Copy

Keys in `lib/i18n/stock-tutorial.ts` (yarn section rewritten; `yarnStockTutorialHelp` removed). Invitation benefit fixed in `lib/i18n/tour-invitations.ts` (YS-1).

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `balance.title` | Unused yarn, by yarn | વણવપરાયેલું યાર્ન, યાર્ન પ્રમાણે | बिना इस्तेमाल धागा, धागे के अनुसार |
| `balance.body` | This is yarn on hand that has not been woven yet, in kg. Here 100 kg. | આ હાથ પરનું હજી વણાયું ન હોય તેવું યાર્ન છે, કિલોમાં. અહીં 100 કિલો. | यह हाथ में पड़ा, अभी न बुना गया धागा है, किलो में। यहाँ 100 किलो। |
| `balance.detail` | Yarn already woven into fabric that is still in your stock is not lost. {c:auditInventory} adds it back from each quality's kg per 100 m, so you see all the yarn you own. | સ્ટોકમાં પડેલા કાપડમાં વણાઈ ગયેલું યાર્ન ખોવાતું નથી. {c:auditInventory} દરેક ક્વોલિટીના 100 મીટરે કિલો પ્રમાણે તે પાછું ઉમેરે છે, જેથી તમારી પાસેનું બધું યાર્ન દેખાય. | स्टॉक में पड़े कपड़े में बुना जा चुका धागा खोता नहीं। {c:auditInventory} हर क्वालिटी के 100 मीटर पर किलो के हिसाब से उसे वापस जोड़ता है, ताकि आपके पास का सारा धागा दिखे। |
| `opening.title` | Record the yarn you already have | તમારી પાસેનું યાર્ન નોંધો | आपके पास पड़ा धागा दर्ज करें |
| `opening.body` | {c:openingWeight} records each yarn's weight once, when you start: here 100 kg. | {c:openingWeight} શરૂઆતમાં દરેક યાર્નનું વજન એક વાર નોંધે છે: અહીં 100 કિલો. | {c:openingWeight} शुरुआत में हर धागे का वज़न एक बार दर्ज करता है: यहाँ 100 किलो। |
| `receipt.title` | Add each new delivery | દરેક નવી આવક ઉમેરો | हर नई आवक जोड़ें |
| `receipt.body` | {c:addYarn} adds a delivery to that yarn: 100 + 20 = 120 kg. | {c:addYarn} તે યાર્નમાં આવક ઉમેરે છે: 100 + 20 = 120 કિલો. | {c:addYarn} उस धागे में आवक जोड़ता है: 100 + 20 = 120 किलो। |
| `link.title` | Link each fabric to its costing | દરેક કાપડને તેની કોસ્ટિંગ સાથે જોડો | हर कपड़े को उसकी कॉस्टिंग से जोड़ें |
| `link.body` | {c:linkCosting} copies the kg of each yarn per 100 m from a saved costing. Here warp 6 + weft 4 = 10 kg per 100 m. | {c:linkCosting} સાચવેલી કોસ્ટિંગમાંથી 100 મીટરે દરેક યાર્નના કિલો લે છે. અહીં તાણા 6 + ભરણ 4 = 100 મીટરે 10 કિલો. | {c:linkCosting} सेव कॉस्टिंग से 100 मीटर पर हर धागे के किलो लेता है। यहाँ ताना 6 + बाना 4 = 100 मीटर पर 10 किलो। |
| `usage.title` | Saving production uses yarn | ઉત્પાદન સાચવવાથી યાર્ન વપરાય છે | उत्पादन सेव करने से धागा लगता है |
| `usage.body` | When a shift of 200 m is saved, 20 kg is deducted (200 × 10 ÷ 100). Dispatch does not deduct yarn again. | 200 મીટરની શિફ્ટ સાચવતાં 20 કિલો ઘટે છે (200 × 10 ÷ 100). ડિસ્પેચ ફરી યાર્ન ઘટાડતું નથી. | 200 मीटर की शिफ्ट सेव होने पर 20 किलो घटता है (200 × 10 ÷ 100)। डिस्पैच दोबारा धागा नहीं घटाता। |
| `usage.detail` | Those 20 kg now sit inside the 200 m of fabric until it is dispatched; the Stock audit still counts them as your yarn. | એ 20 કિલો ડિસ્પેચ થાય ત્યાં સુધી 200 મીટર કાપડમાં રહે છે; સ્ટોક ઓડિટ તેને હજી તમારું યાર્ન ગણે છે. | वे 20 किलो डिस्पैच होने तक 200 मीटर कपड़े में रहते हैं; स्टॉक ऑडिट उन्हें अब भी आपका धागा गिनता है। |
| `correct.title` | After weighing, enter the weighed total | વજન કર્યા પછી કુલ વજન લખો | तौलने के बाद कुल वज़न लिखें |
| `correct.body` | {c:correctBalance} replaces the balance with what you weighed. Enter 98, not −2. | {c:correctBalance} બેલેન્સને તમે તોલેલા વજનથી બદલે છે. 98 લખો, −2 નહીં. | {c:correctBalance} बैलेंस को आपके तौले वज़न से बदलता है। 98 लिखें, −2 नहीं। |
| `correct.detail` | {c:movementHistory} shows every change. Pick a date to see balances on that day and export them. Use {c:correctBalance} for regular weighing; for a full dated audit of fabric and yarn, kept as a record, use {c:auditInventory}. | {c:movementHistory}માં દરેક ફેરફાર દેખાય છે. તારીખ પસંદ કરી તે દિવસનું બેલેન્સ જોઈ એક્સપોર્ટ કરી શકો. નિયમિત વજન માટે {c:correctBalance} વાપરો; કાપડ અને યાર્નનું તારીખ સાથેનું પૂરું ઓડિટ રેકોર્ડ તરીકે રાખવા {c:auditInventory} વાપરો. | {c:movementHistory} में हर बदलाव दिखता है। तारीख चुनकर उस दिन का बैलेंस देख और एक्सपोर्ट कर सकते हैं। नियमित तौल के लिए {c:correctBalance} इस्तेमाल करें; कपड़े और धागे का तारीख के साथ पूरा ऑडिट रिकॉर्ड के रूप में रखने के लिए {c:auditInventory} इस्तेमाल करें। |
| `handoff.title` | Record the yarn in your godown | ગોડાઉનનું યાર્ન નોંધો | गोदाम का धागा दर्ज करें |
| `handoff.body` | Start with each yarn's opening weight, then link your fabric costings so production can deduct yarn. | દરેક યાર્નના શરૂઆતના વજનથી શરૂ કરો, પછી કાપડની કોસ્ટિંગ જોડો જેથી ઉત્પાદન યાર્ન ઘટાડી શકે. | हर धागे के शुरुआती वज़न से शुरू करें, फिर कपड़े की कॉस्टिंग जोड़ें ताकि उत्पादन धागा घटा सके। |
| `guide.benefit` | Learn to record yarn, link it to costings and follow what production uses. | યાર્ન નોંધવું, કોસ્ટિંગ સાથે જોડવું અને ઉત્પાદનમાં વપરાશ જોવો શીખો. | धागा दर्ज करना, कॉस्टिंग से जोड़ना और उत्पादन में खपत देखना सीखें। |

### Control tokens

| Token | Resolver (verify) | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- |
| `openingWeight` | `yarnStockText[language].<opening key>` | existing | existing | none |
| `addYarn` | `yarnStockText[language].<add key>` | existing | existing | none |
| `linkCosting` | `yarnStockText[language].<link key>` | existing | existing | none |
| `correctBalance` | `yarnStockText[language].<correct key>` | existing ("બેલેન્સ સુધારો") | existing ("शेष सुधारें") | none |
| `movementHistory` | `yarnStockText[language].<history key>` | existing | existing | none |
| `auditInventory` | `t('qualityStock.audit')` (added in GT-08) | સ્ટોક ઓડિટ | स्टॉक ऑडिट | Use the GT-08 key in the Yarn header button too |

## G. State variants

| Variant | Behavior |
| --- | --- |
| No yarns / no costings linked | Replica unchanged; handoff anchor (Opening weight) exists on an empty page. |
| Uncertain save pending (editing locked) | Launcher under the modal/lock; if the header button is disabled, Done focuses the launcher. |
| Replay | Compact launcher. |

## H. Comprehension check

"You received 20 kg of warp yarn today and wove 200 metres of a quality linked at 10 kg per 100 m. What do you enter, and what happens to the yarn balance when you save the shift?" Expected: Add yarn +20 kg on that yarn; saving the shift deducts 20 kg automatically; nothing more at dispatch.
