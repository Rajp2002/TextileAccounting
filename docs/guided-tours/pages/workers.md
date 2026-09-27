# P08 Workers — tour specification

Status: specified, not implemented. Implementation: **GT-14**. Gujarati/Hindi: native review pending.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/production-assignments-machines-workers.md`](../audit/production-assignments-machines-workers.md) §4.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/workers` → `registers/WorkersRegister.tsx` (root `data-i18n-skip`) |
| Entitlement | `production_management` (Base). Owner role. |
| Tour today | `components/tours/WorkersTutorial.tsx` (path buttons "piece" / "salary" in the panel at step 1), `lib/workers-tour.ts` (piece 7 / salary 8 steps; samples `tour-workers-*`; disabled `WorkerEditor` preview), `lib/i18n/workers-tutorial.ts`. |
| Rules | Pay type cannot change after saving (DB trigger); piece-rate wage comes from the active quality; salary is dated (joining date, change effective from, last working day); a salaried worker cannot be made inactive without a last day. |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| WK-1 | Minor | Tour | Sample names ("Sample worker", "Sample staff", role "Supervisor") stay English in Gujarati/Hindi. | CODE-VERIFIED `workers-tour.ts:25-26` |
| WK-2 | Minor | Tour | `earnings` spotlights a whole group while the numbers exist only in copy. | CODE-VERIFIED audit §4.3 |
| WK-3 | Minor | Tour | Panel over target at step 1 (1024, 1280); Gujarati step 1 body scrolls at 390×844. | OBSERVED (harness) |
| WK-4 | Minor | Tour | `tourPath` persists between launches; wage word "વેતન/वेतन" clashes with salary. | CODE-VERIFIED audit §4.5-4.6 |

What works: branch by pay type; guarded handlers; disabled editor preview; labels mostly match the live editor.

## C. Learning outcomes and coverage

| Requirement | Destination |
| --- | --- |
| Two pay paths; choose before saving; cannot change later | `wk-paytype` (both paths) |
| Piece: shift availability | `wkp-availability` |
| Piece: wage comes from the quality | `wkp-wage` |
| Piece: needs a loom (Machine Assignments) | `wkp-loom` |
| Piece: metres × wage (₹1.50 × 100 m = ₹150) | `wkp-earnings` |
| Salary: amount; joining date and part month (15/30 × ₹18,000 = ₹9,000) | `wks-salary`, `wks-joining` |
| Salary: change effective date; last working day | `wks-changes` |
| Salary: shows in payroll | `wks-payroll` |
| Search, filters, active/inactive | Omitted: standard list controls |
| Next: Add worker | handoff |

## D. Structure

Step 1 asks which kind of worker to learn about (two buttons inside the panel: the path choice is a panel control, not a page interaction). Piece path 6 steps, salary path 6 steps, each ending in the same handoff. `tourPath` resets to `piece` on every launch. `effective` and `lastDay` merge into `wks-changes`.

## E. Steps

| # | Step id | Path | Preset | Anchor |
| --- | --- | --- | --- | --- |
| 1 | `wk-paytype` (was `purpose` + `payType`) | both | PS-SAMPLE-DIALOG | `[data-workers-tour-field="payType"]` / `[data-workers-tour-preview="true"]` (editor preview of the chosen path) |
| 2p | `wkp-availability` | piece | PS-SAMPLE-DIALOG | `[data-workers-tour-field="availability"]` |
| 3p | `wkp-wage` (was `pieceReadiness`) | piece | PS-SAMPLE | `[data-workers-tour="piece"] [data-workers-tour="readiness"]` |
| 4p | `wkp-loom` (was `assignments`) | piece | PS-SAMPLE | `[data-workers-tour="piece"] [data-workers-tour="assignments"]` |
| 5p | `wkp-earnings` | piece | PS-SAMPLE | `[data-workers-tour="piece"] [data-workers-tour="readiness"]` (the wage line; the numbers are in the copy and match the sample wage) |
| 2s | `wks-salary` | salary | PS-SAMPLE-DIALOG | `[data-workers-tour-field="salary"]` |
| 3s | `wks-joining` | salary | PS-SAMPLE-DIALOG | `[data-workers-tour-field="joining"]` |
| 4s | `wks-changes` (was `effective` + `lastDay`) | salary | PS-SAMPLE-DIALOG | `[data-workers-tour-field="effective"]` (edit preview) |
| 5s | `wks-payroll` | salary | PS-SAMPLE | `[data-workers-tour="salary-card"] [data-workers-tour="payroll"]` |
| 6 | `wk-handoff` | both | PS-HANDOFF | `[data-tour-anchor="workers.add"]` *(proposed on header and rail "Add worker")* |

