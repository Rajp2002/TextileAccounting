# P04 Production (Overview) — tour specification

Status: implemented and PASSED (2026-09-30; human verification deferred by the owner). **2026-10-08: the Machine Board left the Overview, so the `pd-operators` and `pd-board` steps and their copy were removed (five steps now). Loom quality and operators are set in Machine Assignments.** Implementation: **GT-11**. Gujarati/Hindi: native review pending, not done.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md) (D-10). Evidence: [`audit/production-assignments-machines-workers.md`](../audit/production-assignments-machines-workers.md) §1. The Daily Sheet has its own tour: [daily-sheet.md](daily-sheet.md).

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/production` (sidebar "Overview") → `BaseProductionClient` (jobs view) inside `ProductionGuidedTour` |
| Entitlement | `production_management` (Base). Owner role. |
| Tour today | `components/production/ProductionGuidedTour.tsx` (left rail: guide + "Setup, history & corrections"; hides the live page), `ProductionTourPreview.tsx`, `components/tours/ProductionTutorial.tsx`, `lib/production-tour.ts` (12-step core covering Overview **and** Daily Sheet + 11-step details track), `lib/i18n/production-tutorial.ts`, `productionTourExample`. |
| Live controls | Right rail "Activate Quality" (`BaseProductionClient.tsx:433-442`); `BaseActiveQualities`: Activate Quality dialog, "Yarn required before production" gate with Add Stock, Assign Looms dialog, ⋮ Quality actions (View in Costings, Production History, Deactivate) (the `BaseMachineBoard` that used to follow it was removed on 2026-10-08). |
| Prerequisites | A saved costing (not archived); **stock above 0 kg for every yarn in its recipe** (`validate_quality_activation_yarn`); active machines; active piece-rate workers. |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| PD-1 | Major | Tour | The yarn-stock requirement for activation is never mentioned; a new owner who follows the tour is stopped by "Yarn required before production". | CODE-VERIFIED migration `20260920000000…sql:113-192`; copy `production-tutorial.ts:95-98` |
| PD-2 | Major | Tour | Replica and copy name controls that do not exist: "Overview & Looms", "Loom Board", "Save machine production", "Edit production log", "Print collection sheet", "Production cost". | CODE-VERIFIED audit §1.3 |
| PD-3 | Major | Tour | Half the core tour teaches the Daily Sheet, which cannot launch a guide. | CODE-VERIFIED `ProductionGuidedTour.tsx:25,32` |
| PD-4 | Major | Tour | Live page hidden, no handoff; rail over the replica at ≥1440; panel over target at 1024 (step 8). | OBSERVED (harness) |
| PD-5 | Minor | Tour | Gujarati/Hindi copy embeds English UI names; wage is મજૂરી here and વેતન in Workers; sample worker is "વણકર/बुनकर". | CODE-VERIFIED audit §1.6 |
| PD-6 | Major | Product | Incomplete recipe → "All required yarns are now available!" loop (PI-05); View log / returnTo land on Overview (PI-03). | CODE-VERIFIED |

## C. Learning outcomes and coverage

After the tour the owner can: (1) explain how a saved costing becomes a running quality whose metres feed stock and wages; (2) list the four prerequisites including yarn stock; (3) activate a quality with its wage; (4) assign looms; (5) start with the real "Activate Quality".

| Requirement | Destination |
| --- | --- |
| Purpose: costing → looms → daily metres → stock and wages | `pd-overview` |
| Prerequisites: saved costing, yarn stock, machines, workers | `pd-prereq` (+ detail: where to add each) |
| Activate Quality: version + weaver wage | `pd-activate` (+ detail: yarn gate, Add Stock) |
| Assign Looms | `pd-looms` |
| Recording metres | Daily Sheet tour (`pd-handoff` names it) |
| History, corrections, print | Daily Sheet tour |

## D. Structure

Five steps on the Overview. The old details track and every Daily Sheet step leave this tour (D-10). The "Setup, history & corrections" rail button is removed; the rail has only the guide. Replica: only the overview surfaces and the two overview dialogs remain; labels come from the live keys (LR-02); rendered inside `production-overview-workspace`; handoff unhides the live page (EC-18).

Sample (`productionTourExample`): wage ₹2/m, quality "Sample fabric · v2", looms "Sample loom 1–3", worker "Sample worker" (localized per §9.2).

## E. Steps

| # | Step id | Preset | Anchor | Surface |
| --- | --- | --- | --- | --- |
| 1 | `pd-overview` (was `overview`) | PS-SAMPLE | `[data-production-tour="overview"]` | overview |
| 2 | `pd-prereq` (was `prerequisites`) | PS-SAMPLE | `[data-production-tour="prerequisites"]` | overview, a checklist card: Saved costing, Yarn stock, Machines, Workers |
| 3 | `pd-activate` (was `activate`) | PS-SAMPLE-DIALOG | `[data-production-tour="activate"]` / `[data-production-tour-preview="true"]` | Activate Quality dialog |
| 4 | `pd-looms` (was `allocate`) | PS-SAMPLE-DIALOG | `[data-production-tour="allocate"]` / same | Assign Looms dialog |
| 5 | `pd-handoff` | PS-HANDOFF | `[data-tour-anchor="production.activate"]` *(proposed on the right-rail Activate Quality and on its inline counterpart below 1280px)* | live |

## F. Copy

Keys in `lib/i18n/production-tutorial.ts` (rewritten; Daily Sheet and details keys move to the Daily Sheet tour or are deleted).

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `overview.title` | From costing to daily production | કોસ્ટિંગથી રોજિંદા ઉત્પાદન સુધી | कॉस्टिंग से रोज़ के उत्पादन तक |
| `overview.body` | Here a saved costing becomes a quality running on your looms. Metres recorded each shift then add fabric stock and worker pay. | અહીં સાચવેલી કોસ્ટિંગ તમારા લૂમ પર ચાલતી ક્વોલિટી બને છે. પછી દરેક શિફ્ટમાં નોંધાયેલા મીટર કાપડનો સ્ટોક અને કારીગરનો પગાર ઉમેરે છે. | यहाँ सेव की गई कॉस्टिंग आपके लूम पर चलती क्वालिटी बनती है। फिर हर शिफ्ट में दर्ज मीटर कपड़े का स्टॉक और कारीगर का वेतन जोड़ते हैं। |
| `prereq.title` | Three things must exist first | પહેલાં આ ત્રણ વસ્તુ જોઈએ | पहले ये तीन चीज़ें चाहिए |
| `prereq.body` | A saved costing, your machines, and your workers. | સાચવેલી કોસ્ટિંગ, તમારાં મશીનો અને તમારા કારીગરો. | सेव की गई कॉस्टिंग, आपकी मशीनें और आपके कारीगर। |
| `prereq.detail` | Costings come from the Cost Estimator, and machines and workers from their own pages. | કોસ્ટિંગ ખર્ચ અંદાજકમાંથી, અને મશીનો તથા કારીગરો તેમના પોતાના પેજમાંથી આવે છે. | कॉस्टिंग लागत अनुमानक से, और मशीनें व कारीगर अपने-अपने पेज से आते हैं। |
| `activate.title` | Activate a quality with its wage | મજૂરી સાથે ક્વોલિટી ચાલુ કરો | मजदूरी के साथ क्वालिटी चालू करें |
| `activate.body` | {c:activateQuality} picks a saved costing version and the weaver wage per metre, here ₹2/m. The wage is what workers earn on this quality. | {c:activateQuality} સાચવેલી કોસ્ટિંગનું વર્ઝન અને મીટરદીઠ મજૂરી પસંદ કરે છે, અહીં ₹2/મીટર. આ ક્વોલિટી પર કારીગરો આ મજૂરી કમાય છે. | {c:activateQuality} सेव कॉस्टिंग का वर्ज़न और प्रति मीटर मजदूरी चुनता है, यहाँ ₹2/मीटर। इस क्वालिटी पर कारीगर यही मजदूरी कमाते हैं। |
| `looms.title` | Put the quality on looms | ક્વોલિટીને લૂમ પર મૂકો | क्वालिटी को लूम पर लगाएँ |
| `looms.body` | {c:assignLooms} ticks the looms that will weave it. A loom weaves one quality at a time. | {c:assignLooms} તેને વણનારા લૂમ પર ટિક કરે છે. એક લૂમ એક વખતે એક જ ક્વોલિટી વણે છે. | {c:assignLooms} उसे बुनने वाले लूम पर टिक करता है। एक लूम एक बार में एक ही क्वालिटी बुनता है। |
| `handoff.title` | Start your first quality | તમારી પહેલી ક્વોલિટી શરૂ કરો | अपनी पहली क्वालिटी शुरू करें |
| `handoff.body` | Choose {c:activateQuality} to put a quality on your looms. Then record each shift's metres on the Daily Sheet. | તમારા લૂમ પર ક્વોલિટી મૂકવા {c:activateQuality} પસંદ કરો. પછી દરેક શિફ્ટના મીટર દૈનિક શીટમાં નોંધો. | अपने लूम पर क्वालिटी लगाने के लिए {c:activateQuality} चुनें। फिर हर शिफ्ट के मीटर दैनिक शीट में दर्ज करें। |
| `guide.benefit` | See how to put a saved costing on your looms and get ready to record production. | સાચવેલી કોસ્ટિંગને લૂમ પર મૂકવી અને ઉત્પાદન નોંધવાની તૈયારી કેવી રીતે કરવી તે જુઓ. | सेव कॉस्टिंग को लूम पर लगाना और उत्पादन दर्ज करने की तैयारी करना देखें। |

### Control tokens

All are hard-coded English today and display word-by-word (label probe). Each gets a key (LR-03) under a proposed `production.*` namespace used by the live control and the token.

| Token | Live render site | Gujarati | Hindi |
| --- | --- | --- | --- |
| `activateQuality` | right rail (433-442), `BaseActiveQualities` 406-412 | ક્વોલિટી ચાલુ કરો | क्वालिटी चालू करें |
| `assignLooms` | quality card (528-535) | લૂમ ફાળવો | लूम दें |
| `qualityActions` | ⋮ menu aria-label (459-490) | ક્વોલિટીના વિકલ્પો | क्वालिटी के विकल्प |

### F.1 Owner-authorized missing replica labels — 2026-09-28

The owner resolved GT-11's missing-copy/key escalation: “GT-11 - approved for their label keys. You can look online to see what would be the appropriate words”. This authorizes selecting these two labels from researched terminology and sharing their keys between the existing Overview live render sites and replica. It is a narrow exception to the earlier missing-copy stop; other copy and protected behavior stay governed by the original specification.

| Shared key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `production.cost` | Cost | ખર્ચ | लागत |

Retain the `{loom}` placeholder and interpolate the same custom-label/name value as the live sheet currently uses. Key only the `BaseActiveQualities` Cost labels, plus the matching Overview replica labels. (`production.manageOperatorsForLoom` was keyed for the operators sheet of the removed Machine Board and has been deleted with it.) Keep punctuation, amounts, units, handlers and calculations unchanged. Do not change Daily Sheet or Payroll copy.

Terminology evidence: [GujaratiLexicon, manage](https://www.gujaratilexicon.com/dictionary/english-to-gujarati-translation/manage/) gives સંચાલન કરવું; [Cambridge, Gujarati cost](https://dictionary.cambridge.org/dictionary/english-gujarati/cost) gives ખર્ચ for money spent; [Cambridge, Hindi manage](https://dictionary.cambridge.org/dictionary/english-hindi/manage) gives प्रबंधन करना; [Collins, Hindi cost](https://www.collinsdictionary.com/dictionary/english-hindi/cost) gives लागत. The operator noun follows the already-approved Production copy's ઓપરેટર/ऑपरेटर terminology. These full UI titles are coordinator-composed from those meanings under the owner's delegated wording decision; no source or native reviewer is claimed to have approved the complete phrases. Native-language and browser review remain **UNVERIFIED**.

## G. State variants

| Variant | Behavior |
| --- | --- |
| No saved costings / no machines / no workers | Replica unchanged; handoff anchor (Activate Quality) exists; `prereq` already tells where each comes from. |
| Qualities already active | Same tour; `handoff.body` still correct. |
| Live dialog open | Launcher under the modal. |
| Replay | Compact launcher. |

## H. Comprehension check

"You saved a costing for a new crepe yesterday and want two looms to start it tonight. What must be true before you can, and what do you press, in which order?" Expected: yarn stock exists for its yarns; Activate Quality (version + wage) → Assign Looms (two looms) → record metres on the Daily Sheet.
