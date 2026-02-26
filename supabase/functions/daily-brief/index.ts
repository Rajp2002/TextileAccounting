
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ─────────────────────────────────────────────────────

interface ProdRow {
    meters: number
    worker_name: string
    worker_id: number
    machine_name: string
    machine_id: string
    shift: string // 'day' | 'night' | 'unknown'
}

// ─── Message Builders ──────────────────────────────────────────

function buildWorkerBreakdown(rows: ProdRow[]): string {
    // Group by shift → worker → machine
    const shifts: Record<string, Record<string, { total: number; machines: Record<string, number> }>> = {
        day: {},
        night: {},
    }

    for (const r of rows) {
        const shiftKey = r.shift === 'night' ? 'night' : 'day'
        if (!shifts[shiftKey][r.worker_name]) {
            shifts[shiftKey][r.worker_name] = { total: 0, machines: {} }
        }
        shifts[shiftKey][r.worker_name].total += r.meters
        shifts[shiftKey][r.worker_name].machines[r.machine_name] =
            (shifts[shiftKey][r.worker_name].machines[r.machine_name] || 0) + r.meters
    }

    let text = ''

    // Day Shift
    const dayWorkers = Object.entries(shifts.day)
    if (dayWorkers.length > 0) {
        text += `☀️ *DAY SHIFT*`
        for (const [worker, data] of dayWorkers) {
            text += `\n  👷 *${worker}* — ${data.total} m`
            for (const [machine, meters] of Object.entries(data.machines)) {
                text += `\n      ${machine}: ${meters} m`
            }
        }
    }

    // Night Shift
    const nightWorkers = Object.entries(shifts.night)
    if (nightWorkers.length > 0) {
        if (text) text += '\n\n'
        text += `🌙 *NIGHT SHIFT*`
        for (const [worker, data] of nightWorkers) {
            text += `\n  👷 *${worker}* — ${data.total} m`
            for (const [machine, meters] of Object.entries(data.machines)) {
                text += `\n      ${machine}: ${meters} m`
            }
        }
    }

    return text
}

function buildMachineBreakdown(rows: ProdRow[]): string {
    const map: Record<string, { total: number; workers: Record<string, number> }> = {}

    for (const r of rows) {
        if (!map[r.machine_name]) map[r.machine_name] = { total: 0, workers: {} }
        map[r.machine_name].total += r.meters
        map[r.machine_name].workers[r.worker_name] =
            (map[r.machine_name].workers[r.worker_name] || 0) + r.meters
    }

    const sorted = Object.entries(map).sort((a, b) => b[1].total - a[1].total)

    let text = `🏭 *MACHINE RANKING*`
    let rank = 1
    for (const [machine, data] of sorted) {
        const workerList = Object.keys(data.workers).join(', ')
        text += `\n  ${rank}. ${machine}: ${data.total} m (${workerList})`
        rank++
    }
    return text
}

