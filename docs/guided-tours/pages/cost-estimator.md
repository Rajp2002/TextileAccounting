# P01 Cost Estimator — tour specification

Status: implemented and PASSED (2026-09-30; human verification deferred by the owner). Implementation: **GT-05**. Gujarati/Hindi: native review pending, not done (LR-08).
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/cost-estimator.md`](../audit/cost-estimator.md).

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Routes | `/owner/estimator` (Lite, Base) → `app/(dashboard)/owner/estimator/EstimatorClient.tsx` (~7.5k lines); `/free` (Free) → `app/free/FreeClient.tsx` renders the same `EstimatorClient` with `freeMode`, `disableAutosave`, `initialTemplates=[]` |
| Entitlement | `estimator` (Free, Lite, Base). Base adds "Start Production" after save. Owner role. |
| Tour today | `components/estimator/CostEstimateTutorial.tsx` (bespoke engine, 753 lines); steps `lib/estimator-tour.ts` (`buildEstimatorCoreTour`); copy `lib/i18n/cost-estimate-workflow.ts` (core) and `lib/i18n/cost-estimate-tutorial.ts` (field guide); prepare/restore `prepareTutorial` (`EstimatorClient.tsx:3584-3598`); row expansion via the `tutorial-expand-row` event (`EstimatorClient.tsx:2343-2354`). |
| Entry today | Rail guide card (halo on first visit), rail button "Field-by-field help · Optional walkthrough". Launcher enabled only when `state.isConfigured && !saving` (`EstimatorClient.tsx:5351`). |
| Default view | Quick (`entryMode` initial `'quick'`, `EstimatorClient.tsx:3572`); Quick sections are seven `EstimatorCard`s (`EstimatorClient.tsx:2838-3246`). |
| Live cost | A floating shortcut on every breakpoint `[data-estimator-field="liveCostShortcut"]` (1484) opens the sheet `#mobile-live-estimate-panel` with `liveCostMetrics` (1558) and `liveCostActions` (1622). |
| Consequential actions | Save Costing / Save New Version (snapshot), Save Quality & Create Costing (recipe + v1), Save baseline (profile), Free "Calculate & save" (uses one Free costing). |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| CE-1 | Major | Tour | The tour forces Detailed view and teaches its layout; owners return to Quick, which has no component-count boxes. | CODE-VERIFIED `prepareTutorial` 3584-3598; audit §4.3 |
| CE-2 | Major | Tour | Warp/weft steps spotlight the component-count boxes while the copy explains yarn rows; the process step spotlights weaving only while describing warping and sizing too; the last paid step spotlights Saved *Qualities* while describing Saved *Costings*. | CODE-VERIFIED `lib/estimator-tour.ts:16-23` |
| CE-3 | Major | Tour | Last step's spotlight is ~1,700px above the viewport (paid) and step 5's target is below it (Free): empty spotlight. | OBSERVED (harness): `estimator` step 10, `free-estimator` steps 5 and 9 |
| CE-4 | Major | Tour | The 43+-step field guide walks every field of every row. | CODE-VERIFIED `CostEstimateTutorial.tsx:200-248` |
| CE-5 | Major | Tour | Every exit (Finish, Skip, Escape) records "dismissed" through `dismissCostEstimateTutorial`, which refreshes `/owner/estimator` and `/free`; completion is never recorded; account metadata is not passed. | CODE-VERIFIED `tutorial-actions.ts:19-20`; audit §2 Persistence |
| CE-6 | Major | Tour | Bespoke engine: fixed timers (150/200/350/500/550 ms), no inert handling for sheets opened mid-tour, mutates React state objects, no scroll restore of its own. | CODE-VERIFIED audit §2, §4 |
| CE-7 | Major | Tour | Hindi/Gujarati copy embeds English labels ("Save Costing", "Calculate & save · uses 1 costing", "Detailed", "Finish"); inconsistent terms (વાણા vs UI ભરણ; यार्न vs सूत). | CODE-VERIFIED audit §5 |
| CE-8 | Minor | Tour | Halo (orange glow) on first visit; `shadow-2xl`, orange gradient progress, two counters. | CODE-VERIFIED `CostEstimateTutorial.tsx:686-744`; `app/globals.css:1567-1600` |
| CE-9 | Minor | Product | Quick view and the Live cost sheet contain hard-coded English titles and labels (PI-17). | audit §4 "Underlying product usability" |

