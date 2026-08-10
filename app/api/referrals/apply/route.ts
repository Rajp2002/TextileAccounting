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

        const body = await req.json().catch(() => ({})) as { referralCode?: unknown };
        const referralCode = typeof body.referralCode === 'string' ? body.referralCode.trim() : '';
        
        if (!referralCode) {
            return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
        }

        await applyReferralCode(referralCode, profile.org_id);

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const safeMessages = [
            'Invalid referral code',
            'Cannot use your own referral code',
            'Referral code already applied for this organization',
            'This referral code has reached its five-referral limit.',
            'Referral rewards require an active Base Plan with the initial year paid.',
        ]
        if (!safeMessages.includes(message)) {
            Sentry.captureException(error, { tags: { route: 'referrals_apply' } });
        }
        return NextResponse.json(
            { error: safeMessages.includes(message) ? message : 'Failed to apply referral code' },
            { status: 400 }
        );
    }
}
