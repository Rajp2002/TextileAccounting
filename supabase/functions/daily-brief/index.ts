
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        // en-CA locale returns YYYY-MM-DD which matches Supabase DATE columns
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

        // 2. Loop through organizations
        for (const org of orgs) {

            // 🛡️ C-2 Fix: Idempotency check — skip if already sent today
            const { data: existingLog } = await supabaseClient
                .from('daily_brief_logs')
                .select('id')
                .eq('org_id', org.id)
                .eq('report_date', todayIST)
                .maybeSingle()

            if (existingLog) {
                console.log(`[SKIP] Report already sent for ${org.name} on ${todayIST}`)
                results.push({ org: org.name, status: 'skipped', reason: 'already_sent' })
                continue
            }

            // A. Calculate total production for today for this org
            const { data: productionLines, error: prodError } = await supabaseClient
                .from('production_logs')
                .select('meters')
                .eq('org_id', org.id)
                .eq('date', todayIST)

            if (prodError) {
                console.error(`Error fetching logs for org ${org.name}:`, prodError)
                continue
            }

            // Calculate total meters
            const totalMeters = productionLines.reduce((sum, row) => sum + Number(row.meters), 0)

            // B. Get Owner's phone number
            const { data: owners, error: ownerError } = await supabaseClient
                .from('profiles')
                .select('phone')
                .eq('org_id', org.id)
                .eq('role', 'owner')
                .limit(1)

            if (ownerError) {
                console.error(`Error fetching owner for org ${org.name}:`, ownerError)
                continue
            }

            if (!owners || owners.length === 0 || !owners[0].phone) {
                console.log(`No owner phone found for org ${org.name}`)
                // Log as skipped
                await supabaseClient.from('daily_brief_logs').insert({
                    org_id: org.id,
                    report_date: todayIST,
                    status: 'skipped',
                    details: { reason: 'no_owner_phone' },
                })
                results.push({ org: org.name, status: 'skipped', reason: 'no_owner_phone' })
                continue
            }

            const ownerPhone = owners[0].phone
            const messageBody = `*Daily Summary for ${org.name}*\n📅 Date: ${todayIST}\n🏭 Total Production: ${totalMeters} meters`

            // C. Send WhatsApp Message
            let sendStatus = 'simulated'
            let providerResponse = {}

            // --- CONFIGURATION START ---
            const WHATSAPP_PROVIDER = Deno.env.get('WHATSAPP_PROVIDER') || 'simulate'

            if (WHATSAPP_PROVIDER === 'twilio') {
                const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
                const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
                const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

                if (!accountSid || !authToken || !fromNumber) {
                    console.error('Twilio credentials missing')
                    continue
                }

                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
                const formData = new URLSearchParams()
                formData.append('To', `whatsapp:${ownerPhone}`)
                formData.append('From', fromNumber)
                formData.append('Body', messageBody)

                try {
                    const response = await fetch(twilioUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: formData
                    })
                    providerResponse = await response.json()
                    sendStatus = response.ok ? 'sent' : 'failed'
                } catch (e) {
                    sendStatus = 'error'
                    console.error('Twilio Error:', e)
                }

            } else if (WHATSAPP_PROVIDER === 'interakt') {
                const apiKey = Deno.env.get('INTERAKT_API_KEY')
                if (!apiKey) {
                    console.error('Interakt API Key missing')
                    continue
                }

                const interaktUrl = 'https://api.interakt.ai/v1/public/message/'
                const payload = {
                    countryCode: ownerPhone.replace('+', '').substring(0, 2),
                    phoneNumber: ownerPhone.replace('+', '').substring(2),
                    callbackData: "some_callback_data",
                    type: "Template",
                    template: {
                        name: "daily_brief",
                        languageCode: "en",
                        bodyValues: [
                            org.name,
                            todayIST,
                            totalMeters.toString()
                        ]
                    }
                }

                try {
                    const response = await fetch(interaktUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Basic ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    })
                    providerResponse = await response.json()
                    sendStatus = response.ok ? 'sent' : 'failed'
                } catch (e) {
                    sendStatus = 'error'
                    console.error('Interakt Error:', e)
                }
            } else {
                // SIMULATION MODE
                console.log(`[SIMULATION] Sending WhatsApp to ${ownerPhone}:`)
                console.log(messageBody)
            }
            // --- CONFIGURATION END ---

            // 🛡️ C-2 Fix: Log the send attempt (UNIQUE constraint prevents duplicates)
            const briefStatus = (sendStatus === 'sent' || sendStatus === 'simulated') ? 'success' : 'failed'
            await supabaseClient.from('daily_brief_logs').insert({
                org_id: org.id,
                report_date: todayIST,
                status: briefStatus,
                details: { provider: WHATSAPP_PROVIDER, totalMeters, response: providerResponse },
            })

            results.push({
                org: org.name,
                phone: ownerPhone,
                total: totalMeters,
                status: sendStatus,
                provider: WHATSAPP_PROVIDER,
                response: providerResponse
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
