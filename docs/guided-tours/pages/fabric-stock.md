# P09 Fabric Stock — tour specification

Status: implemented and PASSED (2026-09-30; human verification deferred by the owner). Implementation: **GT-08**. Gujarati/Hindi: native review pending, not done.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/stock-and-dispatch.md`](../audit/stock-and-dispatch.md) §1.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/stock` → `QualityStockClient.tsx` inside `StockGuidedTour kind="fabric-stock"` |
| Entitlement | `production` (Base). Owner role. |
| Tour today | `components/stock/StockGuidedTour.tsx` (hides the live page), `FabricStockTourPreview.tsx`, `components/tours/StockTutorial.tsx`, steps `fabricStockTourSteps` in `lib/stock-tour.ts`, copy `lib/i18n/stock-tutorial.ts`, numbers `fabricStockExample`. |
| Also wrapped (wrongly) | `/owner/stock/audit` renders the same Fabric tour (`app/(dashboard)/owner/stock/audit/page.tsx:16-19`). Removed by GT-08 (D-11). |
| Live controls | Header: "Audit Inventory" link (hard-coded, ~129), Refresh, Opening stock (~138); quality cards: Opening stock / Correct balance / Movement history (~224-255). Labels through `t('qualityStock.*')` (root is `data-i18n-skip`). |
| Rule | Saved production adds metres; confirming a dispatch removes them; opening stock is added once; a correction sets the counted total. Every count uses Correct balance; the Stock audit was deleted on 2026-10-14. |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| FS-1 | Major | Tour | Step `tracking` tells the owner to read "Stock started" on the page; the page never shows it (PI-09). | CODE-VERIFIED `stock-tutorial.ts:16-19`; no `cutover` in `QualityStockClient.tsx` |
| FS-2 | Major | Tour | `openingPending` sends owners to "Dispatch → Earlier dispatch records → Pending Dispatches", a retired screen (pinned by `stock-tour.test.tsx:59`). | CODE-VERIFIED `stock-tutorial.ts:22` |
| FS-3 | Major | Tour | The audit page runs this tour, which teaches a different page and records Fabric completion there. | CODE-VERIFIED `audit/page.tsx:16-19` |
| FS-4 | Major | Tour | Live page hidden, no handoff; replica not in the workspace width (rail paints over it at ≥1440). | CODE-VERIFIED `StockGuidedTour.tsx:37`; OBSERVED (harness) |
| FS-5 | Minor | Tour | Panel covers the target at 1024px (step 3). | OBSERVED (harness) `fabric-stock-en-1024x768` s3 |
| FS-6 | Major | Product | Movement kinds `audit_adjustment` / `production_reversal` show raw keys (PI-08). | CODE-VERIFIED |

## C. Learning outcomes and coverage

After the tour the owner can: (1) read fabric balance per quality and where it comes from; (2) record fabric they had before Weavly, once; (3) correct the balance after a physical count by entering the counted total; (4) trace any change in movement history; (5) know where a full audit lives.

| Requirement | Destination |
| --- | --- |
| Balance = production − dispatch (+ opening, ± corrections) | `fs-balance` |
| Quality with no opening stock ("Pending") | `fs-pending` |
| Opening stock is added once, with a reason | `fs-opening` |
| Correction = counted total, not the difference | `fs-correct` |
| Correct balance is for regular counts; a full dated audit kept as a record is "Audit Inventory" (D-20) | `fs-correct` detail |
| Trace changes; balance after each movement | `fs-history` |
| Refresh after another device saves | `fs-history` detail |
| Next action | `fs-handoff` |

## D. Structure

Six steps. The sample quality starts with production and a dispatch but no opening stock, then gains opening stock, then a correction, so each number follows from the one before. Replica steps as today; the replica renders inside `stock-workspace-shell` and disappears on the handoff (EC-18). The `tracking` step and its replica card are removed.

Sample numbers (`fabricStockExample`, changed): production 200 m, dispatch 100 m, opening 500 m, counted 590 m. Remove `preStartPhysical` and `historicalCommitted`. Balance shown by step: `fs-balance`, `fs-pending`, `fs-opening` 100 m (before saving opening); `fs-correct` 600 m; `fs-history` 590 m.

