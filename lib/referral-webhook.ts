import { createAdminClient } from '@/lib/supabase/admin';
import Razorpay from 'razorpay';

export async function processReferralConversion(refereeOrgId: string) {
    const supabase = createAdminClient();
    
    // Find pending use
    const { data: usage } = await supabase
        .from('referral_uses')
        .select(`
            id,
            referral_code_id,
            referral_codes ( org_id )
        `)
        .eq('referee_org_id', refereeOrgId)
        .eq('status', 'pending')
        .single();
        
    if (!usage) return; // No pending referral found
    
    // Type casting to handle the join return type
    const codeInfo = usage.referral_codes as any as { org_id: string };
    const referrerOrgId = codeInfo.org_id;

    // 1. Mark as converted
    await supabase.from('referral_uses')
        .update({ status: 'converted', converted_at: new Date().toISOString() })
        .eq('id', usage.id);
        
    // 2. Determine discount window bounds (3 months starting from next billing cycle)
    const { data: sub } = await supabase
        .from('org_subscriptions')
        .select('current_end')
        .eq('org_id', referrerOrgId)
        .in('status', ['active', 'authenticated'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    let validFrom = new Date();
    if (sub && sub.current_end && new Date(sub.current_end) > validFrom) {
        validFrom = new Date(sub.current_end);
    }
    
    const validUntil = new Date(validFrom);
    validUntil.setMonth(validUntil.getMonth() + 3);
    
    await supabase.from('referral_discount_windows')
        .insert({
            referrer_org_id: referrerOrgId,
            referral_use_id: usage.id,
            discount_pct: 10,
            valid_from: validFrom.toISOString(),
            valid_until: validUntil.toISOString()
        });
}

export async function issueReferralRefund(orgId: string, paymentId: string, amountPaise: number) {
    const supabase = createAdminClient();
    
    // Check if they have active windows
    const now = new Date().toISOString();
    const { data: windows } = await supabase
        .from('referral_discount_windows')
        .select('id, discount_pct')
        .eq('referrer_org_id', orgId)
        .lte('valid_from', now)
        .gte('valid_until', now);
        
    if (!windows || windows.length === 0) return;
    
    // Calculate effective discount
    const totalDiscountPct = Math.min(100, windows.reduce((sum, w) => sum + w.discount_pct, 0));
    
    if (totalDiscountPct > 0) {
        const refundAmountPaise = Math.round(amountPaise * (totalDiscountPct / 100));
        
        let refundId = null;
        let status = 'pending';
        
        // Initialize Razorpay
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
            try {
                const rzp = new Razorpay({
                    key_id: process.env.RAZORPAY_KEY_ID,
                    key_secret: process.env.RAZORPAY_KEY_SECRET,
                });
                
                const refund = await rzp.payments.refund(paymentId, {
                    amount: refundAmountPaise,
                    notes: {
                        reason: `Loomi referral discount: ${totalDiscountPct}% (${windows.length} referrals)`
                    }
                });
                
                refundId = refund.id;
                status = 'issued';
            } catch (error) {
                console.error("Failed to issue Razorpay refund:", error);
                status = 'failed';
            }
        } else {
             console.warn("Razorpay keys missing, skipping actual refund API call");
        }
        
        // Log it
        await supabase.from('referral_refunds').insert({
            referrer_org_id: orgId,
            razorpay_payment_id: paymentId,
            razorpay_refund_id: refundId,
            original_amount_paise: amountPaise,
            refund_amount_paise: refundAmountPaise,
            discount_pct_applied: totalDiscountPct,
            windows_applied: JSON.stringify(windows.map(w => w.id)),
            status: status
        });
    }
}
