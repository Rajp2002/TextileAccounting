import type { Language } from './context'

export const liteRecordsCopy = {
  en: { help: 'Help', filters: 'Filters', compare: 'Compare', exitCompare: 'Exit comparison', favourites: 'Favourites', archived: 'Archived', active: 'Active', productionCost: 'Production cost', sellingPrice: 'Selling price', reviewDue: 'Review due', freeHistory: 'Earlier Free costings', freeHistoryHint: 'Saved Free receipts remain available here.' },
  hi: { help: 'सहायता', filters: 'फ़िल्टर', compare: 'तुलना करें', exitCompare: 'तुलना बंद करें', favourites: 'पसंदीदा', archived: 'संग्रहित', active: 'सक्रिय', productionCost: 'उत्पादन लागत', sellingPrice: 'विक्रय मूल्य', reviewDue: 'समीक्षा बाकी', freeHistory: 'पहले की Free कॉस्टिंग', freeHistoryHint: 'सेव की गई Free रसीदें यहाँ उपलब्ध हैं।' },
  gu: { help: 'સહાય', filters: 'ફિલ્ટર', compare: 'સરખામણી', exitCompare: 'સરખામણી બંધ કરો', favourites: 'મનપસંદ', archived: 'આર્કાઇવ', active: 'સક્રિય', productionCost: 'ઉત્પાદન ખર્ચ', sellingPrice: 'વેચાણ ભાવ', reviewDue: 'સમીક્ષા બાકી', freeHistory: 'અગાઉનાં Free કોસ્ટિંગ', freeHistoryHint: 'સાચવેલી Free રસીદો અહીં ઉપલબ્ધ છે.' },
} satisfies Record<Language, Record<string, string>>
