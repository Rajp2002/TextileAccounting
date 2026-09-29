# P14 Payroll — tour specification

Status: specified, not implemented. Implementation: **GT-10**. Gujarati/Hindi: native review pending.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/payroll.md`](../audit/payroll.md).

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/payroll` → `PayrollGuidedTour variant="base"` around `BaseProductionClient view="payroll"` (period rail, summary, readiness, worker cards, settlement workspace `BasePayrollSettlementWorkspace.tsx`, records `BasePayrollRecords.tsx`) |
| Entitlement | `production` (Base; `payroll/layout.tsx` AccessGate). Owner role. |
| Tour today | `components/payroll/PayrollGuidedTour.tsx` (hides the live page; rail has guide, "More payroll help", "How pay is calculated" dialog in English only), `PayrollTourPreview.tsx`, `components/tours/PayrollTutorial.tsx`, `lib/payroll-tour.ts` (base + unreachable `full` variant, core + help tracks), `lib/i18n/payroll-tutorial.ts`, numbers `makePayrollTourExample()`. |
| Rules | Piece pay = metres × saved wage; salary by dated segments; recovery of advances and deductions capped at 50% of gross (`BASE_PAYROLL_DEDUCTION_PERCENT`); payments are records of money paid outside Weavly; completing the period is separate from paying. |
| Consequential actions | Mark paid / Confirm Payment (`settleBaseWorkerPayroll`), Resolve (saved on completion), Complete Payroll, Record reversal, Reopen Payment, Add advance, Add deduction. |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| PR-1 | Major | Tour | The Base deduction copy mentions the retired "Full" tier; the unreachable `full` variant (WhatsApp slips, statutory deductions, final settlement) is maintained and tested. | CODE-VERIFIED `payroll-tutorial.ts:85` (+ gu 203, hi 321); `payroll/page.tsx:10` only passes `base` |
| PR-2 | Major | Tour | Replica labels differ from the live UI: "Settle Payroll" vs "Continue settlement", "Mark as paid" vs "Mark Paid"/"Confirm Payment", text Previous/Next vs chevrons; the earnings breakdown shown does not exist live. | CODE-VERIFIED audit §3 #1-#4 |
| PR-3 | Major | Tour | The readiness step promises "Review opens the affected Production entry"; the link lands on Overview (PI-03). The payment step teaches a payment date that is never saved (PI-01). | CODE-VERIFIED audit §5 #2, #4 |
| PR-4 | Major | Tour | Live page hidden, no handoff; rail over the replica at ≥1440; panel over target at 1024 (steps 1, 3, 4). | OBSERVED (harness) |
| PR-5 | Minor | Tour | "How pay is calculated" rail dialog is English only; help track records nothing and ends on the core finish copy; five visible sections with a Base-irrelevant "rules" label. | CODE-VERIFIED audit §5 #9-#11, §6.2 |

What works: the replica has only disabled controls and no handlers; the sample recovery maths is pinned to `calculateAdvanceRecovery`.

## C. Learning outcomes and coverage

After the tour the owner can: (1) explain that payroll turns saved production and salaries into what each worker is owed; (2) fix readiness issues before paying; (3) read gross, recovery and net per worker; (4) apply the 50% recovery rule; (5) open the settlement and record each payment made; (6) complete the period last; (7) find the settlement for the current period.

| Requirement | Destination |
| --- | --- |
| What a period is; paying ≠ completing | `pr-period` |
| Pay cycle is set in Settings | `pr-period` detail (Settings excluded; named as a destination) |
| Readiness issues first | `pr-readiness` |
| Gross: piece and salary | `pr-earnings` |
| Recovery ≤ 50% of gross; carry forward | `pr-recovery` |
| Settlement workspace; ₹0 workers resolved | `pr-settle` (+ detail) |
| Record payment (method; no money moves) | `pr-paid` |
| Complete the period | `pr-complete` |
| Advances and deductions | Optional walkthrough `pra-advance`, `pra-deduction` |
| Records by worker and machine; export CSV/PDF | Optional walkthrough `pra-records`, `pra-export` |
| Correct a mistaken payment | Optional walkthrough `pra-correct` |
| Payment date, period-scoped payables | Not taught (PI-01, PI-02) |

