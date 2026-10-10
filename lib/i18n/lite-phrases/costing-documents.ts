import type { Language } from '../context'
import type { LitePhraseRow } from './types'

/**
 * Hindi and Gujarati for the printed labels of the internal cost sheet and the
 * customer quotation (lib/estimator-export.ts). PDFs are built as HTML outside
 * the page, so the page translator never sees them; the document builder looks
 * labels up here with costingDocumentText(). `{0}`, `{1}` are values.
 */
export const COSTING_DOCUMENT_PHRASES: LitePhraseRow[] = [
    ["Customer quotation · unsaved working inputs", "ग्राहक कोटेशन · बिना सेव की गई जानकारी", "ગ્રાહક ક્વોટેશન · સાચવ્યા વગરની માહિતી"],
    ["Internal estimate · unsaved working inputs", "अंदरूनी अनुमान · बिना सेव की गई जानकारी", "આંતરિક અંદાજ · સાચવ્યા વગરની માહિતી"],
    ["This customer quotation is a document artifact only and is not a GST tax invoice.", "यह ग्राहक कोटेशन सिर्फ़ एक दस्तावेज़ है, GST टैक्स इनवॉइस नहीं है।", "આ ગ્રાહક ક્વોટેશન ફક્ત દસ્તાવેજ છે, GST ટેક્સ ઇન્વૉઇસ નથી."],
    ["Untitled Costing", "बिना नाम की कॉस्टिंग", "નામ વગરની કોસ્ટિંગ"],
    ["The costing result is not ready yet.", "कॉस्टिंग का नतीजा अभी तैयार नहीं है।", "કોસ્ટિંગનું પરિણામ હજી તૈયાર નથી."],
    ["This historical costing is not verified for export. Open it, review the assumptions, and save a new current Cost Estimate before exporting.", "यह पुरानी कॉस्टिंग एक्सपोर्ट के लिए जाँची हुई नहीं है। इसे खोलें, आंकड़े जाँचें और एक्सपोर्ट से पहले नया लागत अनुमान सेव करें।", "આ જૂની કોસ્ટિંગ એક્સપોર્ટ માટે ચકાસેલી નથી. તેને ખોલો, આંકડા તપાસો અને એક્સપોર્ટ કરતાં પહેલાં નવો ખર્ચ અંદાજ સાચવો."],
    ["This saved costing needs owner review before it can be used as a customer quotation. Check the saved numbers or save a new current costing.", "ग्राहक कोटेशन में इस्तेमाल से पहले मालिक को यह सेव की गई कॉस्टिंग जाँचनी होगी। सेव किए गए आंकड़े जाँचें या नई कॉस्टिंग सेव करें।", "ગ્રાહક ક્વોટેશનમાં વાપરતા પહેલાં માલિકે આ સાચવેલી કોસ્ટિંગ તપાસવી પડશે. સાચવેલા આંકડા તપાસો અથવા નવી કોસ્ટિંગ સાચવો."],
    ["The costing result is not valid for export. Review the calculation before exporting.", "कॉस्टिंग का नतीजा एक्सपोर्ट के लायक सही नहीं है। एक्सपोर्ट से पहले हिसाब जाँचें।", "કોસ્ટિંગનું પરિણામ એક્સપોર્ટ માટે સાચું નથી. એક્સપોર્ટ કરતાં પહેલાં ગણતરી તપાસો."],
    ["Quality is required before generating a document.", "दस्तावेज़ बनाने से पहले क्वालिटी ज़रूरी है।", "દસ્તાવેજ બનાવતા પહેલાં ક્વોલિટી જરૂરી છે."],
    ["Production cost is not valid. Review the costing before exporting.", "उत्पादन लागत सही नहीं है। एक्सपोर्ट से पहले कॉस्टिंग जाँचें।", "ઉત્પાદન ખર્ચ સાચો નથી. એક્સપોર્ટ કરતાં પહેલાં કોસ્ટિંગ તપાસો."],
    ["Selling price per metre is not valid. Review the commercial assumptions before exporting.", "प्रति मीटर बिक्री भाव सही नहीं है। एक्सपोर्ट से पहले दलाली, भाड़ा और मार्जिन जाँचें।", "મીટરદીઠ વેચાણ ભાવ સાચો નથી. એક્સપોર્ટ કરતાં પહેલાં દલાલી, ભાડું અને માર્જિન તપાસો."],
    ["Enter the party or customer name before creating a quotation.", "कोटेशन बनाने से पहले पार्टी या ग्राहक का नाम लिखें।", "ક્વોટેશન બનાવતા પહેલાં પાર્ટી કે ગ્રાહકનું નામ લખો."],
    ["Enter an order quantity before creating a Customer Quotation.", "ग्राहक कोटेशन बनाने से पहले ऑर्डर की मात्रा लिखें।", "ગ્રાહક ક્વોટેશન બનાવતા પહેલાં ઓર્ડરનો જથ્થો લખો."],
    ["Choose a valid quotation validity date.", "कोटेशन की वैधता की सही तारीख चुनें।", "ક્વોટેશનની માન્યતાની સાચી તારીખ પસંદ કરો."],
    ["quantity to be confirmed", "मात्रा बाद में तय होगी", "જથ્થો પછી નક્કી થશે"],
    ["to be confirmed", "बाद में तय होगा", "પછી નક્કી થશે"],
    ["PDF quotation attached separately.", "PDF कोटेशन अलग से भेजा गया है।", "PDF ક્વોટેશન અલગથી મોકલ્યું છે."],
    ["Internal Cost Sheet", "अंदरूनी कॉस्ट शीट", "આંતરિક કોસ્ટ શીટ"],
    ["Customer Quotation", "ग्राहक कोटेशन", "ગ્રાહક ક્વોટેશન"],
    ["Review required", "जाँच ज़रूरी", "તપાસ જરૂરી"],
    ["Prepared from an incomplete historical snapshot", "अधूरी पुरानी कॉस्टिंग से बनाया गया", "અધૂરી જૂની કોસ્ટિંગ પરથી બનાવ્યું"],
    ["Historical record", "पुराना रिकॉर्ड", "જૂનો રેકોર્ડ"],
    ["Customer export is blocked until the costing is reconciled.", "कॉस्टिंग ठीक होने तक ग्राहक के लिए एक्सपोर्ट बंद है।", "કોસ્ટિંગ સુધરે ત્યાં સુધી ગ્રાહક માટે એક્સપોર્ટ બંધ છે."],
    ["Not specified", "नहीं बताया", "જણાવ્યું નથી"],
    ["Base warp yarn", "ताना यार्न (मूल)", "તાણા યાર્ન (મૂળ)"],
    ["Base weft yarn", "बाना यार्न (मूल)", "ભરણ યાર્ન (મૂળ)"],
    ["Yarn wastage / crimp", "यार्न वेस्ट / क्रिम्प", "યાર્ન વેસ્ટ / ક્રિમ્પ"],
    ["Warp yarn (saved adjusted cost)", "ताना यार्न (सेव की गई कुल लागत)", "તાણા યાર્ન (સાચવેલો કુલ ખર્ચ)"],
    ["Weft yarn (saved adjusted cost)", "बाना यार्न (सेव की गई कुल लागत)", "ભરણ યાર્ન (સાચવેલો કુલ ખર્ચ)"],
    ["Machine weaving", "मशीन बुनाई", "મશીન વીવિંગ"],
    ["Warping + sizing", "वार्पिंग + साइज़िंग", "વૉર્પિંગ + સાઇઝિંગ"],
    ["Winding", "वाइंडिंग", "વાઇન્ડિંગ"],
    ["Processing", "प्रोसेसिंग", "પ્રોસેસિંગ"],
    ["Finishing", "फिनिशिंग", "ફિનિશિંગ"],
    ["Factory expenses", "फैक्ट्री खर्च", "ફેક્ટરી ખર્ચ"],
    ["Production cost", "उत्पादन लागत", "ઉત્પાદન ખર્ચ"],
    ["Warp", "ताना", "તાણા"],
    ["Weft", "बाना", "ભરણ"],
    ["Historical yarn details", "पुरानी यार्न जानकारी", "જૂની યાર્ન માહિતી"],
    ["Unavailable", "उपलब्ध नहीं", "ઉપલબ્ધ નથી"],
    ["Re-enter and save this costing", "यह कॉस्टिंग फिर से लिखकर सेव करें", "આ કોસ્ટિંગ ફરી લખીને સાચવો"],
    ["Suggested selling price", "सुझाया गया बिक्री भाव", "સૂચવેલો વેચાણ ભાવ"],
    ["Break-even price", "ब्रेक-ईवन भाव", "બ્રેક-ઈવન ભાવ"],
    ["Estimated margin at this price", "इस भाव पर अनुमानित मार्जिन", "આ ભાવે અંદાજિત માર્જિન"],
    ["Order quantity", "ऑर्डर मात्रा", "ઓર્ડર જથ્થો"],
    ["Expected loss", "अनुमानित नुकसान", "અંદાજિત નુકસાન"],
    ["Expected profit", "अनुमानित मुनाफ़ा", "અંદાજિત નફો"],
    ["Loss / m", "नुकसान / मीटर", "નુકસાન / મીટર"],
    ["Profit / m", "मुनाफ़ा / मीटर", "નફો / મીટર"],
    ["Cost component", "लागत का हिस्सा", "ખર્ચનો ભાગ"],
    ["Share", "हिस्सा", "હિસ્સો"],
    ["Cost / m", "लागत / मीटर", "ખર્ચ / મીટર"],
    ["Wastage is shown separately in the cost breakdown above", "वेस्ट ऊपर लागत के ब्योरे में अलग दिखाया गया है", "વેસ્ટ ઉપર ખર્ચની વિગતમાં અલગ બતાવ્યો છે"],
    ["Detailed historical values unavailable", "पुराने विस्तृत आंकड़े उपलब्ध नहीं", "જૂના વિગતવાર આંકડા ઉપલબ્ધ નથી"],
    ["Use", "उपयोग", "ઉપયોગ"],
    ["Yarn / layer", "यार्न / लेयर", "યાર્ન / લેયર"],
    ["Base kg / 100m", "मूल kg / 100m", "મૂળ kg / 100m"],
    ["Rate", "रेट", "ભાવ"],
    ["Base cost / m", "मूल लागत / मीटर", "મૂળ ખર્ચ / મીટર"],
    ["On confirmation", "पुष्टि होने पर", "ખાતરી થયે"],
    ["Issued by", "जारीकर्ता", "જારી કરનાર"],
    ["Prepared for", "किसके लिए", "કોના માટે"],
    ["To be confirmed", "बाद में तय होगा", "પછી નક્કી થશે"],
    ["Valid until", "मान्य तारीख तक", "માન્ય તારીખ સુધી"],
    ["Description", "विवरण", "વિગત"],
    ["Quoted price", "कोटेशन भाव", "ક્વોટ કરેલો ભાવ"],
    ["Amount", "रकम", "રકમ"],
    ["Name and signature", "नाम और हस्ताक्षर", "નામ અને સહી"],
    ["Reference", "संदर्भ", "સંદર્ભ"],
    ["Prepared", "तारीख", "તારીખ"],
    ["Costing snapshot", "कॉस्टिंग", "કોસ્ટિંગ"],
    ["Quotation", "कोटेशन", "ક્વોટેશન"],
    ["Historical costings retain their saved assumptions.", "पुरानी कॉस्टिंग में सेव किए गए आंकड़े वैसे ही रहते हैं।", "જૂની કોસ્ટિંગમાં સાચવેલા આંકડા જેમ હતા તેમ રહે છે."],
    ["Thank you for the opportunity to quote.", "कोटेशन का अवसर देने के लिए धन्यवाद।", "ક્વોટેશનની તક આપવા બદલ આભાર."],
    ["Customer quotation · based on {quality} costing v{version} · saved {date}", "ग्राहक कोटेशन · {quality} कॉस्टिंग v{version} पर आधारित · {date} को सेव किया गया", "ગ્રાહક ક્વોટેશન · {quality} કોસ્ટિંગ v{version} પરથી · {date} એ સાચવ્યું"],
    ["Internal cost sheet · based on {quality} costing v{version} · saved {date}", "अंदरूनी कॉस्ट शीट · {quality} कॉस्टिंग v{version} पर आधारित · {date} को सेव किया गया", "આંતરિક કોસ્ટ શીટ · {quality} કોસ્ટિંગ v{version} પરથી · {date} એ સાચવ્યું"],
    ["Notes must be {0} characters or fewer.", "नोट्स {0} अक्षरों से ज़्यादा नहीं हो सकते।", "નોંધ {0} અક્ષરથી વધુ ન હોઈ શકે."],
    ["Valid until: {0}", "मान्य तारीख: {0} तक", "માન્ય: {0} સુધી"],
    ["{0} — review required", "{0} — जाँच ज़रूरी", "{0} — તપાસ જરૂરી"],
    ["GST will be charged as applicable on the final tax invoice. {0}", "अंतिम टैक्स इनवॉइस पर लागू GST अलग से लगेगा। {0}", "અંતિમ ટેક્સ ઇન્વૉઇસ પર લાગુ પડતો GST અલગથી લાગશે. {0}"],
]

const BY_ENGLISH = new Map(COSTING_DOCUMENT_PHRASES.map(row => [row[0], row]))

/** The label in the document's language, or the English label when no row exists. */
export function costingDocumentText(language: Language, english: string, values: Record<string, string | number> = {}) {
    const row = BY_ENGLISH.get(english)
    const text = !row || language === 'en' ? english : language === 'hi' ? row[1] : row[2]
    return text.replace(/\{(\w+)\}/g, (token, key: string) => values[key] === undefined ? token : String(values[key]))
}