Step 1 panel: title/body as §F, then two buttons in the body area: {piece} and {salary} (`data-tour-control="path-piece"`, `"path-salary"`); the chosen one has `aria-pressed="true"`. Next continues on the chosen path (default piece).

## F. Copy

Keys in `lib/i18n/workers-tutorial.ts` (rewritten). Samples localized: Sample worker / નમૂના કારીગર / नमूना कारीगर; Sample staff / નમૂના સ્ટાફ / नमूना स्टाफ; Supervisor / સુપરવાઇઝર / सुपरवाइज़र.

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `paytype.title` | Choose how this worker is paid | આ કારીગરને કેવી રીતે પગાર મળે તે પસંદ કરો | यह कारीगर कैसे वेतन पाता है, यह चुनें |
| `paytype.body` | Piece-rate workers earn per metre woven; salaried staff earn a monthly amount. This cannot be changed after saving. | પીસ રેટ કારીગર વણેલા મીટર પ્રમાણે કમાય છે; પગારદાર સ્ટાફ માસિક રકમ કમાય છે. સાચવ્યા પછી આ બદલી શકાતું નથી. | पीस रेट कारीगर बुने मीटर के हिसाब से कमाते हैं; वेतन वाला स्टाफ़ मासिक रकम कमाता है। सेव के बाद यह बदला नहीं जा सकता। |
| `paytype.piece` | Piece rate | પીસ રેટ | पीस रेट |
| `paytype.salary` | Monthly salary | માસિક પગાર | मासिक वेतन |
| `availability.title` | Set the shifts they can work | તે કઈ શિફ્ટમાં કામ કરી શકે તે નક્કી કરો | वह किन शिफ्ट में काम कर सकता है, यह तय करें |
| `availability.body` | Day, night or both. Only matching workers can be put on a loom for that shift. | દિવસ, રાત કે બંને. ફક્ત મેળ ખાતા કારીગર જ તે શિફ્ટમાં લૂમ પર મુકાય છે. | दिन, रात या दोनों। सिर्फ़ मेल खाते कारीगर ही उस शिफ्ट में लूम पर लगते हैं। |
| `wage.title` | The wage comes from the quality | મજૂરી ક્વોલિટીમાંથી આવે છે | मजदूरी क्वालिटी से आती है |
| `wage.body` | You do not type a wage here. Each quality's weaver wage, set when it is activated in Production, applies to whoever weaves it. | અહીં મજૂરી લખવાની નથી. ઉત્પાદનમાં ચાલુ કરતી વખતે નક્કી થયેલી ક્વોલિટીની મજૂરી, જે કારીગર તેને વણે તેને લાગુ પડે છે. | यहाँ मजदूरी नहीं लिखनी। उत्पादन में चालू करते समय तय क्वालिटी की मजदूरी, जो कारीगर उसे बुने, उस पर लागू होती है। |
| `loom.title` | Put them on a loom | તેમને લૂમ પર મૂકો | उन्हें लूम पर लगाएँ |
| `loom.body` | A piece-rate worker earns only when assigned to a loom for a shift, in Machine Assignments. | પીસ રેટ કારીગર મશીન ફાળવણીમાં કોઈ શિફ્ટના લૂમ પર મુકાય ત્યારે જ કમાય છે. | पीस रेट कारीगर मशीन आवंटन में किसी शिफ्ट के लूम पर लगने पर ही कमाता है। |
| `earnings.title` | Metres become earnings | મીટર કમાણી બને છે | मीटर कमाई बनते हैं |
| `earnings.body` | Saved shifts add metres × wage: 100 m × ₹1.50 = ₹150. Payroll pays it. | સાચવેલી શિફ્ટ મીટર × મજૂરી ઉમેરે છે: 100 મીટર × ₹1.50 = ₹150. પેરોલ તે ચૂકવે છે. | सेव शिफ्ट मीटर × मजदूरी जोड़ती है: 100 मीटर × ₹1.50 = ₹150। पेरोल यह चुकाता है। |
| `salary.title` | Enter the agreed monthly salary | નક્કી થયેલો માસિક પગાર લખો | तय मासिक वेतन लिखें |
| `salary.body` | Enter the full monthly amount, here ₹18,000. Payroll works out each period from it. | આખી માસિક રકમ લખો, અહીં ₹18,000. પેરોલ તેમાંથી દરેક સમયગાળો ગણે છે. | पूरी मासिक रकम लिखें, यहाँ ₹18,000। पेरोल उससे हर अवधि निकालता है। |
| `joining.title` | Salary starts on the joining date | પગાર જોડાયાની તારીખથી શરૂ થાય | वेतन जुड़ने की तारीख से शुरू होता है |
| `joining.body` | Someone who joins halfway through a 30-day month is paid 15/30 × ₹18,000 = ₹9,000 for it. | 30 દિવસના મહિનાની વચ્ચે જોડાનારને તે મહિનાના 15/30 × ₹18,000 = ₹9,000 મળે છે. | 30 दिन के महीने के बीच में जुड़ने वाले को उस महीने के 15/30 × ₹18,000 = ₹9,000 मिलते हैं। |
| `changes.title` | Date every change | દરેક ફેરફારને તારીખ આપો | हर बदलाव को तारीख दें |
| `changes.body` | When the salary changes, set the date it applies from. When someone leaves, set their last working day before marking them inactive. | પગાર બદલાય ત્યારે તે કઈ તારીખથી લાગુ થાય તે લખો. કોઈ છોડે ત્યારે નિષ્ક્રિય કરતાં પહેલાં છેલ્લો કામકાજનો દિવસ લખો. | वेतन बदले तो किस तारीख से लागू हो, यह लिखें। कोई छोड़े तो निष्क्रिय करने से पहले आख़िरी काम का दिन लिखें। |
| `payroll.title` | Salaries appear in payroll | પગાર પેરોલમાં દેખાય છે | वेतन पेरोल में दिखता है |
| `payroll.body` | {c:viewPayroll} opens this worker's pay for the current period. | {c:viewPayroll} આ કારીગરનો ચાલુ સમયગાળાનો પગાર ખોલે છે. | {c:viewPayroll} इस कारीगर का चालू अवधि का वेतन खोलता है। |
| `handoff.title` | Add your workers | તમારા કારીગરો ઉમેરો | अपने कारीगर जोड़ें |
| `handoff.body` | Choose {c:addWorker} for each person and pick their pay type carefully. | દરેક વ્યક્તિ માટે {c:addWorker} પસંદ કરો અને પગારનો પ્રકાર ધ્યાનથી પસંદ કરો. | हर व्यक्ति के लिए {c:addWorker} चुनें और वेतन का प्रकार ध्यान से चुनें। |
| `guide.benefit` | See how to add workers and set up their pay. | કારીગરો ઉમેરવા અને તેમનો પગાર ગોઠવવાનું જુઓ. | कारीगर जोड़ना और उनका वेतन तय करना देखें। |

