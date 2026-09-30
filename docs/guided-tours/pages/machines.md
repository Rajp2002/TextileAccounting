# P07 Machines — tour specification

Status: implemented and PASSED (2026-09-30; human verification deferred by the owner). Implementation: **GT-13**. Gujarati/Hindi: native review pending, not done.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/production-assignments-machines-workers.md`](../audit/production-assignments-machines-workers.md) §3.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/machines` → `app/(dashboard)/owner/production/registers/MachinesRegister.tsx` (root `data-i18n-skip`) |
| Entitlement | `production_management` (Base). Owner role. |
| Tour today | `components/tours/MachinesTutorial.tsx` (shared hooks), `lib/machines-tour.ts` (6 steps; samples `tour-machines-*` injected into the live grid; a disabled `MachineEditor` preview at `details`), `lib/i18n/machines-tutorial.ts`. |
| Anchors today | `[data-machines-tour="header"]`, preview `[data-machines-tour-field="details"]`, `[data-machines-tour="identity"]` (ready card), `[data-machines-tour-id="tour-machines-incomplete"]`, `[data-machines-tour="production-next"]`, `[data-machines-tour="assignments-next"]` (right-rail links). |
| Readiness rule | "Active" = has a worker in a shift today **and** a current job context; otherwise "Needs setup" (`lib/machine-readiness.ts:39`). |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| MC-1 | Minor | Tour | `production` copy says Assign Looms sets a start date (it does not); link label "1. Production → Overview & Looms" is not a sidebar label (pinned by tests). | CODE-VERIFIED audit §3.3 |
| MC-2 | Minor | Tour | Ends on a rail link rather than the page's own primary action; no live handoff. | CODE-VERIFIED `machines-tour.ts:3` |
| MC-3 | Minor | Tour | Style and placement per SD-07/SD-13; panel corner changes 3× at 1024. | OBSERVED (harness) |
| MC-4 | Minor | Product | Cards never show availability (PI-14). | CODE-VERIFIED |

What works: every handler is guarded during the tour; the preview editor is disabled; toolbar state is shadowed; the real editor must be closed before the launcher shows. The tour is already the closest to the target design.

## C. Learning outcomes and coverage

| Requirement | Destination |
| --- | --- |
| One record per physical loom | `mc-purpose` |
| Add: type, optional label, automatic name | `mc-details` |
| Needs setup vs Active; what makes a machine ready | `mc-readiness` |
| Give it a quality (Production → Assign Looms) | `mc-quality` |
| Give it a worker (Machine Assignments) | `mc-worker` |
| Edit; availability for new assignments | `mc-details` detail |
| Next: Add machine | `mc-handoff` |

## D. Structure

Six steps: purpose → details → readiness → quality → worker → handoff. The `label` step is merged into `details`.

## E. Steps

| # | Step id | Preset | Anchor | State |
| --- | --- | --- | --- | --- |
| 1 | `mc-purpose` (was `purpose`) | PS-LIVE | `[data-machines-tour="header"]` | samples in grid |
| 2 | `mc-details` (was `details`) | PS-SAMPLE-DIALOG | `[data-machines-tour-field="details"]` / `[data-machines-tour-preview="true"][data-state="open"]` | disabled preview editor |
| 3 | `mc-readiness` (was `readiness`) | PS-SAMPLE | `[data-machines-tour-id="tour-machines-incomplete"]` | samples |
| 4 | `mc-quality` (was `production`) | PS-LIVE | `[data-machines-tour="production-next"]` | samples |
| 5 | `mc-worker` (was `assignments`) | PS-LIVE | `[data-machines-tour="assignments-next"]` | samples |
| 6 | `mc-handoff` | PS-HANDOFF | `[data-tour-anchor="machines.add"]` *(proposed on the header "Add machine" and the right-rail Add)* | live grid |

Rail links in steps 4–5 are hidden below 1280px (right rail inline): verify they render inline; if not, TC-8 with the shared text (no copy depends on seeing them).

## F. Copy

