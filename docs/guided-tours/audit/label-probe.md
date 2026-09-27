# Audit: how Base and costing pages display tour-named labels in Gujarati and Hindi

OBSERVED (harness), 2026-09-27. Method: the harness mounted the real `I18nProvider`, set `window.location.pathname` to the route (the runtime switches to the strict Base-plan fallback by path), loaded each language and called `tx(label)` for each English label. This reproduces what the runtime translator shows for **hard-coded English literals**. It does **not** show labels that a component renders through `t('key')` (those use the dictionary value), and components whose root is `data-i18n-skip="true"` show hard-coded literals in English regardless. Use it as evidence of the fallback's quality, not as the displayed label of every control; LR-02/LR-03 in the plan define the rule.

`=EN` marks labels that stay English.

## `/free`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Calculate & save · uses 1 costing | ગણતરી કરો & સેવ કરો · uses 1 costing | गणना करें & सेव करें · uses 1 costing |
| Live cost | Live કોસ્ટ | Live कॉस्ट |
| Quality basics | ક્વોલિટીની મૂળ માહિતી | क्वालिटी की मूल जानकारी |
| Warp yarn | warp યાર્ન | warp यार्न |
| Weft yarn | weft યાર્ન | weft यार्न |
| Factory overhead | ફેક્ટરી ઓવરહેડ | फैक्ट्री ओवरहेड |
| Complete inputs | પૂર્ણ ઇનપુટ | पूरा इनपुट |

## `/free/costings`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| New Costing | નવી કોસ્ટિંગ | नई कॉस्टिंग |
| Export | એક્સપોર્ટ કરો | निर्यात करें |
| View breakdown / Export | જુઓ વિગતો / એક્સપોર્ટ કરો | देखें विवरण / निर्यात करें |
| Load more | વધુ જુઓ | और देखें |

## `/owner/assignments`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Assign | Assign (=EN) | Assign (=EN) |
| Choose | પસંદ કરો | चुनें |
| Open Daily Sheet | ખોલો દૈનિક શીટ | खोलें दैनिक शीट |
| Add worker | કારીગર ઉમેરો | कारीगर जोड़ें |
| Add machine | મશીન ઉમેરો | मशीन जोड़ें |
| Set job in Production | પ્રોડક્શનમાં કામ પસંદ કરો | प्रोडक्शन में काम चुनें |
| No production job | કોઈ નહીં ઉત્પાદન job | कोई नहीं उत्पादन job |
| Change | બદલો | बदलें |
| Undo | પાછું વાળો | पूर्ववत करें |
| Day | દિવસ | दिन |
| Night | રાત | रात |
| Assignment help | Assignment help (=EN) | Assignment help (=EN) |
| Manage workers | કારીગરોનું સંચાલન કરો | कारीगरों का प्रबंधन करें |
| Manage machines | મશીનોનું સંચાલન કરો | मशीनों का प्रबंधन करें |

## `/owner/dispatches`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| New dispatch | નવો dispatch | नया dispatch |
| Save draft | ડ્રાફ્ટ સાચવો | ड्राफ्ट सहेजें |
| Edit draft | ડ્રાફ્ટ બદલો | ड्राफ्ट बदलें |
| Confirm dispatch has left | dispatch રવાના થયાની પુષ્ટિ | dispatch रवाना होने की पुष्टि |
| Received as sent | મોકલ્યા મુજબ પ્રાપ્ત | भेजे अनुसार प्राप्त |
| Record / correct receipt | પ્રાપ્તિ નોંધો / સુધારો | प्राप्ति दर्ज / सुधारें |
| Review difference | તફાવતની સમીક્ષા | अंतर की समीक्षा |
| Record payment | ચુકવણી નોંધો | भुगतान दर्ज करें |
| Add charge / credit adjustment | શુલ્ક / ક્રેડિટ સમાયોજન | शुल्क / क्रेडिट समायोजन |
| Change payment terms | ચુકવણીની શરતો બદલો | भुगतान शर्तें बदलें |
| Record credit refund | જમા રકમની પરત નોંધો | जमा राशि वापसी दर्ज करें |
| Reverse erroneous dispatch | ખોટો dispatch ઉલટાવો | गलत dispatch वापस करें |
| Preview / Print / Save PDF | જુઓ / પ્રિન્ટ / PDF સાચવો | देखें / प्रिंट / PDF सहेजें |
| Reverse entry | નોંધ ઉલટાવો | प्रविष्टि वापस करें |
| Active | સક્રિય | सक्रिय |
| History | ઇતિહાસ | इतिहास |
| Search | શોધો | खोजें |
| Load more | વધુ જુઓ | और देखें |
| Remaining balance | બાકી રકમ | बाकी राशि |

