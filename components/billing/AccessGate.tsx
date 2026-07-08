import { createClient } from '@/lib/supabase/server'
import { getOrgTier, tierSatisfies, type SubscriptionTier } from '@/lib/subscription'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Lock, Zap, Star, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AccessGateProps {
    /** Minimum tier needed to view this content */
    requiredTier: 'base' | 'premium'
    children: React.ReactNode
}

/**
 * Server component that gates content behind a subscription tier check.
 *
 * - If the user's tier meets `requiredTier` → renders children.
 * - If the user is 'none' (no subscription) → redirects to /owner/billing.
 * - If tier is 'base' but 'premium' is required → shows upgrade wall.
 */
export default async function AccessGate({ requiredTier, children }: AccessGateProps) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

    if (!profile?.org_id) redirect('/login')

    const tier = await getOrgTier(profile.org_id)

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
                {/* Icon */}
                <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center shadow-sm">
                    <Lock className="h-8 w-8 text-amber-600" />
                </div>

                {/* Headline */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        Premium Feature
                    </h2>
                    <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                        This section is available on the <strong>Premium plan</strong>.
                        {currentTier === 'base' && (
                            <> Your current <strong>Base plan</strong> includes the Estimator. Upgrade to unlock full production tracking, payroll, analytics, and more.</>
                        )}
                    </p>
                </div>

                {/* What you get */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left space-y-3">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Premium unlocks</p>
                    <ul className="space-y-2 text-sm text-gray-700">
                        {[
                            'Full production & order tracking',
                            'Payroll, advances & settlement',
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
                        ₹15,000<span className="text-lg font-normal text-gray-400">/year</span>
                    </p>
                    <p className="text-xs text-gray-400">+ 18% GST = ₹17,700 first year</p>
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
