import { NextResponse } from 'next/server';
import { getOrCreateReferralCode, getReferralStats } from '@/lib/referral';
import { requireRole } from '@/lib/auth';
import * as Sentry from '@sentry/nextjs';

export async function GET() {
    try {
        const { profile } = await requireRole(['owner']);
        
        if (!profile.org_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        const stats = await getReferralStats(profile.org_id);
        if (!stats.eligible) {
            return NextResponse.json(stats);
        }
        let code = stats.code;
        
        if (!code) {
           code = await getOrCreateReferralCode(profile.org_id);
           // Re-fetch stats to include the newly generated code
           const updatedStats = await getReferralStats(profile.org_id);
           return NextResponse.json(updatedStats);
        }

        return NextResponse.json(stats);
    } catch (error) {
        Sentry.captureException(error, { tags: { route: 'referrals_generate', method: 'GET' } });
        return NextResponse.json({ error: 'Failed to fetch referral profile' }, { status: 500 });
    }
}

export async function POST() {
     try {
        const { profile } = await requireRole(['owner']);
        
        if (!profile.org_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        const code = await getOrCreateReferralCode(profile.org_id);

        return NextResponse.json({ code });
    } catch (error) {
        Sentry.captureException(error, { tags: { route: 'referrals_generate', method: 'POST' } });
        const message = error instanceof Error ? error.message : ''
        if (message.includes('active Base Plan')) {
            return NextResponse.json({ error: message }, { status: 403 });
        }
        return NextResponse.json({ error: 'Failed to generate referral code' }, { status: 500 });
    }
}
