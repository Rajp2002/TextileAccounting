# P05 Daily Sheet — tour specification (new tour)

Status: specified, not implemented. Implementation: **GT-12**. Gujarati/Hindi: native review pending.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md) (D-10). Evidence: [`audit/production-assignments-machines-workers.md`](../audit/production-assignments-machines-workers.md) §1.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/production/daily-sheet` (sidebar "Daily Sheet") → `BaseProductionClient` with `activeTab='production'` → `BaseDailyProductionSheet.tsx` (workspace class `production-daily-sheet-workspace`) |
| Entitlement | Base (owner). |
| Tour today | None: `ProductionGuidedTour` renders no rail on this route (`ProductionGuidedTour.tsx:25,32`). The old Production core taught this page from the Overview. |
| Live controls | Right rail: "Save shift" / "Save correction" (664), Shift details (Date, Shift, "Print sheet" 686), progress + "Draft on device", "Worker review" (722), "Recent production"; main: saved banner with "Edit saved log" (780), "Machine sheet" with "Discard draft" and "Show pending", rows with a Metres input and "Not running"; dialogs: Worker review, "Save an incomplete shift?", "Edit this saved production log?", audit trail. All labels hard-coded English. |
| Drafts | Every edit writes `localStorage['weavly:base-production:v1:{org}:{actor}:{date}:{shift}']`; save calls `saveBaseDailyProductionBatch`. |
| Rules | Readings are metres woven in the shift (not a cumulative counter); saving adds fabric stock, worker earnings and deducts yarn; a saved shift is corrected only with a reason; paid entries are locked. |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| DSH-1 | Major | Tour | The most-used Base page cannot launch a guide. | CODE-VERIFIED `ProductionGuidedTour.tsx:25,32` |
| DSH-2 | Major | Tour | Existing Daily Sheet copy (inside the Production tour) names "Save machine production", "Edit production log", "Print collection sheet", "Worker payroll roll-up". | CODE-VERIFIED audit §1.3 |
| DSH-3 | Unknown | Product | Owner-defined behavior (2026-09-27): changing the date or shift keeps the owner on the Daily Sheet for the selected date; only today and past dates can be chosen (the input already has `max={today}`, `BaseDailyProductionSheet.tsx:673`), so wrong past entries can be corrected. Unverified in code: `changeSelection` calls `replaceState` to `/owner/production?…` (178), which may switch the view to Overview (PI-04). GT-12 checks it. | INFERRED `BaseDailyProductionSheet.tsx:178` |
| DSH-4 | Minor | Product | A machine without an operator stays "pending" with no Not running action, forcing "Save an incomplete shift?" (production audit P7). | CODE-VERIFIED |

## C. Learning outcomes and coverage

After the tour the owner can: (1) explain that each date and shift has one sheet; (2) pick the shift; (3) enter metres woven per loom; (4) mark stopped looms; (5) check each worker's earnings; (6) know entries are a device draft until saved; (7) save and know what saving changes; (8) correct a saved shift with a reason; (9) start the first reading.

| Requirement | Destination |
| --- | --- |
| One sheet per date and shift | `ds-sheet` (+ detail: print a blank sheet) |
| Date and shift; past dates only, to check or correct an earlier shift | `ds-shift` (+ detail) |
| Metres per loom, not a counter; keyboard movement | `ds-reading` (+ detail) |
| Pending vs Not running; loom without operator | `ds-pending` (+ detail) |
| Worker review: metres × wage; zero output, absent | `ds-earnings` (+ detail) |
| Draft is on this device only | `ds-draft` |
| Save shift: stock, earnings, yarn | `ds-save` (+ detail: incomplete shift) |
| Correction with reason; paid entries locked; audit trail | `ds-correct` |
| Recent production / View log | Omitted (PI-03: View log lands on Overview) |
| Next action | `ds-handoff` |

## D. Structure

Nine steps on a replica of the sheet (the live sheet may be empty for a new owner and holds device drafts that must not be touched). The replica reuses the Daily Sheet surfaces of today's `ProductionTourPreview` (moved to a proposed `components/production/DailySheetTourPreview.tsx`) with live labels, rendered inside `production-daily-sheet-workspace`; the live sheet stays mounted and hidden (drafts untouched); handoff unhides it.

**Launcher placement (DR-24 for a route without a left rail):** the guide slot is the last block of the Daily Sheet's right rail at ≥1280px and appears at the top of the sheet below 1280px (use the page's existing inline/rail pattern; if the right rail does not render inline below 1280px on this route, render the slot inline at the top via the existing `rail-inline-actions` pattern). One `TourInvitation` instance (`tourId="daily-sheet"`).

**Wrapper:** a proposed `components/production/DailySheetGuidedTour.tsx` used inside `BaseDailyProductionSheet` around its main content. `ProductionGuidedTour` keeps rendering children only on this route.

Sample: loom "Sample loom 1–3", worker "Sample worker", quality "Sample fabric · v2", wage ₹2/m, 120 m → ₹240; date shown with the page's formatter.

## E. Steps

| # | Step id | Preset | Anchor (replica, proposed `data-daily-tour`) | Surface |
| --- | --- | --- | --- | --- |
| 1 | `ds-sheet` | PS-SAMPLE | `[data-daily-tour="sheet"]` | machine sheet |
| 2 | `ds-shift` | PS-SAMPLE | `[data-daily-tour="shift"]` | shift details |
| 3 | `ds-reading` | PS-SAMPLE | `[data-daily-tour="reading"]` | first row with 120 |
| 4 | `ds-pending` | PS-SAMPLE | `[data-daily-tour="pending"]` | row 2 pending, row 3 Not running |
| 5 | `ds-earnings` | PS-SAMPLE-DIALOG | `[data-daily-tour="review"]` / `[data-daily-tour-preview="true"]` | Worker review dialog |
| 6 | `ds-draft` | PS-SAMPLE | `[data-daily-tour="draft"]` | "Draft on device" chip + Discard draft |
| 7 | `ds-save` | PS-SAMPLE | `[data-daily-tour="save"]` | Save shift in the rail |
| 8 | `ds-correct` | PS-SAMPLE-DIALOG | `[data-daily-tour="correct"]` / same | "Edit this saved production log?" dialog |
| 9 | `ds-handoff` | PS-HANDOFF | a row exists: `[data-tour-anchor="daily.first-reading"]` *(proposed on the first enabled Metres input)*; empty state: `[data-tour-anchor="daily.empty-action"]` *(proposed on "Add worker", ~788-801)* | live |

## F. Copy

Keys in a proposed `lib/i18n/daily-sheet-tutorial.ts`.

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `sheet.title` | One sheet for each shift | દરેક શિફ્ટ માટે એક શીટ | हर शिफ्ट के लिए एक शीट |
| `sheet.body` | Each day and night shift has its own sheet listing every running loom with its quality and operator. | દિવસ અને રાતની દરેક શિફ્ટની પોતાની શીટ હોય છે, જેમાં દરેક ચાલુ લૂમ તેની ક્વોલિટી અને ઓપરેટર સાથે હોય છે. | दिन और रात की हर शिफ्ट की अपनी शीट होती है, जिसमें हर चालू लूम अपनी क्वालिटी और ऑपरेटर के साथ होता है। |
| `sheet.detail` | {c:printSheet} prints the sheet so readings can be written on the floor and typed in later. | {c:printSheet} શીટ છાપે છે, જેથી ફ્લોર પર રીડિંગ લખી પછી અહીં ભરી શકાય. | {c:printSheet} शीट छापता है, ताकि फ़्लोर पर रीडिंग लिखकर बाद में यहाँ भरी जा सके। |
| `shift.title` | Check the date and shift | તારીખ અને શિફ્ટ તપાસો | तारीख और शिफ्ट जाँचें |
| `shift.body` | Choose the shift you are recording. To check or fix an earlier shift, pick its date; future dates cannot be chosen. | તમે નોંધો છો તે શિફ્ટ પસંદ કરો. જૂની શિફ્ટ તપાસવા કે સુધારવા તેની તારીખ પસંદ કરો; આગળની તારીખ પસંદ કરી શકાતી નથી. | आप जो शिफ्ट दर्ज कर रहे हैं, उसे चुनें। पुरानी शिफ्ट जाँचने या सुधारने के लिए उसकी तारीख चुनें; आगे की तारीख नहीं चुनी जा सकती। |
| `shift.detail` | If that shift was already saved, it opens locked; {c:editSavedLog} unlocks it after you give a reason. | એ શિફ્ટ પહેલેથી સાચવી હોય તો તે લૉક ખૂલે છે; કારણ આપ્યા પછી {c:editSavedLog} તેને ખોલે છે. | वह शिफ्ट पहले सेव हो चुकी हो तो लॉक खुलती है; कारण देने के बाद {c:editSavedLog} उसे खोलता है। |
| `reading.title` | Enter the metres woven this shift | આ શિફ્ટમાં વણાયેલા મીટર લખો | इस शिफ्ट में बुने मीटर लिखें |
| `reading.body` | Type what each loom wove in this shift, here 120 m, not the meter's running total. | દરેક લૂમે આ શિફ્ટમાં જે વણ્યું તે લખો, અહીં 120 મીટર, મીટરનો ચાલુ કુલ આંકડો નહીં. | हर लूम ने इस शिफ्ट में जो बुना वह लिखें, यहाँ 120 मीटर, मीटर का चालू कुल नहीं। |
| `reading.detail` | Enter or the down arrow moves to the next loom. | Enter અથવા નીચેનો તીર આગલા લૂમ પર લઈ જાય છે. | Enter या नीचे का तीर अगले लूम पर ले जाता है। |
| `pending.title` | Mark looms that did not run | ન ચાલેલા લૂમ ચિહ્નિત કરો | न चले लूम चिह्नित करें |
| `pending.body` | A loom with no reading stays pending. Use {c:notRunning} for a loom that was stopped, so the shift is complete. | રીડિંગ વગરનો લૂમ બાકી રહે છે. બંધ રહેલા લૂમ માટે {c:notRunning} વાપરો, જેથી શિફ્ટ પૂરી થાય. | बिना रीडिंग का लूम बाकी रहता है। बंद रहे लूम के लिए {c:notRunning} इस्तेमाल करें, ताकि शिफ्ट पूरी हो। |
| `pending.detail` | A loom with no operator stays pending; assign one in Machine Assignments or save the shift as incomplete. | ઓપરેટર વગરનો લૂમ બાકી રહે છે; મશીન ફાળવણીમાં ઓપરેટર આપો અથવા શિફ્ટ અધૂરી તરીકે સાચવો. | बिना ऑपरेटर का लूम बाकी रहता है; मशीन आवंटन में ऑपरेटर दें या शिफ्ट अधूरी के रूप में सेव करें। |
| `earnings.title` | Check each worker's earnings | દરેક કારીગરની કમાણી તપાસો | हर कारीगर की कमाई जाँचें |
| `earnings.body` | {c:workerReview} shows metres and pay per worker: 120 m × ₹2/m = ₹240. | {c:workerReview}માં દરેક કારીગરના મીટર અને પગાર દેખાય છે: 120 મીટર × ₹2/મીટર = ₹240. | {c:workerReview} में हर कारीगर के मीटर और वेतन दिखते हैं: 120 मीटर × ₹2/मीटर = ₹240। |
| `earnings.detail` | Mark a worker who was absent or produced nothing there, so payroll knows the shift was not missed. | ગેરહાજર કે કંઈ ન બનાવનાર કારીગરને ત્યાં ચિહ્નિત કરો, જેથી પેરોલને ખબર પડે કે શિફ્ટ ચૂકી નથી. | ग़ैरहाज़िर या कुछ न बनाने वाले कारीगर को वहाँ चिह्नित करें, ताकि पेरोल को पता रहे कि शिफ्ट छूटी नहीं। |
| `draft.title` | Until you save, it is a draft on this device | સાચવો નહીં ત્યાં સુધી આ ઉપકરણ પર ડ્રાફ્ટ છે | सेव करने तक यह इस डिवाइस पर ड्राफ्ट है |
| `draft.body` | Readings are kept only on this phone or computer. Others do not see them and payroll does not use them yet. | રીડિંગ ફક્ત આ ફોન કે કમ્પ્યુટર પર રહે છે. બીજાને દેખાતાં નથી અને પેરોલ હજી વાપરતું નથી. | रीडिंग सिर्फ़ इस फ़ोन या कंप्यूटर पर रहती हैं। दूसरों को नहीं दिखतीं और पेरोल अभी इस्तेमाल नहीं करता। |
| `save.title` | Save the shift | શિફ્ટ સાચવો | शिफ्ट सेव करें |
| `save.body` | {c:saveShift} adds 120 m to fabric stock and ₹240 to the worker's earnings, and deducts the yarn used. | {c:saveShift} કાપડના સ્ટોકમાં 120 મીટર અને કારીગરની કમાણીમાં ₹240 ઉમેરે છે, અને વપરાયેલું યાર્ન ઘટાડે છે. | {c:saveShift} कपड़े के स्टॉक में 120 मीटर और कारीगर की कमाई में ₹240 जोड़ता है, और लगा धागा घटाता है। |
| `save.detail` | If some looms are still pending, Weavly asks whether to save the shift as incomplete. | કેટલાક લૂમ હજી બાકી હોય તો Weavly પૂછે છે કે શિફ્ટ અધૂરી તરીકે સાચવવી કે નહીં. | कुछ लूम अभी बाकी हों तो Weavly पूछता है कि शिफ्ट अधूरी के रूप में सेव करें या नहीं। |
| `correct.title` | Correct a saved shift with a reason | કારણ સાથે સાચવેલી શિફ્ટ સુધારો | कारण के साथ सेव शिफ्ट सुधारें |
| `correct.body` | {c:editSavedLog} unlocks a saved shift after you give a reason. The change and the reason stay in its history. | {c:editSavedLog} કારણ આપ્યા પછી સાચવેલી શિફ્ટ ખોલે છે. ફેરફાર અને કારણ તેના ઇતિહાસમાં રહે છે. | {c:editSavedLog} कारण देने के बाद सेव शिफ्ट खोलता है। बदलाव और कारण उसके इतिहास में रहते हैं। |
| `correct.detail` | Entries already paid in payroll cannot be changed. | પેરોલમાં ચૂકવાઈ ગયેલી નોંધો બદલી શકાતી નથી. | पेरोल में भुगतान हो चुकी एंट्री बदली नहीं जा सकती। |
| `handoff.title` | Record this shift | આ શિફ્ટ નોંધો | यह शिफ्ट दर्ज करें |
| `handoff.body` | Enter the first loom's metres. Save when every loom has a reading or is marked not running. | પહેલા લૂમના મીટર લખો. દરેક લૂમનું રીડિંગ થાય કે બંધ ચિહ્નિત થાય એટલે સાચવો. | पहले लूम के मीटर लिखें। हर लूम की रीडिंग हो जाए या बंद चिह्नित हो जाए, तब सेव करें। |
| `handoff.empty.title` | Add workers and machines first | પહેલાં કારીગરો અને મશીનો ઉમેરો | पहले कारीगर और मशीनें जोड़ें |
| `handoff.empty.body` | The sheet lists looms once you have machines, workers and an active quality. | મશીનો, કારીગરો અને ચાલુ ક્વોલિટી હોય એટલે શીટમાં લૂમ દેખાય છે. | मशीनें, कारीगर और चालू क्वालिटी होने पर शीट में लूम दिखते हैं। |
| `guide.title` | Daily Sheet guide | દૈનિક શીટ માર્ગદર્શિકા | दैनिक शीट मार्गदर्शिका |
| `guide.benefit` | See how to record a shift's metres and save them. | શિફ્ટના મીટર નોંધીને કેવી રીતે સાચવવા તે જુઓ. | शिफ्ट के मीटर दर्ज करके सेव करना देखें। |


### Control tokens

All hard-coded English today (label probe). Keys under a proposed `dailySheet.*` namespace, used by the live control and the token (LR-03).

| Token | Live render site | Gujarati | Hindi |
| --- | --- | --- | --- |
| `printSheet` | 686 | શીટ છાપો | शीट छापें |
| `notRunning` | row action (~840-883) | ચાલુ નથી | नहीं चला |
| `workerReview` | 722, 901 | કારીગર તપાસ | कारीगर जाँच |
| `saveShift` | 664, 987 ("Save shift"; "Save correction" gets its own key) | શિફ્ટ સાચવો | शिफ्ट सेव करें |
| `editSavedLog` | 780 | સાચવેલી નોંધ સુધારો | सेव की गई एंट्री सुधारें |

Also key the labels shown in the replica ("Machine sheet", "Draft on device", "Discard draft", "Show pending", "Metres", "Shift details") so the replica and the live sheet match in every language.

### F.1 Owner-authorized missing label wording — 2026-09-28

The owner answered “approve all three” to the coordinator's GT-12 wording, GT-12 PI-04 deferral and GT-15 copy questions. The owner delegated research and selection of these three missing Gujarati/Hindi labels. Use these exact selected values for the live Daily Sheet and its replica under the already specified `dailySheet.*` namespace:

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `dailySheet.draftOnDevice` | Draft on device | આ ઉપકરણ પર ડ્રાફ્ટ | इस डिवाइस पर ड्राफ्ट |
| `dailySheet.showPending` | Show pending | બાકી બતાવો | बाकी दिखाएँ |
| `dailySheet.shiftDetails` | Shift details | શિફ્ટની વિગતો | शिफ्ट का विवरण |

Selection rationale: retain the page's approved `draft.title` terminology (`ઉપકરણ`, `ડ્રાફ્ટ`, `डिवाइस`, `ड्राफ्ट`), `pending.body` terminology (`બાકી`, `बाकी`), and existing repository Show/Shift/Details vocabulary. Preserve the existing pending count suffix and all control behavior. This is a GT-12-only wording decision, not broader permission to translate new strings or change global phrase precedence.

Research checked 2026-09-28: [Google's Gujarati draft/device usage](https://support.google.com/youtube/answer/10343433?hl=gu), [Google's Hindi draft/device usage](https://support.google.com/youtube/answer/10343433?hl=hi), [GujaratiLexicon: detail](https://www.gujaratilexicon.com/dictionary/english-to-gujarati-translation/detail/), and [Google Docs Hindi details/show usage](https://support.google.com/docs/answer/45893?co=GENIE.Platform%3DDesktop&hl=hi). These establish terminology, not approval of Weavly's exact composed labels; the final selections above are the coordinator's judgment under the owner's delegation. Existing repository spellings are retained. The Gujarati Google page was available in search excerpts; a direct open returned a cache miss. Some help pages may use automated localization. Native-language quality remains **UNVERIFIED** until native review.

### F.2 Owner-authorized PI-04 implementation deferral — 2026-09-28

The same approval permits GT-12 implementation to continue while source-established PI-04 remains unresolved: changing date/shift calls the Overview URL helper and may select Overview through pathname-based tab selection. Do not change navigation, the approved U-06 `shift.body`/`shift.detail`, or business behavior in GT-12. Preserve the source evidence and track the product fix separately. Live reproduction/browser acceptance and native/reviewer/owner QA remain **UNVERIFIED**; this permission does not mark PI-04 fixed or allow GT-12 to become PASSED.

## G. State variants

| Variant | Behavior |
| --- | --- |
| No machines/workers/active quality (empty state) | Replica unchanged; handoff `empty` on "Add worker". |
| Unsaved draft on the device | Untouched (sheet hidden, not unmounted; the tour never edits). |
| Saved shift, locked | Handoff anchor may be disabled (inputs locked); Done focuses the launcher. |
| Conflict or storage-error state | Same as locked. |
| Replay | Compact launcher. |

## H. Comprehension check

"It is 8 p.m. and the day shift's meter slips are on your desk. Loom 3 was stopped for a broken beam. What do you enter, and when do the metres reach fabric stock?" Expected: day shift sheet; metres woven per loom (not counter totals); Not running for loom 3; check Worker review; Save shift, which is when stock and earnings change.