What works: the tour never dispatches estimate inputs; autosave cannot fire from view flags; Free autosave is off; the Free allowance is consumed only by a user's "Calculate & save" click (CODE-VERIFIED audit §3).

## C. Learning outcomes and coverage

After the tour the owner can: (1) say what the page produces (cost and suggested price per metre); (2) name a quality and, on paid plans, load a saved one; (3) fill warp and weft rows (denier/ends or picks/width, rate); (4) add weaving, warping and sizing charges once; (5) choose how overhead is counted; (6) set margin, commission and transport; (7) read Live cost; (8) save correctly (paid: snapshot vs recipe; Free: one allowance); (9) start their own costing.

| Requirement | Destination |
| --- | --- |
| Purpose and top-to-bottom order | `est-purpose` |
| Quality name; paid: load a saved quality | `est-purpose` body; paid More detail |
| Factory defaults (paid wizard) | Existing product guidance (the wizard runs before the tour can launch) |
| Warp inputs and consumption | `est-warp` (+ detail: waste, crimp, GST, Rate Book suggestions) |
| Weft inputs | `est-weft` |
| Weaving charge (₹/m or paisa per pick) | `est-weaving` |
| Warping and sizing (in-house vs outsourced) | `est-warping` |
| Overhead: direct rate vs monthly expenses (₹60,000 ÷ 30,000 m = ₹2/m) | `est-overhead` |
| Margin, broker commission, transport, quantity | `est-pricing` |
| Reading Live cost (₹100/m at 20% → ₹125/m) | `est-live` |
| Save paths; Free allowance | `est-save` (plan variants) |
| Quick vs Detailed view | `est-handoff` body |
| Rate Book "unverified" yarn suggestions, stale-rate dialog | `est-warp` detail (paid) |
| Cost Breakdown audit card (Detailed only), draft Resume banner | Omitted: secondary; both explain themselves on screen |
| Next: Saved Costings; Base: production | `est-save` detail (paid/Base) |

## D. Structure

One core tour, 10 steps on every plan (copy varies by plan). It follows the page top to bottom because that is how a costing is filled in. The field guide is removed (D-09); its useful facts are in More detail. The halo is removed (D-08).

