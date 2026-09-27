# P03 Yarn Rate Book — tour specification

Status: specified, not implemented. Implementation: **GT-06**. Gujarati/Hindi: native review pending (LR-08).
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md). Evidence: [`audit/rate-book-and-saved-costings.md`](../audit/rate-book-and-saved-costings.md) §A.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/rates` → `app/(dashboard)/owner/rates/RatesClient.tsx` (~2.3k lines) |
| Entitlement | `rate_book` (Lite, Base); `AccessGate` + server `requireBaseTier`. Owner role. |
| Tour today | `components/rates/RateBookTutorial.tsx` (bespoke engine, 700 lines); steps `lib/rate-book-tour.ts`; copy `lib/i18n/rate-book-tutorial.ts`; dismissal `app/(dashboard)/owner/rates/tutorial-actions.ts` |
| Entry today | Two `TourInvitation` mounts: header launcher inside `lg:hidden` (`RatesClient.tsx:1538-1545`) and the rail guide card (`RateBookTutorial.tsx:540`); a help list (`RateBookHelp`). |
| Anchors today | `data-ratebook-field`: `overview` (header wrapper ~1533), `yarnSearch` (~1648), `linkedQualitiesPopover` (~1865 desktop / ~2016 mobile), `quickEditAction` (~1914 / ~2067), `reviewStatusBadge` (~1861 / ~2001), `addRateAction` (header Add ~1547; the right-rail Add ~2295 has none), `immutabilityNotice` (right rail ~2308). |
| Empty account | A demo row `DEMO_YARN_RATE` (`id: 'demo-sample-yarn-rate'`) is shown until deleted (`RatesClient.tsx:92-113, 907-919`). |
| Consequential actions | Save Rate (quick or advanced), confirm current (row, one click), Confirm All, Archive, Delete unused. |

## B. Diagnosis

| ID | Sev | Type | Finding | Evidence |
| --- | --- | --- | --- | --- |
| RB-1 | Major | Tour | Adding the first rate, the first thing a new owner needs, is never shown. | CODE-VERIFIED `lib/rate-book-tour.ts:5-12` |
| RB-2 | Major | Tour | Steps 3–5 lose their target when no row is visible (filters, archived view); step 6 has no target below 1280px (right rail hidden). | CODE-VERIFIED audit A4 #1, #2 |
| RB-3 | Major | Tour | Step 3 promises a qualities badge that the demo row does not show; step 5 spotlights a badge while describing dialog fields; the price example (₹200→₹220) does not match the visible row. | CODE-VERIFIED audit A4 #3, #4 |
| RB-4 | Major | Product (tour-owned sample) | The demo row's Advanced edit, Activity and Archive send `demo-sample-yarn-rate` to server actions; the user gets "Rate identifier is invalid." | CODE-VERIFIED `RatesClient.tsx:1103` (no guard), `1361-1446` |
| RB-5 | Major | Tour | Two launchers, two impression writes; every exit recorded as "dismissed" through a refreshing action; completion never recorded; account metadata not passed. | CODE-VERIFIED audit A2 |
| RB-6 | Minor | Tour | Bespoke engine with fixed timers (350/500/550 ms, 1,500 ms retry), no scroll restore, dead sheet/popover code, three progress indicators, saffron Next, amber banner, `shadow-2xl`. | CODE-VERIFIED audit A2, A4 #6-#9 |
| RB-7 | Minor | Tour | Hindi/Gujarati sentences keep English action names ("Advanced edit", "Save Rate"); three words for yarn. | CODE-VERIFIED audit A5 |
| RB-8 | Major | Product | "Confirm All (N) as Current" confirms every due rate, including rows hidden by filters, with no confirmation (PI-11). | CODE-VERIFIED `RatesClient.tsx:1307-1346` |

What works: the tour opens no editor and changes no filter; `formatRateBookTourText` already resolves action names through `tx()` (the LR-02 pattern).

## C. Learning outcomes and coverage

After the tour the owner can: (1) explain that the Rate Book holds their own purchase prices per kg and feeds new costings only; (2) add a yarn; (3) find a yarn; (4) record a new supplier price with its source; (5) handle review reminders; (6) see which qualities use a yarn; (7) know saved costings are unchanged.

| Requirement | Destination |
| --- | --- |
| Purpose; not a market feed; new costings only | `rb-purpose` |
| Add a yarn rate | `rb-purpose` body + `rb-handoff` (empty) |
| Yarns discovered from saved qualities | `rb-purpose` detail |
| Find: search, warp/weft filter, Needs Review | `rb-find` |
| Update price with source; history kept | `rb-update` |
| Effective date, review date, review interval (Advanced edit) | `rb-update` detail |
| Review reminders; confirm unchanged price; bulk confirm caveat | `rb-review` (+ detail) |
| Where a yarn is used; saved costings unchanged | `rb-usage` |
| Activity, archive, restore, delete unused | Existing rail help (`RateBookHelp`), unchanged except the removed "market" wording |
| Conflicts dialog | Omitted: it opens itself when conflicts exist and explains itself |

## D. Structure

Six steps: purpose → find → update → review → usage → handoff. Rows are the heart of the page, so three steps sit on one row; the first visible row is used (a real row, or the demo row on an empty account, which makes those steps PS-SAMPLE and shows "Sample" in the eyebrow).

**Shadowing (DS-03):** while the tour runs, the table renders as if search were empty, the direction filter "All", "Needs Review" off and the archived view off. The owner's filter state is not changed and reappears when the tour ends. This guarantees a row for steps 3–5 whenever any active rate or the demo row exists.

**One launcher (DR-24):** remove the header `lg:hidden` launcher and show the left-rail guide slot at every width (inline above the page below 1440px, like other rail pages). Rate Book help stays below the guide.

## E. Steps

All steps: observe only; recovery TC-8 with the shared text unless given. "Row" = the first visible row after shadowing, desktop table below `lg` the mobile card.

| # | Step id | Preset | Anchor | Acceptance |
| --- | --- | --- | --- | --- |
| 1 | `rb-purpose` | PS-LIVE | `[data-ratebook-field="overview"]` (existing) | Outline on the header incl. the Add button when it is inline |
| 2 | `rb-find` | PS-LIVE | `[data-ratebook-field="yarnSearch"]` (existing) | |
| 3 | `rb-update` | PS-LIVE or PS-SAMPLE (demo row) | `[data-ratebook-field="quickEditAction"]` (existing, first visible row) | Eyebrow shows "Sample" when the row is the demo row |
| 4 | `rb-review` | as 3 | `[data-ratebook-field="reviewStatusBadge"]` (existing, same row) | |
| 5 | `rb-usage` | as 3 | `[data-ratebook-field="linkedQualitiesPopover"]` (existing, same row) | Copy does not promise a badge (fixes RB-3) |
| 6 | `rb-handoff` | PS-HANDOFF | no real (non-demo) active rates: `[data-ratebook-field="addRateAction"]` (existing on the header Add; **add the same attribute to the right-rail Add ~2295**); otherwise `[data-ratebook-field="yarnSearch"]` | Done focuses the anchor |

Unavailable text for steps 3–5 (only if the account has no rates and the demo row was deleted): `rows.unavailable` (§F).

## F. Copy

Keys in `lib/i18n/rate-book-tutorial.ts` (rewritten; unused old keys removed, including the market-toned ones).

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `purpose.title` | Your own yarn price list | તમારું પોતાનું યાર્ન ભાવપત્રક | आपकी अपनी धागा रेट सूची |
| `purpose.body` | Keep the price per kg you pay for each warp and weft yarn. New costings suggest these prices; add a yarn with {c:addRate}. | દરેક તાણા અને ભરણ યાર્ન માટે તમે ચૂકવો તે કિલોનો ભાવ રાખો. નવી કોસ્ટિંગમાં આ ભાવ સૂચવાય છે; યાર્ન ઉમેરવા {c:addRate}. | हर ताना और बाना धागे का आपका दिया किलो रेट रखें। नई कॉस्टिंग में यही रेट सुझाए जाते हैं; धागा जोड़ने के लिए {c:addRate}। |
| `purpose.detail` | Yarns from qualities you save in the Cost Estimator appear here by themselves. | ખર્ચ અંદાજકમાં સાચવેલી ક્વોલિટીના યાર્ન અહીં આપોઆપ દેખાય છે. | लागत अनुमानक में सेव की गई क्वालिटी के धागे यहाँ अपने आप दिखते हैं। |
| `find.title` | Find a yarn | યાર્ન શોધો | धागा खोजें |
| `find.body` | Search by yarn name or supplier. {c:needsReview} shows only the prices that are due for a check. | યાર્નના નામ કે સપ્લાયરથી શોધો. {c:needsReview} ફક્ત તપાસવાના બાકી ભાવ બતાવે છે. | धागे के नाम या सप्लायर से खोजें। {c:needsReview} सिर्फ़ जाँच के लिए बाकी रेट दिखाता है। |
| `update.title` | Update a price when your supplier changes it | સપ્લાયર ભાવ બદલે ત્યારે ભાવ બદલો | सप्लायर रेट बदले तो रेट बदलें |
| `update.body` | {c:editRate} lets you enter the new price and where it came from, such as an invoice. The old price stays in the yarn's history. | {c:editRate}થી નવો ભાવ અને તે ક્યાંથી આવ્યો, જેમ કે બિલ, લખી શકો છો. જૂનો ભાવ યાર્નના ઇતિહાસમાં રહે છે. | {c:editRate} से नया रेट और वह कहाँ से आया, जैसे बिल, लिख सकते हैं। पुराना रेट धागे के इतिहास में रहता है। |
| `update.detail` | Use {c:advancedEdit} to set the date the price applies from and how often Weavly should remind you to recheck it. | ભાવ કઈ તારીખથી લાગુ થાય અને Weavly કેટલા દિવસે ફરી તપાસવાનું યાદ કરાવે તે નક્કી કરવા {c:advancedEdit} વાપરો. | रेट किस तारीख से लागू हो और Weavly कितने दिन में दोबारा जाँचने की याद दिलाए, यह तय करने के लिए {c:advancedEdit} इस्तेमाल करें। |
| `review.title` | Recheck prices when reminded | યાદ અપાય ત્યારે ભાવ ફરી તપાસો | याद दिलाने पर रेट दोबारा जाँचें |
| `review.body` | A price due for review still has its old value. If your supplier's price is unchanged, confirm it; if it changed, update it. | તપાસ બાકી હોય તે ભાવ હજી જૂનો જ છે. સપ્લાયરનો ભાવ ન બદલાયો હોય તો ખાતરી કરો; બદલાયો હોય તો સુધારો. | जाँच बाकी वाला रेट अभी पुराना ही है। सप्लायर का रेट नहीं बदला तो पुष्टि करें; बदला तो सुधारें। |
| `review.detail` | The bulk confirm button confirms every price that is due, including ones hidden by your search or filters. | એકસાથે ખાતરીનું બટન બાકી બધા ભાવની ખાતરી કરે છે, તમારી શોધ કે ફિલ્ટરથી છુપાયેલા ભાવની પણ. | एक साथ पुष्टि वाला बटन सभी बाकी रेट की पुष्टि करता है, आपकी खोज या फ़िल्टर से छिपे रेट की भी। |
| `usage.title` | See which qualities use a yarn | યાર્ન કઈ ક્વોલિટીમાં વપરાય છે તે જુઓ | धागा किन क्वालिटी में लगता है, यह देखें |
| `usage.body` | This column lists the saved qualities that use this yarn. A new price is used by their next costing; costings already saved keep their numbers. | આ કૉલમમાં આ યાર્ન વાપરતી સાચવેલી ક્વોલિટી દેખાય છે. નવો ભાવ તેમની આગલી કોસ્ટિંગમાં વપરાય છે; સાચવેલી કોસ્ટિંગના આંકડા બદલાતા નથી. | इस कॉलम में यह धागा इस्तेमाल करने वाली सेव क्वालिटी दिखती हैं। नया रेट उनकी अगली कॉस्टिंग में लगता है; सेव कॉस्टिंग के आँकड़े नहीं बदलते। |
| `handoff.empty.title` | Add the yarns you buy | તમે ખરીદો છો તે યાર્ન ઉમેરો | जो धागे आप खरीदते हैं, उन्हें जोड़ें |
| `handoff.empty.body` | Choose {c:addRate} and enter the name, warp or weft, and the price per kg from your latest bill. | {c:addRate} પસંદ કરો અને નામ, તાણા કે ભરણ, અને છેલ્લા બિલનો કિલોનો ભાવ લખો. | {c:addRate} चुनें और नाम, ताना या बाना, और पिछले बिल का किलो रेट लिखें। |
| `handoff.existing.title` | Check a yarn you bought recently | હમણાં ખરીદેલું યાર્ન તપાસો | हाल में खरीदा धागा जाँचें |
| `handoff.existing.body` | Search for it and compare its price with your latest bill. | તેને શોધો અને તેનો ભાવ છેલ્લા બિલ સાથે મેળવો. | उसे खोजें और उसका रेट पिछले बिल से मिलाएँ। |
| `rows.unavailable` | There are no yarn rows to show yet. Add a yarn first; this step will then point at it. | હજી બતાવવા કોઈ યાર્ન નથી. પહેલાં યાર્ન ઉમેરો; પછી આ પગલું તેના પર બતાવશે. | अभी दिखाने को कोई धागा नहीं है। पहले धागा जोड़ें; फिर यह चरण उसी पर दिखाएगा। |
| `guide.benefit` | See how to keep your yarn prices up to date. | તમારા યાર્નના ભાવ અદ્યતન કેવી રીતે રાખવા તે જુઓ. | अपने धागे के रेट ताज़ा कैसे रखें, यह देखें। |

### Control tokens

| Token | Live render site | Resolver | Gujarati | Hindi | Action |
| --- | --- | --- | --- | --- | --- |
| `addRate` | header Add (~1547), rail Add (~2295) | `tx('Add Yarn Rate')` | યાર્ન ભાવ ઉમેરો | धागा रेट जोड़ें | Add phrase for Hindi (today "यार्न रेट जोड़ें"; keep if the reviewer prefers the page-name word) |
| `needsReview` | toolbar toggle (~1723, hard-coded) | wrap in `tx()`; `tx('Needs Review')` | સમીક્ષા બાકી | समीक्षा बाकी | Wrap + add phrase |
| `editRate` | row button | `tx('Edit rate')` | ભાવ બદલો | रेट बदलें | none |
| `advancedEdit` | row menu / popover link | `tx('Advanced edit')` | વિગતવાર ફેરફાર | विस्तृत बदलाव | Add phrase (today: half English) |

## G. State variants

| Variant | Behavior |
| --- | --- |
| No rates, demo row present | Steps 3–5 on the demo row (Sample); handoff `empty`. |
| No rates, demo deleted | Steps 3–5 show `rows.unavailable` (TC-8); handoff `empty`. |
| Rates, owner filters or search active | Shadowed; steps on the first active row; restored after. |
| Only archived rates | Shadowed to active view; if no active row and no demo: as "demo deleted". |
| Conflicts dialog open on arrival | Launcher sits under the modal; the tour can start after the dialog is closed. |
| Desktop < 1280px | Handoff Add is the header button; ≥1280px the rail Add. |
| Replay | Compact launcher. |

## H. Comprehension check

"Your supplier says polyester 75D is now ₹230 a kilo from Monday. What do you change in Weavly, and does it change the costing you sent a buyer last week?" Expected: Rate Book → find the yarn → Edit rate (or Advanced edit for the Monday date) → Save; last week's saved costing does not change.

## I. Implementation notes for GT-06

- Guard the demo row in `handleSave` (Advanced edit), `openHistory` (Activity) and `handleArchive` (DS-02; RB-4) with the existing sample toast.
- Delete `dismissRatebookTutorial` and its tests; §7 persistence; pass `userMetadata`.
- Remove the dead sheet/popover tour branches, `isTutorialActive` guards that only served them, and the header launcher.
- Harness: `rates` at the four viewports (the 390×844 Gujarati run timed out during planning, U-07); add a `rates-populated` scenario with two real-shaped rows.