## D. Structure

- **Core (8 steps):** period → readiness → earnings → recovery → settle → paid → complete → handoff. Order = the order of a pay day.
- **Optional walkthrough "Advances, records and corrections" (6 steps):** advance → deduction → records → export → correct → handoff. Launched by the existing "More payroll help" rail button (renamed); records nothing.
- `full` variant and its copy, preview branches and tests are deleted (D-17).
- Replica inside `payroll-workspace-shell`; handoff unhides the live page (EC-18).
- "How pay is calculated" stays in the rail as existing guidance; its strings move into the tour copy file with gu/hi (PR-5).

Sample (`makePayrollTourExample`, unchanged): piece 1,000 m × ₹2 = ₹2,000 gross, debt ₹1,000, recovery ₹1,000, net ₹1,000; salary ₹18,000 × 30/30 = ₹18,000; period "01–30 Sep 2026" rendered with the page's date formatter in each language (fixes English month names).

## E. Steps

| # | Step id | Preset | Anchor | Surface |
| --- | --- | --- | --- | --- |
| 1 | `pr-period` (was `period`) | PS-SAMPLE | `[data-payroll-tour="period"]` | page |
| 2 | `pr-readiness` | PS-SAMPLE | `[data-payroll-tour="readiness"]` | page |
| 3 | `pr-earnings` | PS-SAMPLE | `[data-payroll-tour="earnings"]` | page (worker cards: gross lines only, matching the live card) |
| 4 | `pr-recovery` | PS-SAMPLE | `[data-payroll-tour="recovery"]` | page |
| 5 | `pr-settle` *(new; replaces `obligations`)* | PS-SAMPLE-DIALOG | `[data-payroll-tour="settle"]` *(new anchor on the replica settlement list)* / `[data-payroll-tour-preview="true"]` | settlement dialog |
| 6 | `pr-paid` (was `paymentDetails` + `confirm` + `paid`) | PS-SAMPLE-DIALOG | `[data-payroll-tour="paymentDetails"]` | mark-paid dialog: method + optional note (no date field) |
| 7 | `pr-complete` | PS-SAMPLE-DIALOG | `[data-payroll-tour="complete"]` | settlement dialog footer |
| 8 | `pr-handoff` | PS-HANDOFF | `[data-tour-anchor="payroll.settle"]` *(proposed on the period rail primary button, `BaseProductionClient.tsx:476-485`, whatever its current label)* | live |
| A1 | `pra-advance` | PS-SAMPLE-DIALOG | `[data-payroll-tour="advance"]` | advance dialog |
| A2 | `pra-deduction` | PS-SAMPLE-DIALOG | `[data-payroll-tour="deduction"]` | deduction dialog |
| A3 | `pra-records` | PS-SAMPLE | `[data-payroll-tour="records"]` | records view |
| A4 | `pra-export` | PS-SAMPLE | `[data-payroll-tour="export"]` | records view |
| A5 | `pra-correct` | PS-SAMPLE-DIALOG | `[data-payroll-tour="correction"]` | reversal dialog |
| A6 | `pra-handoff` (copy `extra.handoff`) | PS-HANDOFF | `[data-tour-anchor="payroll.records"]` *(proposed on "Payroll records", `BaseProductionClient.tsx:787-792`)* | live |

## F. Copy

