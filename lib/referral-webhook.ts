import { createAdminClient } from '@/lib/supabase/admin';
import Razorpay from 'razorpay';
import * as Sentry from '@sentry/nextjs';

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
    
    // App-level idempotency check: Skip if discount window already exists for this referral use
    const { data: existingWindow } = await supabase
        .from('referral_discount_windows')
        .select('id')
        .eq('referral_use_id', usage.id)
        .maybeSingle();

    if (existingWindow) {
        Sentry.captureMessage(`Discount window already exists for referral use ${usage.id}`, 'info');
        return;
    }
    
    const codeInfo = Array.isArray(usage.referral_codes) ? usage.referral_codes[0] : usage.referral_codes;
    if (!codeInfo?.org_id) return;
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
    
    const { error: insertError } = await supabase.from('referral_discount_windows')
        .insert({
            referrer_org_id: referrerOrgId,
            referral_use_id: usage.id,
            discount_pct: 10,
            valid_from: validFrom.toISOString(),
            valid_until: validUntil.toISOString()
        });

    if (insertError) {
        if (insertError.code === '23505') {
            Sentry.captureMessage('Concurrent insert prevented by unique constraint', 'warning');
            return;
        }
        Sentry.captureException(insertError, { tags: { component: 'referral_webhook', phase: 'discount_window_insert' } });
        return;
    }
}

export async function issueReferralRefund(orgId: string, paymentId: string, amountPaise: number) {
    const supabase = createAdminClient();
    
    // Idempotency check: Skip if refund already issued for this payment
    const { data: existingRefund } = await supabase
        .from('referral_refunds')
        .select('id')
        .eq('razorpay_payment_id', paymentId)
        .maybeSingle()

    if (existingRefund) {
        Sentry.captureMessage(`Refund already processed for payment ${paymentId}`, 'info')
        return
    }
    
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
                        reason: `Weavly referral discount: ${totalDiscountPct}% (${windows.length} referrals)`
                    }
                });
                
                refundId = refund.id;
                status = 'issued';
            } catch (error) {
                Sentry.captureException(error, { tags: { component: 'referral_webhook', phase: 'razorpay_refund' } });
                status = 'failed';
            }
        } else {
            Sentry.captureMessage('Razorpay keys missing for referral refund', 'warning');
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
