import 'server-only'

/**
 * Referral is a pilot capability, not a public campaign. Keep the switch
 * closed by default and require an explicit organization allowlist before a
 * referral code can be displayed or applied.
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
    return configuredPilotOrganizations().has(orgId)
}