Keys in `lib/i18n/payroll-tutorial.ts` (rewritten; `full` keys deleted; `previewLabelRows` completed for every label the replica shows so nothing falls back).

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `period.title` | Pay one period at a time | એક વખતે એક સમયગાળાનો પગાર | एक बार में एक अवधि का वेतन |
| `period.body` | Each period follows your pay cycle. Paying a worker and completing the period are separate steps. | દરેક સમયગાળો તમારા પગાર ચક્ર પ્રમાણે છે. કારીગરને ચૂકવવું અને સમયગાળો પૂર્ણ કરવો અલગ પગલાં છે. | हर अवधि आपके वेतन चक्र के अनुसार है। कारीगर को भुगतान करना और अवधि पूरी करना अलग कदम हैं। |
| `period.detail` | The cycle (for example monthly) is set in Settings → Payroll. | ચક્ર (જેમ કે માસિક) સેટિંગ્સ → પેરોલમાં નક્કી થાય છે. | चक्र (जैसे मासिक) सेटिंग्स → पेरोल में तय होता है। |
| `readiness.title` | Fix readiness issues first | પહેલાં તૈયારીની ખામીઓ સુધારો | पहले तैयारी की कमियाँ ठीक करें |
| `readiness.body` | Missing production readings or pay setup are listed here. Fix each one on the Daily Sheet or in Workers before paying. | ખૂટતાં ઉત્પાદન રીડિંગ કે પગાર સેટઅપ અહીં દેખાય છે. ચૂકવતાં પહેલાં દરેકને દૈનિક શીટ કે કારીગરોમાં સુધારો. | छूटी उत्पादन रीडिंग या वेतन सेटअप यहाँ दिखते हैं। भुगतान से पहले हर एक को दैनिक शीट या कारीगर में ठीक करें। |
| `earnings.title` | How gross pay is worked out | કુલ પગાર કેવી રીતે ગણાય છે | कुल वेतन कैसे निकलता है |
| `earnings.body` | Piece-rate pay is metres × wage: 1,000 m × ₹2/m = ₹2,000. A salary is paid for the days worked in the period. | પીસ રેટ પગાર = મીટર × મજૂરી: 1,000 મીટર × ₹2/મીટર = ₹2,000. પગારદારને સમયગાળામાં કામ કરેલા દિવસોનો પગાર મળે છે. | पीस रेट वेतन = मीटर × मजदूरी: 1,000 मीटर × ₹2/मीटर = ₹2,000। वेतन वालों को अवधि में काम के दिनों का वेतन मिलता है। |
| `recovery.title` | Advances are recovered from pay | ઉપાડ પગારમાંથી વસૂલાય છે | उपाड़ वेतन से वसूला जाता है |
| `recovery.body` | Up to half of gross pay recovers advances and deductions: ₹1,000 of ₹2,000 here, leaving ₹1,000 to pay. Any rest carries forward. | કુલ પગારમાંથી વધુમાં વધુ અડધો ઉપાડ અને કપાતમાં જાય: અહીં ₹2,000 માંથી ₹1,000, ચૂકવવાના ₹1,000 રહે. બાકી આગળ જાય છે. | कुल वेतन का अधिकतम आधा उपाड़ और कटौती में जाता है: यहाँ ₹2,000 में से ₹1,000, देने को ₹1,000 बचते हैं। बाकी आगे जाता है। |
| `settle.title` | Open the settlement to pay | ચૂકવવા સેટલમેન્ટ ખોલો | भुगतान के लिए निपटान खोलें |
| `settle.body` | {c:settlePayroll} lists every worker with the net amount to pay for this period. | {c:settlePayroll}માં આ સમયગાળામાં દરેક કારીગરને ચૂકવવાની ચોખ્ખી રકમ દેખાય છે. | {c:settlePayroll} में इस अवधि में हर कारीगर को देने की शुद्ध रकम दिखती है। |
| `settle.detail` | A worker with nothing to pay is closed with {c:resolve} instead of a payment. | ચૂકવવાનું કંઈ ન હોય તે કારીગરને ચુકવણીને બદલે {c:resolve}થી બંધ કરો. | जिसे कुछ नहीं देना, उस कारीगर को भुगतान के बजाय {c:resolve} से बंद करें। |
| `paid.title` | Record each payment you made | તમે કરેલી દરેક ચુકવણી નોંધો | अपना किया हर भुगतान दर्ज करें |
| `paid.body` | {c:markPaid} records that you paid the worker in cash, bank or UPI. Weavly does not move any money. | {c:markPaid} નોંધે છે કે તમે કારીગરને રોકડ, બેંક કે UPIથી ચૂકવ્યા. Weavly કોઈ પૈસા મોકલતું નથી. | {c:markPaid} दर्ज करता है कि आपने कारीगर को नकद, बैंक या UPI से भुगतान किया। Weavly कोई पैसा नहीं भेजता। |
| `complete.title` | Complete the period last | સમયગાળો છેલ્લે પૂર્ણ કરો | अवधि सबसे आख़िर में पूरी करें |
| `complete.body` | When every worker is paid or resolved, {c:completePayroll} closes the period and keeps it in records. | દરેક કારીગર ચૂકવાઈ જાય કે બંધ થાય પછી {c:completePayroll} સમયગાળો બંધ કરી રેકોર્ડમાં રાખે છે. | हर कारीगर का भुगतान हो जाए या बंद हो जाए, तब {c:completePayroll} अवधि बंद करके रिकॉर्ड में रखता है। |
| `handoff.title` | Pay this period's workers | આ સમયગાળાના કારીગરોને ચૂકવો | इस अवधि के कारीगरों को भुगतान करें |
| `handoff.body` | When readiness is clear, open the settlement here and record each payment as you make it. | તૈયારી પૂરી થાય એટલે અહીં સેટલમેન્ટ ખોલો અને દરેક ચુકવણી કરતાં જ નોંધો. | तैयारी पूरी होने पर यहाँ निपटान खोलें और हर भुगतान करते ही दर्ज करें। |
| `advance.title` | Record an advance when you give it | ઉપાડ આપો ત્યારે નોંધો | उपाड़ दें तब दर्ज करें |
| `advance.body` | {c:addAdvance} on a worker records money given ahead of pay. It is recovered from later pay under the half-of-gross limit. | કારીગર પર {c:addAdvance} પગાર પહેલાં આપેલા પૈસા નોંધે છે. તે પછીના પગારમાંથી અડધા સુધીની મર્યાદામાં વસૂલાય છે. | कारीगर पर {c:addAdvance} वेतन से पहले दिए पैसे दर्ज करता है। यह बाद के वेतन से आधे तक की सीमा में वसूला जाता है। |
| `deduction.title` | Record a deduction with its reason | કારણ સાથે કપાત નોંધો | कारण के साथ कटौती दर्ज करें |
| `deduction.body` | {c:addDeduction} records an amount to recover, such as damage. It is recovered together with advances, under the same limit. | {c:addDeduction} વસૂલવાની રકમ, જેમ કે નુકસાન, નોંધે છે. તે ઉપાડ સાથે એ જ મર્યાદામાં વસૂલાય છે. | {c:addDeduction} वसूलने की रकम, जैसे नुकसान, दर्ज करता है। यह उपाड़ के साथ उसी सीमा में वसूली जाती है। |
| `records.title` | Find past payments | જૂની ચુકવણીઓ શોધો | पुराने भुगतान खोजें |
| `records.body` | {c:payrollRecords} shows each recorded payment by worker or by machine for the period you pick. | {c:payrollRecords}માં પસંદ કરેલા સમયગાળાની દરેક નોંધાયેલી ચુકવણી કારીગર કે મશીન પ્રમાણે દેખાય છે. | {c:payrollRecords} में चुनी अवधि का हर दर्ज भुगतान कारीगर या मशीन के अनुसार दिखता है। |
| `export.title` | Export a period | સમયગાળો એક્સપોર્ટ કરો | अवधि एक्सपोर्ट करें |
| `export.body` | {c:exportCsv} or {c:exportPdf} downloads the whole period, whatever you have searched. | {c:exportCsv} કે {c:exportPdf} તમે શું શોધ્યું હોય તે છતાં આખો સમયગાળો ડાઉનલોડ કરે છે. | {c:exportCsv} या {c:exportPdf} आपकी खोज चाहे जो हो, पूरी अवधि डाउनलोड करता है। |
| `correct.title` | Correct a mistaken payment record | ખોટો ચુકવણી રેકોર્ડ સુધારો | गलत भुगतान रिकॉर्ड सुधारें |
| `correct.body` | {c:resolveMistaken} reverses a payment recorded by mistake, with a reason. It does not return any cash. | {c:resolveMistaken} ભૂલથી નોંધાયેલી ચુકવણી કારણ સાથે ઉલટાવે છે. તે કોઈ રોકડ પાછી આપતું નથી. | {c:resolveMistaken} गलती से दर्ज भुगतान को कारण के साथ वापस करता है। यह कोई नकद वापस नहीं देता। |
| `extra.handoff.title` | Open your payroll records | તમારા પેરોલ રેકોર્ડ ખોલો | अपने पेरोल रिकॉर्ड खोलें |
| `extra.handoff.body` | Choose {c:payrollRecords} to see payments you have already recorded. | નોંધાયેલી ચુકવણીઓ જોવા {c:payrollRecords} પસંદ કરો. | दर्ज भुगतान देखने के लिए {c:payrollRecords} चुनें। |
| `extra.launcher` | Advances, records and corrections | ઉપાડ, રેકોર્ડ અને સુધારા | उपाड़, रिकॉर्ड और सुधार |
| `guide.benefit` | See how to check earnings, record payments and close a pay period. | કમાણી તપાસવી, ચુકવણી નોંધવી અને પગાર સમયગાળો બંધ કરવો કેવી રીતે તે જુઓ. | कमाई जाँचना, भुगतान दर्ज करना और वेतन अवधि बंद करना देखें। |