## `/owner/estimator`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Save Costing | costing સાચવો | costing सेव करें |
| Save New Version | સેવ કરો નવું વર્ઝન | सेव करें नया वर्जन |
| Save Quality & Create Costing | ક્વોલિટી સાચવો અને કોસ્ટિંગ બનાવો | क्वालिटी सेव करें और कॉस्टिंग बनाएं |
| Live cost | Live કોસ્ટ | Live कॉस्ट |
| Quality basics | ક્વોલિટીની મૂળ માહિતી | क्वालिटी की मूल जानकारी |
| Warp yarn | warp યાર્ન | warp यार्न |
| Weft yarn | weft યાર્ન | weft यार्न |
| Weaving cost | વીવિંગ કોસ્ટ | वीविंग कॉस्ट |
| Warping and sizing | Warping અને સાઇઝિંગ | Warping और साइजिंग |
| Factory overhead | ફેક્ટરી ઓવરહેડ | फैक्ट्री ओवरहेड |
| Detailed | વિગતવાર | विस्तृत |
| Quick | ઝડપી | त्वरित |
| Complete inputs | પૂર્ણ ઇનપુટ | पूरा इनपुट |
| Edit monthly overhead details | ફેરફાર કરો માસિક ઓવરહેડ વિગતો | बदलें मासिक ओवरहेड विवरण |
| Target margin | લક્ષ્ય margin | लक्ष्य margin |
| Broker commission | બ્રોકર કમિશન | ब्रोकर कमीशन |
| Transport charge | પરિવહન ચાર્જ | परिवहन शुल्क |
| Costing quantity | costing જથ્થો | costing मात्रा |
| Change quality | બદલો ક્વોલિટી | बदलें क्वालिटी |
| Monthly expenses ÷ output | માસિક ખર્ચ ÷ ઉત્પાદન | मासिक खर्च ÷ उत्पादन |
| Direct overhead rate | સીધો ઓવરહેડ રેટ | सीधा ओवरहेड रेट |
| Start Production | પ્રોડક્શન શરૂ કરો | प्रोडक्शन शुरू करें |
| View saved costings | સેવ કરેલી કોસ્ટિંગ જુઓ | सेव की गई कॉस्टिंग देखें |

## `/owner/machines`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Add machine | મશીન ઉમેરો | मशीन जोड़ें |
| View assignment | ફાળવણી જુઓ | आवंटन देखें |
| Edit | ફેરફાર કરો | संपादित करें |
| Needs setup | સેટઅપ જરૂરી | सेटअप आवश्यक |
| Active | સક્રિય | सक्रिय |
| Save machine | સેવ કરો મશીન | सेव करें मशीन |
| Machine name | મશીન નામ | मशीन नाम |
| Machine type | મશીન type | मशीन type |
| Custom label | Custom લેબલ | Custom लेबल |
| Available for new assignments and daily context | ઉપલબ્ધ માટે નવું assignments અને દૈનિક સંદર્ભ | उपलब्ध के लिए नया assignments और दैनिक संदर्भ |
| Activating your machine | સક્રિય થઈ રહ્યું છે તમારું મશીન | सक्रिय किया जा रहा है आपका मशीन |

## `/owner/payroll`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Settle payroll | Settle પેરોલ | Settle पेरोल |
| Continue settlement | ચાલુ રાખો settlement | जारी रखें settlement |
| Complete Payroll | પૂર્ણ પેરોલ | पूरा पेरोल |
| Mark paid | Mark ચૂકવાયું | Mark भुगतान हुआ |
| Review before paying | સમીક્ષા પહેલાં paying | समीक्षा पहले paying |
| Confirm Payment | ખાતરી કરો ચૂકવણી | पुष्टि करें भुगतान |
| Add advance | ઉમેરો એડવાન્સ | जोड़ें एडवांस |
| Add deduction | ઉમેરો deduction | जोड़ें deduction |
| Payroll records | પેરોલ રેકોર્ડ | पेरोल रिकॉर्ड |
| Export CSV | એક્સપોર્ટ કરો CSV | निर्यात करें CSV |
| Export PDF | એક્સપોર્ટ કરો PDF | निर्यात करें PDF |
| Resolve | Resolve (=EN) | Resolve (=EN) |
| Reopen Payment | Reopen ચૂકવણી | Reopen भुगतान |
| Resolve mistaken payment record | ખોટો ચુકવણી રેકોર્ડ સુધારો | गलत भुगतान रिकॉर्ड सुधारें |
| Record reversal | રેકોર્ડ પાછો લેવાની નોંધ કરો | रिकॉर्ड वापसी दर्ज करें |
| Manage workers | કારીગરોનું સંચાલન કરો | कारीगरों का प्रबंधन करें |
| Review | સમીક્ષા કરો | समीक्षा |
| Outstanding only | Outstanding ફક્ત | Outstanding केवल |
| Mark as paid | Mark તરીકે ચૂકવાયું | Mark के रूप में भुगतान हुआ |
| Payment method | ચુકવણી પદ્ધતિ | भुगतान माध्यम |
| Payment date | ચૂકવણી તારીખ | भुगतान तारीख |
| View in records | જુઓ માં records | देखें में records |