## E. Steps

| # | Step id | Preset | Anchor | Surface |
| --- | --- | --- | --- | --- |
| 1 | `fs-balance` (was `balance`) | PS-SAMPLE | `[data-stock-tour="balance"]` | page |
| 2 | `fs-pending` (was `openingPending`) | PS-SAMPLE | `[data-stock-tour="openingPending"]` | page |
| 3 | `fs-opening` (was `opening`) | PS-SAMPLE-DIALOG | `[data-stock-tour="opening"]` / `[data-stock-tour-preview="true"]` | opening dialog |
| 4 | `fs-correct` (was `correction` + `counted`) | PS-SAMPLE-DIALOG | `[data-stock-tour="correction"]` / same | correction dialog |
| 5 | `fs-history` (was `finish`) | PS-SAMPLE | `[data-stock-tour="history"]` *(renamed anchor in the preview)* | page, history list |
| 6 | `fs-handoff` | PS-HANDOFF | `[data-tour-anchor="fabric.opening"]` *(proposed on the header "Opening stock" button, `QualityStockClient.tsx` ~138)* | live page |

Acceptance for all: panel never overlaps the outline at 1024/1280/1440 (fixes FS-5); no rail over the replica at 1440 (FS-4).

## F. Copy

Keys in `lib/i18n/stock-tutorial.ts` (fabric section rewritten; `fabricStockTutorialHelp` removed; preview labels from `t('qualityStock.*')`).

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `balance.title` | Fabric ready to send, by quality | મોકલવા તૈયાર કાપડ, ક્વોલિટી પ્રમાણે | भेजने को तैयार कपड़ा, क्वालिटी के अनुसार |
| `balance.body` | Saved shifts add metres and confirmed dispatches remove them. Here 200 m made − 100 m sent = 100 m. | સાચવેલી શિફ્ટ મીટર ઉમેરે છે અને ખાતરી કરેલા ડિસ્પેચ ઘટાડે છે. અહીં 200 મીટર બન્યું − 100 મીટર ગયું = 100 મીટર. | सेव शिफ्ट मीटर जोड़ती हैं और पुष्टि किए डिस्पैच घटाते हैं। यहाँ 200 मीटर बना − 100 मीटर गया = 100 मीटर। |
| `pending.title` | Add the fabric you had before Weavly | Weavly પહેલાંનું કાપડ ઉમેરો | Weavly से पहले का कपड़ा जोड़ें |
| `pending.body` | A quality marked {c:pending} has no opening stock yet. Count the finished fabric you already had and record it once. | {c:pending} લખેલી ક્વોલિટીનો શરૂઆતનો સ્ટોક હજી નોંધાયો નથી. તમારી પાસે પહેલેથી હતું તે તૈયાર કાપડ ગણી એક વાર નોંધો. | {c:pending} लिखी क्वालिटी का शुरुआती स्टॉक अभी दर्ज नहीं है। आपके पास पहले से पड़ा तैयार कपड़ा गिनकर एक बार दर्ज करें। |
| `opening.title` | Opening stock is added once | શરૂઆતનો સ્ટોક એક જ વાર ઉમેરાય છે | शुरुआती स्टॉक एक ही बार जुड़ता है |
| `opening.body` | {c:openingStock} adds the counted metres to what production already recorded: 100 + 500 = 600 m. Add a note such as your count date. | {c:openingStock} ગણેલા મીટર ઉત્પાદનમાં નોંધાયેલા મીટરમાં ઉમેરે છે: 100 + 500 = 600 મીટર. ગણતરીની તારીખ જેવી નોંધ લખો. | {c:openingStock} गिने हुए मीटर उत्पादन में दर्ज मीटर में जोड़ता है: 100 + 500 = 600 मीटर। गिनती की तारीख जैसा नोट लिखें। |
| `correct.title` | After a count, enter the counted total | ગણતરી પછી ગણેલો કુલ જથ્થો લખો | गिनती के बाद गिना हुआ कुल लिखें |
| `correct.body` | {c:correctBalance} replaces the balance with what you counted. Enter 590, not −10; Weavly records the −10 m difference. | {c:correctBalance} બેલેન્સને ગણેલા જથ્થાથી બદલે છે. 590 લખો, −10 નહીં; Weavly −10 મીટરનો ફરક નોંધે છે. | {c:correctBalance} बैलेंस को गिनी हुई मात्रा से बदलता है। 590 लिखें, −10 नहीं; Weavly −10 मीटर का फ़र्क दर्ज करता है। |
| `correct.detail` | Use this for every count. Weavly keeps the difference in the stock history. | દરેક ગણતરી માટે આ જ વાપરો. Weavly ફરક સ્ટોકના ઇતિહાસમાં રાખે છે. | हर गिनती के लिए यही इस्तेमाल करें। Weavly फ़र्क स्टॉक के इतिहास में रखता है। |
| `history.title` | Trace every change | દરેક ફેરફાર તપાસો | हर बदलाव देखें |
| `history.body` | {c:movementHistory} lists each production, dispatch, opening and correction with the balance after it. | {c:movementHistory}માં દરેક ઉત્પાદન, ડિસ્પેચ, શરૂઆતનો સ્ટોક અને સુધારો, પછીના બેલેન્સ સાથે દેખાય છે. | {c:movementHistory} में हर उत्पादन, डिस्पैच, शुरुआती स्टॉक और सुधार, उसके बाद के बैलेंस के साथ दिखता है। |
| `history.detail` | If a shift was saved on another device, choose {c:refresh} to see it. | બીજા ઉપકરણ પર શિફ્ટ સાચવી હોય તો જોવા {c:refresh} પસંદ કરો. | किसी दूसरे डिवाइस पर शिफ्ट सेव हुई हो तो देखने के लिए {c:refresh} चुनें। |
| `handoff.title` | Record fabric you already have | તમારી પાસેનું કાપડ નોંધો | आपके पास पड़ा कपड़ा दर्ज करें |
| `handoff.body` | If you had finished fabric before using Weavly, record it here once. From now on, saved shifts add stock by themselves. | Weavly વાપરતાં પહેલાં તૈયાર કાપડ હતું તો તેને અહીં એક વાર નોંધો. હવેથી સાચવેલી શિફ્ટ જાતે સ્ટોક ઉમેરશે. | Weavly इस्तेमाल करने से पहले तैयार कपड़ा था तो उसे यहाँ एक बार दर्ज करें। अब से सेव शिफ्ट खुद स्टॉक जोड़ेंगी। |
| `guide.benefit` | Learn to record opening fabric, correct a count and trace changes. | શરૂઆતનું કાપડ નોંધવું, ગણતરી સુધારવી અને ફેરફાર તપાસવા શીખો. | शुरुआती कपड़ा दर्ज करना, गिनती सुधारना और बदलाव देखना सीखें। |

