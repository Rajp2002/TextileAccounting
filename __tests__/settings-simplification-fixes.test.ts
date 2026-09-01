import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hasMeaningfulFactoryCostBaseline } from '../lib/factory-cost-profiles'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Settings simplification fixes', () => {
    const page = read('app/(dashboard)/owner/settings/page.tsx')
    const profile = read('components/settings/factory-cost-profile.tsx')
    const qualities = read('components/settings/template-manager.tsx')

    it('uses persisted costing values as a meaningful baseline, not only the flag', () => {
        expect(hasMeaningfulFactoryCostBaseline({ is_configured: false })).toBe(false)
        expect(hasMeaningfulFactoryCostBaseline({ is_configured: true })).toBe(true)
        expect(hasMeaningfulFactoryCostBaseline({ monthly_output_m: 12_000 })).toBe(true)
        expect(hasMeaningfulFactoryCostBaseline({ overhead_override_per_m: '8.5' })).toBe(true)
    })

    it('routes Lite and Base owners through the focused settings surface', () => {
        expect(page).toContain("const isFocusedPlanExperience = subscriptionTier === 'lite' || subscriptionTier === 'base'")
        expect(page).toContain('if (isFocusedPlanExperience)')
        expect(page).toContain('<FactoryCostProfile standaloneEstimator />')
        expect(page).toContain('Manage saved qualities')
        expect(page).toContain('<div id="cost-profile"')
        expect(page).toContain('<SettingsPanel id="factory-identity"')
        expect(page).toContain('<SettingsPanel id="privacy-data"')
        expect(page).toContain('<div id="account-deletion"')

        const accountIndex = page.indexOf('id="account-data"')
        const workspaceIndex = page.indexOf('id="workspace-experience"')
        expect(accountIndex).toBeGreaterThan(-1)
        expect(workspaceIndex).toBeGreaterThan(accountIndex)
    })

    it('keeps workspace switching entitled, collapsed, and deep-linkable', () => {
        expect(page).toContain('title="Advanced workspace"')
        expect(page).toContain('collapsible')
        expect(page).toContain("window.location.hash !== '#workspace-experience'")
        expect(page).toContain('if (!planAccess.canSwitchExperience || isLoading) return')
        expect(page).toContain('section.scrollIntoView')
        expect(page).toContain('summary.focus({ preventScroll: true })')
        expect(page).toContain('This does not change your subscription.')
    })

    it('keeps costing setup prominent and makes validation disclosure-driven', () => {
        expect(profile).toContain('Defaults apply only to new Cost Estimates.')
        expect(profile).toContain('Saved Costings keep the rates and assumptions captured when they were saved.')
        expect(profile).toContain('setCoreOpen(!meaningfulBaseline)')
        expect(profile).toContain('Edit defaults')
        expect(profile).toContain('setCapacityOpen(')
        expect(profile).toContain('validateFactoryCostProfile(payload)')
        expect(profile).toContain('handleSaveFailure(firstIssue.message, firstIssue.field)')
        expect(profile).toContain('focusInvalidField(field)')
        expect(profile).toContain('Optional · used only for capacity warnings')
        expect(profile).toContain('open={standaloneEstimator ? optionalGroupOpen : true}')
        expect(profile).toContain('Monthly overhead only needs actual output and monthly expenses.')
        expect(profile).toContain('requireCapacity: false')
        expect(profile).toContain('Saving…')
        expect(profile).toContain('Changes not saved')
        expect(profile).toContain('Saved for new cost estimates')
        expect(profile).not.toContain('advancedOpen')
    })

    it('keeps inactive optional assumptions out of the active form', () => {
        for (const label of ['Processing / Dyeing', 'Finishing', 'Broker commission', 'Transport charge']) {
            expect(profile).toContain(`title="${label}"`)
        }
        expect(profile).toContain('{enabled && (')
        expect(profile).toContain('default_processing_rate_per_m: sections.processing ?')
        expect(profile).toContain('default_transport_per_m: sections.transport ?')
        expect(profile).toContain('Review cadence')
    })

    it('shows active qualities as reference and hands lifecycle management off', () => {
        expect(qualities).toContain('const activeQualities = qualities.filter')
        expect(qualities).toContain('activeQualities.map')
        expect(qualities).toContain('Manage saved qualities in Saved Costings')
        expect(qualities).toContain('href="/owner/quotes"')
        expect(qualities).toContain('href="/owner/estimator"')
        expect(qualities).toContain('href="/owner/rates"')
        expect(qualities).not.toContain('archiveTemplate')
        expect(qualities).not.toContain('restoreTemplate')
        expect(qualities).not.toContain('<ConfirmActionDialog')
        expect(qualities).not.toContain('Archived · read-only')
    })

    it('keeps Base identity and account/data copy scoped to the approved hierarchy', () => {
        expect(page).toContain('Used on documents generated after this change. Saved costing values, versions, and history are unchanged.')
        expect(page).toContain('Owner profile, password, organization export, export history, and account deletion.')
        expect(page).toContain('href="/owner/data-export"')
        expect(page).toContain('<DeleteAccountCard organizationName={org?.name || \'\'} />')
    })
})
