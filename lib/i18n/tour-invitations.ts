import type { Language } from './context'
import type { TourId } from '../tours/tour-types'

export interface TourInvitationCopy {
    takeTour: string
    tour: string
    dismiss: string
    dismissAriaLabel: string
    tourAriaLabel: string
    loading: string
    error: string
    benefits: Record<TourId, string>
    tourNames: Record<TourId, string>
}

export const tourInvitationCopy: Record<Language, TourInvitationCopy> = {
    en: {
        takeTour: 'Take a tour',
        tour: 'Tour',
        dismiss: 'Dismiss',
        dismissAriaLabel: 'Dismiss tour invitation',
        tourAriaLabel: 'Tour: {name}',
        loading: 'Starting tour…',
        error: 'Tour temporarily unavailable. Try again.',
        benefits: {
            "dispatch": "Learn to send fabric, record what arrived and track payment.",
            "fabric-stock": "Learn to record opening fabric, correct a count and trace changes.",
            "production": "See how to put a saved costing on your looms and get ready to record production.",
            "payroll": "See how to check earnings, record payments and close a pay period.",
            "machines": "See how to add looms and get them ready for production.",
            "workers": "See how to add workers and set up their pay.",
            "configuration": "See how to link workers to looms for each shift.",
            "cost-estimate": "See how to work out a fabric's cost and selling price.",
            "rate-book": "See how to keep your yarn prices up to date.",
            "saved-costings": "See how to find a saved costing, read its numbers and reuse it.",
            "daily-sheet": "See how to record a shift's metres and save them.",
        },
        tourNames: {
            'daily-sheet': 'Daily Sheet',
            dispatch: 'Dispatch',
            'fabric-stock': 'Fabric Stock',
            production: 'Production',
            payroll: 'Payroll',
            machines: 'Machines',
            workers: 'Workers',
            configuration: 'Machine Assignments',
            'cost-estimate': 'Cost Estimator',
            'rate-book': 'Rate Book',
            'saved-costings': 'Saved Costings',
        },
    },
    gu: {
        takeTour: 'ટૂર શરૂ કરો',
        tour: 'ટૂર',
        dismiss: 'છોડો',
        dismissAriaLabel: 'ટૂર આમંત્રણ છોડો',
        tourAriaLabel: 'ટૂર: {name}',
        loading: 'ટૂર શરૂ થઈ રહી છે…',
        error: 'ટૂર અસ્થાયી રૂપે અનુપલબ્ધ છે. ફરી પ્રયાસ કરો.',
        benefits: {
            "dispatch": "કાપડ મોકલવું, શું પહોંચ્યું તે નોંધવું અને ચુકવણી તપાસવી શીખો.",
            "fabric-stock": "શરૂઆતનું કાપડ નોંધવું, ગણતરી સુધારવી અને ફેરફાર તપાસવા શીખો.",
            "production": "સાચવેલી કોસ્ટિંગને લૂમ પર મૂકવી અને ઉત્પાદન નોંધવાની તૈયારી કેવી રીતે કરવી તે જુઓ.",
            "payroll": "કમાણી તપાસવી, ચુકવણી નોંધવી અને પગાર સમયગાળો બંધ કરવો કેવી રીતે તે જુઓ.",
            "machines": "લૂમ ઉમેરવા અને ઉત્પાદન માટે તૈયાર કરવાનું જુઓ.",
            "workers": "કારીગરો ઉમેરવા અને તેમનો પગાર ગોઠવવાનું જુઓ.",
            "configuration": "દરેક શિફ્ટ માટે કારીગરોને લૂમ સાથે જોડવાનું જુઓ.",
            "cost-estimate": "કાપડનો ખર્ચ અને વેચાણ ભાવ કેવી રીતે ગણવો તે જુઓ.",
            "rate-book": "તમારા યાર્નના ભાવ અદ્યતન કેવી રીતે રાખવા તે જુઓ.",
            "saved-costings": "સાચવેલી કોસ્ટિંગ શોધવી, તેના આંકડા વાંચવા અને ફરી વાપરવી કેવી રીતે તે જુઓ.",
            "daily-sheet": "શિફ્ટના મીટર નોંધીને કેવી રીતે સાચવવા તે જુઓ.",
        },
        tourNames: {
            'daily-sheet': 'દૈનિક શીટ',
            dispatch: 'ડિસ્પેચ',
            'fabric-stock': 'કાપડનો સ્ટોક',
            production: 'ઉત્પાદન',
            payroll: 'પેરોલ',
            machines: 'મશીનો',
            workers: 'કારીગરો',
            configuration: 'મશીન ફાળવણી',
            'cost-estimate': 'કોસ્ટ એસ્ટીમેટર',
            'rate-book': 'રેટ બુક',
            'saved-costings': 'સાચવેલી કોસ્ટિંગ',
        },
    },
    hi: {
        takeTour: 'टूर शुरू करें',
        tour: 'टूर',
        dismiss: 'खारिज करें',
        dismissAriaLabel: 'टूर निमंत्रण खारिज करें',
        tourAriaLabel: 'टूर: {name}',
        loading: 'टूर शुरू हो रहा है…',
        error: 'टूर अस्थायी रूप से अनुपलब्ध है। पुन: प्रयास करें।',
        benefits: {
            "dispatch": "कपड़ा भेजना, क्या पहुँचा यह दर्ज करना और भुगतान देखना सीखें।",
            "fabric-stock": "शुरुआती कपड़ा दर्ज करना, गिनती सुधारना और बदलाव देखना सीखें।",
            "production": "सेव कॉस्टिंग को लूम पर लगाना और उत्पादन दर्ज करने की तैयारी करना देखें।",
            "payroll": "कमाई जाँचना, भुगतान दर्ज करना और वेतन अवधि बंद करना देखें।",
            "machines": "लूम जोड़ना और उत्पादन के लिए तैयार करना देखें।",
            "workers": "कारीगर जोड़ना और उनका वेतन तय करना देखें।",
            "configuration": "हर शिफ्ट के लिए कारीगरों को लूम से जोड़ना देखें।",
            "cost-estimate": "कपड़े की लागत और बिक्री भाव कैसे निकालें, यह देखें।",
            "rate-book": "अपने धागे के रेट ताज़ा कैसे रखें, यह देखें।",
            "saved-costings": "सेव की गई कॉस्टिंग खोजना, उसके आँकड़े पढ़ना और दोबारा इस्तेमाल करना देखें।",
            "daily-sheet": "शिफ्ट के मीटर दर्ज करके सेव करना देखें।",
        },
        tourNames: {
            'daily-sheet': 'दैनिक शीट',
            dispatch: 'डिस्पैच',
            'fabric-stock': 'कपड़े का स्टॉक',
            production: 'उत्पादन',
            payroll: 'पेरोल',
            machines: 'मशीनें',
            workers: 'कारीगर',
            configuration: 'मशीन आवंटन',
            'cost-estimate': 'कॉस्ट एस्टीमेटर',
            'rate-book': 'रेट बुक',
            'saved-costings': 'सेव की गई कॉस्टिंग',
        },
    },
}
