import { NextResponse } from 'next/server';
import { getOrCreateReferralCode, getReferralStats } from '@/lib/referral';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const { profile } = await requireRole(['owner']);
        
        if (!profile.org_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        const stats = await getReferralStats(profile.org_id);
        let code = stats.code;
        
        if (!code) {
           code = await getOrCreateReferralCode(profile.org_id);
           // Re-fetch stats to include the newly generated code
           const updatedStats = await getReferralStats(profile.org_id);
           return NextResponse.json(updatedStats);
        }

        return NextResponse.json(stats);
    } catch (error: any) {
         console.error("Fetch referral stats error:", error);
         return NextResponse.json({ error: 'Failed to fetch referral profile' }, { status: 500 });
    }
}

export async function POST(req: Request) {
     try {
        const { profile } = await requireRole(['owner']);
        
        if (!profile.org_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        const code = await getOrCreateReferralCode(profile.org_id);

        return NextResponse.json({ code });
    } catch (error: any) {
        console.error("Generate referral code error:", error);
        return NextResponse.json({ error: 'Failed to generate referral code' }, { status: 500 });
    }
}
