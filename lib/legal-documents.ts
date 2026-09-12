export const LEGAL_DOCUMENTS = {
    terms: {
        type: 'terms',
        version: '2026-09-12',
        identifier: 'terms:2026-09-12',
        path: '/terms',
        displayDate: 'September 12, 2026',
    },
    privacy: {
        type: 'privacy',
        version: '2026-09-12',
        identifier: 'privacy:2026-09-12',
        path: '/privacy',
        displayDate: 'September 12, 2026',
    },
} as const

export const SIGNUP_LEGAL_ACCEPTANCE = {
    termsVersion: LEGAL_DOCUMENTS.terms.version,
    privacyVersion: LEGAL_DOCUMENTS.privacy.version,
} as const
