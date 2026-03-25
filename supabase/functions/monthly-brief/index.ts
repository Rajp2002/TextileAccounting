
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

// ─── Types ─────────────────────────────────────────────────────

interface MonthlyProdRow {
    meters: number
    worker_name: string
    worker_id: number
    machine_name: string
    machine_id: string
    rate_per_meter: number
    shift: string
}

// ─── Message Builders ──────────────────────────────────────────

function buildMeterWorkerBreakdown(rows: MonthlyProdRow[]): string {
    // Group by shift → worker → machine
    const shifts: Record<string, Record<string, {
        total: number
        totalPay: number
        machines: Record<string, { meters: number; rate: number; pay: number }>
    }>> = { day: {}, night: {} }

    for (const r of rows) {
        const shiftKey = r.shift === 'night' ? 'night' : 'day'
        if (!shifts[shiftKey][r.worker_name]) {
            shifts[shiftKey][r.worker_name] = { total: 0, totalPay: 0, machines: {} }
        }
        const entry = shifts[shiftKey][r.worker_name]
        const meters = Number(r.meters)
        const rate = Number(r.rate_per_meter)
        const linePay = meters * rate

        entry.total += meters
        entry.totalPay += linePay

        if (!entry.machines[r.machine_name]) {
            entry.machines[r.machine_name] = { meters: 0, rate, pay: 0 }
        }
        entry.machines[r.machine_name].meters += meters
        entry.machines[r.machine_name].pay += linePay
    }

    let text = ''

    for (const [shiftKey, shiftLabel] of [['day', '☀️ *DAY SHIFT*'], ['night', '🌙 *NIGHT SHIFT*']]) {
        const workers = Object.entries(shifts[shiftKey])
        if (workers.length === 0) continue

        if (text) text += '\n\n'
        text += shiftLabel

        for (const [worker, data] of workers) {
            text += `\n\n  👷 *${worker}* — ${data.total} m`
            for (const [machine, mData] of Object.entries(data.machines)) {
                text += `\n      ${machine} (₹${mData.rate.toFixed(2)}/m): ${mData.meters} m → ₹${mData.pay.toFixed(2)}`
            }
            text += `\n      💰 *Pay: ₹${data.totalPay.toFixed(2)}*`
        }
    }

    return text || '👷 No meter-based production this month.'
}

