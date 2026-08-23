export const LEGAL_DOCUMENTS = {
    terms: {
        type: 'terms',
        version: '2026-08-24',
        identifier: 'terms:2026-08-24',
        path: '/terms',
        displayDate: 'August 24, 2026',
    },
    privacy: {
        type: 'privacy',
        version: '2026-08-24',
        identifier: 'privacy:2026-08-24',
        path: '/privacy',
        displayDate: 'August 24, 2026',
    },
} as const

export const SIGNUP_LEGAL_ACCEPTANCE = {
    termsVersion: LEGAL_DOCUMENTS.terms.version,
    privacyVersion: LEGAL_DOCUMENTS.privacy.version,
} as const
