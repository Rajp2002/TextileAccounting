// ─── monthly-brief ────────────────────────────────────────────────────────────
// Scheduled by pg_cron on the 28th of every month at 18:00 UTC (23:30 IST).
// Sends a monthly production + payroll summary to all opted-in org owners.
//
// Auth: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import {
    sendInteraktTemplate,
    logDelivery,
    makeCallbackData,
    formatInr,
} from "../_shared/interakt.ts"

const ALLOWED_ORIGIN = Deno.env.get('SITE_URL') ?? 'https://loomi.app'

const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TEMPLATE_NAME = 'vastra_monthly_brief'

// ─── Main Handler ──────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Auth: must supply service_role key (set by pg_cron)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader = req.headers.get('Authorization') ?? ''
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            serviceRoleKey
        )

        // Calculate report month (default: previous month, or override with ?month=2026-02)
        const now = new Date()
        const url = new URL(req.url)
        let reportMonth: string

        if (url.searchParams.has('month')) {
            reportMonth = url.searchParams.get('month')!
        } else {
            const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            reportMonth = prevMonth.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 7)
        }

        const [year, month] = reportMonth.split('-').map(Number)
        const startDate = `${reportMonth}-01`
        const daysInMonth = new Date(year, month, 0).getDate()
        const endDate = `${reportMonth}-${String(daysInMonth).padStart(2, '0')}`

        // Fetch all opted-in owners
        const { data: owners, error: ownersError } = await supabase
            .from('profiles')
            .select(`id, whatsapp_number, org_id, organizations ( name )`)
            .eq('role', 'owner')
            .eq('whatsapp_opted_in', true)
            .not('whatsapp_number', 'is', null)

        if (ownersError) throw new Error(`Owners fetch failed: ${ownersError.message}`)
        if (!owners?.length) {
            return new Response(JSON.stringify({ sent: 0, message: "No opted-in owners" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        const results = []

        for (const owner of owners) {
            const orgId = owner.org_id
            const factoryName = (owner.organizations as any)?.name ?? 'Your Factory'
            const ownerPhone = owner.whatsapp_number as string

            // ── Idempotency: skip if already sent for this month ──────────────
            const { data: existingLog } = await supabase
                .from('daily_brief_logs')
                .select('id')
                .eq('org_id', orgId)
                .eq('report_date', `${reportMonth}-01`)
                .eq('status', 'monthly_sent')
                .maybeSingle()

            if (existingLog) {
                results.push({ org: factoryName, status: 'skipped', reason: 'already_sent' })
                continue
            }

            // ── A. Production metrics (lean pivot: production_logs with rate snapshot) ──
            const { data: prodRows } = await supabase
                .from('production_logs')
                .select('meters, worker_rate_snapshot')
                .eq('org_id', orgId)
                .gte('date', startDate)
                .lte('date', endDate)

            const totalMeters = (prodRows ?? []).reduce((s: number, r: any) => s + Number(r.meters), 0)
            const totalLaborCost = (prodRows ?? []).reduce(
                (s: number, r: any) => s + Number(r.meters) * Number(r.worker_rate_snapshot ?? 0),
                0
            )

            // ── B. Payroll settlements for the month ──────────────────────────
            const { data: settlements } = await supabase
                .from('payroll_settlements')
                .select('gross_pay, net_payout, advance_deducted')
                .eq('org_id', orgId)
                .eq('month', reportMonth)

            const settledCount = (settlements ?? []).length
            const totalGrossPay = (settlements ?? []).reduce((s: number, r: any) => s + Number(r.gross_pay), 0)
            const totalNetPaid = (settlements ?? []).reduce((s: number, r: any) => s + Number(r.net_payout), 0)

            // ── C. Format month label ─────────────────────────────────────────
            const monthLabel = new Date(`${reportMonth}-01`).toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
            })

            // ── D. Build message body ─────────────────────────────────────────
            const divider = '─────────────────'
            const lines = [
                `📊 *MONTHLY REPORT — ${factoryName}*`,
                `📅 ${monthLabel}`,
                divider,
                `🏭 Production: *${Math.round(totalMeters).toLocaleString('en-IN')} meters*`,
                `💰 Gross Payroll: *₹${formatInr(totalGrossPay)}*`,
                `💸 Net Paid Out: *₹${formatInr(totalNetPaid)}*`,
                `👷 Workers Settled: *${settledCount}*`,
            ]

            if (totalLaborCost > 0 && settledCount === 0) {
                // Production happened but payroll not yet settled
                lines.push(`⚠️ Accrued Labor Cost: *₹${formatInr(totalLaborCost)}* (unsettled)`)
            }

            lines.push(divider)
            lines.push(`_Generated by Loomi_`)

            const messageBody = lines.join('\n')

            // ── E. Send via Interakt ──────────────────────────────────────────
            const apiKey = Deno.env.get('INTERAKT_API_KEY') ?? ''
            const callbackData = makeCallbackData('monthly', orgId)

            const result = await sendInteraktTemplate(
                apiKey,
                ownerPhone,
                TEMPLATE_NAME,
                'en',
                [messageBody],   // {{1}} = full report text
                callbackData,
            )

            // ── F. Log delivery ───────────────────────────────────────────────
            await logDelivery(supabase, {
                orgId,
                ownerProfileId: owner.id,
                recipientPhone: ownerPhone,
                templateName: TEMPLATE_NAME,
                notificationType: 'monthly_brief',
                callbackData,
                interaktMessageId: result.interaktMessageId,
                status: result.success ? 'sent' : 'failed',
                errorMessage: result.success ? null : JSON.stringify(result.responseBody),
                payloadSnapshot: { month: reportMonth, totalMeters, settledCount },
            })

            // ── G. Idempotency marker ─────────────────────────────────────────
            const briefStatus = result.success ? 'monthly_sent' : 'monthly_failed'
            await supabase.from('daily_brief_logs').insert({
                org_id: orgId,
                report_date: `${reportMonth}-01`,
                status: briefStatus,
                details: { type: 'monthly', month: reportMonth, totalMeters, settledCount },
            })

            results.push({
                org: factoryName,
                phone: ownerPhone,
                month: reportMonth,
                totalMeters: Math.round(totalMeters),
                settledCount,
                status: result.success ? 'sent' : 'failed',
                interaktMessageId: result.interaktMessageId,
            })
        }

        return new Response(
            JSON.stringify(results),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
