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
            'cost-estimate': 'See how to calculate your fabric cost.',
            'rate-book': 'See how to update the rates used in your costings.',
            'saved-costings': 'See how to find and review your saved costings.',
        },
        tourNames: {
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
            'cost-estimate': 'તમારા કાપડના ખર્ચની ગણતરી કેવી રીતે કરવી તે જુઓ.',
            'rate-book': 'તમારા કોસ્ટિંગમાં વપરાતા દરો કેવી રીતે અપડેટ કરવા તે જુઓ.',
            'saved-costings': 'તમારા સાચવેલા કોસ્ટિંગ કેવી રીતે શોધવા અને સમીક્ષા કરવી તે જુઓ.',
        },
        tourNames: {
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
            'cost-estimate': 'देखें कि अपने कपड़े की लागत की गणना कैसे करें।',
            'rate-book': 'देखें कि अपनी लागत गणना में उपयोग की जाने वाली दरों को कैसे अपडेट करें।',
            'saved-costings': 'देखें कि अपनी सहेजी गई लागतों को कैसे खोजें और उनकी समीक्षा करें।',
        },
        tourNames: {
            'cost-estimate': 'कॉस्ट एस्टीमेटर',
            'rate-book': 'रेट बुक',
            'saved-costings': 'सहेजी गई लागतें',
        },
    },
}
