import { NextResponse } from 'next/server';
import { applyReferralCode } from '@/lib/referral';
import { requireRole } from '@/lib/auth';
import * as Sentry from '@sentry/nextjs';

export async function POST(req: Request) {
    try {
        const { profile } = await requireRole(['owner']);
        
        if (!profile.org_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        const { referralCode } = await req.json();
        
        if (!referralCode) {
            return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
        }

        await applyReferralCode(referralCode, profile.org_id);

        return NextResponse.json({ success: true });
    } catch (error) {
        Sentry.captureException(error, { tags: { route: 'referrals_apply' } });
        return NextResponse.json(
            { error: 'Failed to apply referral code' },
            { status: 400 }
        );
    }
}
