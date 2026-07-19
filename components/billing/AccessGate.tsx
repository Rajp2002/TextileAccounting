import { getCachedSession } from '@/lib/auth'
import { getCachedOrgTier, tierSatisfies, type SubscriptionTier } from '@/lib/subscription'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calculator, Zap, Star, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createPerfTimer } from '@/lib/perf'

interface AccessGateProps {
    /** Minimum tier needed to view this content */
    requiredTier: 'base' | 'premium'
    /** Optional route label for performance logs. */
    routeName?: string
    children: React.ReactNode
}

/**
 * Server component that gates content behind a subscription tier check.
 *
 * - If the user's tier meets `requiredTier` → renders children.
 * - If the user is 'none' (no subscription) → redirects to /owner/billing.
 * - If tier is 'base' but 'premium' is required → shows upgrade wall.
 *
 * Uses getCachedSession() and getCachedOrgTier() so that the auth + profiles
 * and org_subscriptions queries are deduplicated per request. When the owner
 * layout, AccessGate, and the page's own requireRole() all run within the same
 * request, Supabase is contacted only once for each.
 */
export default async function AccessGate({ requiredTier, routeName = '/owner/* access-gate', children }: AccessGateProps) {
    const perf = createPerfTimer(routeName)

    // getCachedSession() is a request-scoped cache: the getUser + profiles lookup
    // is shared with OwnerLayout and any requireRole() calls on the same page.
    const session = await perf.measure('authSession', () => getCachedSession(), 0)
    if (!session) redirect('/login')

    // getCachedOrgTier() is similarly deduplicated within the request.
    const tier = await perf.measure(
        'profileOrgTier',
        () => getCachedOrgTier(session.profile.org_id),
        1
    )
    perf.log({ required_tier: requiredTier })

    // No subscription at all → send to billing
    if (tier === 'none') {
        redirect('/owner/billing')
    }

    // Tier is sufficient → render the protected content
    if (tierSatisfies(tier, requiredTier)) {
        return <>{children}</>
    }

    // Tier is insufficient (base trying to access premium) → show upgrade wall
    return <UpgradeWall currentTier={tier} />
}

// ─── Upgrade Wall UI ──────────────────────────────────────────────────────────

function UpgradeWall({
    currentTier,
}: {
    currentTier: SubscriptionTier
}) {
    return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center shadow-sm">
                    <Calculator className="h-8 w-8 text-orange-600" />
                </div>

                {/* Headline */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        Continue with Weavly Cost Estimate
                    </h2>
                    <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                        This operational workspace is part of the <strong>Weavly Full Suite</strong>.
                        {currentTier === 'base' && (
                            <> Your <strong>Cost Estimate Plan</strong> remains complete for calculating, saving, and updating fabric costings.</>
                        )}
                    </p>
                </div>

                <Link href="/owner/estimator" className="block">
                    <Button variant="outline" size="lg" className="w-full gap-2 rounded-xl">
                        <ArrowLeft className="h-4 w-4" />
                        Return to Cost Estimate
                    </Button>
                </Link>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left space-y-3">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Premium unlocks</p>
                    <ul className="space-y-2 text-sm text-gray-700">
                        {[
                            'Full production & order tracking',
                            'Worker Hisaab and Upaad',
                            'Daily WhatsApp briefs',
                            'Analytics & performance reports',
                            'Unlimited machines & workers',
                        ].map(f => (
                            <li key={f} className="flex items-center gap-2">
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
                                {f}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Price highlight */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-500">Weavly Full Suite</p>
                    <p className="text-3xl font-extrabold text-gray-900 mt-1">
                        ₹29,500<span className="text-lg font-normal text-gray-400">/first year</span>
                    </p>
                    <p className="text-xs text-gray-400">₹25,000 + 18% GST · ₹8,260/year renewal</p>
                </div>

                {/* CTA */}
                <Link href="/owner/billing">
                    <Button
                        id="upgrade-to-premium-btn"
                        size="lg"
                        className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200 rounded-xl"
                    >
                        <Zap className="h-4 w-4" />
                        Upgrade to Full Suite
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>

                <p className="text-xs text-gray-400">
                    Secured by Razorpay.
                </p>
            </div>
        </div>
    )
}