### Control tokens

Payroll labels are hard-coded English and display word-by-word in Gujarati/Hindi today (label probe). Each gets a key (LR-03) in `lib/i18n/locales/{en,gu,hi}.ts` under `payroll.*` (proposed namespace), used by the live control and the token.

| Token | Live render site | Gujarati | Hindi |
| --- | --- | --- | --- |
| `settlePayroll` | period rail button when the period is open (`BaseProductionClient.tsx` ~476) | પેરોલ સેટલ કરો | पेरोल निपटाएँ |
| `resolve` | workspace row (~736-743) | બંધ કરો | बंद करें |
| `markPaid` | workspace row "Mark Paid" (~756) and card "Mark paid" (~775) | ચૂકવાયું નોંધો | भुगतान दर्ज करें |
| `completePayroll` | workspace footer (~859-870) | પેરોલ પૂર્ણ કરો | पेरोल पूरा करें |
| `addAdvance` | card (~773) | ઉપાડ ઉમેરો | उपाड़ जोड़ें |
| `addDeduction` | card (~774) | કપાત ઉમેરો | कटौती जोड़ें |
| `payrollRecords` | records entry (~787-792) | પેરોલ રેકોર્ડ | पेरोल रिकॉर्ड |
| `exportCsv` / `exportPdf` | records (~257-258) | CSV એક્સપોર્ટ કરો / PDF એક્સપોર્ટ કરો | CSV एक्सपोर्ट करें / PDF एक्सपोर्ट करें |
| `resolveMistaken` | records (~305) | ખોટો ચુકવણી રેકોર્ડ સુધારો | गलत भुगतान रिकॉर्ड सुधारें |

