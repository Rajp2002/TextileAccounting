# P06 Machine Assignments — tour specification

Status: implemented and PASSED (2026-09-30; human verification deferred by the owner). Implementation: **GT-15**. Gujarati/Hindi: native review pending, not done.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/production-assignments-machines-workers.md`](../audit/production-assignments-machines-workers.md) §2.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/assignments` → `BaseProductionClient view="operations"` → `BaseAssignmentWorkspace.tsx` (root `data-i18n-skip`) |
| Entitlement | `production_management` (Base). Owner role. |
| Tour today | `components/tours/ConfigurationTutorial.tsx` (dynamic import), `lib/configuration-tour.ts` (7 steps; samples `tour-configuration-*` merged into `initialData`), `lib/i18n/configuration-tutorial.ts`. |
| Anchors today | `[data-configuration-tour="board"|"shift"|"job"|"assign"|"saved-preview"|"daily-sheet"]`, picker `[data-configuration-picker-state="available"]`. |
| Rules | Only active piece-rate workers available for the shift; a machine needs a current production job; Choose saves immediately (effective today); replacing an existing link asks first; Undo appears in the success toast. |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| MA-1 | Major | Tour | Panel covers the board at step 1 at 1024, 1280 and 1440. | OBSERVED (harness) `assignments-*` s1 |
| MA-2 | Minor | Tour | `jobRequired` copy points to "Overview & Looms" and a `#machine-jobs` target that does not exist; help topic "Show inactive records" describes a missing control. | CODE-VERIFIED audit §2.3 |
| MA-3 | Minor | Tour | Ends on "Open Daily Sheet" rather than the page's own action. | CODE-VERIFIED |
| MA-4 | Minor | Product | Replace confirmation is English; links for machines without a current job are hidden (PI-15). | CODE-VERIFIED |

What works: samples shadow live data; shift, search and filters are forced only in the derived view; all handlers guarded; picker disabled.

## C. Learning outcomes and coverage

| Requirement | Destination |
| --- | --- |
| Purpose: who runs which loom, per shift | `ma-purpose` |
| Choose the shift first | `ma-shift` |
| A loom needs a quality (job) first | `ma-job` |
| Assign a worker; list shows available looms | `ma-assign` |
| Choose saves immediately; replace asks first; Undo | `ma-choose` (+ detail) |
| Check the saved link | `ma-linked` |
| Next: Daily Sheet | `ma-linked` detail |
| Drag to link, unlink | `ma-choose` detail |
| Next action on this page | `ma-handoff` |

## D. Structure

Seven steps (same shape as today). The last step changes from "Continue to Daily Sheet" to a live handoff on the first real worker's Assign (or Add worker).

## E. Steps