function buildFixedWorkerBreakdown(
    workers: { id: number; name: string; role: string; monthly_salary: number }[],
    attendanceCounts: Record<number, number>,
    daysInMonth: number,
): string {
    const monthly = workers.filter(w => w.role !== 'daily')
    const daily = workers.filter(w => w.role === 'daily')

    let text = ''

    // Monthly salaried workers
    if (monthly.length > 0) {
        text += `💼 *SALARIED STAFF*`
        for (const w of monthly) {
            const days = attendanceCounts[w.id] ?? 0
            text += `\n  • ${w.name} (${w.role})`
            text += `\n    ₹${Number(w.monthly_salary).toFixed(0)}/month`
            text += `\n    📅 Attendance: ${days}/${daysInMonth} days`
        }
    }

    // Daily workers
    if (daily.length > 0) {
        if (text) text += '\n\n'
        text += `🔨 *DAILY WORKERS*`
        for (const w of daily) {
            const days = attendanceCounts[w.id] ?? 0
            const monthlySalary = Number(w.monthly_salary)
            const dailyRate = monthlySalary / 30
            const totalPay = dailyRate * days
            text += `\n  • ${w.name}`
            text += `\n    ₹${monthlySalary.toFixed(0)}/month (₹${dailyRate.toFixed(0)}/day)`
            text += `\n    📅 ${days} days → 💰 ₹${totalPay.toFixed(2)}`
        }
    }

    return text || '🔧 No fixed/daily workers registered.'
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

        // Calculate report month (default: previous month, or override with ?month=2026-02)
        const now = new Date()
        const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
        const url = new URL(req.url)
        let reportMonth: string

        if (url.searchParams.has('month')) {
            reportMonth = url.searchParams.get('month')!
        } else {
            const prevMonth = new Date(istNow.getFullYear(), istNow.getMonth() - 1, 1)
            reportMonth = prevMonth.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 7)
        }

        const [year, month] = reportMonth.split('-').map(Number)
        const startDate = `${reportMonth}-01`
        const daysInMonth = new Date(year, month, 0).getDate()
        const endDate = `${reportMonth}-${String(daysInMonth).padStart(2, '0')}`

        for (const org of orgs) {

            // Idempotency
            const { data: existingLog } = await supabaseClient
                .from('daily_brief_logs')
                .select('id')
                .eq('org_id', org.id)
                .eq('report_date', `${reportMonth}-01`)
                .eq('status', 'monthly_sent')
                .maybeSingle()

            if (existingLog) {
                results.push({ org: org.name, status: 'skipped', reason: 'already_sent' })
                continue
            }

            // A. Production logs with worker, machine, rate
            const { data: productionLines, error: prodError } = await supabaseClient
                .from('production_logs')
                .select('meters, worker_id, machine_id, workers(name), machines(name, rate_per_meter)')
                .eq('org_id', org.id)
                .gte('date', startDate)
                .lte('date', endDate)

            if (prodError) {
                console.error(`Error fetching logs for org ${org.name}:`, prodError)
                continue
            }

            // B. Machine assignments for shift lookup
            const { data: assignments } = await supabaseClient
                .from('machine_assignments')
                .select('machine_id, worker_id, shift')
                .eq('org_id', org.id)

            const shiftLookup: Record<string, string> = {}
            for (const a of (assignments || [])) {
                shiftLookup[`${a.machine_id}_${a.worker_id}`] = a.shift
            }

            const rows: MonthlyProdRow[] = (productionLines || []).map((r: any) => ({
                meters: Number(r.meters),
                worker_name: r.workers?.name ?? 'Unknown',
                worker_id: r.worker_id,
                machine_name: r.machines?.name ?? 'Unknown',
                machine_id: r.machine_id,
                rate_per_meter: Number(r.machines?.rate_per_meter ?? 0),
                shift: shiftLookup[`${r.machine_id}_${r.worker_id}`] || 'day',
            }))

            // C. Fixed workers + attendance
            const { data: fixedWorkers } = await supabaseClient
                .from('fixed_workers')
                .select('id, name, role, monthly_salary')
                .eq('org_id', org.id)
                .eq('is_active', true)

            const { data: attendanceRows } = await supabaseClient
                .from('attendance')
                .select('fixed_worker_id')
                .eq('org_id', org.id)
                .eq('present', true)
                .gte('date', startDate)
                .lte('date', endDate)

            const attendanceCounts: Record<number, number> = {}
            for (const row of (attendanceRows || [])) {
                attendanceCounts[row.fixed_worker_id] = (attendanceCounts[row.fixed_worker_id] || 0) + 1
            }

            // D. Owner phone
            const { data: owners } = await supabaseClient
                .from('profiles')
                .select('phone')
                .eq('org_id', org.id)
                .eq('role', 'owner')
                .limit(1)

            if (!owners || owners.length === 0 || !owners[0].phone) {
                results.push({ org: org.name, status: 'skipped', reason: 'no_owner_phone' })
                continue
            }

            const ownerPhone = owners[0].phone

            // ─── Build Message ───
            const divider = '─────────────────'
            const header = `📊 *MONTHLY REPORT*\n${org.name}\n📅 ${reportMonth}\n${divider}`

            const section1 = buildMeterWorkerBreakdown(rows)
            const section2 = buildFixedWorkerBreakdown(fixedWorkers || [], attendanceCounts, daysInMonth)

            const messageBody = [header, section1, divider, section2]
                .filter(Boolean)
                .join('\n\n')

            // E. Send
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
                    callbackData: "monthly_brief", type: "Text",
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
                console.log(`[SIMULATION] Monthly WhatsApp to ${ownerPhone}:`)
                console.log(messageBody)
            }

            const briefStatus = (sendStatus === 'sent' || sendStatus === 'simulated') ? 'monthly_sent' : 'monthly_failed'
            await supabaseClient.from('daily_brief_logs').insert({
                org_id: org.id, report_date: `${reportMonth}-01`, status: briefStatus,
                details: { type: 'monthly', provider: WHATSAPP_PROVIDER, month: reportMonth, message: messageBody, response: providerResponse },
            })

            results.push({
                org: org.name, phone: ownerPhone, month: reportMonth,
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