"Continue settlement", "Confirm Payment", "Complete Payroll" (dialog title) and the other labels on the same controls get keys in the same namespace so the whole button family is consistent. Gujarati "પૂર્ણ કરો" is also the shared "Done" verb; the tour's Done is "પૂર્ણ" (§9.3), which the reviewer should check for confusion.

### F.1 Owner-authorized Payroll copy completion — 2026-09-28

Authority: the owner replied **“Gt-10, Approved Payroll-only terminology research and selection”** to the coordinator's specific request covering the 8 retained calculation-help strings and 6 sibling-control labels below. This delegates selection of these missing strings and resumes GT-10. It does not authorize broader copy or business changes. Native-language review remains **UNVERIFIED**.

The exact wording below is the fixed implementation copy selected by the coordinator under that authority. Key names remain local implementation discretion. Keep calculation-help strings in `lib/i18n/payroll-tutorial.ts`; keep sibling live/replica labels in the `payroll.*` locale namespace. Use the same calculation title for the rail trigger and dialog title. Preserve the existing English wording, including capitalization. Preserve the dynamic period label in the completion title; `{period.label}` denotes the existing value and may be wired through the existing interpolation mechanism without changing its content or semantics.

#### Retained calculation-help copy

| Suggested key | English (unchanged) | Gujarati | Hindi |
| --- | --- | --- | --- |
| `calculation.title` | How pay is calculated | પગાર કેવી રીતે ગણાય છે | वेतन की गणना कैसे होती है |
| `calculation.description` | Payroll settlement calculation and advance recovery rules | પેરોલ સેટલમેન્ટની ગણતરી અને ઉપાડની વસૂલાતના નિયમો | पेरोल निपटान की गणना और उपाड़ की वसूली के नियम |
| `calculation.piece.title` | 1. Piece-rate earnings | 1. પીસ રેટની કમાણી | 1. पीस रेट की कमाई |
| `calculation.piece.body` | Piece-rate pay uses saved machine rates multiplied by verified metres produced per machine. | પીસ રેટનો પગાર દરેક મશીન માટે સાચવેલા મજૂરી દરને તે મશીન પર બનેલા ચકાસેલા મીટરથી ગુણવાથી ગણાય છે. | हर मशीन की सहेजी गई मजदूरी दर को उस मशीन पर बने कपड़े के जाँचे गए मीटर से गुणा करके पीस रेट वेतन निकाला जाता है। |
| `calculation.salary.title` | 2. Fixed salaries | 2. નિશ્ચિત પગાર | 2. निश्चित वेतन |
| `calculation.salary.body` | Fixed salaries accrue by calendar day, accounting for joining/leaving dates and effective-dated salary adjustments. | નિશ્ચિત પગાર કૅલેન્ડરના દરેક દિવસ પ્રમાણે ગણાય છે. તેમાં કામે જોડાવાની અને કામ છોડવાની તારીખો તથા જે તારીખથી પગારમાં ફેરફાર લાગુ પડે છે તે ધ્યાનમાં લેવાય છે. | निश्चित वेतन की गणना कैलेंडर के दिनों के हिसाब से होती है। इसमें काम शुरू करने और छोड़ने की तारीखें तथा वेतन में बदलाव लागू होने की तारीखें ध्यान में रखी जाती हैं। |
| `calculation.recovery.title` | 3. Advance recovery | 3. ઉપાડની વસૂલાત | 3. उपाड़ की वसूली |
| `calculation.recovery.body` | Recovery is capped at the lower of the outstanding advance balance or 50% of gross pay; any remaining balance carries forward to the next pay cycle. | વસૂલાતની મર્યાદા ઉપાડની બાકી રકમ અને કુલ પગારના 50%માંથી જે ઓછી રકમ હોય તેટલી છે. બાકી રહેલી રકમ આવતા પગાર ચક્રમાં આગળ જાય છે. | वसूली की सीमा बकाया उपाड़ और कुल वेतन के 50% में से जो रकम कम हो, उतनी है। बची रकम अगले वेतन चक्र में आगे ले जाई जाती है। |

