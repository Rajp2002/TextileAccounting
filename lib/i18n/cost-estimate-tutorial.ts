import type { Language } from './context'

// Explicit copy: never infer a tutorial title from potentially untranslated DOM labels.
const en = {
  "sections": [
    "Quick vs Detailed",
    "Quality basics",
    "Warp yarn",
    "Weft yarn",
    "Weaving cost",
    "Warping and sizing",
    "Factory overhead",
    "Selling price and quantity",
    "Live cost estimate",
    "Saved qualities"
  ],
  "sectionProgress": "Section {current} of {total}",
  "replay": "How to estimate · Guided tour",
  "skip": "Skip tour",
  "back": "Back",
  "next": "Next",
  "finish": "Finish",
  "progress": "Tutorial progress",
  "hint": "Take a look first. You can enter your numbers after the tour.",
  "syncFailed": "Tutorial dismissed. We couldn’t save this to your account yet.",
  "retry": "Retry saving preference",
  "fields": {
    "partyName": {
      "title": "Party / Customer",
      "description": "Enter the customer or party name for this quotation or party order."
    },
    "warpingMode": {
      "title": "Warping: in-house or outsourced",
      "description": "Is your warping done in-house or outsourced? Choose In-house if you do it at your factory and include its expenses in factory overhead. Choose Outsourced if someone else does it; then enter their warping charge in ₹/kg in the rate field that appears."
    },
    "sizingMode": {
      "title": "Sizing: in-house or outsourced",
      "description": "Is your sizing done in-house or outsourced? Choose In-house if you do it at your factory and include its expenses in factory overhead. Choose Outsourced if someone else does it; then enter their sizing charge in ₹/kg in the rate field that appears."
    },
    "directOverheadMethod": {
      "title": "Direct overhead",
      "description": "Already know your factory overhead cost per metre? Choose Direct overhead rate, then enter that amount in ₹/m in the field below. Use this method when you already have a calculated overhead rate."
    },
    "monthlyOverheadMethod": {
      "title": "Monthly overhead",
      "description": "Want help calculating overhead? Choose Monthly expenses ÷ output, then open Edit monthly overhead details. Enter your monthly factory expenses and typical monthly production in metres; we divide the total expenses by that output to calculate overhead per metre."
    },
    "weavingRateMode": {
      "title": "Weaving rate unit",
      "description": "Choose the unit for your weaving charge: rupees per metre or paisa per pick. Then enter the charge in the next field using that unit."
    },
    "monthlyOverhead": {
      "title": "Monthly expenses and output",
      "description": "After the tour, open these details to review each monthly expense and your typical production in metres. Total monthly expenses divided by production gives overhead per metre."
    },
    "qualityLabel": {
      "title": "Fabric quality name",
      "description": "Enter a recognisable name for this fabric quality, such as 60g Georgette or Japan Satin. This is how you will find it again."
    },
    "warpComponentCount": {
      "title": "Warp components",
      "description": "Enter how many different warp yarn components this quality uses. Each component gets its own row; this is not the number of individual threads."
    },
    "weftComponentCount": {
      "title": "Weft components",
      "description": "Enter how many different weft yarn components this quality uses. Each component gets its own row."
    },
    "warpConstruction": {
      "title": "Warp yarn construction",
      "description": "Optionally enter the warp specification or blend name (such as 50/48 + Rainbow). It auto-fills from your warp components and appears on quotations."
    },
    "weftConstruction": {
      "title": "Weft yarn construction",
      "description": "Optionally enter the weft specification or pick details (such as 50/48 - 68 Picks). It auto-fills from your weft components and appears on quotations."
    },
    "warpCrimpPct": {
      "title": "Warp crimp (take-up)",
      "description": "Enter the extra warp length taken up as yarn bends around the weft, as a percentage. Review the default for this fabric."
    },
    "yarnShortagePct": {
      "title": "Default yarn waste",
      "description": "Enter the default yarn wastage percentage. It applies to yarn rows unless you enter a row-specific waste value."
    },
    "tapeLengthM": {
      "title": "Tape length per beam",
      "description": "Enter the yarn length on one beam in metres. This supports beam planning and party orders."
    },
    "calculationMode": {
      "title": "Yarn calculation method",
      "description": "Formula calculates consumption from fabric construction. Manual kg lets you enter known yarn consumption per 100 metres."
    },
    "label": {
      "title": "Yarn component name",
      "description": "Name this yarn component so you can distinguish it from the other yarns in the quality."
    },
    "calcDenier": {
      "title": "Denier",
      "description": "Enter yarn denier: the weight in grams of 9,000 metres of yarn. Use the denier specified by your yarn supplier."
    },
    "beamEnds": {
      "title": "Beam ends",
      "description": "Enter the number of warp threads on the beam for this component."
    },
    "manualKgPer100m": {
      "title": "Yarn consumption (kg/100m)",
      "description": "Enter kilograms of this yarn needed to make 100 metres of fabric. This is consumption, not metres produced per kilogram."
    },
    "shortagePct": {
      "title": "Component wastage",
      "description": "Enter wastage for this component. Leave blank to use the quality default; enter 0 to explicitly apply no waste."
    },
    "yarnRate": {
      "title": "Current yarn rate",
      "description": "Enter the current purchase price of this yarn in rupees per kilogram, before the GST entered separately."
    },
    "gstPct": {
      "title": "Yarn GST",
      "description": "Enter the yarn GST percentage used in this estimate."
    },
    "picks": {
      "title": "Picks per inch (PPI)",
      "description": "Enter picks per inch (PPI): the number of weft threads in one inch of fabric for this component."
    },
    "effectiveCostingWidthCm": {
      "title": "Finished fabric width",
      "description": "Enter the finished fabric width in the displayed unit (cm or inches). Use finished width, not reed width."
    },
    "perPickCostPaisa": {
      "title": "Weaving charge",
      "description": "Enter the weaving charge in the selected unit: rupees per metre or paisa per pick. Check the unit before entering the number."
    },
    "warpingRatePerKg": {
      "title": "Warping rate",
      "description": "Enter the outsourced warping charge in rupees per kilogram of warp yarn."
    },
    "sizingRatePerKg": {
      "title": "Sizing rate",
      "description": "Enter the outsourced sizing charge in rupees per kilogram of warp yarn."
    },
    "overheadOverridePerM": {
      "title": "Direct overhead rate",
      "description": "Enter your factory overhead allocation in rupees per metre. This covers factory expenses beyond yarn and separately entered process charges."
    },
    "profitPct": {
      "title": "Target margin",
      "description": "Enter your target margin percentage. The estimate uses this to calculate the suggested selling price."
    },
    "commissionPct": {
      "title": "Broker commission",
      "description": "Enter the broker or agent commission as a percentage of the selling price."
    },
    "transportPerM": {
      "title": "Transport charge",
      "description": "Enter the delivery cost to include for each metre of fabric, in rupees."
    },
    "orderQuantityM": {
      "title": "Costing quantity",
      "description": "Optionally enter the total fabric quantity in metres to see order-level totals. Quantity is needed for quotations."
    },
    "entryMode": {
      "title": "Quick vs Detailed mode",
      "description": "Switch between Quick costing for fast estimates with essential inputs, and Detailed costing for full technical parameters, crimp, and factory assumptions. Both use the exact same calculation engine."
    },
    "liveCostShortcut": {
      "title": "Live cost estimator",
      "description": "Tap this floating shortcut anytime to review your live production cost, suggested price, margin, and order profit without losing your place in the form."
    },
    "liveCostReadiness": {
      "title": "Costing status and readiness",
      "description": "Quickly check whether your costing has all required inputs or needs review. If any inputs are missing, tap here to jump straight to the first issue."
    },
    "liveCostMetrics": {
      "title": "Live cost and margin metrics",
      "description": "Review real-time calculations: production cost per metre, suggested selling price based on your target margin, actual margin %, break-even rate, and total order profit."
    },
    "liveCostAssumptions": {
      "title": "Commercial assumptions",
      "description": "Open assumptions to review active overhead rates, target margin, broker commission, order quantity, and process charges factored into this estimate."
    },
    "liveCostActions": {
      "title": "Costing actions and orders",
      "description": "Save this quotation as a draft or accepted deal, start a market production run, or create a party order directly from the live estimate."
    },
    "savedQualities": {
      "title": "Saved qualities",
      "description": "Browse and select from your library of saved fabric recipes. Loading a saved quality instantly populates yarn construction, weaving rates, and overhead assumptions."
    }
  }
}