| # | Step id | Preset | Anchor | State (`configurationTourView`) |
| --- | --- | --- | --- | --- |
| 1 | `ma-purpose` (was `purpose`) | PS-SAMPLE | `[data-configuration-tour="board"]` | day shift, samples |
| 2 | `ma-shift` (was `dayShift`) | PS-SAMPLE | `[data-configuration-tour="shift"]` | same |
| 3 | `ma-job` (was `jobRequired`) | PS-SAMPLE | `[data-configuration-tour="job"]` | sample machine without job |
| 4 | `ma-assign` (was `assign`) | PS-SAMPLE | `[data-configuration-tour="assign"]` | samples |
| 5 | `ma-choose` (was `picker`) | PS-SAMPLE-DIALOG | `[data-configuration-picker-state="available"]` / the picker sheet `[data-configuration-picker-preview="true"]` | picker open for the sample worker |
| 6 | `ma-linked` (was `connected`) | PS-SAMPLE | `[data-configuration-tour="saved-preview"]` | link shown |
| 7 | `ma-handoff` (replaces `finish`) | PS-HANDOFF | a piece-rate worker exists: `[data-tour-anchor="assignments.first-assign"]` *(proposed on the first live worker's Assign)*; none: `[data-tour-anchor="assignments.add-worker"]` *(proposed on the rail "Add worker")* | live |

Step 1 must not overlap the board (MA-1): at 1024–1440 the board is wide, so DR-14 falls back to the corner with least overlap; if any overlap remains at 1024×768, the step's anchor becomes the board's column header row `[data-tour-anchor="assignments.columns"]` *(proposed)* so the panel fits below it.

## F. Copy

Keys in `lib/i18n/configuration-tutorial.ts` (rewritten; the dead "Show inactive" help topic and the `[data-configuration-tour-preview]` CSS are removed).

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `purpose.title` | Who runs which loom, each shift | દરેક શિફ્ટમાં કયો લૂમ કોણ ચલાવે | हर शिफ्ट में कौन सा लूम कौन चलाए |
| `purpose.body` | Link each worker to the loom they run. The Daily Sheet then lists each loom with its worker. | દરેક કારીગરને તે ચલાવે તે લૂમ સાથે જોડો. પછી દૈનિક શીટમાં દરેક લૂમ તેના કારીગર સાથે આવે છે. | हर कारीगर को उसके लूम से जोड़ें। फिर दैनिक शीट में हर लूम अपने कारीगर के साथ आता है। |
| `shift.title` | Choose the shift first | પહેલાં શિફ્ટ પસંદ કરો | पहले शिफ्ट चुनें |
| `shift.body` | Day and night are set separately. | દિવસ અને રાત અલગ નક્કી થાય છે. | दिन और रात अलग तय होते हैं। |
| `job.title` | A loom needs a quality first | લૂમને પહેલાં ક્વોલિટી જોઈએ | लूम को पहले क्वालिटी चाहिए |
| `job.body` | A loom marked {c:noJob} has nothing to weave yet. Put a quality on it in Production with {c:assignLooms}. | {c:noJob} લખેલા લૂમ પાસે હજી વણવાનું કંઈ નથી. ઉત્પાદનમાં {c:assignLooms}થી તેના પર ક્વોલિટી મૂકો. | {c:noJob} लिखे लूम के पास अभी बुनने को कुछ नहीं। उत्पादन में {c:assignLooms} से उस पर क्वालिटी लगाएँ। |
| `assign.title` | Start from the worker | કારીગરથી શરૂ કરો | कारीगर से शुरू करें |
| `assign.body` | {c:assign} next to a worker lists the looms free in this shift. | કારીગરની બાજુમાં {c:assign} આ શિફ્ટના ખાલી લૂમ બતાવે છે. | कारीगर के पास {c:assign} इस शिफ्ट के खाली लूम दिखाता है। |
| `choose.title` | Choosing a loom saves at once | લૂમ પસંદ કરતાં જ સચવાય છે | लूम चुनते ही सेव हो जाता है |
| `choose.body` | {c:choose} links the worker to that loom from today. If the loom already has a worker, Weavly asks before replacing. | {c:choose} આજથી કારીગરને તે લૂમ સાથે જોડે છે. લૂમ પર પહેલેથી કારીગર હોય તો બદલતાં પહેલાં Weavly પૂછે છે. | {c:choose} आज से कारीगर को उस लूम से जोड़ता है। लूम पर पहले से कारीगर हो तो बदलने से पहले Weavly पूछता है। |
| `choose.detail` | Right after a change, {c:undo} in the message puts it back. On a computer you can also drag from a worker to a loom. | ફેરફાર પછી તરત સંદેશમાં {c:undo} તેને પાછું કરે છે. કમ્પ્યુટર પર કારીગરથી લૂમ સુધી ખેંચીને પણ જોડી શકાય. | बदलाव के तुरंत बाद संदेश में {c:undo} उसे वापस करता है। कंप्यूटर पर कारीगर से लूम तक खींचकर भी जोड़ सकते हैं। |
| `linked.title` | Check the link | જોડાણ તપાસો | जोड़ जाँचें |
| `linked.body` | The worker and loom now show together for this shift. Their metres are entered on the Daily Sheet. | હવે આ શિફ્ટ માટે કારીગર અને લૂમ સાથે દેખાય છે. તેમના મીટર દૈનિક શીટમાં નોંધાય છે. | अब इस शिफ्ट के लिए कारीगर और लूम साथ दिखते हैं। उनके मीटर दैनिक शीट में दर्ज होते हैं। |
| `handoff.title` | Link your first worker | તમારા પહેલા કારીગરને જોડો | अपने पहले कारीगर को जोड़ें |
| `handoff.body` | Choose {c:assign} next to a worker and pick their loom. | કારીગરની બાજુમાં {c:assign} પસંદ કરો અને તેમનો લૂમ પસંદ કરો. | कारीगर के पास {c:assign} चुनें और उसका लूम चुनें। |
| `handoff.empty.title` | Add workers first | પહેલાં કારીગરો ઉમેરો | पहले कारीगर जोड़ें |
| `handoff.empty.body` | Only piece-rate workers can be linked to looms. Choose {c:addWorker} to add one. | ફક્ત પીસ રેટ કારીગર લૂમ સાથે જોડાય છે. ઉમેરવા {c:addWorker} પસંદ કરો. | सिर्फ़ पीस रेट कारीगर लूम से जुड़ते हैं। जोड़ने के लिए {c:addWorker} चुनें। |
| `guide.benefit` | See how to link workers to looms for each shift. | દરેક શિફ્ટ માટે કારીગરોને લૂમ સાથે જોડવાનું જુઓ. | हर शिफ्ट के लिए कारीगरों को लूम से जोड़ना देखें। |

### F.1 Owner-approved copy correction — 2026-09-28

The owner answered “approve all three” to the coordinator’s decisions, including removing only the unsupported one-loom-per-worker sentence from `shift.body` in all three languages. The table above now retains only its previously approved first sentence. The existing assignment workflow supports multiple looms per worker in a shift; do not alter assignment/replace/undo/remove behavior, server validation or other copy. Native/browser/reviewer/owner verification remains UNVERIFIED.

### Control tokens

| Token | Live render site | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- |
| `assign` | worker row button (English today) | ફાળવો | लगाएँ | Add key (LR-03) |
| `choose` | picker row | પસંદ કરો | चुनें | none |
| `noJob` | machine row "No production job" (word-by-word today) | ઉત્પાદન કામ નથી | उत्पादन काम नहीं | Add key |
| `assignLooms` | `production.assignLooms` (GT-11) | લૂમ ફાળવો | लूम दें | reuse |
| `undo` | toast action | પાછું વાળો | पूर्ववत करें | none |
| `addWorker` | rail link | કારીગર ઉમેરો | कारीगर जोड़ें | none |

## G. State variants

| Variant | Behavior |
| --- | --- |
| No workers or machines | Samples; handoff `empty`. |
| `?worker=` / `?machine=` focus in the URL | Ignored during the tour (existing); the focus banner is hidden while the tour runs. |
| Night shift selected | Forced to day in the derived view; restored after. |
| Mobile | Workers/Machines toggle forced per step (existing `configurationTourView`). |
| Replay | Compact launcher. |

## H. Comprehension check

"Suresh will run loom 4 on the night shift from today. What do you do here, and what if loom 4 says No production job?" Expected: choose Night, Assign next to Suresh, choose loom 4; if it has no job, first put a quality on it in Production (Assign Looms).