// ─── Main Handler ──────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: orgs, error: orgError } = await supabaseClient
            .from('organizations')
            .select('id, name')
        if (orgError) throw orgError

        const results = []
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

        for (const org of orgs) {

            // Idempotency
            const { data: existingLog } = await supabaseClient
                .from('daily_brief_logs')
                .select('id')
                .eq('org_id', org.id)
                .eq('report_date', todayIST)
                .maybeSingle()

            if (existingLog) {
                results.push({ org: org.name, status: 'skipped', reason: 'already_sent' })
                continue
            }

            // A. Fetch production logs with worker & machine names
            const { data: productionLines, error: prodError } = await supabaseClient
                .from('production_logs')
                .select('meters, worker_id, machine_id, workers(name), machines(name)')
                .eq('org_id', org.id)
                .eq('date', todayIST)

            if (prodError) {
                console.error(`Error fetching logs for org ${org.name}:`, prodError)
                continue
            }

            // B. Fetch machine_assignments to map worker+machine → shift
            const { data: assignments } = await supabaseClient
                .from('machine_assignments')
                .select('machine_id, worker_id, shift')
                .eq('org_id', org.id)

            // Build lookup: "machineId_workerId" → shift
            const shiftLookup: Record<string, string> = {}
            for (const a of (assignments || [])) {
                shiftLookup[`${a.machine_id}_${a.worker_id}`] = a.shift
            }

            // Normalize rows
            const rows: ProdRow[] = (productionLines || []).map((r: any) => ({
                meters: Number(r.meters),
                worker_name: r.workers?.name ?? 'Unknown',
                worker_id: r.worker_id,
                machine_name: r.machines?.name ?? 'Unknown',
                machine_id: r.machine_id,
                shift: shiftLookup[`${r.machine_id}_${r.worker_id}`] || 'day',
            }))

            const totalMeters = rows.reduce((sum, row) => sum + row.meters, 0)

            // C. Get owner phone
            const { data: owners, error: ownerError } = await supabaseClient
                .from('profiles')
                .select('phone')
                .eq('org_id', org.id)
                .eq('role', 'owner')
                .limit(1)

            if (ownerError) { continue }

            if (!owners || owners.length === 0 || !owners[0].phone) {
                await supabaseClient.from('daily_brief_logs').insert({
                    org_id: org.id, report_date: todayIST, status: 'skipped',
                    details: { reason: 'no_owner_phone' },
                })
                results.push({ org: org.name, status: 'skipped', reason: 'no_owner_phone' })
                continue
            }

            const ownerPhone = owners[0].phone

            // ─── Build Message ───
            const divider = '─────────────────'
            const header = `📋 *DAILY REPORT*\n${org.name}\n📅 ${todayIST}\n${divider}`

            const section1 = rows.length > 0
                ? buildWorkerBreakdown(rows)
                : '👷 No production logged today.'

            const section2 = rows.length > 0
                ? `\n${divider}\n${buildMachineBreakdown(rows)}`
                : ''

            const section3 = `\n${divider}\n📊 *TOTAL: ${totalMeters} meters*`

            const messageBody = [header, section1, section2, section3]
                .filter(Boolean)
                .join('\n\n')

            // D. Send
            let sendStatus = 'simulated'
            let providerResponse = {}
            const WHATSAPP_PROVIDER = Deno.env.get('WHATSAPP_PROVIDER') || 'simulate'

            if (WHATSAPP_PROVIDER === 'twilio') {
                const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
                const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
                const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')
                if (!accountSid || !authToken || !fromNumber) { continue }

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
                if (!apiKey) { continue }
                const interaktUrl = 'https://api.interakt.ai/v1/public/message/'
                const payload = {
                    countryCode: ownerPhone.replace('+', '').substring(0, 2),
                    phoneNumber: ownerPhone.replace('+', '').substring(2),
                    callbackData: "daily_brief", type: "Text",
                    data: { message: messageBody }
                }
                try {
                    const response = await fetch(interaktUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Basic ${apiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    })
                    providerResponse = await response.json()
                    sendStatus = response.ok ? 'sent' : 'failed'
                } catch (e) { sendStatus = 'error' }
            } else {
                console.log(`[SIMULATION] Sending WhatsApp to ${ownerPhone}:`)
                console.log(messageBody)
            }

            const briefStatus = (sendStatus === 'sent' || sendStatus === 'simulated') ? 'success' : 'failed'
            await supabaseClient.from('daily_brief_logs').insert({
                org_id: org.id, report_date: todayIST, status: briefStatus,
                details: { provider: WHATSAPP_PROVIDER, totalMeters, message: messageBody, response: providerResponse },
            })

            results.push({
                org: org.name, phone: ownerPhone, total: totalMeters,
                status: sendStatus, provider: WHATSAPP_PROVIDER,
                message: messageBody, response: providerResponse
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