export type TutorialField = keyof typeof en.fields
type TutorialCopy = Omit<typeof en, 'fields'> & { fields: Record<TutorialField, { title: string; description: string }> }

const hi: TutorialCopy = {
  "sections": [
    "त्वरित बनाम विस्तृत मोड",
    "क्वालिटी की मूल जानकारी",
    "ताना यार्न",
    "बाना यार्न",
    "बुनाई खर्च",
    "वार्पिंग और साइजिंग",
    "फैक्ट्री ओवरहेड",
    "बिक्री मूल्य और मात्रा",
    "लाइव लागत अनुमान",
    "सेव की गई क्वालिटी"
  ],
  "sectionProgress": "भाग {current} / {total}",
  "replay": "अनुमान कैसे बनाएं · ट्यूटोरियल",
  "skip": "ट्यूटोरियल छोड़ें",
  "back": "पीछे",
  "next": "आगे",
  "finish": "पूरा करें",
  "progress": "ट्यूटोरियल की प्रगति",
  "hint": "पहले समझ लें। ट्यूटोरियल के बाद अपने आँकड़े दर्ज कर सकते हैं।",
  "syncFailed": "ट्यूटोरियल बंद कर दिया गया है। यह पसंद अभी आपके खाते में सेव नहीं हो सकी।",
  "retry": "पसंद फिर से सेव करें",
  "fields": {
    "partyName": {
      "title": "पार्टी / ग्राहक",
      "description": "इस कोटेशन या पार्टी ऑर्डर के लिए ग्राहक या पार्टी का नाम दर्ज करें।"
    },
    "warpingMode": {
      "title": "वार्पिंग: फैक्ट्री में या बाहर",
      "description": "वार्पिंग आपकी फैक्ट्री में होती है या बाहर करवाई जाती है? फैक्ट्री में होने पर इन-हाउस चुनें और उसका खर्च फैक्ट्री ओवरहेड में शामिल करें। बाहर करवाने पर आउटसोर्स्ड चुनें; फिर दिखाई देने वाले दर के फ़ील्ड में वार्पिंग का शुल्क ₹/kg में दर्ज करें।"
    },
    "sizingMode": {
      "title": "साइजिंग: फैक्ट्री में या बाहर",
      "description": "साइजिंग आपकी फैक्ट्री में होती है या बाहर करवाई जाती है? फैक्ट्री में होने पर इन-हाउस चुनें और उसका खर्च फैक्ट्री ओवरहेड में शामिल करें। बाहर करवाने पर आउटसोर्स्ड चुनें; फिर दिखाई देने वाले दर के फ़ील्ड में साइजिंग का शुल्क ₹/kg में दर्ज करें।"
    },
    "directOverheadMethod": {
      "title": "सीधी ओवरहेड दर",
      "description": "क्या आपको प्रति मीटर फैक्ट्री ओवरहेड पहले से पता है? सीधी ओवरहेड दर चुनें और नीचे के फ़ील्ड में वह राशि ₹/m में दर्ज करें। पहले से निकाली हुई ओवरहेड दर के लिए यह विधि उपयोग करें।"
    },
    "monthlyOverheadMethod": {
      "title": "मासिक खर्च से ओवरहेड",
      "description": "ओवरहेड की गणना करनी है? मासिक खर्च ÷ उत्पादन चुनें, फिर मासिक ओवरहेड विवरण खोलें। फैक्ट्री के मासिक खर्च और सामान्य मासिक उत्पादन मीटर में दर्ज करें। कुल खर्च को उत्पादन से भाग देकर प्रति मीटर ओवरहेड निकलेगा।"
    },
    "weavingRateMode": {
      "title": "बुनाई दर की इकाई",
      "description": "बुनाई शुल्क की इकाई चुनें: रुपये प्रति मीटर या पैसे प्रति पिक। फिर अगले फ़ील्ड में उसी इकाई में शुल्क दर्ज करें।"
    },
    "monthlyOverhead": {
      "title": "मासिक खर्च और उत्पादन",
      "description": "ट्यूटोरियल के बाद ये विवरण खोलकर हर मासिक खर्च और सामान्य उत्पादन मीटर में देखें। कुल मासिक खर्च को उत्पादन से भाग देने पर प्रति मीटर ओवरहेड मिलता है।"
    },
    "qualityLabel": {
      "title": "कपड़े की क्वालिटी का नाम",
      "description": "इस कपड़े की क्वालिटी का पहचानने योग्य नाम दर्ज करें, जैसे 60g जॉर्जेट या जापान सैटिन। बाद में इसी नाम से इसे ढूँढ सकेंगे।"
    },
    "warpComponentCount": {
      "title": "ताना यार्न के घटक",
      "description": "इस क्वालिटी में ताना यार्न के कितने अलग घटक हैं, वह संख्या दर्ज करें। हर घटक की अलग पंक्ति बनेगी; यह अलग-अलग धागों की संख्या नहीं है।"
    },
    "weftComponentCount": {
      "title": "बाना यार्न के घटक",
      "description": "इस क्वालिटी में बाना यार्न के कितने अलग घटक हैं, वह संख्या दर्ज करें। हर घटक की अलग पंक्ति बनेगी।"
    },
    "warpConstruction": {
      "title": "ताना यार्न संरचना",
      "description": "ताना यार्न का तकनीकी विवरण या नाम दर्ज करें (जैसे 50/48 + Rainbow)। यह आपके ताना यार्न घटकों से अपने-आप भर जाता है और कोटेशन पर छपता है।"
    },
    "weftConstruction": {
      "title": "बाना यार्न संरचना",
      "description": "बाना यार्न का तकनीकी विवरण या पिक्स दर्ज करें (जैसे 50/48 - 68 Picks)। यह आपके बाना यार्न घटकों से अपने-आप भर जाता है और कोटेशन पर छपता है।"
    },
    "warpCrimpPct": {
      "title": "ताना क्रिम्प (टेक-अप)",
      "description": "बाने के चारों ओर मुड़ने से ताने में जितनी अतिरिक्त लंबाई लगती है, उसका प्रतिशत दर्ज करें। इस कपड़े के लिए पहले से भरा मान जाँच लें।"
    },
    "yarnShortagePct": {
      "title": "सामान्य यार्न वेस्टेज",
      "description": "सामान्य यार्न वेस्टेज का प्रतिशत दर्ज करें। यह सभी यार्न पंक्तियों पर लागू होगा, जब तक किसी पंक्ति में अलग वेस्टेज न दिया हो।"
    },
    "tapeLengthM": {
      "title": "एक बीम की टेप लंबाई",
      "description": "एक बीम पर यार्न की लंबाई मीटर में दर्ज करें। इसका उपयोग बीम प्लानिंग और पार्टी ऑर्डर में होता है।"
    },
    "calculationMode": {
      "title": "यार्न खपत की गणना विधि",
      "description": "फ़ॉर्मूला विधि कपड़े की बनावट से खपत निकालती है। मैनुअल kg विधि में आप प्रति 100 मीटर की ज्ञात यार्न खपत दर्ज कर सकते हैं।"
    },
    "label": {
      "title": "यार्न घटक का नाम",
      "description": "इस यार्न घटक का नाम दर्ज करें ताकि इसे क्वालिटी के दूसरे यार्न से अलग पहचान सकें।"
    },
    "calcDenier": {
      "title": "डेनियर",
      "description": "यार्न का डेनियर दर्ज करें: 9,000 मीटर यार्न का वजन ग्राम में। अपने यार्न सप्लायर द्वारा बताया गया डेनियर उपयोग करें।"
    },
    "beamEnds": {
      "title": "बीम पर ताने के धागे",
      "description": "इस घटक के लिए बीम पर ताने के धागों की संख्या दर्ज करें।"
    },
    "manualKgPer100m": {
      "title": "यार्न खपत (kg/100m)",
      "description": "100 मीटर कपड़ा बनाने के लिए इस यार्न के कितने किलोग्राम चाहिए, वह दर्ज करें। यह खपत है, एक किलोग्राम से बनने वाले मीटर नहीं।"
    },
    "shortagePct": {
      "title": "इस घटक का वेस्टेज",
      "description": "इस घटक का वेस्टेज दर्ज करें। क्वालिटी का सामान्य वेस्टेज उपयोग करने के लिए खाली छोड़ें; कोई वेस्टेज नहीं लगाने के लिए 0 दर्ज करें।"
    },
    "yarnRate": {
      "title": "यार्न की मौजूदा दर",
      "description": "इस यार्न की मौजूदा खरीद दर रुपये प्रति किलोग्राम में दर्ज करें। अलग से दर्ज किया जाने वाला GST इसमें शामिल न करें।"
    },
    "gstPct": {
      "title": "यार्न पर GST",
      "description": "इस अनुमान में उपयोग होने वाला यार्न GST प्रतिशत दर्ज करें।"
    },
    "picks": {
      "title": "प्रति इंच पिक्स (PPI)",
      "description": "प्रति इंच पिक्स (PPI) दर्ज करें: इस घटक के लिए कपड़े के एक इंच में बाने के धागों की संख्या।"
    },
    "effectiveCostingWidthCm": {
      "title": "तैयार कपड़े की चौड़ाई",
      "description": "तैयार कपड़े की चौड़ाई दिखाई गई इकाई (सेमी या इंच) में दर्ज करें। तैयार चौड़ाई लें, रीड की चौड़ाई नहीं।"
    },
    "perPickCostPaisa": {
      "title": "बुनाई का शुल्क",
      "description": "चुनी हुई इकाई में बुनाई शुल्क दर्ज करें: रुपये प्रति मीटर या पैसे प्रति पिक। संख्या भरने से पहले इकाई जाँच लें।"
    },
    "warpingRatePerKg": {
      "title": "वार्पिंग दर",
      "description": "बाहर करवाई गई वार्पिंग का शुल्क ताना यार्न के प्रति किलोग्राम के लिए रुपये में दर्ज करें।"
    },
    "sizingRatePerKg": {
      "title": "साइजिंग दर",
      "description": "बाहर करवाई गई साइजिंग का शुल्क ताना यार्न के प्रति किलोग्राम के लिए रुपये में दर्ज करें।"
    },
    "overheadOverridePerM": {
      "title": "सीधी ओवरहेड दर",
      "description": "फैक्ट्री ओवरहेड का हिस्सा रुपये प्रति मीटर में दर्ज करें। इसमें यार्न और अलग से दर्ज प्रक्रिया शुल्क के अलावा फैक्ट्री के खर्च आते हैं।"
    },
    "profitPct": {
      "title": "लक्षित मार्जिन",
      "description": "अपना लक्षित मार्जिन प्रतिशत दर्ज करें। इससे सुझाए गए बिक्री मूल्य की गणना होगी।"
    },
    "commissionPct": {
      "title": "ब्रोकर कमीशन",
      "description": "ब्रोकर या एजेंट का कमीशन बिक्री मूल्य के प्रतिशत के रूप में दर्ज करें।"
    },
    "transportPerM": {
      "title": "परिवहन शुल्क",
      "description": "कपड़े के हर मीटर के लिए शामिल किया जाने वाला डिलीवरी खर्च रुपये में दर्ज करें।"
    },
    "orderQuantityM": {
      "title": "अनुमान की मात्रा",
      "description": "ऑर्डर का कुल हिसाब देखने के लिए चाहें तो कपड़े की कुल मात्रा मीटर में दर्ज करें। कोटेशन के लिए मात्रा ज़रूरी है।"
    },
    "entryMode": {
      "title": "त्वरित बनाम विस्तृत मोड",
      "description": "आवश्यक इनपुट के साथ तेज़ गणना के लिए त्वरित (Quick) मोड, या पूर्ण तकनीकी विवरण और फैक्ट्री मान्यताओं के लिए विस्तृत (Detailed) मोड चुनें। दोनों में एक ही गणना इंजन काम करता है।"
    },
    "liveCostShortcut": {
      "title": "लाइव लागत शॉर्टकट",
      "description": "फॉर्म में कहीं भी रहते हुए अपना लाइव उत्पादन खर्च, सुझाई गई बिक्री कीमत, मार्जिन और ऑर्डर का मुनाफा देखने के लिए इस बटन को दबाएं।"
    },
    "liveCostReadiness": {
      "title": "अनुमान की स्थिति और तैयारी",
      "description": "तुरंत देखें कि अनुमान में सभी ज़रूरी जानकारी भर दी गई है या समीक्षा की आवश्यकता है। यदि कोई इनपुट छूटा है, तो सीधे वहाँ पहुँचने के लिए यहाँ टैप करें।"
    },
    "liveCostMetrics": {
      "title": "लाइव लागत और मार्जिन विवरण",
      "description": "प्रति मीटर उत्पादन लागत, लक्षित मार्जिन के आधार पर सुझाई गई बिक्री कीमत, वास्तविक मार्जिन %, ब्रेक-इवन दर और कुल ऑर्डर मुनाफे की लाइव गणना देखें।"
    },
    "liveCostAssumptions": {
      "title": "व्यावसायिक मान्यताएं",
      "description": "इस अनुमान में शामिल ओवरहेड दर, लक्षित मार्जिन, ब्रोकर कमीशन, ऑर्डर मात्रा और प्रक्रिया खर्चों की समीक्षा करने के लिए मान्यताएं खोलें।"
    },
    "liveCostActions": {
      "title": "अनुमान सेव और ऑर्डर कार्य",
      "description": "इस कोटेशन को ड्राफ्ट या स्वीकृत सौदे के रूप में सेव करें, मार्केट रन शुरू करें, या लाइव अनुमान से सीधे पार्टी ऑर्डर तैयार करें।"
    },
    "savedQualities": {
      "title": "सेव की गई क्वालिटी",
      "description": "अपनी सेव की गई कपड़े की क्वालिटी और रेसिपी की लाइब्रेरी देखें और चुनें। सेव की गई क्वालिटी लोड करने पर यार्न की बनावट, बुनाई की दरें और ओवरहेड तुरंत भर जाते हैं।"
    }
  }
}

