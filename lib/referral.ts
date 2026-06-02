import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

type ReferralDiscountWindow = {
    discount_pct: number
    valid_from: string
    valid_until: string
}

type ReferralUseStatsRow = {
    status: string
    signed_up_at: string
    converted_at: string | null
    organizations?: { name?: string | null } | null
    referral_discount_windows?: ReferralDiscountWindow[] | null
}

type ReferralHistoryRow = {
    factoryName: string
    status: string
    date: string | null
}

export async function getOrCreateReferralCode(orgId: string): Promise<string> {
    const supabase = await createClient();

    // Check if code exists
    const { data: existingCode } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('org_id', orgId)
        .single();

    if (existingCode) {
        return existingCode.code;
    }

    // Generate new code: WEAVLY-{WORD}{4-hex-chars}
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const prefixStr = 'WEAVLY'; 
    let code = `${prefixStr}-${randomHex}`;

    // Retry loop for uniqueness
    while (true) {
        const { error } = await supabase
            .from('referral_codes')
            .insert({ org_id: orgId, code });

        if (!error) break;
        if (error.code !== '23505') { // Not unique violation
             console.error("Failed to insert referral code", error);
             throw new Error("Failed to create referral code");
        }
        // Generate new and retry
        code = `${prefixStr}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    return code;
}

export async function getReferralStats(orgId: string) {
    const supabase = await createClient();
    
    // First find the code for this org
    const { data: codeData } = await supabase
        .from('referral_codes')
        .select('id, code')
        .eq('org_id', orgId)
        .single();
    
    if (!codeData) {
        const code = await getOrCreateReferralCode(orgId);
        return { code, total: 0, converted: 0, activeWindows: [], currentDiscountPct: 0, history: [] };
    }

    // Get referrals
    const { data: referrees, error: refError } = await supabase
        .from('referral_uses')
        .select(`
            status,
            signed_up_at,
            converted_at,
            organizations ( name ),
            referral_discount_windows (
                discount_pct,
                valid_from,
                valid_until
            )
        `)
        .eq('referral_code_id', codeData.id);

    if (refError || !referrees) {
        return { code: codeData.code, total: 0, converted: 0, activeWindows: [], currentDiscountPct: 0 };
    }

    const typedReferrees = referrees as ReferralUseStatsRow[];
    const total = typedReferrees.length;
    const converted = typedReferrees.filter(r => r.status === 'converted').length;
    
    const now = new Date();
    
    // We want all active and future windows to visualize on the UI
    const upcomingAndActiveWindows = typedReferrees.flatMap(r => r.referral_discount_windows || []).filter((w) => {
        return new Date(w.valid_until) >= now;
    });

    const currentDiscountPct = upcomingAndActiveWindows
        .filter((w) => new Date(w.valid_from) <= now && new Date(w.valid_until) >= now)
        .reduce((sum, w) => sum + w.discount_pct, 0);

    const history = typedReferrees.map((r): ReferralHistoryRow => ({
        factoryName: r.organizations?.name || 'Unknown Factory',
        status: r.status,
        date: r.status === 'converted' ? r.converted_at : r.signed_up_at
    })).sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

    return {
        code: codeData.code,
        total,
        converted,
        activeWindows: upcomingAndActiveWindows,
        currentDiscountPct: Math.min(100, currentDiscountPct),
        history
    };
}

export async function applyReferralCode(code: string, refereeOrgId: string) {
    const supabase = await createClient();
    
    // 1. Find code
    const { data: codeRow, error: codeErr } = await supabase
        .from('referral_codes')
        .select('id, org_id')
        .eq('code', code)
        .single();
        
    if (codeErr || !codeRow) {
        throw new Error("Invalid referral code");
    }
    
    // Prevent self-referral
    if (codeRow.org_id === refereeOrgId) {
        throw new Error("Cannot use your own referral code");
    }

    // 2. Insert use
    const { error: useErr } = await supabase
        .from('referral_uses')
        .insert({
            referral_code_id: codeRow.id,
            referee_org_id: refereeOrgId,
            status: 'pending'
        });
        
    if (useErr) {
        if (useErr.code === '23505') {
            throw new Error("Referral code already applied for this organization");
        }
        throw new Error("Failed to apply referral code");
    }
    
    return true;
}
