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
            dispatch: 'Learn to prepare dispatches, confirm receipts and track payments.',
            'yarn-stock': 'Learn to record yarn weights, link costings and audit dispatch deductions.',
            'fabric-stock': 'Learn to record opening fabric stock, correct balances and trace movements.',
            production: 'Learn to activate qualities, record machine metres and review production corrections.',
            payroll: 'See how to review earnings, record payments and find payroll records.',
            machines: 'See how to add machines and check their assignment readiness.',
            workers: 'See how to add workers and manage their pay setup and availability.',
            configuration: 'See how to connect workers to machines for each shift.',
            'cost-estimate': 'See how to calculate your fabric cost.',
            'rate-book': 'See how to update the rates used in your costings.',
            'saved-costings': 'See how to find and review your saved costings.',
        },
        tourNames: {
            dispatch: 'Dispatch',
            'yarn-stock': 'Yarn Stock',
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
            dispatch: 'ડિસ્પેચ તૈયાર કરવા, રસીદની પુષ્ટિ અને ચુકવણી તપાસવાનું શીખો.',
            'yarn-stock': 'યાર્નનું વજન, કોસ્ટિંગ જોડાણ અને ડિસ્પેચ કપાત તપાસવાનું શીખો.',
            'fabric-stock': 'કાપડનો શરૂઆતનો સ્ટોક, બેલેન્સ સુધારા અને હિલચાલ જાણો.',
            production: 'ક્વોલિટી સક્રિય કરવી, મશીન મીટર નોંધવા અને ઉત્પાદન સુધારા તપાસવાનું શીખો.',
            payroll: 'કમાણી તપાસવા, ચુકવણી નોંધવા અને પેરોલ રેકોર્ડ શોધવાનું શીખો.',
            machines: 'મશીનો ઉમેરવા અને તેમની ફાળવણીની તૈયારી તપાસવાનું શીખો.',
            workers: 'કારીગરો ઉમેરવા અને તેમનો પગાર તથા શિફ્ટ ઉપલબ્ધતા ગોઠવવાનું શીખો.',
            configuration: 'દરેક શિફ્ટમાં કારીગરોને મશીનો સાથે કેવી રીતે જોડવા તે જુઓ.',
            'cost-estimate': 'તમારા કાપડના ખર્ચની ગણતરી કેવી રીતે કરવી તે જુઓ.',
            'rate-book': 'તમારા કોસ્ટિંગમાં વપરાતા દરો કેવી રીતે અપડેટ કરવા તે જુઓ.',
            'saved-costings': 'તમારા સાચવેલા કોસ્ટિંગ કેવી રીતે શોધવા અને સમીક્ષા કરવી તે જુઓ.',
        },
        tourNames: {
            dispatch: 'ડિસ્પેચ',
            'yarn-stock': 'યાર્ન સ્ટોક',
            'fabric-stock': 'કાપડનો સ્ટોક',
            production: 'ઉત્પાદન',
            payroll: 'પેરોલ',
            machines: 'મશીનો',
            workers: 'કારીગરો',
            configuration: 'મશીન ફાળવણી',
            'cost-estimate': 'કોસ્ટ એસ્ટીમેટર',
            'rate-book': 'રેટ બુક',
            'saved-costings': 'સેવ કરેલ કોસ્ટિંગ',
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
            dispatch: 'डिस्पैच तैयार करना, प्राप्ति की पुष्टि और भुगतान देखना सीखें।',
            'yarn-stock': 'धागे का वजन, लागत जोड़ना और डिस्पैच कटौती जाँचना सीखें।',
            'fabric-stock': 'कपड़े का शुरुआती स्टॉक, शेष सुधार और गतिविधियाँ समझें।',
            production: 'क्वालिटी सक्रिय करना, मशीन मीटर दर्ज करना और उत्पादन सुधार जाँचना सीखें।',
            payroll: 'कमाई जाँचना, भुगतान दर्ज करना और पेरोल रिकॉर्ड खोजना सीखें।',
            machines: 'मशीनें जोड़ना और उनके आवंटन की तैयारी जाँचना सीखें।',
            workers: 'कारीगर जोड़ना और उनका वेतन तथा शिफ्ट उपलब्धता तय करना सीखें।',
            configuration: 'देखें कि हर शिफ्ट में कारीगरों को मशीनों से कैसे जोड़ें।',
            'cost-estimate': 'देखें कि अपने कपड़े की लागत की गणना कैसे करें।',
            'rate-book': 'देखें कि अपनी लागत गणना में उपयोग की जाने वाली दरों को कैसे अपडेट करें।',
            'saved-costings': 'देखें कि अपनी सहेजी गई लागतों को कैसे खोजें और उनकी समीक्षा करें।',
        },
        tourNames: {
            dispatch: 'डिस्पैच',
            'yarn-stock': 'धागे का स्टॉक',
            'fabric-stock': 'कपड़े का स्टॉक',
            production: 'उत्पादन',
            payroll: 'पेरोल',
            machines: 'मशीनें',
            workers: 'कारीगर',
            configuration: 'मशीन आवंटन',
            'cost-estimate': 'कॉस्ट एस्टीमेटर',
            'rate-book': 'रेट बुक',
            'saved-costings': 'सहेजी गई लागतें',
        },
    },
}