#### Sibling controls and dynamic completion title

| Suggested key | English (unchanged) | Gujarati | Hindi |
| --- | --- | --- | --- |
| `continueSettlement` | Continue settlement | સેટલમેન્ટ ચાલુ રાખો | निपटान जारी रखें |
| `viewSettledPayroll` | View settled payroll | સેટલ થયેલો પેરોલ જુઓ | निपटाया गया पेरोल देखें |
| `reviewBeforePaying` | Review before paying | ચૂકવતાં પહેલાં તપાસો | भुगतान से पहले जाँचें |
| `confirmPayment` | Confirm Payment | ચુકવણીની પુષ્ટિ કરો | भुगतान की पुष्टि करें |
| `viewSettledRecords` | View Settled Records | સેટલ થયેલા રેકોર્ડ જુઓ | निपटाए गए रिकॉर्ड देखें |
| `completePeriodTitle` | Complete {period.label} payroll? | શું {period.label}નો પેરોલ પૂર્ણ કરવો છે? | क्या {period.label} का पेरोल पूरा करें? |

Scope: the live substitutions stay within the existing GT-10 packet's three named live files and same-control sibling labels. These strings do not modify settlement actions, salary accrual, recovery rules, payment dates, period-scoped payables or PI-01/PI-02/PI-03. The 50% limit and calculation description come from existing application copy; external language sources do not establish product or legal rules. No other missing translations are pre-authorized.

