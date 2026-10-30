import type { Language } from './context'
import { freeSupportingText, type FreeSupportingKey } from './free-supporting'

const phrases = {
  support: ['Support', 'सहायता', 'સહાય'],
  welcome: ['A little help to keep your work moving.', 'आपका काम आगे बढ़ाने के लिए थोड़ी सहायता।', 'તમારું કામ આગળ વધારવા માટે થોડી સહાય.'],
  workspaceBack: ['Back to workspace', 'कार्यक्षेत्र पर वापस', 'કાર્યક્ષેત્ર પર પાછા'],
  signOut: ['Sign out', 'साइन आउट', 'સાઇન આઉટ'],
  signOutNote: ['Signing out also ends your workspace session.', 'साइन आउट करने से कार्यक्षेत्र का सत्र भी समाप्त होगा।', 'સાઇન આઉટ કરવાથી કાર્યક્ષેત્રનું સત્ર પણ સમાપ્ત થશે.'],
  tickets: ['Your tickets', 'आपके टिकट', 'તમારી ટિકિટો'],
  emptyHeading: ['How can we help?', 'हम कैसे मदद कर सकते हैं?', 'અમે કેવી રીતે મદદ કરી શકીએ?'],
  emptyBody: ['Ask a question or tell us what’s getting in your way. Your tickets and replies will appear here.', 'अपना सवाल पूछें या बताएँ कि कहाँ परेशानी आ रही है। आपके टिकट और जवाब यहाँ दिखेंगे।', 'તમારો પ્રશ્ન પૂછો અથવા ક્યાં મુશ્કેલી પડે છે તે જણાવો. તમારી ટિકિટો અને જવાબો અહીં દેખાશે.'],
  firstTicket: ['Create your first ticket', 'अपना पहला टिकट बनाएँ', 'તમારી પહેલી ટિકિટ બનાવો'],
  helpFaster: ['Get help faster', 'बेहतर सहायता पाएँ', 'વધુ સારી સહાય મેળવો'],
  tipWhere: ['Tell us where you’re stuck', 'बताएँ कहाँ परेशानी है', 'ક્યાં મુશ્કેલી છે તે જણાવો'],
  tipWhereBody: ['Mention the page or task you need help with.', 'उस पेज या काम का नाम बताएँ जिसमें सहायता चाहिए।', 'જે પેજ કે કામમાં સહાય જોઈએ તેનું નામ જણાવો.'],
  tipWhat: ['Describe what happened', 'बताएँ क्या हुआ', 'શું થયું તે જણાવો'],
  tipWhatBody: ['Share what you expected and what you saw instead.', 'बताएँ कि आपको क्या उम्मीद थी और उसके बजाय क्या हुआ।', 'તમને શું અપેક્ષા હતી અને તેના બદલે શું થયું તે જણાવો.'],
  tipError: ['Include any error message', 'त्रुटि का संदेश लिखें', 'ભૂલનો સંદેશ લખો'],
  tipErrorBody: ['The exact wording helps us understand the issue.', 'संदेश के सही शब्दों से हमें समस्या समझने में मदद मिलती है।', 'સંદેશના ચોક્કસ શબ્દોથી અમને સમસ્યા સમજવામાં મદદ મળે છે.'],
  privateHeading: ['A private conversation', 'आपकी निजी बातचीत', 'તમારી ખાનગી વાતચીત'],
  privateBody: ['Only you and the Weavly founder can see your tickets.', 'आपके टिकट केवल आप और Weavly के संस्थापक देख सकते हैं।', 'તમારી ટિકિટો ફક્ત તમે અને Weavly ના સ્થાપક જોઈ શકે છે.'],
  historyTitle: ['Your support history', 'आपका सहायता इतिहास', 'તમારો સહાય ઇતિહાસ'],
  historyBody: ['A copy of your tickets and in-app conversations.', 'आपके टिकट और ऐप की बातचीत की एक प्रति।', 'તમારી ટિકિટો અને ઍપની વાતચીતની એક નકલ.'],
  downloadHistory: ['Download history', 'इतिहास डाउनलोड करें', 'ઇતિહાસ ડાઉનલોડ કરો'],
  checked: ['Last checked {date} IST', 'आखिरी बार जाँचा {date} IST', 'છેલ્લે તપાસ્યું {date} IST'],
  filteredEmpty: ['No tickets in this view', 'इस सूची में कोई टिकट नहीं', 'આ યાદીમાં કોઈ ટિકિટ નથી'],
  allTickets: ['View all tickets', 'सभी टिकट देखें', 'બધી ટિકિટો જુઓ'],
  composeIntro: ['Tell us a little about the issue. You can follow the conversation here after sending.', 'समस्या के बारे में थोड़ा बताएँ। भेजने के बाद आप यहीं बातचीत देख सकते हैं।', 'સમસ્યા વિશે થોડું જણાવો. મોકલ્યા પછી તમે અહીં જ વાતચીત જોઈ શકો છો.'],
  subjectPlaceholder: ['A short summary of what you need help with', 'जिसमें सहायता चाहिए उसका संक्षिप्त विवरण', 'જેમાં સહાય જોઈએ તેનો ટૂંકો સારાંશ'],
  descriptionPlaceholder: ['What were you trying to do? What happened instead?', 'आप क्या करना चाहते थे? उसके बजाय क्या हुआ?', 'તમે શું કરવા માંગતા હતા? તેના બદલે શું થયું?'],
  requiredFields: ['Subject and description are required.', 'विषय और विवरण आवश्यक हैं।', 'વિષય અને વિગત જરૂરી છે.'],
  conversationTitle: ['Conversation', 'आपकी बातचीत', 'તમારી વાતચીત'],
  you: ['You', 'आप', 'તમે'],
  replyPlaceholder: ['Add a little more detail or ask a follow-up question…', 'थोड़ी और जानकारी दें या अगला सवाल पूछें…', 'થોડી વધુ વિગત આપો અથવા આગળનો પ્રશ્ન પૂછો…'],
  waitingOnYou: ['Your reply needed', 'आपका जवाब चाहिए', 'તમારો જવાબ જરૂરી છે'],
  resolvedHelp: ['Still need help? Reply below to reopen this ticket.', 'अब भी सहायता चाहिए? टिकट दोबारा खोलने के लिए नीचे जवाब दें।', 'હજુ સહાય જોઈએ છે? ટિકિટ ફરી ખોલવા નીચે જવાબ આપો.'],
  ticketDetails: ['Ticket details', 'टिकट का विवरण', 'ટિકિટની વિગત'],
  status: ['Status', 'स्थिति', 'સ્થિતિ'],
  opened: ['Opened', 'शुरू हुआ', 'શરૂ થયું'],
  nextUpdate: ['Next update', 'अगला अपडेट', 'આગલું અપડેટ'],
} as const

export type CustomerSupportKey = keyof typeof phrases | FreeSupportingKey
export type CustomerSupportText = (key: CustomerSupportKey, values?: Record<string, string | number>) => string

export function customerSupportText(language: Language, key: CustomerSupportKey, values: Record<string, string | number> = {}) {
  if (!(key in phrases)) return freeSupportingText(language, key as FreeSupportingKey, values)
  const index = language === 'hi' ? 1 : language === 'gu' ? 2 : 0
  return Object.entries(values).reduce<string>((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), phrases[key as keyof typeof phrases][index])
}