### Control tokens

| Token | Resolver (verify) | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- |
| `addWorker` | header/rail button | કારીગર ઉમેરો | कारीगर जोड़ें | none |
| `viewPayroll` | salaried card link | પેરોલ જુઓ | पेरोल देखें | none |

The editor labels shown by the preview ("Fixed monthly salary", "Salary change effective from", "Last working day (optional)", "Shift availability", "Joining date") display English or word-by-word today (label probe); key them (LR-03) so the preview and the live editor match: સ્થિર માસિક પગાર / निश्चित मासिक वेतन; પગાર ફેરફાર લાગુ તારીખ / वेतन बदलाव लागू तारीख; છેલ્લો કામકાજનો દિવસ (વૈકલ્પિક) / आख़िरी काम का दिन (वैकल्पिक); શિફ્ટ ઉપલબ્ધતા / शिफ्ट उपलब्धता; જોડાયાની તારીખ / जुड़ने की तारीख.

## G. State variants

| Variant | Behavior |
| --- | --- |
| No workers | Same (samples). |
| Filters set | Shadowed (existing). |
| Editor open | Launcher hidden (existing). |
| Replay | Compact launcher; path resets to piece. |

## H. Comprehension check

"You are hiring a supervisor on ₹18,000 a month from the 16th, and a weaver paid by the metre. How do you add each, and where does the weaver's rate come from?" Expected: Add worker → Monthly salary, ₹18,000, joining date the 16th; Add worker → Piece rate, shifts; the weaver's wage comes from the quality's weaver wage in Production.