## `/owner/production`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Activate Quality | ચાલુ કરો ક્વોલિટી | सक्रिय करें क्वालिटी |
| Assign Looms | Assign લૂમ | Assign लूम |
| Machine Board | મશીન Board | मशीन Board |
| Manage Workers | કારીગરો મેનેજ કરો | कारीगर प्रबंधित करें |
| Switch Quality | Switch ક્વોલિટી | Switch क्वालिटी |
| Assign Quality | Assign ક્વોલિટી | Assign क्वालिटी |
| Save shift | સેવ કરો shift | सेव करें shift |
| Save correction | સુધારો સેવ કરો | सुधार सेव करें |
| Print sheet | Print sheet (=EN) | Print sheet (=EN) |
| Worker review | કારીગર સમીક્ષા | कारीगर समीक्षा |
| Show pending | બતાવો બાકી | दिखाएं बाकी |
| Not running | નહીં running | नहीं running |
| Edit saved log | સેવ કરેલો લોગ સુધારો | सेव किया लॉग सुधारें |
| Discard draft | ડ્રાફ્ટ કાઢી નાખો | ड्राफ्ट हटाएं |
| Recent production | તાજેતરનું ઉત્પાદન | हाल का उत्पादन |
| View log | લોગ જુઓ | लॉग देखें |
| Shift details | Shift વિગતો | Shift विवरण |
| Draft on device | Draft પર device | Draft पर device |
| Save an incomplete shift? | સેવ કરો an અપૂર્ણ shift? | सेव करें an अधूरा shift? |
| Keep entering | જાળવો entering | रखें entering |
| Save incomplete shift | સેવ કરો અપૂર્ણ shift | सेव करें अधूरा shift |
| Unlock editing | સુધારા કરવા દો | सुधार करने दें |
| Keep locked | સુધારા બંધ રાખો | सुधार बंद रखें |
| Yarn required before production | યાર્ન જરૂરી પહેલાં ઉત્પાદન | यार्न जरूरी पहले उत्पादन |
| Add Stock | સ્ટોક ઉમેરો | स्टॉक जोड़ें |
| Deactivate Quality | બંધ કરો ક્વોલિટી | निष्क्रिय करें क्वालिटी |
| Quality actions | ક્વોલિટીના વિકલ્પો | क्वालिटी के विकल्प |
| Metres | મીટર | मीटर |
| Day Shift | દિવસ Shift | दिन Shift |
| Night Shift | રાત Shift | रात Shift |
| Active Qualities | સક્રિય ક્વોલિટી | सक्रिय क्वालिटी |
| Machine sheet | મશીનની શીટ | मशीन की शीट |
| Daily sheet | દૈનિક sheet | दैनिक sheet |
| Weaver wage | Weaver મજૂરી | Weaver मजदूरी |
| Production History | ઉત્પાદન ઇતિહાસ | उत्पादन इतिहास |
| Start Quality | શરૂ કરો ક્વોલિટી | शुरू करें क्वालिटी |

## `/owner/quotes`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| New Costing | નવી કોસ્ટિંગ | नई कॉस्टिंग |
| Use | વાપરો | उपयोग करें |
| Duplicate | નકલ બનાવો | कॉपी बनाएं |
| Export | એક્સપોર્ટ કરો | निर्यात करें |
| Compare | સરખામણી કરો | तुलना करें |
| Compare Costings | કોસ્ટિંગની તુલના કરો | कॉस्टिंग की तुलना करें |
| View breakdown | જુઓ વિગતો | देखें विवरण |
| Activate for Production | ચાલુ કરો માટે ઉત્પાદન | सक्रिय करें के लिए उत्पादन |
| Favourites | મનપસંદ | पसंदीदा |
| Archived | આર્કાઇવ કરેલી | आर्काइव किए गए |
| Save as separate quality | સેવ કરો તરીકે અલગ ક્વોલિટી | सेव करें के रूप में अलग क्वालिटी |
| Filters | Filters (=EN) | Filters (=EN) |
| Done | પૂર્ણ | पूरा |
| Saved Costing history | સાચવેલી કોસ્ટિંગ ઇતિહાસ | सेव कॉस्टिंग इतिहास |

