import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

// Restrict CORS: these functions are called by the server cron, not the browser.
// Only allowing our own site origin prevents stray browser calls.
const ALLOWED_ORIGIN = Deno.env.get('SITE_URL') ?? 'https://vastra.app'

const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // 🔐 Security gate: verify CRON_SECRET
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get all organizations
        const { data: orgs, error: orgError } = await supabaseClient
            .from('organizations')
            .select('id, name')

        if (orgError) throw orgError

        const results = []

        // 🕐 C-1 Fix: Use IST (Asia/Kolkata) for the date, not UTC
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

        // 2. For each org, calculate today's total
        for (const org of orgs) {

            // 🛡️ C-2 Fix: Idempotency — skip if already sent today
            const { data: existingLog } = await supabaseClient
                .from('daily_brief_logs')
                .select('id')
                .eq('org_id', org.id)
                .eq('report_date', todayIST)
                .maybeSingle()

            if (existingLog) {
                console.log(`[SKIP] Summary already sent for ${org.name} on ${todayIST}`)
                results.push({ org: org.name, status: 'skipped', reason: 'already_sent' })
                continue
            }

            const { data: production, error: prodError } = await supabaseClient
                .from('production_logs')
                .select('meters')
                .eq('org_id', org.id)
                .eq('date', todayIST)

            if (prodError) continue

            const totalMeters = production.reduce((sum, row) => sum + Number(row.meters), 0)

            // 3. Get Owner's phone number
            const { data: owners, error: ownerError } = await supabaseClient
                .from('profiles')
                .select('phone')
                .eq('org_id', org.id)
                .eq('role', 'owner')

            if (ownerError || !owners.length) {
                await supabaseClient.from('daily_brief_logs').insert({
                    org_id: org.id,
                    report_date: todayIST,
                    status: 'skipped',
                    details: { reason: 'no_owner_phone' },
                })
                continue
            }

            // 4. Send WhatsApp (Mock implementation for now)
            const message = `*Daily Summary for ${org.name}*\nDate: ${todayIST}\nTotal Production: ${totalMeters} meters`

            console.log(`Sending to ${owners[0].phone}: ${message}`)

            // 🛡️ C-2 Fix: Log the send (UNIQUE constraint prevents duplicates)
            await supabaseClient.from('daily_brief_logs').insert({
                org_id: org.id,
                report_date: todayIST,
                status: 'success',
                details: { totalMeters, sentTo: owners[0].phone },
            })

            results.push({ org: org.name, total: totalMeters, sentTo: owners[0].phone })
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

// Cron schedule: 8 PM IST = 2:30 PM UTC
// postgres cron syntax: 30 14 * * *