const gu: TutorialCopy = {
  "sections": [
    "ઝડપી કે વિગતવાર મોડ",
    "ક્વોલિટીની મૂળભૂત માહિતી",
    "તાણાનું યાર્ન",
    "વાણાનું યાર્ન",
    "વણાટ ખર્ચ",
    "વાર્પિંગ અને સાઇઝિંગ",
    "ફેક્ટરી ઓવરહેડ",
    "વેચાણ કિંમત અને જથ્થો",
    "લાઇવ ખર્ચ અંદાજ",
    "સેવ કરેલી ક્વોલિટી"
  ],
  "sectionProgress": "ભાગ {current} / {total}",
  "replay": "અંદાજ કેવી રીતે બનાવવો · ટ્યુટોરિયલ",
  "skip": "ટ્યુટોરિયલ છોડો",
  "back": "પાછળ",
  "next": "આગળ",
  "finish": "પૂર્ણ કરો",
  "progress": "ટ્યુટોરિયલની પ્રગતિ",
  "hint": "પહેલાં સમજી લો. ટ્યુટોરિયલ પછી તમારા આંકડા દાખલ કરી શકો છો.",
  "syncFailed": "ટ્યુટોરિયલ બંધ કર્યું છે. આ પસંદગી હજી તમારા ખાતામાં સેવ થઈ શકી નથી.",
  "retry": "પસંદગી ફરી સેવ કરો",
  "fields": {
    "partyName": {
      "title": "પાર્ટી / ગ્રાહક",
      "description": "આ ક્વોટેશન અથવા પાર્ટી ઓર્ડર માટે ગ્રાહક કે પાર્ટીનું નામ દાખલ કરો."
    },
    "warpingMode": {
      "title": "વાર્પિંગ: ફેક્ટરીમાં કે બહાર",
      "description": "વાર્પિંગ તમારી ફેક્ટરીમાં થાય છે કે બહાર કરાવો છો? ફેક્ટરીમાં થતું હોય તો ઇન-હાઉસ પસંદ કરો અને તેનો ખર્ચ ફેક્ટરી ઓવરહેડમાં સામેલ કરો. બહાર કરાવતા હોય તો આઉટસોર્સ્ડ પસંદ કરો; પછી દેખાતા દરના ફીલ્ડમાં વાર્પિંગનો ચાર્જ ₹/kg માં દાખલ કરો."
    },
    "sizingMode": {
      "title": "સાઇઝિંગ: ફેક્ટરીમાં કે બહાર",
      "description": "સાઇઝિંગ તમારી ફેક્ટરીમાં થાય છે કે બહાર કરાવો છો? ફેક્ટરીમાં થતું હોય તો ઇન-હાઉસ પસંદ કરો અને તેનો ખર્ચ ફેક્ટરી ઓવરહેડમાં સામેલ કરો. બહાર કરાવતા હોય તો આઉટસોર્સ્ડ પસંદ કરો; પછી દેખાતા દરના ફીલ્ડમાં સાઇઝિંગનો ચાર્જ ₹/kg માં દાખલ કરો."
    },
    "directOverheadMethod": {
      "title": "સીધો ઓવરહેડ દર",
      "description": "શું તમને પ્રતિ મીટર ફેક્ટરી ઓવરહેડ પહેલેથી ખબર છે? સીધો ઓવરહેડ દર પસંદ કરો અને નીચેના ફીલ્ડમાં તે રકમ ₹/m માં દાખલ કરો. પહેલેથી ગણેલો ઓવરહેડ દર હોય ત્યારે આ પદ્ધતિ વાપરો."
    },
    "monthlyOverheadMethod": {
      "title": "માસિક ખર્ચથી ઓવરહેડ",
      "description": "ઓવરહેડની ગણતરી કરવી છે? માસિક ખર્ચ ÷ ઉત્પાદન પસંદ કરો, પછી માસિક ઓવરહેડની વિગતો ખોલો. ફેક્ટરીના માસિક ખર્ચ અને સામાન્ય માસિક ઉત્પાદન મીટરમાં દાખલ કરો. કુલ ખર્ચને ઉત્પાદનથી ભાગીને પ્રતિ મીટર ઓવરહેડ ગણાશે."
    },
    "weavingRateMode": {
      "title": "વણાટના દરનો એકમ",
      "description": "વણાટના ચાર્જનો એકમ પસંદ કરો: રૂપિયા પ્રતિ મીટર અથવા પૈસા પ્રતિ પિક. પછી આગળના ફીલ્ડમાં એ જ એકમમાં ચાર્જ દાખલ કરો."
    },
    "monthlyOverhead": {
      "title": "માસિક ખર્ચ અને ઉત્પાદન",
      "description": "ટ્યુટોરિયલ પછી આ વિગતો ખોલીને દરેક માસિક ખર્ચ અને સામાન્ય ઉત્પાદન મીટરમાં જુઓ. કુલ માસિક ખર્ચને ઉત્પાદનથી ભાગવાથી પ્રતિ મીટર ઓવરહેડ મળે છે."
    },
    "qualityLabel": {
      "title": "કાપડની ક્વોલિટીનું નામ",
      "description": "આ કાપડની ક્વોલિટીનું ઓળખી શકાય એવું નામ દાખલ કરો, જેમ કે 60g જ્યોર્જેટ અથવા જાપાન સાટિન. પછી આ જ નામથી તેને શોધી શકશો."
    },
    "warpComponentCount": {
      "title": "તાણાના યાર્નના ઘટકો",
      "description": "આ ક્વોલિટીમાં તાણાના યાર્નના કેટલા અલગ ઘટકો છે તે સંખ્યા દાખલ કરો. દરેક ઘટકની અલગ પંક્તિ બનશે; આ વ્યક્તિગત તારની સંખ્યા નથી."
    },
    "weftComponentCount": {
      "title": "વાણાના યાર્નના ઘટકો",
      "description": "આ ક્વોલિટીમાં વાણાના યાર્નના કેટલા અલગ ઘટકો છે તે સંખ્યા દાખલ કરો. દરેક ઘટકની અલગ પંક્તિ બનશે."
    },
    "warpConstruction": {
      "title": "તાણાના યાર્નની રચના",
      "description": "તાણાના યાર્નની સ્પેસિફિકેશન કે નામ દાખલ કરો (જેમ કે 50/48 + Rainbow). આ તમારા તાણાના ઘટકો પરથી આપોઆપ ભરાય છે અને ક્વોટેશનમાં દર્શાવાય છે."
    },
    "weftConstruction": {
      "title": "વાણાના યાર્નની રચના",
      "description": "વાણાના યાર્નની સ્પેસિફિકેશન કે પિક્સ વિગત દાખલ કરો (જેમ કે 50/48 - 68 Picks). આ તમારા વાણાના ઘટકો પરથી આપોઆપ ભરાય છે અને ક્વોટેશનમાં દર્શાવાય છે."
    },
    "warpCrimpPct": {
      "title": "તાણા ક્રિમ્પ (ટેક-અપ)",
      "description": "વાણાની આસપાસ વળવાથી તાણામાં જેટલી વધારાની લંબાઈ વપરાય છે તેની ટકાવારી દાખલ કરો. આ કાપડ માટે પહેલેથી ભરેલું મૂલ્ય તપાસો."
    },
    "yarnShortagePct": {
      "title": "સામાન્ય યાર્ન વેસ્ટેજ",
      "description": "સામાન્ય યાર્ન વેસ્ટેજની ટકાવારી દાખલ કરો. કોઈ પંક્તિમાં અલગ વેસ્ટેજ આપેલું ન હોય તો આ બધી યાર્ન પંક્તિઓ પર લાગુ પડશે."
    },
    "tapeLengthM": {
      "title": "એક બીમની ટેપ લંબાઈ",
      "description": "એક બીમ પર યાર્નની લંબાઈ મીટરમાં દાખલ કરો. તેનો ઉપયોગ બીમ પ્લાનિંગ અને પાર્ટી ઓર્ડરમાં થાય છે."
    },
    "calculationMode": {
      "title": "યાર્ન વપરાશની ગણતરી પદ્ધતિ",
      "description": "ફોર્મ્યુલા પદ્ધતિ કાપડની રચના પરથી વપરાશ ગણે છે. મેન્યુઅલ kg પદ્ધતિમાં પ્રતિ 100 મીટરનો જાણીતો યાર્ન વપરાશ દાખલ કરી શકો છો."
    },
    "label": {
      "title": "યાર્નના ઘટકનું નામ",
      "description": "આ યાર્નના ઘટકનું નામ દાખલ કરો જેથી તેને ક્વોલિટીના બીજા યાર્નથી અલગ ઓળખી શકો."
    },
    "calcDenier": {
      "title": "ડેનિયર",
      "description": "યાર્નનો ડેનિયર દાખલ કરો: 9,000 મીટર યાર્નનું વજન ગ્રામમાં. તમારા યાર્ન સપ્લાયરે જણાવેલો ડેનિયર વાપરો."
    },
    "beamEnds": {
      "title": "બીમ પર તાણાના તાર",
      "description": "આ ઘટક માટે બીમ પર તાણાના તારની સંખ્યા દાખલ કરો."
    },
    "manualKgPer100m": {
      "title": "યાર્ન વપરાશ (kg/100m)",
      "description": "100 મીટર કાપડ બનાવવા માટે આ યાર્નના કેટલા કિલોગ્રામ જોઈએ તે દાખલ કરો. આ વપરાશ છે, એક કિલોગ્રામમાંથી બનતા મીટર નથી."
    },
    "shortagePct": {
      "title": "આ ઘટકનું વેસ્ટેજ",
      "description": "આ ઘટકનું વેસ્ટેજ દાખલ કરો. ક્વોલિટીનું સામાન્ય વેસ્ટેજ વાપરવા માટે ખાલી રાખો; વેસ્ટેજ ન ગણવા માટે 0 દાખલ કરો."
    },
    "yarnRate": {
      "title": "યાર્નનો હાલનો દર",
      "description": "આ યાર્નનો હાલનો ખરીદ દર રૂપિયા પ્રતિ કિલોગ્રામમાં દાખલ કરો. અલગથી દાખલ થતો GST તેમાં સામેલ ન કરો."
    },
    "gstPct": {
      "title": "યાર્ન પર GST",
      "description": "આ અંદાજમાં વપરાતી યાર્ન GST ની ટકાવારી દાખલ કરો."
    },
    "picks": {
      "title": "પ્રતિ ઇંચ પિક્સ (PPI)",
      "description": "પ્રતિ ઇંચ પિક્સ (PPI) દાખલ કરો: આ ઘટક માટે કાપડના એક ઇંચમાં વાણાના તારની સંખ્યા."
    },
    "effectiveCostingWidthCm": {
      "title": "તૈયાર કાપડની પહોળાઈ",
      "description": "તૈયાર કાપડની પહોળાઈ દેખાતા એકમમાં (સેમી અથવા ઇંચ) દાખલ કરો. તૈયાર પહોળાઈ લો, રીડની પહોળાઈ નહીં."
    },
    "perPickCostPaisa": {
      "title": "વણાટનો ચાર્જ",
      "description": "પસંદ કરેલા એકમમાં વણાટનો ચાર્જ દાખલ કરો: રૂપિયા પ્રતિ મીટર અથવા પૈસા પ્રતિ પિક. સંખ્યા ભરતાં પહેલાં એકમ તપાસો."
    },
    "warpingRatePerKg": {
      "title": "વાર્પિંગનો દર",
      "description": "બહાર કરાવેલી વાર્પિંગનો ચાર્જ તાણાના યાર્નના પ્રતિ કિલોગ્રામ માટે રૂપિયામાં દાખલ કરો."
    },
    "sizingRatePerKg": {
      "title": "સાઇઝિંગનો દર",
      "description": "બહાર કરાવેલી સાઇઝિંગનો ચાર્જ તાણાના યાર્નના પ્રતિ કિલોગ્રામ માટે રૂપિયામાં દાખલ કરો."
    },
    "overheadOverridePerM": {
      "title": "સીધો ઓવરહેડ દર",
      "description": "ફેક્ટરી ઓવરહેડનો હિસ્સો રૂપિયા પ્રતિ મીટરમાં દાખલ કરો. તેમાં યાર્ન અને અલગથી દાખલ કરેલા પ્રક્રિયા ચાર્જ સિવાયના ફેક્ટરી ખર્ચ આવે છે."
    },
    "profitPct": {
      "title": "લક્ષિત માર્જિન",
      "description": "તમારી લક્ષિત માર્જિન ટકાવારી દાખલ કરો. તેના પરથી સૂચવેલી વેચાણ કિંમત ગણાશે."
    },
    "commissionPct": {
      "title": "બ્રોકર કમિશન",
      "description": "બ્રોકર અથવા એજન્ટનું કમિશન વેચાણ કિંમતની ટકાવારી તરીકે દાખલ કરો."
    },
    "transportPerM": {
      "title": "પરિવહન ચાર્જ",
      "description": "કાપડના દરેક મીટર માટે સામેલ કરવાનો ડિલિવરી ખર્ચ રૂપિયામાં દાખલ કરો."
    },
    "orderQuantityM": {
      "title": "અંદાજનો જથ્થો",
      "description": "ઓર્ડરનો કુલ હિસાબ જોવા માટે ઇચ્છો તો કાપડનો કુલ જથ્થો મીટરમાં દાખલ કરો. ક્વોટેશન માટે જથ્થો જરૂરી છે."
    },
    "entryMode": {
      "title": "ઝડપી કે વિગતવાર મોડ",
      "description": "જરૂરી વિગતો સાથે ઝડપી ગણતરી માટે ક્વિક (Quick) મોડ, અથવા સંપૂર્ણ ટેકનિકલ પરિમાણો અને ફેક્ટરી ધારણાઓ માટે વિગતવાર (Detailed) મોડ પસંદ કરો. બંને એક જ ગણતરી એન્જિન વાપરે છે."
    },
    "liveCostShortcut": {
      "title": "લાઇવ ખર્ચ શોર્ટકટ",
      "description": "ફોર્મમાં કોઈપણ જગ્યાએ હોવ ત્યારે તમારો લાઈવ ઉત્પાદન ખર્ચ, સૂચવેલી કિંમત, માર્જિન અને નફો જોવા માટે આ બટન દબાવો."
    },
    "liveCostReadiness": {
      "title": "અંદાજની સ્થિતિ અને તૈયારી",
      "description": "ગણતરીમાં બધી જરૂરી વિગતો ભરાઈ ગઈ છે કે તપાસ બાકી છે તે તરત જુઓ. કોઈ માહિતી ખૂટતી હોય તો સીધા ત્યાં પહોંચવા અહીં ટેપ કરો."
    },
    "liveCostMetrics": {
      "title": "લાઇવ ખર્ચ અને માર્જિન વિગતો",
      "description": "પ્રતિ મીટર ઉત્પાદન ખર્ચ, લક્ષિત માર્જિન મુજબ સૂચવેલી વેચાણ કિંમત, સાચો માર્જિન %, બ્રેક-ઈવન દર અને કુલ ઓર્ડર નફાની લાઈવ ગણતરી જુઓ."
    },
    "liveCostAssumptions": {
      "title": "વાણિજ્યિક ધારણાઓ",
      "description": "આ અંદાજમાં સામેલ ઓવરહેડ દર, લક્ષિત માર્જિન, દલાલી કમિશન, ઓર્ડર જથ્થો અને પ્રોસેસ ખર્ચની સમીક્ષા માટે ધારણાઓ ખોલો."
    },
    "liveCostActions": {
      "title": "અંદાજ સેવ અને ઓર્ડર કાર્ય",
      "description": "આ ક્વોટેશન ડ્રાફ્ટ કે મંજૂર ડીલ તરીકે સેવ કરો, માર્કેટ રન શરૂ કરો, અથવા લાઈવ અંદાજ પરથી સીધો પાર્ટી ઓર્ડર બનાવો."
    },
    "savedQualities": {
      "title": "સેવ કરેલી ક્વોલિટી",
      "description": "તમારી સેવ કરેલી કાપડની ક્વોલિટી અને રેસિપીની લાઇબ્રેરી જુઓ અને પસંદ કરો. સેવ કરેલી ક્વોલિટી લોડ કરવાથી યાર્નની રચના, વણાટ દર અને ઓવરહેડ તરત ભરાઈ જાય છે."
    }
  }
}

export const costEstimateTutorialCopy: Record<Language, TutorialCopy> = { en, hi, gu }

export function isTutorialField(field: string): field is TutorialField {
    return Object.prototype.hasOwnProperty.call(en.fields, field)
}