Keys in `lib/i18n/machines-tutorial.ts` (rewritten; `productionLink` label changes to the sidebar name).

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `purpose.title` | One record for each loom | દરેક લૂમ માટે એક રેકોર્ડ | हर लूम के लिए एक रिकॉर्ड |
| `purpose.body` | Add every loom you run once. Production, assignments and payroll then refer to it by name. | તમારો દરેક લૂમ એક વાર ઉમેરો. પછી ઉત્પાદન, ફાળવણી અને પેરોલ તેને નામથી ઓળખે છે. | अपना हर लूम एक बार जोड़ें। फिर उत्पादन, आवंटन और पेरोल उसे नाम से पहचानते हैं। |
| `details.title` | Name it the way your floor does | ફ્લોર પર કહો છો તેવું નામ આપો | जैसा फ़्लोर पर कहते हैं, वैसा नाम दें |
| `details.body` | Choose the machine type and an optional label such as "Rapier 3". If you leave the name blank, Weavly numbers it. | મશીનનો પ્રકાર અને "રેપિયર 3" જેવું વૈકલ્પિક લેબલ પસંદ કરો. નામ ખાલી રાખો તો Weavly નંબર આપે છે. | मशीन का प्रकार और "रेपियर 3" जैसा वैकल्पिक लेबल चुनें। नाम खाली छोड़ें तो Weavly नंबर देता है। |
| `details.detail` | Later, {c:edit} lets you rename it or stop offering it for new assignments. | પછી {c:edit}થી નામ બદલી શકો કે નવી ફાળવણી માટે બંધ કરી શકો. | बाद में {c:edit} से नाम बदल सकते हैं या नए आवंटन के लिए बंद कर सकते हैं। |
| `readiness.title` | Added is not the same as ready | ઉમેર્યું એટલે તૈયાર નહીં | जोड़ा मतलब तैयार नहीं |
| `readiness.body` | A machine shows {c:needsSetup} until it has a quality to weave and a worker for a shift. | મશીન પાસે વણવા ક્વોલિટી અને શિફ્ટ માટે કારીગર ન હોય ત્યાં સુધી {c:needsSetup} દેખાય છે. | मशीन के पास बुनने को क्वालिटी और शिफ्ट के लिए कारीगर न हो तब तक {c:needsSetup} दिखता है। |
| `quality.title` | First, give it a quality | પહેલાં તેને ક્વોલિટી આપો | पहले उसे क्वालिटी दें |
| `quality.body` | In Production, {c:assignLooms} on a quality puts it on this loom. | ઉત્પાદનમાં ક્વોલિટી પર {c:assignLooms} તેને આ લૂમ પર મૂકે છે. | उत्पादन में क्वालिटी पर {c:assignLooms} उसे इस लूम पर लगाता है। |
| `worker.title` | Then give it a worker | પછી તેને કારીગર આપો | फिर उसे कारीगर दें |
| `worker.body` | In Machine Assignments, choose who runs this loom in each shift. | મશીન ફાળવણીમાં દરેક શિફ્ટમાં આ લૂમ કોણ ચલાવે તે પસંદ કરો. | मशीन आवंटन में हर शिफ्ट में यह लूम कौन चलाए, यह चुनें। |
| `handoff.title` | Add your looms | તમારા લૂમ ઉમેરો | अपने लूम जोड़ें |
| `handoff.body` | Choose {c:addMachine} once for each loom on your floor. | તમારા ફ્લોરના દરેક લૂમ માટે એક વાર {c:addMachine} પસંદ કરો. | अपने फ़्लोर के हर लूम के लिए एक बार {c:addMachine} चुनें। |
| `rail.productionLink` | 1. Production | 1. ઉત્પાદન | 1. उत्पादन |
| `guide.benefit` | See how to add looms and get them ready for production. | લૂમ ઉમેરવા અને ઉત્પાદન માટે તૈયાર કરવાનું જુઓ. | लूम जोड़ना और उत्पादन के लिए तैयार करना देखें। |

Sample names already localized (`machinesTutorialCopy[lang].example`); keep.

### Control tokens

| Token | Resolver (verify) | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- |
| `addMachine` | header/rail button | મશીન ઉમેરો | मशीन जोड़ें | none |
| `edit` | card Edit | ફેરફાર કરો | बदलें | Hindi: add phrase (today "संपादित करें") if the reviewer agrees |
| `needsSetup` | card badge | સેટઅપ બાકી | सेटअप बाकी | Add phrase (today "સેટઅપ જરૂરી"/"सेटअप आवश्यक" is acceptable; keep if the reviewer prefers) |
| `assignLooms` | `production.assignLooms` key from GT-11 | લૂમ ફાળવો | लूम दें | reuse |

## G. State variants

| Variant | Behavior |
| --- | --- |
| No machines | Same (samples). |
| Search/status filter set | Shadowed (existing). |
| Editor open | Launcher hidden (existing). |
| Replay | Compact launcher. |

## H. Comprehension check

"You bought two new rapier looms. What do you do on this page, and why will they still show Needs setup afterwards?" Expected: Add machine twice (type Rapier, labels); they need a quality (Production → Assign Looms) and a worker (Machine Assignments).
