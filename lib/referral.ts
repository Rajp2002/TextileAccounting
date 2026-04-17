import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

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

    // Generate new code: LOOMI-{WORD}{4-hex-chars}
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const prefixStr = 'LOOMI'; 
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
        return { code: null, total: 0, converted: 0, activeWindows: [], currentDiscountPct: 0 };
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

    const total = referrees.length;
    const converted = referrees.filter(r => r.status === 'converted').length;
    
    const now = new Date();
    
    // We want all active and future windows to visualize on the UI
    const upcomingAndActiveWindows = referrees.flatMap(r => r.referral_discount_windows || []).filter((w: any) => {
        return new Date(w.valid_until) >= now;
    });

    const currentDiscountPct = upcomingAndActiveWindows
        .filter((w: any) => new Date(w.valid_from) <= now && new Date(w.valid_until) >= now)
        .reduce((sum, w: any) => sum + w.discount_pct, 0);

    const history = referrees.map((r: any) => ({
        factoryName: r.organizations?.name || 'Unknown Factory',
        status: r.status,
        date: r.status === 'converted' ? r.converted_at : r.signed_up_at
    })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