**Tour-owned view state (PS-TOUR-STATE, DS-04).** Captured at launch, restored at TC-9 by the existing restore closure (renamed, same semantics):
- `entryMode = 'quick'` for all steps (restores the owner's previous mode, including Detailed).
- `liveEstimateOpen = true` for `est-live` and `est-save`, `false` otherwise.
- `showQualityLibrary = false`, `showAdvancedOverhead = false`, `assumptionsExpanded` unchanged.
No input, row, draft or reducer state is touched. The `tutorial-expand-row` mechanism is no longer used by the tour; GT-05 removes the tour's dispatch of it (the listener stays if anything else uses it).

**Launch condition** stays `state.isConfigured && !saving` (paid wizard first).

## E. Steps

All steps: observe only; Next/Back/Exit; recovery TC-8 with the shared text. Targets are the whole Quick card so the outline matches the copy (fixes CE-2). Cards taller than the safe view are top-aligned (TC-4) and clipped to it; the panel goes beside them (DR-14).

| # | Step id | Preset | Anchor | State | Acceptance |
| --- | --- | --- | --- | --- | --- |
| 1 | `est-purpose` | PS-TOUR-STATE | `[data-tour-anchor="estimator.quick-basics"]` *(proposed on the Quick "Quality basics" `EstimatorCard`, ~2838)* | Quick | Outline on the card; panel to its right at ≥1280 |
| 2 | `est-warp` | PS-TOUR-STATE | `[data-tour-anchor="estimator.quick-warp"]` *(proposed, ~2880)* | Quick | Card top on screen |
| 3 | `est-weft` | PS-TOUR-STATE | `[data-tour-anchor="estimator.quick-weft"]` *(proposed, ~2978)* | Quick | |
| 4 | `est-weaving` | PS-TOUR-STATE | `[data-tour-anchor="estimator.quick-weaving"]` *(proposed, ~3068)* | Quick | |
| 5 | `est-warping` | PS-TOUR-STATE | `[data-tour-anchor="estimator.quick-warping"]` *(proposed, ~3084)* | Quick | Target on screen (fixes CE-3 Free step 5) |
| 6 | `est-overhead` | PS-TOUR-STATE | `[data-tour-anchor="estimator.quick-overhead"]` *(proposed, ~3199)* | Quick | |
| 7 | `est-pricing` | PS-TOUR-STATE | `[data-tour-anchor="estimator.quick-pricing"]` *(proposed, ~3238)* | Quick | |
| 8 | `est-live` | PS-TOUR-STATE | `[data-estimator-field="liveCostMetrics"]` (existing) / context `#mobile-live-estimate-panel` | Quick + Live cost sheet open | Panel beside the sheet (desktop); sheet not covered |
| 9 | `est-save` | PS-TOUR-STATE | `[data-estimator-field="liveCostActions"]` (existing) / same context | Same | Save controls visible; page inert (no save possible) |
| 10 | `est-handoff` | PS-HANDOFF | `[data-estimator-field="qualityLabel"]` (existing; Quick instance ~2845) | Sheet closed, Quick | Outline on screen (fixes CE-3); Done focuses the quality name input |

Done on step 10 focusing the name input is intentional: it is the first field the owner fills. The page's normal behavior then applies (no tour state remains).

## F. Copy

Copy moves to `lib/i18n/cost-estimate-tutorial.ts` (rewritten; the old field-guide keys and `lib/i18n/cost-estimate-workflow.ts` are deleted once unused). Variants: `paid` (Lite and Base), `base` (Base-only additions), `free`.

### F.1 Step copy

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `purpose.title` | Work out cost and price per metre | પ્રતિ મીટર ખર્ચ અને ભાવ ગણો | प्रति मीटर लागत और भाव निकालें |
| `purpose.body` | Fill the sections from top to bottom; the price updates as you type. Start with the fabric's name. | ઉપરથી નીચે વિભાગો ભરો; લખતાં જ ભાવ બદલાય છે. શરૂઆત કાપડના નામથી કરો. | ऊपर से नीचे हिस्से भरें; लिखते ही भाव बदलता है। शुरुआत कपड़े के नाम से करें। |
| `purpose.detail.paid` | To start from a quality you saved before, choose {c:changeQuality} at the top. | પહેલાં સાચવેલી ક્વોલિટીથી શરૂ કરવા ઉપર {c:changeQuality} પસંદ કરો. | पहले सेव की गई क्वालिटी से शुरू करने के लिए ऊपर {c:changeQuality} चुनें। |
| `warp.title` | Warp yarn: denier, ends and rate | તાણા: ડેનિયર, તાર અને ભાવ | ताना: डेनियर, तार और रेट |
| `warp.body` | For each warp yarn enter its denier, total ends and price per kg. Weavly works out the kg used per 100 m and its cost per metre. | દરેક તાણા યાર્ન માટે ડેનિયર, કુલ તાર અને કિલોનો ભાવ લખો. Weavly 100 મીટરે કેટલા કિલો વપરાય અને મીટરદીઠ ખર્ચ ગણે છે. | हर ताना धागे का डेनियर, कुल तार और किलो का रेट लिखें। Weavly 100 मीटर में लगने वाले किलो और मीटर की लागत निकालता है। |
| `warp.detail` | Waste and crimp increase the yarn used; GST is added to the rate. If you know the kg per 100 m, switch the row to manual kg. | વેસ્ટ અને ક્રિમ્પથી વપરાતું યાર્ન વધે છે; ભાવમાં GST ઉમેરાય છે. 100 મીટરે કિલો ખબર હોય તો લાઇન મેન્યુઅલ કિલોમાં ફેરવો. | वेस्ट और क्रिम्प से लगने वाला धागा बढ़ता है; रेट में GST जुड़ता है। 100 मीटर के किलो पता हों तो लाइन को मैनुअल किलो पर करें। |
| `warp.detail.paid` | Rates filled from your Yarn Rate Book are marked until you confirm them. | તમારી યાર્ન રેટ બુકમાંથી ભરાયેલા ભાવ તમે ખાતરી ન કરો ત્યાં સુધી ચિહ્નિત રહે છે. | आपकी यार्न रेट बुक से भरे रेट आपके पुष्टि करने तक चिह्नित रहते हैं। |
| `weft.title` | Weft yarn: picks and width | ભરણ: પિક્સ અને પહોળાઈ | बाना: पिक्स और चौड़ाई |
| `weft.body` | For each weft yarn enter picks per inch, the finished width and its price per kg. Weft use depends on these, not on ends. | દરેક ભરણ યાર્ન માટે ઇંચદીઠ પિક્સ, તૈયાર પહોળાઈ અને કિલોનો ભાવ લખો. ભરણનો વપરાશ આના પર આધાર રાખે છે, તાર પર નહીં. | हर बाना धागे के लिए प्रति इंच पिक्स, तैयार चौड़ाई और किलो का रेट लिखें। बाने की खपत इन पर निर्भर है, तार पर नहीं। |
| `weaving.title` | Weaving charge | વીવિંગ ચાર્જ | बुनाई शुल्क |
| `weaving.body` | Enter what weaving costs you, either per metre or in paisa per pick. | વીવિંગનો ખર્ચ મીટરદીઠ અથવા પિકદીઠ પૈસામાં લખો. | बुनाई की लागत प्रति मीटर या प्रति पिक पैसे में लिखें। |
| `warping.title` | Warping and sizing | વૉર્પિંગ અને સાઇઝિંગ | वार्पिंग और साइज़िंग |
| `warping.body` | Add these charges if you pay for them, in-house or outside. Count each charge once, not again in overhead. | આ ચાર્જ તમે ચૂકવતા હો તો ઉમેરો, ઘરમાં કે બહાર. દરેક ચાર્જ એક જ વાર ગણો, ફરી ઓવરહેડમાં નહીં. | ये शुल्क आप देते हैं तो जोड़ें, अंदर या बाहर। हर शुल्क एक बार गिनें, ओवरहेड में दोबारा नहीं। |
| `overhead.title` | Factory overhead per metre | મીટરદીઠ ફેક્ટરી ઓવરહેડ | प्रति मीटर फैक्ट्री ओवरहेड |
| `overhead.body` | Enter your overhead per metre, or divide monthly expenses by monthly production: ₹60,000 ÷ 30,000 m = ₹2/m. | મીટરદીઠ ઓવરહેડ લખો, અથવા માસિક ખર્ચને માસિક ઉત્પાદનથી ભાગો: ₹60,000 ÷ 30,000 મીટર = ₹2/મીટર. | प्रति मीटर ओवरहेड लिखें, या मासिक खर्च को मासिक उत्पादन से भाग दें: ₹60,000 ÷ 30,000 मीटर = ₹2/मीटर। |
| `pricing.title` | Margin, commission and transport | માર્જિન, દલાલી અને ભાડું | मार्जिन, दलाली और भाड़ा |
| `pricing.body` | Set the margin you want and any broker commission and transport. The suggested price includes all three. | તમારે જોઈતું માર્જિન અને દલાલી તથા ભાડું લખો. સૂચવેલા ભાવમાં ત્રણેય આવી જાય છે. | अपना चाहा मार्जिन और दलाली व भाड़ा लिखें। सुझाए भाव में तीनों शामिल होते हैं। |
| `live.title` | Read the result | પરિણામ વાંચો | नतीजा पढ़ें |
| `live.body.paid` | {c:liveCost} shows production cost and the suggested price per metre. A cost of ₹100/m at 20% margin gives ₹125/m. | {c:liveCost}માં ઉત્પાદન ખર્ચ અને સૂચવેલો મીટરદીઠ ભાવ દેખાય છે. ₹100/મીટર ખર્ચ પર 20% માર્જિનથી ₹125/મીટર થાય. | {c:liveCost} में उत्पादन लागत और सुझाया गया प्रति मीटर भाव दिखता है। ₹100/मीटर लागत पर 20% मार्जिन से ₹125/मीटर बनता है। |
| `live.body.free` | {c:liveCost} lists what is still missing. On Free, the cost and price appear after you calculate and save. | {c:liveCost}માં હજી ખૂટતું શું છે તે દેખાય છે. Free માં ગણતરી કરી સાચવ્યા પછી ખર્ચ અને ભાવ દેખાય છે. | {c:liveCost} में बताता है कि अभी क्या बाकी है। Free में गणना करके सेव करने के बाद लागत और भाव दिखते हैं। |
| `save.title.paid` | Save a fixed costing | પાકી કોસ્ટિંગ સાચવો | पक्की कॉस्टिंग सेव करें |
| `save.body.paid` | {c:saveCosting} keeps today's inputs and price in Saved Costings. {c:saveQuality} also keeps the recipe to reuse later. | {c:saveCosting} આજના ઇનપુટ અને ભાવ સાચવેલી કોસ્ટિંગમાં રાખે છે. {c:saveQuality} રેસીપી પણ પછી વાપરવા રાખે છે. | {c:saveCosting} आज के इनपुट और भाव सेव की गई कॉस्टिंग में रखता है। {c:saveQuality} रेसिपी को बाद में इस्तेमाल के लिए भी रखता है। |
| `save.detail.paid` | Saving again later creates a new version; the earlier one stays as it was. | પછી ફરી સાચવવાથી નવું વર્ઝન બને છે; પહેલાનું જેમ હતું તેમ રહે છે. | बाद में फिर सेव करने से नया वर्ज़न बनता है; पहला वैसा ही रहता है। |
| `save.detail.base` | After saving, {c:startProduction} opens Production with this costing ready to activate. | સાચવ્યા પછી {c:startProduction} ઉત્પાદન ખોલે છે અને આ કોસ્ટિંગ ચાલુ કરવા તૈયાર રાખે છે. | सेव करने के बाद {c:startProduction} उत्पादन खोलता है और यह कॉस्टिंग चालू करने के लिए तैयार रखता है। |
| `save.title.free` | Calculating and saving uses one costing | ગણતરી કરી સાચવવાથી એક કોસ્ટિંગ વપરાય છે | गणना करके सेव करने पर एक कॉस्टिंग लगती है |
| `save.body.free` | {c:calculateSave} shows your result and keeps it in Saved Costings. Each time uses one of your monthly Free costings. | {c:calculateSave} તમારું પરિણામ બતાવે છે અને સાચવેલી કોસ્ટિંગમાં રાખે છે. દરેક વખતે તમારી માસિક Free કોસ્ટિંગમાંથી એક વપરાય છે. | {c:calculateSave} आपका नतीजा दिखाता है और सेव की गई कॉस्टिंग में रखता है। हर बार आपकी मासिक Free कॉस्टिंग में से एक लगती है। |
| `save.detail.free` | Check every section first; the guide itself never uses a costing. | પહેલાં દરેક વિભાગ તપાસો; આ માર્ગદર્શિકા પોતે કોઈ કોસ્ટિંગ વાપરતી નથી. | पहले हर हिस्सा जाँचें; यह मार्गदर्शिका खुद कोई कॉस्टिंग नहीं लगाती। |
| `handoff.title` | Start with your fabric's name | તમારા કાપડના નામથી શરૂ કરો | अपने कपड़े के नाम से शुरू करें |
| `handoff.body` | Type the quality name, then work down the sections. {c:detailed} view shows every input if you need more control. | ક્વોલિટીનું નામ લખો, પછી નીચેના વિભાગો ભરો. વધુ નિયંત્રણ જોઈએ તો {c:detailed} વ્યૂમાં દરેક ઇનપુટ દેખાય છે. | क्वालिटी का नाम लिखें, फिर नीचे के हिस्से भरें। ज़्यादा नियंत्रण चाहिए तो {c:detailed} व्यू में हर इनपुट दिखता है। |
| `guide.benefit` | See how to work out a fabric's cost and selling price. | કાપડનો ખર્ચ અને વેચાણ ભાવ કેવી રીતે ગણવો તે જુઓ. | कपड़े की लागत और बिक्री भाव कैसे निकालें, यह देखें। |

Words to confirm in native review: "તાર/तार" for ends (UI uses "Beam ends"); "ભાડું/भाड़ा" for transport charge (UI: "પરિવહન ચાર્જ/परिवहन शुल्क"); "દલાલી/दलाली" for broker commission (UI: "બ્રોકર કમિશન/ब्रोकर कमीशन"). If the reviewer prefers the UI words, use them in both UI and tour.

### F.2 Control tokens

| Token | Live render site | Resolver | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- | --- |
| `changeQuality` | quality picker "Change quality" (5797) | `tx('Change quality')` | ક્વોલિટી બદલો | क्वालिटी बदलें | Add phrase (today: word order) |
| `liveCost` | shortcut and sheet title (1492, 1543) | `tx('Live cost')` | લાઇવ ખર્ચ | लाइव लागत | Wrap literals in `tx()` + add phrase |
| `saveCosting` | `topCostingActionLabel` (4189-4191) | same expression as the button | કોસ્ટિંગ સાચવો | कॉस्टिंग सेव करें | Add phrases for "Save Costing" and "Save New Version" |
| `saveQuality` | "Save Quality & Create Costing" | `t('estimator…saveQualityAndCosting')` if present, else `tx(…)` | ક્વોલિટી સાચવો અને કોસ્ટિંગ બનાવો | क्वालिटी सेव करें और कॉस्टिंग बनाएं | none (already translated) |
| `calculateSave` | Free save button | same expression as the button | ગણતરી કરો અને સાચવો · 1 કોસ્ટિંગ વપરાશે | गणना करें और सेव करें · 1 कॉस्टिंग लगेगी | Add phrase (today: half English) |
| `startProduction` | post-save panel (5084) | same expression | ઉત્પાદન શરૂ કરો | उत्पादन शुरू करें | Add phrase |
| `detailed` | view tabs | same expression as the tab | વિગતવાર | विस्तृत | none |

### F.3 Owner addendum — Save labels (2026-09-28)

The owner supplied the missing Save New Version wording in the Wave 1 coordinator chat as romanized Hindi “save naya version” and Gujarati “save navi version”. The coordinator rendered it using those words and the existing save/version terminology as follows. Native-language review remains deferred to the review gate.

| Label | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| Save New Version | Save New Version | નવી વર્ઝન સાચવો | नया वर्ज़न सेव करें |

For these two Estimator labels only, use `t('tourControls.estimator.saveCosting')` and `t('tourControls.estimator.saveNewVersion')` for the live control and the matching tour token. This scoped exception resolves existing phrase overrides; do not change global translation maps or precedence. Save Costing retains §F.2's English/Gujarati/Hindi values. All other task contracts stay unchanged.

## G. State variants

| Variant | Behavior |
| --- | --- |
| Free | Steps identical; `purpose.detail.paid`, `warp.detail.paid`, `save.*.paid` replaced by the Free variants; `live.body.free`. |
| Lite | Paid copy; no `save.detail.base`. |
| Base | Paid copy + `save.detail.base`. |
| Paid, factory defaults not set | Launcher disabled until the wizard is completed or dismissed (existing). |
| Owner was in Detailed view | Tour switches to Quick; Detailed restored at the end. |
| Unsaved inputs, local draft, Resume banner | Untouched; the tour only reads the page. |
| Live cost sheet already open at launch | Closed for steps 1–7, opened for 8–9, restored to open at the end. |
| Saving in progress | Launcher disabled (existing). |
| Replay | Compact launcher. |

## H. Comprehension check

"A buyer wants a price for 60g georgette. Where do you enter the weft picks, and where do you read the price to quote him?" Expected: Weft yarn card (picks per inch, finished width, rate); Live cost shows the suggested price per metre.

## I. Implementation notes for GT-05

- Replace `CostEstimateTutorial`'s engine with `GuidedTour` (EC-10). Keep the launcher in the estimator's left rail; remove the field-guide button and the halo.
- Delete `dismissCostEstimateTutorial` and its tests; completion via §7.2. Keep reading the legacy flags (EC-14). Pass `userMetadata={{ tour_preferences }}`, `userId`, `orgId` from `estimator/page.tsx` and `free/page.tsx`.
- Add the seven proposed `data-tour-anchor` attributes to the Quick `EstimatorCard`s (forward the attribute through `EstimatorCard` if it does not spread props).
- Remove the tour's `tutorial-expand-row` dispatches and the `paddingBottom = '40vh'` hack; TC-4 handles reachability.
- Harness scenarios: `estimator` (Base), `estimator?tier=lite`, `free-estimator`.