### Control tokens

| Token | Resolver (verify at render site) | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- |
| `pending` | `t('qualityStock.pending')` or the badge's key | બાકી | बाकी | Badge text is hard-coded "Pending" (~212): replace with a key |
| `openingStock` | `t('qualityStock.opening')` | existing value | existing value | none |
| `correctBalance` | `t('qualityStock.correct')` | સ્ટોક સુધારો | स्टॉक सुधारें | none |
| `movementHistory` | `t('qualityStock.history')` | existing value | existing value | none |
| `refresh` | `t('qualityStock.refresh')` | રિફ્રેશ કરો | रीफ़्रेश करें | none |

## G. State variants

| Variant | Behavior |
| --- | --- |
| No production yet (empty board) | Replica unchanged (it teaches with the sample). Handoff anchor is the header Opening stock, present on an empty page. |
| All qualities already have opening stock | Same tour; `handoff.body` still correct. |
| Opening/correction form open, uncertain save pending | Launcher under the modal; cannot start. |
| Audit page | No tour (removed); covered by `correct.detail`. |
| Replay | Compact launcher. |

## H. Comprehension check

"You counted 590 metres of your Rapier satin in the godown, but Weavly shows 600. What do you enter, and where?" Expected: Correct balance on that quality, enter 590 (not −10).
