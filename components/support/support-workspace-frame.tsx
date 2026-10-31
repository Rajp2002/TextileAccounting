import 'server-only'

import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { OwnerSidebar } from '@/components/navigation/owner-sidebar'
import { BrandBackground } from '@/components/brand-background'
import { getCachedSession } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import { getYarnReviewDueCount } from '@/lib/yarn-review-due.server'
import { normalizeProductionMode } from '@/lib/production-mode'
import { isFreeWorkspaceAccess } from '@/lib/workspace-hint'
import { parseSidebarPreference, SIDEBAR_PREFERENCE_COOKIE } from '@/lib/sidebar-preference'
import { SupportShell } from './support-shell'
import styles from './customer-support.module.css'

type SidebarProps = Parameters<typeof OwnerSidebar>[0]

/**
 * The owner's own workspace sidebar for /support, built the way the Free and
 * owner layouts build it. Null when there is no usable workspace (signed out,
 * not an owner, locked org, or a failed read): support must stay reachable
 * then, so the caller falls back to the standalone support shell. This only
 * decides the chrome; the support pages keep their own access checks.
 */
async function getSupportSidebar(): Promise<SidebarProps | null> {
  try {
    const session = await getCachedSession()
    if (!session || session.profile.role !== 'owner') return null
    const userName = session.profile.full_name || undefined
    const access = await getCachedOrgPlanAccess(session.profile.org_id)
    if (isFreeWorkspaceAccess(access)) {
      const paid = access.effectiveTier === 'lite' || access.effectiveTier === 'base'
      return { factoryName: paid ? 'Weavly' : 'Weavly Free', userName, productionMode: 'market_run', subscriptionTier: access.effectiveTier }
    }
    const [{ data: organization }, yarnReviewDueCount] = await Promise.all([
      getCachedOwnerOrganization(session.user.id, session.profile.org_id),
      getYarnReviewDueCount(session.profile.org_id),
    ])
    if (!organization || organization.is_locked_down) return null
    return {
      factoryName: organization.name || 'Weavly',
      userName,
      productionMode: normalizeProductionMode(organization.production_mode),
      subscriptionTier: access.effectiveTier,
      yarnReviewDueCount,
    }
  } catch {
    return null
  }
}

/** Support opens inside the same sidebar and page frame as every other workspace route. */
export async function SupportWorkspaceFrame({ children }: { children: ReactNode }) {
  const sidebar = await getSupportSidebar()
  if (!sidebar) return <SupportShell>{children}</SupportShell>
  const sidebarPreference = parseSidebarPreference((await cookies()).get(SIDEBAR_PREFERENCE_COOKIE)?.value)

  return <div className="relative isolate min-h-svh overflow-x-hidden bg-background" data-owner-shell data-workspace-shell data-sidebar-preference={sidebarPreference} data-plan-tier={sidebar.subscriptionTier}>
    <BrandBackground variant="app" />
    <a href="#support-main" className="sr-only fixed left-3 top-[calc(0.75rem+var(--safe-area-top))] z-[100] rounded bg-surface p-3 text-ink focus:not-sr-only">Skip to content</a>
    <OwnerSidebar {...sidebar} />
    <div className="mobile-workspace-content relative z-10 min-w-0 px-safe">
      <main id="support-main" tabIndex={-1} className="dashboard-main mx-auto flex min-h-svh flex-col w-full min-w-0 max-w-[var(--main-max)] px-3 pb-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] xs:px-4 md:px-6 md:pb-6 md:pt-[calc(1.5rem+var(--safe-area-top))] lg:px-8">
        <div className={styles.scope}>{children}</div>
      </main>
    </div>
  </div>
}
