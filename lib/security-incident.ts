import { LEGAL_OPERATOR } from './legal-operator'

export const BASE_SECURITY_INCIDENT_DATA_CATEGORIES = [
    'Account and authentication data',
    'Costings and associated business contacts',
    'Billing references and subscription records',
    'Support and privacy communications',
    'Technical, diagnostic, and security logs',
] as const

export const SECURITY_INCIDENT_REPORT_CATEGORIES = [
    { value: 'account_compromise', label: 'Account compromise or suspicious login' },
    { value: 'unauthorized_access', label: 'Possible unauthorized data access' },
    { value: 'billing_security', label: 'Billing or payment-reference concern' },
    { value: 'suspicious_message', label: 'Suspicious message claiming to be Weavly' },
    { value: 'service_vulnerability', label: 'Potential service vulnerability' },
    { value: 'other', label: 'Other security concern' },
] as const

export const SECURITY_INCIDENT_SERVICE_LEVEL = {
    acknowledgementBusinessDays: 1,
} as const

export const SECURITY_INCIDENT_LEGAL_CLOCKS = {
    certInAssessmentHours: 6,
    futureDpdpBoardDetailHours: 72,
} as const

export function buildSecurityIncidentMailto(category?: string) {
    const subject = category
        ? `Weavly security report — ${category}`
        : 'Weavly security incident report'
    const body = [
        'Organization / factory name:',
        'Registered account email:',
        `Concern type: ${category ?? ''}`,
        'When you first noticed it (date, time, and time zone):',
        'What happened:',
        'Relevant costing, billing, or support reference (if any):',
        '',
        'Do not include passwords, OTPs, card or bank credentials, government ID numbers, or active exploit instructions.',
    ].join('\n')

    return `mailto:${LEGAL_OPERATOR.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
