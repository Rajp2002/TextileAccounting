# P02 Saved Costings — tour specification (reference tour)

Status: specified, not implemented. Implementation: **GT-03** (reference tour, gate G1). Gujarati/Hindi: native review pending (LR-08).
Shared rules are cited by ID from [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/rate-book-and-saved-costings.md`](../audit/rate-book-and-saved-costings.md) §B.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Routes | `/owner/quotes` (Lite, Base: `QuotesClient.tsx`); `/free/costings` (Free: `app/free/costings/SavedFreeCostings.tsx`). `/owner/quotes` also renders `SavedFreeCostings` above `QuotesClient` when the organization has a retained Free grant (`owner/quotes/page.tsx:36-38`). |
| Entitlement | `saved_costings` capability (Free, Lite, Base). Base adds "Activate for Production" (`canUseProductionPipeline`). Owner role. |
| Tour today | `components/estimator/SavedCostingsTutorial.tsx` (bespoke engine); steps `lib/saved-costings-tour.ts`; copy `lib/i18n/saved-costings-tutorial.ts`; samples `makeSavedCostingTourExamples()` (ids `tour-preview-v2`, `tour-preview-v1`). |
| Entry today | Rail guide card (`TourInvitation align="full"`), rail button "Compare versions · Sample walkthrough" (paid), rail help disclosure. |
| Prerequisite for real use | At least one costing saved in the Cost Estimator. |
| Page state the tour renders | While `tourStep !== null`, the list is replaced by the sample library (`QuotesClient.tsx:1364-1379`); dialogs are derived from `costingTourSurface(step)`. |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| SC-1 | Major | Tour | The panel covers the sample library dialog at every desktop width (the reserved-width CSS no longer matches the centred dialog). | OBSERVED (harness): 1440×900 step 2, 55,460 px² under the panel; CODE-VERIFIED `app/globals.css:1485-1487` |
| SC-2 | Major | Tour | Free `freeSelect` loses its target when the owner's own search or margin filter hides the demo card. | CODE-VERIFIED `SavedFreeCostings.tsx:162-176` |
| SC-3 | Major | Tour | Free `snapshots` spotlights the whole workspace (no useful focus). | CODE-VERIFIED selector `[data-free-costing]` |
| SC-4 | Major | Product (tour-owned sample) | The demo costing shown on empty accounts passes `tour-preview-v2` to "Use" (writes a real estimator draft with that source id) and "Duplicate"/"Save as separate quality". | CODE-VERIFIED `QuotesClient.tsx:1413-1441, 1098-1142` |
| SC-5 | Major | Tour | Free passes no `userId`, so nothing is stored; every visit re-invites and calls the server. | CODE-VERIFIED `SavedFreeCostings.tsx:207` |
| SC-6 | Major | Product | Retained Free grant: two pages, two rails and two tours overlap on `/owner/quotes` (PI-12). | CODE-VERIFIED `owner/quotes/page.tsx:36-38` |
| SC-7 | Minor | Tour | Copy is long (3–4 sentences), names "View breakdown / Export" where the card says "Export", promises "Finish restores your page" while the demo persists, and uses English UI labels inside Hindi/Gujarati sentences. | CODE-VERIFIED `lib/i18n/saved-costings-tutorial.ts` |
| SC-8 | Minor | Tour | Style: `shadow-2xl`, amber border and banner, saffron "Next", three progress indicators, 260px panel. | OBSERVED (harness); CODE-VERIFIED `SavedCostingsTutorial.tsx:193-204` |
| SC-9 | Minor | Tour | The count line shows the owner's real "N qualities" above a one-sample list during the tour. | CODE-VERIFIED `QuotesClient.tsx:1357-1360` |

What works: the sample library is rendered from real components with no-op handlers; the export dialog has a `tutorialPreview` mode that cannot print, generate or share; filters, search and selections are never changed (shadowed).

## C. Learning outcomes and coverage

After the tour the owner can: (1) explain that a saved costing is a fixed record of inputs and prices; (2) open a quality and pick a version; (3) read production cost, selling price and profit per metre; (4) choose between reusing a version and starting a new quality; (5) choose an internal or a customer document; (6, Base) send a version to production; (7) start from their own list or save a first costing.

| Requirement | Destination |
| --- | --- |
| Prerequisite: a costing saved in the Cost Estimator | `sc-handoff` (empty variant) |
| Library = fixed snapshots; later rates do not rewrite them | `sc-library` |
| Quality card → versions → pick a version | `sc-versions` |
| Read cost, price, profit per metre | `sc-economics` (worked example) |
| Use vs Duplicate (and the draft-replace question) | `sc-reuse` (+ More detail) |
| Internal vs customer document; sharing after PDF | `sc-export` (+ More detail) |
| Base: Activate for Production | `sc-production` (Base only) |
| Compare two versions | Optional walkthrough "Compare versions" |
| Search, sort, margin filter, favourites, archive | Existing rail help disclosure (unchanged content, corrected where listed in GT-03); omitted from the core tour because they are self-explanatory list controls |
| Free: snapshots do not use the allowance; no versions or comparison on Free | `scf-snapshots` |
| Next action | `sc-handoff` / `scf-handoff` |

## D. Structure

- **Paid core (Lite 6 steps, Base 7):** library → versions → economics → reuse → export → (production) → handoff. It follows the order in which an owner actually uses a saved costing: find it, pick the version, trust the numbers, then act on it.
- **Free core (4 steps):** snapshots → open → export → handoff. Free has no versions, reuse or comparison, so those steps are absent, not disabled.
- **Optional walkthrough "Compare versions" (paid, 4 steps):** select → result → details → handoff. Launched from its own rail button (DR-24). Records nothing (§7.2).
- **Empty account:** identical steps; the samples are the only records. Handoff uses the `empty` variant.
- **Load error (`ending === 'unavailable'`):** identical steps; handoff uses the `unavailable` variant.
- **Retained Free grant on `/owner/quotes`:** only the paid tour is offered. `SavedFreeCostings` gets an `embedded` prop that suppresses its rail and guide.

## E. Steps

Mechanics come from the presets in plan §5.3; only differences are listed. Every step: observe only; progression = Next; Back re-derives the previous step; Exit ends the tour (TC-9); recovery = TC-8 with the shared `unavailable` text unless a step gives its own.

Existing anchors are kept. Proposed anchors are marked *(proposed)*.

### Paid core

| # | Step id (existing) | Preset | Anchor / context | Derived page state | Acceptance (in addition to plan §10.4) |
| --- | --- | --- | --- | --- | --- |
| 1 | `find` → id kept, content `sc-library` | PS-SAMPLE | `[data-costing-tour="sample"]` | Sample library replaces the list; count line shows `1 sample quality` in all cases (fixes SC-9); sample banner DR-09 replaces the amber one | Outline encloses the sample quality card; panel beside it (right at ≥1280) |
| 2 | `versions` | PS-SAMPLE-DIALOG | `[data-costing-tour="versions"]` / context `[data-costing-tour-dialog="true"]` | Library dialog open for `tour-preview`, no version selected | Dialog laid out per DR-15; panel in the reserved column; no overlap (fixes SC-1) |
| 3 | `economics` | PS-SAMPLE-DIALOG | `[data-costing-tour="economics"]` / same context | v2 selected | Numbers in copy equal the rendered sample (₹17.44/m, ₹19.82/m) |
| 4 | `reuse` | PS-SAMPLE-DIALOG | `[data-costing-tour="reuse"]` / same context | v2 selected | Buttons visible, handlers no-op |
| 5 | `internal` | PS-SAMPLE-DIALOG | `[data-costing-tour="export-modes"]` / context: the export `DialogContent` (`[data-costing-tour-dialog="true"]` inside `CostingExportDialog`) | Export dialog in `tutorialPreview`, internal mode | Print/PDF/share return early (existing) |
| 6 | `production` (Base only) | PS-SAMPLE-DIALOG | `[data-costing-tour="production"]` / library dialog | v2 selected | Absent on Lite |
| 7 | `finish` → content `sc-handoff` | PS-HANDOFF | existing: `[data-tour-anchor="costings.first-card"]` *(proposed, on the first quality card rendered by `SavedQualityLibraryView` when not in a tour)*; empty/unavailable: `[data-tour-anchor="costings.new"]` *(proposed, on both "New Costing" buttons: header `QuotesClient.tsx:1242-1253` and right-rail pill ~1506)* | Samples removed; live list visible | Done focuses the anchor; on empty accounts the demo costing (D-18) is back in the list, and the anchor is New Costing |

### Free core

| # | Step id | Preset | Anchor / context | Derived page state | Acceptance |
| --- | --- | --- | --- | --- | --- |
| 1 | `snapshots` | PS-SAMPLE | `[data-costing-tour="free-sample"]` (was the whole workspace) | Demo card rendered first **regardless of search, sort and margin filters** (shadowing; fixes SC-2/SC-3); filters untouched | Outline encloses the demo card only |
| 2 | `freeSelect` | PS-SAMPLE | `[data-tour-anchor="free-costings.sample-export"]` *(proposed, the demo card's Export button, `SavedFreeCostings.tsx` ~419)* | Same | Outline on the Export button |
| 3 | `internal` | PS-SAMPLE-DIALOG | `[data-costing-tour="export-modes"]` / export dialog | Export dialog in `tutorialPreview` for the demo | No PDF generated |
| 4 | `finish` | PS-HANDOFF | snapshots exist: `[data-tour-anchor="free-costings.first-card"]` *(proposed)*; none: `[data-tour-anchor="free-costings.new"]` *(proposed, header "New Costing", ~214)* | Demo/tour state removed | Done focuses the anchor |

### Optional walkthrough "Compare versions" (paid)

| # | Step id | Preset | Anchor / context | Derived page state |
| --- | --- | --- | --- | --- |
| 1 | `compareSelect` | PS-SAMPLE-DIALOG | `[data-costing-tour="versions"]` / library dialog | Library dialog, comparison mode, both sample versions ticked (existing) |
| 2 | `comparison` | PS-SAMPLE-DIALOG | `[data-costing-tour="comparison"]` (the comparison `DialogContent`) | Comparison dialog open with the two samples |
| 3 | `comparisonDetails` | PS-SAMPLE-DIALOG | `[data-costing-tour="comparison-details"]` / comparison dialog | Details expanded (existing `open={tourStep === 'comparisonDetails'}`) |
| 4 | `compareHandoff` *(new id)* | PS-HANDOFF | `[data-tour-anchor="costings.compare"]` *(proposed, the toolbar "Compare" toggle ~1303-1331)* | Samples removed |

Launcher: rail `railButton` "Compare versions" (existing, text updated), directly under the guide.

## F. Copy

Keys live in `lib/i18n/saved-costings-tutorial.ts` (rewritten; the old keys that are not listed here are deleted). `{c:*}` tokens: §F.2. `{cost}`, `{price}`, `{profit}` are filled from the rendered sample: `makeSavedCostingTourExamples()[0].result.productionCostPerM`, `.suggestedSellingPricePerM` and `.profitPerM`, formatted `en-IN` with 2 decimals, so copy and screen cannot drift. At `f7cff98` cost and price are ₹17.44 and ₹19.82; GT-03 records the rendered `profitPerM` in its evidence and a test pins all three to the calculation.

### F.1 Step copy

Step id → copy key: paid `find` → `find`, `versions`, `economics`, `reuse`, `internal`, `production` (same), `finish` → `handoff.{existing|empty|unavailable}`; Free `snapshots` → `free.snapshots`, `freeSelect` → `free.open`, `internal` → `internal`, `finish` → `free.handoff.{existing|empty}`; Compare `compareSelect` → `compare.select`, `comparison` → `compare.result`, `comparisonDetails` → `compare.details`, `compareHandoff` → `compare.handoff`.

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `find.title` | Every saved costing is a fixed record | દરેક સાચવેલી કોસ્ટિંગ એક પાકો રેકોર્ડ છે | हर सेव की गई कॉस्टिंग एक पक्का रिकॉर्ड है |
| `find.body` | Each card is one quality. Its versions keep the inputs and prices from the day you saved them; later yarn rates never change them. | દરેક કાર્ડ એક ક્વોલિટી છે. તેના વર્ઝનમાં સાચવ્યા દિવસના ઇનપુટ અને ભાવ રહે છે; પછીના યાર્નના ભાવ તેને બદલતા નથી. | हर कार्ड एक क्वालिटी है। उसके वर्ज़न में सेव करने वाले दिन के इनपुट और भाव रहते हैं; बाद के धागे के रेट उन्हें नहीं बदलते। |
| `versions.title` | Open the version you mean | તમને જોઈતું વર્ઝન ખોલો | जो वर्ज़न चाहिए, उसे खोलें |
| `versions.body` | Open a quality card to see its versions. Choose {c:viewBreakdown} next to a date to read that version. | વર્ઝન જોવા ક્વોલિટી કાર્ડ ખોલો. તારીખની બાજુમાં {c:viewBreakdown} પસંદ કરીને તે વર્ઝન વાંચો. | वर्ज़न देखने के लिए क्वालिटी कार्ड खोलें। तारीख के पास {c:viewBreakdown} चुनकर वह वर्ज़न पढ़ें। |
| `versions.detail` | A quality with only one version opens it directly. Archived versions stay under {c:archived}. | એક જ વર્ઝન હોય તો તે સીધું ખૂલે છે. આર્કાઇવ કરેલા વર્ઝન {c:archived}માં રહે છે. | एक ही वर्ज़न हो तो वह सीधे खुलता है। आर्काइव किए वर्ज़न {c:archived} में रहते हैं। |
| `economics.title` | Read cost, price and profit | ખર્ચ, ભાવ અને નફો વાંચો | लागत, भाव और मुनाफ़ा पढ़ें |
| `economics.body` | In sample v2, production cost is ₹{cost}/m and the selling price is ₹{price}/m, so you keep ₹{profit} on every metre. | નમૂના v2માં ઉત્પાદન ખર્ચ ₹{cost}/મીટર અને વેચાણ ભાવ ₹{price}/મીટર છે, એટલે દરેક મીટરે ₹{profit} નફો રહે છે. | नमूना v2 में उत्पादन लागत ₹{cost}/मीटर और बिक्री भाव ₹{price}/मीटर है, यानी हर मीटर पर ₹{profit} मुनाफ़ा बचता है। |
| `economics.detail` | These numbers come from the inputs saved with v2, not from today's rates. Open the breakdown above them to see yarn, weaving and overhead separately. | આ આંકડા v2 સાથે સાચવેલા ઇનપુટમાંથી આવે છે, આજના ભાવમાંથી નહીં. યાર્ન, વીવિંગ અને ઓવરહેડ અલગ જોવા ઉપરની વિગત ખોલો. | ये आँकड़े v2 के साथ सेव इनपुट से आते हैं, आज के रेट से नहीं। धागा, बुनाई और ओवरहेड अलग देखने के लिए ऊपर का विवरण खोलें। |
| `reuse.title` | Reuse a version or start a new quality | વર્ઝન ફરી વાપરો કે નવી ક્વોલિટી શરૂ કરો | वर्ज़न दोबारा इस्तेमाल करें या नई क्वालिटी शुरू करें |
| `reuse.body` | {c:use} opens this version in the Cost Estimator so you can change it and save a new version. {c:duplicate} starts a separate quality from it. | {c:use} આ વર્ઝનને ખર્ચ અંદાજકમાં ખોલે છે, જેથી ફેરફાર કરી નવું વર્ઝન સાચવી શકો. {c:duplicate} તેમાંથી અલગ ક્વોલિટી શરૂ કરે છે. | {c:use} इस वर्ज़न को लागत अनुमानक में खोलता है, ताकि आप बदलाव करके नया वर्ज़न सेव कर सकें। {c:duplicate} इससे अलग क्वालिटी शुरू करता है। |
| `reuse.detail` | If the estimator already has unsaved work, Weavly asks before replacing it. Neither button changes this saved version. | અંદાજકમાં સાચવ્યા વગરનું કામ હોય તો બદલતાં પહેલાં Weavly પૂછે છે. કોઈ બટન આ સાચવેલું વર્ઝન બદલતું નથી. | अनुमानक में बिना सेव किया काम हो तो बदलने से पहले Weavly पूछता है। कोई भी बटन इस सेव वर्ज़न को नहीं बदलता। |
| `internal.title` | Choose who will see the document | દસ્તાવેજ કોણ જોશે તે પસંદ કરો | दस्तावेज़ कौन देखेगा, यह चुनें |
| `internal.body` | {c:internalEstimate} shows your costs and margin. {c:customerQuotation} shows only the price and your terms. | {c:internalEstimate}માં તમારો ખર્ચ અને માર્જિન દેખાય છે. {c:customerQuotation}માં ફક્ત ભાવ અને તમારી શરતો દેખાય છે. | {c:internalEstimate} में आपकी लागत और मार्जिन दिखता है। {c:customerQuotation} में सिर्फ़ भाव और आपकी शर्तें दिखती हैं। |
| `internal.detail` | Previewing sends nothing. After you create a customer PDF you can share it from your phone. | પ્રીવ્યૂ કરવાથી કંઈ મોકલાતું નથી. ગ્રાહક PDF બનાવ્યા પછી તમે તેને ફોનમાંથી મોકલી શકો છો. | प्रीव्यू करने से कुछ नहीं भेजा जाता। ग्राहक PDF बनाने के बाद आप उसे फ़ोन से भेज सकते हैं। |
| `production.title` | Send a version to production | વર્ઝનને ઉત્પાદનમાં મોકલો | वर्ज़न को उत्पादन में भेजें |
| `production.body` | {c:activateForProduction} opens Production with this version ready to activate. Nothing is produced until you assign looms and record a shift. | {c:activateForProduction} ઉત્પાદન ખોલે છે અને આ વર્ઝન ચાલુ કરવા તૈયાર રાખે છે. લૂમ ફાળવી શિફ્ટ નોંધો ત્યાં સુધી કંઈ ઉત્પાદન થતું નથી. | {c:activateForProduction} उत्पादन खोलता है और यह वर्ज़न चालू करने के लिए तैयार रखता है। लूम देकर शिफ्ट दर्ज करने तक कुछ उत्पादन नहीं होता। |
| `handoff.existing.title` | Open one of your costings | તમારી એક કોસ્ટિંગ ખોલો | अपनी एक कॉस्टिंग खोलें |
| `handoff.existing.body` | Choose a quality card to check its latest version before you quote or reuse it. | ભાવ આપતાં કે ફરી વાપરતાં પહેલાં ક્વોલિટી કાર્ડ ખોલી તેનું છેલ્લું વર્ઝન તપાસો. | भाव देने या दोबारा इस्तेमाल से पहले क्वालिटी कार्ड खोलकर उसका आख़िरी वर्ज़न जाँचें। |
| `handoff.empty.title` | Save your first costing | તમારી પહેલી કોસ્ટિંગ સાચવો | अपनी पहली कॉस्टिंग सेव करें |
| `handoff.empty.body` | Choose {c:newCosting} to open the Cost Estimator. Your costing appears here after you save it. | ખર્ચ અંદાજક ખોલવા {c:newCosting} પસંદ કરો. સાચવ્યા પછી તમારી કોસ્ટિંગ અહીં દેખાશે. | लागत अनुमानक खोलने के लिए {c:newCosting} चुनें। सेव करने के बाद आपकी कॉस्टिंग यहाँ दिखेगी। |
| `handoff.unavailable.title` | Your list didn't load | તમારી યાદી લોડ થઈ નથી | आपकी सूची लोड नहीं हुई |
| `handoff.unavailable.body` | Refresh the page to see your saved costings, or choose {c:newCosting} to start a new one. | સાચવેલી કોસ્ટિંગ જોવા પેજ રિફ્રેશ કરો, અથવા નવી શરૂ કરવા {c:newCosting} પસંદ કરો. | सेव की गई कॉस्टिंग देखने के लिए पेज रीफ़्रेश करें, या नई शुरू करने के लिए {c:newCosting} चुनें। |
| `free.snapshots.title` | Each Free costing is kept here | દરેક Free કોસ્ટિંગ અહીં રહે છે | हर Free कॉस्टिंग यहाँ रहती है |
| `free.snapshots.body` | Every costing you calculate and save appears here as a fixed record. Opening or exporting it does not use your monthly allowance. | તમે ગણેલી અને સાચવેલી દરેક કોસ્ટિંગ અહીં પાકા રેકોર્ડ તરીકે દેખાય છે. તેને ખોલવા કે એક્સપોર્ટ કરવાથી માસિક મર્યાદા વપરાતી નથી. | आपकी गिनी और सेव की गई हर कॉस्टिंग यहाँ पक्के रिकॉर्ड के रूप में दिखती है। उसे खोलने या एक्सपोर्ट करने से मासिक सीमा खर्च नहीं होती। |
| `free.snapshots.detail` | Free keeps one version per costing. Paid plans add versions, comparison and reuse. | Free માં દરેક કોસ્ટિંગનું એક જ વર્ઝન રહે છે. પેઇડ પ્લાનમાં વર્ઝન, સરખામણી અને ફરી ઉપયોગ મળે છે. | Free में हर कॉस्टिंग का एक ही वर्ज़न रहता है। पेड प्लान में वर्ज़न, तुलना और दोबारा इस्तेमाल मिलता है। |
| `free.open.title` | Export a costing sheet | કોસ્ટિંગ શીટ એક્સપોર્ટ કરો | कॉस्टिंग शीट एक्सपोर्ट करें |
| `free.open.body` | {c:export} on a card opens its cost per metre and selling price as a document you can print or save. | કાર્ડ પરનું {c:export} તેનો પ્રતિ મીટર ખર્ચ અને વેચાણ ભાવ છાપી કે સાચવી શકાય તેવા દસ્તાવેજમાં ખોલે છે. | कार्ड पर {c:export} उसकी प्रति मीटर लागत और बिक्री भाव को ऐसे दस्तावेज़ में खोलता है जिसे आप छाप या सेव कर सकते हैं। |
| `free.handoff.existing.title` | Open one of your costings | તમારી એક કોસ્ટિંગ ખોલો | अपनी एक कॉस्टिंग खोलें |
| `free.handoff.existing.body` | Choose a card to check its numbers before you give a price. | ભાવ આપતાં પહેલાં કાર્ડ ખોલી તેના આંકડા તપાસો. | भाव देने से पहले कार्ड खोलकर उसके आँकड़े जाँचें। |
| `free.handoff.empty.title` | Calculate your first costing | તમારી પહેલી કોસ્ટિંગ ગણો | अपनी पहली कॉस्टिंग गिनें |
| `free.handoff.empty.body` | Choose {c:newCosting} to open the Cost Estimator. Saved costings appear here. | ખર્ચ અંદાજક ખોલવા {c:newCosting} પસંદ કરો. સાચવેલી કોસ્ટિંગ અહીં દેખાશે. | लागत अनुमानक खोलने के लिए {c:newCosting} चुनें। सेव की गई कॉस्टिंग यहाँ दिखेंगी। |
| `compare.select.title` | Pick two versions of one quality | એક ક્વોલિટીના બે વર્ઝન પસંદ કરો | एक क्वालिटी के दो वर्ज़न चुनें |
| `compare.select.body` | Turn on {c:compare}, open a quality and tick two versions. Then choose {c:compareCostings}. | {c:compare} ચાલુ કરો, ક્વોલિટી ખોલો અને બે વર્ઝન પર ટિક કરો. પછી {c:compareCostings} પસંદ કરો. | {c:compare} चालू करें, क्वालिटी खोलें और दो वर्ज़न पर टिक करें। फिर {c:compareCostings} चुनें। |
| `compare.result.title` | See what changed | શું બદલાયું તે જુઓ | देखें क्या बदला |
| `compare.result.body` | Old, New and Change show every figure side by side. Here v2 costs ₹{costChange}/m more than v1. | જૂનું, નવું અને ફેરફાર દરેક આંકડો બાજુબાજુમાં બતાવે છે. અહીં v2 નો ખર્ચ v1 કરતાં ₹{costChange}/મીટર વધુ છે. | पुराना, नया और बदलाव हर आँकड़ा साथ-साथ दिखाते हैं। यहाँ v2 की लागत v1 से ₹{costChange}/मीटर ज़्यादा है। |
| `compare.details.title` | Find the input that caused it | ફેરફારનું કારણ બનેલો ઇનપુટ શોધો | बदलाव की वजह बना इनपुट खोजें |
| `compare.details.body` | Open the calculation details to see which input moved, such as a yarn rate or the weaving charge. | કયો ઇનપુટ બદલાયો, જેમ કે યાર્નનો ભાવ કે વીવિંગ ચાર્જ, તે જોવા ગણતરીની વિગત ખોલો. | कौन सा इनपुट बदला, जैसे धागे का रेट या बुनाई शुल्क, यह देखने के लिए गणना का विवरण खोलें। |
| `compare.handoff.title` | Compare your own versions | તમારા પોતાના વર્ઝનની સરખામણી કરો | अपने वर्ज़न की तुलना करें |
| `compare.handoff.body` | Choose {c:compare} to start. You need two saved versions of the same quality. | શરૂ કરવા {c:compare} પસંદ કરો. એક જ ક્વોલિટીના બે સાચવેલા વર્ઝન જોઈએ. | शुरू करने के लिए {c:compare} चुनें। एक ही क्वालिटी के दो सेव वर्ज़न चाहिए। |
| `guide.benefit` | See how to find a saved costing, read its numbers and reuse it. | સાચવેલી કોસ્ટિંગ શોધવી, તેના આંકડા વાંચવા અને ફરી વાપરવી કેવી રીતે તે જુઓ. | सेव की गई कॉस्टिंग खोजना, उसके आँकड़े पढ़ना और दोबारा इस्तेमाल करना देखें। |
| `compare.launcher` | Compare versions | વર્ઝનની સરખામણી | वर्ज़न की तुलना |

`{costChange}` = v2 production cost − v1 production cost from the rendered samples (₹1.65/m at `f7cff98`). `guide.benefit` replaces `tourInvitationCopy[*].benefits['saved-costings']`.

### F.2 Control tokens

Resolver = the exact call the live control renders with (LR-02). "Add phrase" = add an entry to `lib/i18n/locales/{en,gu,hi}.ts` under `tourControls.savedCostings.*` whose English value equals the literal, so the phrase map translates the live control and the token alike (LR-03).

| Token | Live render site | Resolver | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- | --- |
| `viewBreakdown` | `QuotesClient.tsx:746` `tx('View breakdown')` | `tx('View breakdown')` | વિગત જુઓ | विवरण देखें | Add phrase (today: word-order fallback) |
| `archived` | toolbar toggle `tx('Archived')` | `tx('Archived')` | આર્કાઇવ કરેલી | आर्काइव की गई | none |
| `use` | reuse group `tx('Use')` | `tx('Use')` | વાપરો | इस्तेमाल करें | Add phrase (Hindi today "उपयोग करें"; keep if native review prefers) |
| `duplicate` | reuse group `tx('Duplicate')` | `tx('Duplicate')` | નકલ બનાવો | कॉपी बनाएं | none |
| `internalEstimate` | `CostingExportDialog.tsx:421` literal | wrap in `tx()`; resolver `tx('Internal Cost Estimate')` | આંતરિક ખર્ચ અંદાજ | आंतरिक लागत अनुमान | Wrap + add phrase |
| `customerQuotation` | `CostingExportDialog.tsx:431` literal | `tx('Customer Quotation')` | ગ્રાહક ક્વોટેશન | ग्राहक कोटेशन | Wrap + add phrase |
| `activateForProduction` | `QuotesClient.tsx:593, 620` | `tx('Activate for Production')` | ઉત્પાદન માટે ચાલુ કરો | उत्पादन के लिए सक्रिय करें | Add phrase (today: garbled) |
| `newCosting` | header and rail pill | `tx('New Costing')` | નવી કોસ્ટિંગ | नई कॉस्टिंग | none |
| `export` | Free card / reuse group | `tx('Export')` | એક્સપોર્ટ કરો | एक्सपोर्ट करें | Add phrase for Hindi (today "निर्यात करें") |
| `compare` | toolbar | `tx('Compare')` | સરખામણી કરો | तुलना करें | none |
| `compareCostings` | comparison bar | `tx('Compare Costings')` | કોસ્ટિંગની તુલના કરો | कॉस्टिंग की तुलना करें | none |

Before changing a resolver, the executor confirms the render site; if a control renders through `t('key')`, that key is the resolver instead.

## G. State variants

| Variant | Behavior |
| --- | --- |
| Free / Lite / Base | Free core; paid core without / with `production`. |
| Empty account | Same steps; handoff `empty`. Demo costing (D-18) remains in the list afterwards with guarded handlers. |
| Load error | Handoff `unavailable`. |
| Owner has search text, a margin filter, favourites-only or archived view on | Shadowed during the tour (samples shown regardless); all restored exactly afterwards. Handoff anchor may be hidden by the owner's filter: TC-8 with `handoff.existing.body` still valid. |
| Retained Free grant on `/owner/quotes` | Only the paid guide and tour (SC-6 fix). |
| Direct navigation mid-tour | TC-9; nothing recorded. |
| Replay | Compact launcher. |

## H. Comprehension check

"A buyer asks you today for the price of the quality you costed last month. Where do you check that price, and how do you give him a document that does not show your margin?" Expected: open Saved Costings, open the quality card, pick the latest version, read the selling price; Export → Customer Quotation.

## I. Implementation notes for GT-03

- Guard the demo costing (DS-02): in the demo branch (`QuotesClient.tsx:1413-1441`) `onOpen`, `onStartFrom` and `onSaveAsNewQuality` show the existing sample toast `tx('This is a sample costing for exploration.')` instead of calling `handleRestore`. Export stays (it writes nothing).
- Free page passes `userId`, `orgId`, `userMetadata` (from `freeContext()` in `app/free/costings/page.tsx`) to `SavedFreeCostings` and on to the tour (SC-5).
- `SavedFreeCostings` accepts `embedded?: boolean`; `owner/quotes/page.tsx` passes `embedded`; when true it renders no left rail and no guide (SC-6).
- The rail help disclosure stays; delete its dead entries (`select`, `searchAndFilters`, `search`, `freeFilters`) and fix `organize`'s English grammar.
- Harness scenarios to add: `quotes` (Lite: `?tier=lite`), `quotes` (Base), `free-costings`, `quotes-compare` (launch the walkthrough button).
