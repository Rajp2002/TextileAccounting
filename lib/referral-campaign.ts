import 'server-only'

/**
 * Referral is opt-in by environment. A comma-separated organization allowlist
 * can be used for a pilot; `*` explicitly enables the campaign for every
 * organization, including organizations created after deployment.
 */
export const REFERRAL_CAMPAIGN_DISABLED_MESSAGE = 'Referral campaign is currently paused.'

function configuredPilotOrganizations(): Set<string> {
    return new Set(
        (process.env.REFERRAL_PILOT_ORG_IDS ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
    )
}

export function isReferralCampaignEnabledForOrg(orgId: string | null | undefined): boolean {
    if (process.env.REFERRAL_CAMPAIGN_ENABLED?.trim().toLowerCase() !== 'true') return false
    if (!orgId) return false
    const configuredOrganizations = configuredPilotOrganizations()
    return configuredOrganizations.has('*') || configuredOrganizations.has(orgId)
}
