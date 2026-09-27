import type { Language } from './context'
import type { SavedCostingStep } from '@/lib/saved-costings-tour'

type Copy = { replay: string; sample: string; fields: Record<SavedCostingStep | 'finishEmpty' | 'finishUnavailable' | 'separateQuality' | 'freeHelp', [string, string]>; help: string; compare: string }
const en: Copy = {
 replay: 'How Saved Costings works · Guided tour', sample: 'Tour sample · Nothing is saved or sent',
 help: "More help: documents and library", compare: "Compare versions · Sample walkthrough", fields: {
 finishUnavailable: ["Return to your saved list", "Finish closes the tour samples and restores your page. Let the list finish loading; if it shows an error, refresh before looking for a saved snapshot."],
 finishEmpty: ["Save your first costing", "Finish closes the tour samples and restores your page. Choose {new} to open Cost Estimate, review a calculation and save it."],
 freeHelp: ["Find a Free snapshot", "Search by label or use the date, cost and margin filters. Clear filters if a snapshot is missing. Load more shows older records; refresh the page if loading fails."],
 separateQuality: ["Keep another quality separate", "Save as separate quality starts a draft for a different quality. Give it a new name in Cost Estimate and save after review. It does not overwrite the original costing."],
 economics: ["Read v2 before reusing it", "This sample’s v2 shows production cost, selling price and margin from its saved inputs. Selling price minus production cost is profit per metre. Check the yarn and factory costs in its breakdown before using this price for a new decision."],
 comparisonDetails: ["Find the reason for a change", "Expand calculation details to distinguish cost changes from reference changes. Read Old, New and Change for each input. Not available means saved detail is missing; today’s rates are not substituted."],
 find: ["Keep the numbers behind a price", "Saved Costings preserves the inputs and economics from the day you saved. Later yarn rates do not rewrite that history. First save a calculation in Cost Estimate; then choose its quality and version here."],
 filters: ['Narrow the library', 'Filters sort by update date, margin or production cost and restrict margin ranges. Favourites shows starred records; Archived shows archived snapshots. Clear filters if a saved record is missing.'],
 select: ['Select a costing', 'In the Costings tab, where shown, open a quality card to see its saved versions. A quality with no snapshots needs a calculation saved in Cost Estimate first. The example has two versions of the same costing.'],
 versions: ["Choose the version you mean", "Search for a quality and open its card. In Saved Costing history, choose View breakdown beside the required date and version. Our sample has v1 and v2; next we will read v2. A single saved version opens directly."],
 breakdown: ['Read the selected breakdown', 'The active version badge identifies the snapshot being shown. Review yarn and other cost components, production cost, selling price and profit. Saved numbers do not use today’s rates. Older incomplete snapshots may show a review notice instead of a detailed breakdown.'],
 reuse: ["Reuse or start a new quality?", "{open} loads this version into Cost Estimate. Duplicate starts a draft for a new quality and asks for a new name when saving. Confirm before replacing an existing local draft; review and save in the estimator. Neither action changes this snapshot by itself."],
 organize: ["Find and maintain records", "Star a version for Favourites. Archive snapshot hides it from the active list; restore it from Archived. Archiving is not deletion. Check saved numbers, on older records that offer it, checks whether their saved numbers need review."],
 internal: ["Choose who may see the document", "{preview} opens this preview. Internal Cost Estimate includes costs, margin and internal notes. Customer Quotation hides those details and shows price and customer terms. Choose the audience before Print or Generate PDF; previewing sends nothing."],
 customer: ['Customer-facing quotation', 'Customer mode shows selling price and customer terms while keeping internal costs, profit and internal notes private. Set the party, validity and optional GST note, and check validation messages before generating. Previewing alone does not send a quotation.'],
 share: ['Share after generating', 'After you generate a customer PDF, Share PDF becomes available for that current document. It opens the device share sheet or WhatsApp fallback; you choose the recipient and send. A handoff does not confirm delivery. Changes to document details require a fresh PDF. This tour does not generate, download or share.'],
 compareSelect: ['Select two versions of one costing', 'Turn on Compare, open the costing and select two version checkboxes. Close details and choose Compare Costings when both snapshots finish loading. Clear selection resets the pair; Done leaves comparison mode. With only one version, save another version before comparing.'],
 comparison: ["Explain what changed", "Old and New follow saved order; Change is New minus Old. Compare cost, price, margin and quantity in these two sample versions. A review warning means an older costing lacks enough saved detail for a full comparison."],
 production: ["Hand this version to production", "Activate for Production opens the Activate Quality for Production picker. Find the intended quality and version, choose Activate, then Assign Looms. Opening the link records no output, stock or wages. Archived snapshots cannot be activated."],
 snapshots: ['Your Free snapshots', 'Completed Free calculations appear here as fixed snapshots. Viewing and exporting them does not use your monthly allowance. They are not reusable saved qualities and have no version history or comparison. These rules also apply to retained Free snapshots after upgrading.'],
 searchAndFilters: ['Search and filters', 'Here you can search a specific costing or sort by filters.'],
 search: ['Search', 'Here you can search a specific costing.'],
 freeFilters: ['Filters', 'Here you can sort by specific filters.'],
 freeSelect: ["Inspect a completed calculation", "Search by label, then choose View breakdown / Export on a saved snapshot. Review its saved cost per metre and selling price before exporting. Complete a calculation first if none is saved."],
 finish: ["Review one of your saved costings", "Finish closes the tour samples and restores your page. Open one of your saved costings and check its numbers. Clear search and filters if it is hidden. You can replay this tour or open the help beside its launcher."],
 }
}
const hi: Copy = { replay: 'सेव की गई लागतें कैसे काम करती हैं · गाइडेड टूर', sample: 'टूर का नमूना · कुछ सेव या भेजा नहीं जाएगा', help: "और सहायता: दस्तावेज़ और सूची", compare: "संस्करणों की तुलना · नमूना टूर", fields: {
 finishUnavailable: ["अपनी सेव सूची पर लौटें", "Finish टूर नमूने बंद करके आपका पेज बहाल करता है। सूची लोड होने दें; त्रुटि दिखे तो सेव स्नैपशॉट खोजने से पहले रीफ़्रेश करें।"],
 finishEmpty: ["पहली लागत सेव करें", "Finish टूर नमूने बंद करके आपका पेज बहाल करता है। {new} से Cost Estimate खोलें, गणना जाँचें और सेव करें।"],
 freeHelp: ["Free स्नैपशॉट खोजें", "लेबल खोजें या तारीख, लागत और मार्जिन के फ़िल्टर लगाएँ। स्नैपशॉट न मिले तो फ़िल्टर हटाएँ। Load more से पुराने रिकॉर्ड देखें; लोड न हो तो पेज रीफ़्रेश करें।"],
 separateQuality: ["दूसरी क्वालिटी अलग रखें", "Save as separate quality दूसरी क्वालिटी का ड्राफ्ट शुरू करता है। Cost Estimate में नया नाम दें और जाँचकर सेव करें। मूल लागत नहीं बदलती।"],
 economics: ["इस्तेमाल से पहले v2 पढ़ें", "नमूने के v2 में सेव इनपुट से उत्पादन लागत, बिक्री मूल्य और मार्जिन दिखते हैं। बिक्री मूल्य में से उत्पादन लागत घटाने पर प्रति मीटर लाभ मिलता है। नई कीमत तय करने से पहले विवरण में धागे और कारखाने के खर्च जाँचें।"],
 comparisonDetails: ["बदलाव का कारण देखें", "Calculation details खोलकर लागत बदलने वाले इनपुट और संदर्भ बदलाव अलग देखें। हर इनपुट का Old, New और Change पढ़ें। Not available का अर्थ सेव विवरण नहीं है; आज के रेट उसकी जगह नहीं आते।"],
 find: ["कीमत के पीछे के आंकड़े सुरक्षित रखें", "Saved Costings में सेव किए दिन के इनपुट और आर्थिक आंकड़े सुरक्षित रहते हैं। बाद के धागे के रेट यह इतिहास नहीं बदलते। पहले Cost Estimate में गणना सेव करें; फिर यहाँ उसकी क्वालिटी और संस्करण चुनें।"],
 filters: ['सूची को सीमित करें', 'फ़िल्टर से तारीख, मार्जिन या उत्पादन लागत के अनुसार क्रम और मार्जिन सीमा चुनें। Favourites में स्टार वाले रिकॉर्ड और Archived में संग्रहित स्नैपशॉट मिलते हैं। रिकॉर्ड न मिले तो फ़िल्टर हटाएँ।'],
 select: ['लागत चुनें', 'Costings टैब उपलब्ध हो तो उसे चुनें, फिर क्वालिटी कार्ड खोलकर सेव किए संस्करण देखें। स्नैपशॉट न हो तो पहले Cost Estimate में गणना सेव करें। नमूने में एक ही लागत के दो संस्करण हैं।'],
 versions: ["सही संस्करण चुनें", "क्वालिटी खोजकर उसका कार्ड खोलें। Saved Costing history में इच्छित तारीख और संस्करण के पास View breakdown चुनें। नमूने में v1 और v2 हैं; आगे हम v2 देखेंगे। एक ही संस्करण हो तो वह सीधे खुलता है।"],
 breakdown: ['चुना हुआ विवरण पढ़ें', 'Active breakdown बैज चुना स्नैपशॉट बताता है। धागा, अन्य खर्च, उत्पादन लागत, बिक्री मूल्य और लाभ देखें। सेव किए आंकड़े आज के रेट नहीं लेते। पुराने अधूरे स्नैपशॉट में विवरण की जगह समीक्षा सूचना हो सकती है।'],
 reuse: ["फिर इस्तेमाल करें या नई क्वालिटी बनाएँ?", "{open} इस संस्करण को Cost Estimate में लाता है। Duplicate नई क्वालिटी का ड्राफ्ट बनाता है और सेव करते समय नया नाम माँगता है। स्थानीय ड्राफ्ट बदलने से पहले पुष्टि करें; एस्टिमेटर में जाँचकर सेव करें। केवल खोलने से पुराना स्नैपशॉट नहीं बदलता।"],
 organize: ["रिकॉर्ड खोजें और सँभालें", "संस्करण पर स्टार लगाकर उसे Favourites में पाएँ। Archive snapshot सक्रिय सूची से छिपाता है; Archived से वापस लाएँ। यह डिलीट नहीं है। पुराने रिकॉर्ड पर Check saved numbers उपलब्ध हो तो उससे पता करें कि सेव आंकड़ों की समीक्षा चाहिए या नहीं।"],
 internal: ["दस्तावेज़ किसके लिए है?", "{preview} से यह प्रीव्यू खुलता है। Internal Cost Estimate में लागत, मार्जिन और आंतरिक नोट्स होते हैं। Customer Quotation इन्हें छिपाकर कीमत और ग्राहक की शर्तें दिखाता है। Print या Generate PDF से पहले सही मोड चुनें; प्रीव्यू कुछ भेजता नहीं।"],
 customer: ['ग्राहक कोटेशन', 'Customer मोड बिक्री मूल्य और ग्राहक शर्तें दिखाता है; आंतरिक लागत, लाभ और नोट्स निजी रहते हैं। पार्टी, वैधता और वैकल्पिक GST नोट भरें तथा त्रुटियाँ जाँचें। प्रीव्यू देखने से कोटेशन नहीं भेजा जाता।'],
 share: ['बनाने के बाद शेयर करें', 'ग्राहक PDF बनाने के बाद वर्तमान दस्तावेज़ के लिए Share PDF मिलता है। यह डिवाइस शेयर शीट या WhatsApp खोलता है; प्राप्तकर्ता और भेजना आप चुनते हैं। इससे डिलीवरी की पुष्टि नहीं होती। विवरण बदलें तो नया PDF बनाएँ। टूर कोई फ़ाइल नहीं बनाता, डाउनलोड या शेयर नहीं करता।'],
 compareSelect: ['एक लागत के दो संस्करण चुनें', 'Compare चालू करें, लागत खोलें और दो संस्करण चुनें। विवरण बंद करके दोनों लोड होने पर Compare Costings चुनें। Clear selection जोड़ी हटाता है; Done तुलना मोड बंद करता है। एक संस्करण हो तो पहले दूसरा सेव करें।'],
 comparison: ["क्या बदला, समझें", "Old और New सेव क्रम में हैं; Change का अर्थ New में से Old घटाना है। दोनों नमूनों की लागत, कीमत, मार्जिन और मात्रा देखें। समीक्षा चेतावनी का अर्थ है कि पुरानी लागत में पूरी तुलना के लिए पर्याप्त सेव विवरण नहीं है।"],
 production: ["यह संस्करण उत्पादन में ले जाएँ", "Activate for Production से Activate Quality for Production की सूची खुलती है। सही क्वालिटी और संस्करण खोजें, Activate चुनें, फिर Assign Looms करें। लिंक खोलने से उत्पादन, स्टॉक या मजदूरी दर्ज नहीं होती। आर्काइव स्नैपशॉट सक्रिय नहीं हो सकते।"],
 snapshots: ['आपके Free स्नैपशॉट', 'पूरी Free गणनाएँ यहाँ स्थिर स्नैपशॉट हैं। देखने और एक्सपोर्ट करने से मासिक सीमा नहीं घटती। ये दोबारा उपयोग योग्य क्वालिटी नहीं हैं और इनमें संस्करण इतिहास या तुलना नहीं है। अपग्रेड के बाद पुराने Free स्नैपशॉट पर भी यही नियम हैं।'],
 searchAndFilters: ['खोज और फ़िल्टर', 'यहाँ आप कोई विशिष्ट लागत खोज सकते हैं या फ़िल्टर के अनुसार क्रमबद्ध कर सकते हैं।'],
 search: ['खोजें', 'यहाँ आप कोई विशिष्ट लागत खोज सकते हैं।'],
 freeFilters: ['फ़िल्टर', 'यहाँ आप विशिष्ट फ़िल्टर के अनुसार क्रमबद्ध कर सकते हैं।'],
 freeSelect: ["पूरी गणना देखें", "लेबल खोजें, फिर सेव स्नैपशॉट पर View breakdown / Export चुनें। एक्सपोर्ट से पहले सेव प्रति मीटर लागत और बिक्री मूल्य जाँचें। कोई सेव रिकॉर्ड न हो तो पहले गणना पूरी करें।"],
 finish: ["अपनी एक सेव लागत जाँचें", "Finish टूर नमूने बंद करके आपका पेज बहाल करता है। अपनी एक सेव लागत खोलकर आंकड़े जाँचें। छिपी हो तो खोज और फ़िल्टर हटाएँ। टूर दोबारा चला सकते हैं या उसके बगल की सहायता खोल सकते हैं।"],
}}
const gu: Copy = { replay: 'સાચવેલી ખર્ચ ગણતરીઓ કેવી રીતે કામ કરે છે · માર્ગદર્શિત ટૂર', sample: 'ટૂરનો નમૂનો · કંઈ સાચવાશે કે મોકલાશે નહીં', help: "વધુ મદદ: દસ્તાવેજ અને યાદી", compare: "આવૃત્તિ સરખાવો · નમૂનાનો ટૂર", fields: {
 finishUnavailable: ["તમારી સાચવેલી યાદી પર પાછા જાઓ", "Finish ટૂરના નમૂના બંધ કરીને તમારું પેજ પાછું લાવે છે. યાદી લોડ થવા દો; ભૂલ દેખાય તો સાચવેલો સ્નેપશોટ શોધતાં પહેલાં રિફ્રેશ કરો."],
 finishEmpty: ["પહેલી ગણતરી સાચવો", "Finish ટૂરના નમૂના બંધ કરીને તમારું પેજ પાછું લાવે છે. {new} થી Cost Estimate ખોલો, ગણતરી તપાસો અને સાચવો."],
 freeHelp: ["Free સ્નેપશોટ શોધો", "લેબલ શોધો અથવા તારીખ, ખર્ચ અને માર્જિનના ફિલ્ટર વાપરો. સ્નેપશોટ ન મળે તો ફિલ્ટર દૂર કરો. Load more થી જૂના રેકોર્ડ જુઓ; લોડ ન થાય તો પેજ રિફ્રેશ કરો."],
 separateQuality: ["બીજી ક્વોલિટી અલગ રાખો", "Save as separate quality બીજી ક્વોલિટીનો ડ્રાફ્ટ શરૂ કરે છે. Cost Estimate માં નવું નામ આપો અને તપાસીને સાચવો. મૂળ ગણતરી બદલાતી નથી."],
 economics: ["વાપરતાં પહેલાં v2 વાંચો", "નમૂનાની v2 માં સાચવેલા ઇનપુટથી ઉત્પાદન ખર્ચ, વેચાણ ભાવ અને માર્જિન દેખાય છે. વેચાણ ભાવમાંથી ઉત્પાદન ખર્ચ બાદ કરતાં પ્રતિ મીટર નફો મળે છે. નવો ભાવ નક્કી કરતાં પહેલાં વિગતોમાં યાર્ન અને કારખાનાનો ખર્ચ તપાસો."],
 comparisonDetails: ["ફેરફારનું કારણ જુઓ", "Calculation details ખોલીને ખર્ચ બદલતા ઇનપુટ અને સંદર્ભના ફેરફાર અલગ જુઓ. દરેક ઇનપુટનું Old, New અને Change વાંચો. Not available એટલે સાચવેલી વિગત નથી; આજના રેટ તેની જગ્યાએ લેવાતા નથી."],
 find: ["ભાવ પાછળના આંકડા સાચવો", "Saved Costings માં સાચવેલા દિવસના ઇનપુટ અને નાણાકીય આંકડા જળવાય છે. પછીના યાર્ન રેટ આ ઇતિહાસ બદલતા નથી. પહેલાં Cost Estimate માં ગણતરી સાચવો; પછી અહીં તેની ક્વોલિટી અને આવૃત્તિ પસંદ કરો."],
 filters: ['યાદી મર્યાદિત કરો', 'ફિલ્ટરમાં તારીખ, માર્જિન અથવા ઉત્પાદન ખર્ચ મુજબ ક્રમ અને માર્જિનની શ્રેણી પસંદ કરો. Favourites માં સ્ટાર કરેલા અને Archived માં આર્કાઇવ સ્નેપશોટ મળે છે. રેકોર્ડ ન મળે તો ફિલ્ટર દૂર કરો.'],
 select: ['ગણતરી પસંદ કરો', 'Costings ટેબ ઉપલબ્ધ હોય તો તે પસંદ કરો, પછી ક્વોલિટી કાર્ડ ખોલીને સાચવેલી આવૃત્તિઓ જુઓ. સ્નેપશોટ ન હોય તો પહેલાં Cost Estimate માં ગણતરી સાચવો. નમૂનામાં એક જ ગણતરીની બે આવૃત્તિ છે.'],
 versions: ["યોગ્ય આવૃત્તિ પસંદ કરો", "ક્વોલિટી શોધીને તેનું કાર્ડ ખોલો. Saved Costing history માં જરૂરી તારીખ અને આવૃત્તિ પાસે View breakdown પસંદ કરો. નમૂનામાં v1 અને v2 છે; આગળ આપણે v2 જોઈશું. એક જ આવૃત્તિ હોય તો સીધી ખુલે છે."],
 breakdown: ['પસંદ કરેલી વિગતો વાંચો', 'Active breakdown બેજ પસંદ કરેલો સ્નેપશોટ બતાવે છે. યાર્ન, અન્ય ખર્ચ, ઉત્પાદન ખર્ચ, વેચાણ ભાવ અને નફો જુઓ. સાચવેલા આંકડા આજના રેટ વાપરતા નથી. જૂના અધૂરા સ્નેપશોટમાં વિગતોને બદલે સમીક્ષા સૂચના હોઈ શકે.'],
 reuse: ["ફરી વાપરવું કે નવી ક્વોલિટી બનાવવી?", "{open} આ આવૃત્તિ Cost Estimate માં લાવે છે. Duplicate નવી ક્વોલિટીનો ડ્રાફ્ટ બનાવે છે અને સાચવતી વખતે નવું નામ માગે છે. સ્થાનિક ડ્રાફ્ટ બદલતાં પહેલાં પુષ્ટિ કરો; એસ્ટિમેટરમાં તપાસીને સાચવો. માત્ર ખોલવાથી જૂનો સ્નેપશોટ બદલાતો નથી."],
 organize: ["રેકોર્ડ શોધો અને જાળવો", "આવૃત્તિ પર સ્ટાર કરીને તેને Favourites માં મેળવો. Archive snapshot સક્રિય યાદીમાંથી છુપાવે છે; Archived માંથી પાછી લાવો. આ ડિલીટ નથી. જૂના રેકોર્ડ પર Check saved numbers હોય તો સાચવેલા આંકડાની સમીક્ષા જરૂરી છે કે નહીં તે તપાસો."],
 internal: ["દસ્તાવેજ કોના માટે છે?", "{preview} થી આ પ્રીવ્યુ ખુલે છે. Internal Cost Estimate માં ખર્ચ, માર્જિન અને આંતરિક નોંધો હોય છે. Customer Quotation આ વિગતો છુપાવીને ભાવ અને ગ્રાહકની શરતો બતાવે છે. Print કે Generate PDF પહેલાં યોગ્ય મોડ પસંદ કરો; પ્રીવ્યુ કંઈ મોકલતું નથી."],
 customer: ['ગ્રાહક ક્વોટેશન', 'Customer મોડ વેચાણ ભાવ અને ગ્રાહકની શરતો બતાવે છે; આંતરિક ખર્ચ, નફો અને નોંધો ખાનગી રહે છે. પાર્ટી, માન્યતા અને વૈકલ્પિક GST નોંધ ભરો અને ભૂલો તપાસો. પ્રીવ્યુ જોવાથી ક્વોટેશન મોકલાતું નથી.'],
 share: ['બનાવ્યા પછી શેર કરો', 'ગ્રાહક PDF બનાવ્યા પછી હાલના દસ્તાવેજ માટે Share PDF મળે છે. તે ડિવાઇસ શેર શીટ અથવા WhatsApp ખોલે છે; મેળવનાર અને મોકલવાનું તમે પસંદ કરો. તે ડિલિવરીની પુષ્ટિ નથી. વિગતો બદલાય તો નવો PDF બનાવો. ટૂર ફાઇલ બનાવતો, ડાઉનલોડ કે શેર કરતો નથી.'],
 compareSelect: ['એક ગણતરીની બે આવૃત્તિ પસંદ કરો', 'Compare ચાલુ કરો, ગણતરી ખોલો અને બે આવૃત્તિ પસંદ કરો. વિગતો બંધ કરીને બંને લોડ થાય પછી Compare Costings પસંદ કરો. Clear selection જોડી દૂર કરે છે; Done સરખામણી મોડ બંધ કરે છે. એક આવૃત્તિ હોય તો પહેલાં બીજી સાચવો.'],
 comparison: ["શું બદલાયું તે સમજો", "Old અને New સાચવેલા ક્રમમાં છે; Change એટલે New માંથી Old બાદ કરવું. બંને નમૂનાના ખર્ચ, ભાવ, માર્જિન અને જથ્થાની સરખામણી કરો. સમીક્ષા ચેતવણીનો અર્થ કે જૂની ગણતરીમાં સંપૂર્ણ સરખામણી માટે પૂરતી સાચવેલી વિગતો નથી."],
 production: ["આ આવૃત્તિ ઉત્પાદનમાં લઈ જાઓ", "Activate for Production થી Activate Quality for Production ની યાદી ખુલે છે. યોગ્ય ક્વોલિટી અને આવૃત્તિ શોધો, Activate પસંદ કરો, પછી Assign Looms કરો. લિંક ખોલવાથી ઉત્પાદન, સ્ટોક કે વેતન નોંધાતું નથી. આર્કાઇવ સ્નેપશોટ સક્રિય થઈ શકતા નથી."],
 snapshots: ['તમારા Free સ્નેપશોટ', 'પૂર્ણ Free ગણતરી અહીં સ્થિર સ્નેપશોટ છે. જોવા અને એક્સપોર્ટથી માસિક મર્યાદા ઘટતી નથી. આ ફરી વાપરી શકાય તેવી ક્વોલિટી નથી અને તેમાં આવૃત્તિ ઇતિહાસ કે સરખામણી નથી. અપગ્રેડ પછી જૂના Free સ્નેપશોટ પર પણ આ જ નિયમ છે.'],
 searchAndFilters: ['શોધો અને ફિલ્ટર', 'અહીં તમે ચોક્કસ ગણતરી શોધી શકો છો અથવા ફિલ્ટર મુજબ ક્રમબદ્ધ કરી શકો છો.'],
 search: ['શોધો', 'અહીં તમે ચોક્કસ ગણતરી શોધી શકો છો.'],
 freeFilters: ['ફિલ્ટર', 'અહીં તમે વિશિષ્ટ ફિલ્ટર મુજબ ક્રમબદ્ધ કરી શકો છો.'],
 freeSelect: ["પૂર્ણ ગણતરી તપાસો", "લેબલ શોધો, પછી સાચવેલા સ્નેપશોટ પર View breakdown / Export પસંદ કરો. એક્સપોર્ટ પહેલાં સાચવેલો પ્રતિ મીટર ખર્ચ અને વેચાણ ભાવ તપાસો. કોઈ સાચવેલો રેકોર્ડ ન હોય તો પહેલાં ગણતરી પૂર્ણ કરો."],
 finish: ["તમારી એક સાચવેલી ગણતરી તપાસો", "Finish ટૂરના નમૂના બંધ કરીને તમારું પેજ પાછું લાવે છે. તમારી એક સાચવેલી ગણતરી ખોલીને આંકડા તપાસો. છુપાયેલી હોય તો શોધ અને ફિલ્ટર દૂર કરો. ટૂર ફરી ચલાવી શકો છો અથવા તેની બાજુની મદદ ખોલી શકો છો."],
}}
export const savedCostingsTutorialCopy: Record<Language, Copy> = {en, hi, gu}

/** Copy follows the actions rendered by the calling library, including retained Free snapshots. */
export function savedCostingStepCopy(language: Language, step: SavedCostingStep, options: {
  free: boolean; ending: import('@/lib/saved-costings-tour').SavedCostingEnding
  openLabel: string; previewLabel: string; newLabel: string
}): [string, string] {
  const fields = savedCostingsTutorialCopy[language].fields
  const key = step === 'finish'
    ? options.ending === 'empty' ? 'finishEmpty' : options.ending === 'unavailable' ? 'finishUnavailable' : 'finish'
    : step
  const [title, description] = fields[key]
  return [title, description.replace('{open}', options.openLabel).replace('{preview}', options.previewLabel).replace('{new}', options.newLabel)]
}