## `/owner/rates`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Add Yarn Rate | યાર્ન ભાવ ઉમેરો | यार्न रेट जोड़ें |
| Edit rate | ભાવ બદલો | रेट बदलें |
| Save Rate | સેવ કરો ભાવ | सेव करें रेट |
| Advanced edit | Advanced ફેરફાર કરો | Advanced बदलें |
| Needs Review | Needs સમીક્ષા | Needs समीक्षा |
| Archived rates | આર્કાઇવ કરેલા રેટ | आर्काइव किए गए रेट |
| Review date | સમીક્ષા તારીખ | समीक्षा तारीख |
| Effective from | લાગુ તારીખ | लागू होने की तारीख |
| Review every | સમીક્ષા દરેક | समीक्षा हर |
| Activity | પ્રવૃત્તિ | गतिविधि |
| Archive rate | રેટ આર્કાઇવ કરો | रेट आर्काइव करें |
| Confirm current rate? | હાલના ભાવની ખાતરી કરો? | वर्तमान रेट की पुष्टि करें? |
| Review conflicts | સમીક્ષા conflicts | समीक्षा conflicts |

## `/owner/stock`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Audit Inventory | Audit Inventory (=EN) | Audit Inventory (=EN) |
| Opening stock | Opening stock (=EN) | Opening stock (=EN) |
| Correct balance | સ્ટોક સુધારો | स्टॉक सुधारें |
| Movement history | સ્ટોક ફેરફારનો ઇતિહાસ | स्टॉक बदलाव का इतिहास |
| Refresh | રિફ્રેશ કરો | रीफ़्रेश करें |
| Save stock | stock સેવ કરો | stock सेव करें |
| Stock by quality | quality પ્રમાણે Stock | quality के अनुसार Stock |
| Pending | બાકી | बाकी |
| Balance after | પછીનો સ્ટોક | बाद का स्टॉक |
| Load older movements | જૂના ફેરફાર જુઓ | पुराने बदलाव देखें |

## `/owner/stock/yarn`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Add yarn | Add yarn (=EN) | Add yarn (=EN) |
| Opening weight | Opening weight (=EN) | Opening weight (=EN) |
| Link costing | Link costing (=EN) | Link costing (=EN) |
| View date | View date (=EN) | View date (=EN) |
| Export balances CSV | Export balances CSV (=EN) | Export balances CSV (=EN) |
| Correct balance | સ્ટોક સુધારો | स्टॉक सुधारें |
| Movement history | સ્ટોક ફેરફારનો ઇતિહાસ | स्टॉक बदलाव का इतिहास |
| Yarn used by each fabric | Yarn used by each fabric (=EN) | Yarn used by each fabric (=EN) |
| Tracking started | Tracking started (=EN) | Tracking started (=EN) |

## `/owner/workers`

| English | Gujarati (tx) | Hindi (tx) |
| --- | --- | --- |
| Add worker | કારીગર ઉમેરો | कारीगर जोड़ें |
| Piece rate | પીસ-રેટ | पीस-रेट |
| Fixed monthly salary | સ્થિર માસિક salary | स्थिर मासिक salary |
| View assignments | ફાળવણી જુઓ | आवंटन देखें |
| View payroll | પેરોલ જુઓ | पेरोल देखें |
| Salary change effective from | Salary બદલો અસરકારક થી | Salary बदलें प्रभावी से |
| Last working day (optional) | છેલ્લું કામના દિવસ (વૈકલ્પિક) | आखिरी काम के दिन (वैकल्पिक) |
| Shift availability | Shift availability (=EN) | Shift availability (=EN) |
| Monthly salary | માસિક પગાર | मासिक वेतन |
| Joining date | Joining તારીખ | Joining तारीख |
| Active worker | સક્રિય કારીગર | सक्रिय कारीगर |
| Piece Rate | પીસ રેટ | पीस रेट |
| Fixed Salary | ફિક્સ્ડ પગાર (સ્થિર Salary) | निश्चित वेतन (स्थिर Salary) |
