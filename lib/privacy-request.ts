import { LEGAL_OPERATOR } from './legal-operator'

export const PRIVACY_REQUEST_SERVICE_LEVEL = {
    acknowledgementBusinessDays: 3,
    responseCalendarDays: 30,
} as const

export const PRIVACY_REQUEST_CATEGORIES = [
    { value: 'access', label: 'Access my personal information' },
    { value: 'correction', label: 'Correct or update information' },
    { value: 'deletion', label: 'Delete information or my workspace' },
    { value: 'consent', label: 'Withdraw consent or object to processing' },
    { value: 'security', label: 'Report a privacy or security concern' },
    { value: 'grievance', label: 'Raise a grievance about an earlier response' },
    { value: 'other', label: 'Other privacy question' },
] as const

export function buildPrivacyRequestMailto(category = 'privacy request') {
    const subject = `Weavly privacy request — ${category}`
    const body = [
        'Registered email:',
        'Organization or factory name:',
        `Request category: ${category}`,
        'Relevant account, payment, or costing reference (if any):',
        'What happened or what information is involved:',
        'Outcome requested:',
        '',
        'Please do not include passwords, payment credentials, government ID numbers, or unrelated personal information.',
    ].join('\n')

    return `mailto:${LEGAL_OPERATOR.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