Research basis (consulted 2026-09-28): [Cambridge English–Gujarati salary](https://dictionary.cambridge.org/dictionary/english-gujarati/salary) supports `પગાર` and lists Hindi `वेतन`; [Google Pay's Hindi verification help](https://support.google.com/pay/india/answer/11179491?hl=hi) supports the confirmation imperative `पुष्टि करें`. Search results for [Gujaratilexicon's વસૂલાતી entry](https://www.gujaratilexicon.com/dictionary/gujarati-to-gujarati-translation/વસૂલાતી/) and [Income Tax Department Hindi advance-recovery terminology](https://www.incometaxindia.gov.in/hi/w/section-12-202) corroborate recovery/payment vocabulary (the latter direct page opening was unavailable). These are terminology references, not sources for the complete sentences. The coordinator's wording deliberately follows this page's approved `સેટલમેન્ટ`/`ઉપાડ` and `निपटान`/`उपाड़` product vocabulary. The complete sentences are coordinator-authored selections, not quoted or certified translations; browser/native/reviewer/owner acceptance remains deferred.

### F.2 Owner-approved PDF loading label — 2026-09-28

The owner explicitly answered **“Approve this loading label”** to the coordinator's exact English/Gujarati/Hindi proposal below. This supplements §F.1 with the omitted loading state of the existing Export PDF button; the earlier 14 entries remain approved.

| Suggested key (`payroll.*`) | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `preparingPdf` | Preparing PDF… | PDF તૈયાર થઈ રહ્યું છે… | PDF तैयार हो रहा है… |

Use this exact copy for the existing same-button loading state in `BasePayrollRecords.tsx` and the matching replica state if shown. Key names remain discretionary within `payroll.*`. This permits only label localization: preserve the export handler, busy/disabled semantics and all export behavior. No other new wording or change surface is authorized. Browser/native-language/reviewer/owner acceptance remains UNVERIFIED.

## G. State variants

| Variant | Behavior |
| --- | --- |
| No workers / no production | Replica unchanged; handoff anchor exists (the period rail button renders for any period). If it is disabled, Done focuses the launcher. |
| Period in progress / ready to complete / settled | The live button's label differs; the token resolves to whatever it currently shows, and the anchor is the same button. |
| Settlement workspace open | Launcher under the modal; cannot start. |
| Replay | Compact launcher; the optional walkthrough is always available. |

## H. Comprehension check

"Ramesh wove 1,000 metres at ₹2 and owes ₹1,000 from an advance. How much do you pay him this period, and what do you press after paying him in cash?" Expected: ₹1,000 (half of ₹2,000 recovered); Settle payroll → Mark paid (cash) for Ramesh; Complete Payroll after everyone is done.
