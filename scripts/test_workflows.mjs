// Comprehensive workflow test — covers all key operations
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzhwahudircrpgtitwzd.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aHdhaHVkaXJjcnBndGl0d3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDAxOTcsImV4cCI6MjA4NjgxNjE5N30.avKJfS24wW6jIO5B6XOPIWlkt8axj7FVAdxfc9rT25Y'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aHdhaHVkaXJjcnBndGl0d3pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI0MDE5NywiZXhwIjoyMDg2ODE2MTk3fQ.355XIvote_askYX1mgF0Sy7YGzIPMaSVDXU_IBI6pOM'

const results = { pass: 0, fail: 0, issues: [] }

function pass(msg) { results.pass++; console.log(`  ✅ ${msg}`) }
function fail(msg, detail) { results.fail++; results.issues.push({ msg, detail }); console.log(`  ❌ ${msg}: ${detail}`) }

async function testAs(email, password, label) {
    console.log(`\n🔐 Testing as ${label} (${email})...`)
    const supabase = createClient(SUPABASE_URL, ANON_KEY)
    const { data: { session }, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { fail(`${label} login`, error.message); return null }
    pass(`${label} login`)

    const jwt = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64').toString())
    if (jwt.org_id) pass(`${label} JWT has org_id`)
    else fail(`${label} JWT missing org_id`, 'JWT custom hook not working')
    if (jwt.user_role) pass(`${label} JWT has user_role: ${jwt.user_role}`)
    else fail(`${label} JWT missing user_role`, 'JWT custom hook not working')

    return { supabase, session, jwt }
}

async function run() {
    console.log('═══════════════════════════════════════════')
    console.log('  COMPREHENSIVE WORKFLOW VERIFICATION')
    console.log('═══════════════════════════════════════════')

    // ═══════════════ OWNER TESTS ═══════════════
    const owner = await testAs('owner.qa.test@mailinator.com', 'TestOwner123!', 'Owner')
    if (!owner) return
    const { supabase: ownerSb, jwt: ownerJwt } = owner
    const orgId = ownerJwt.org_id

    // Test 1: Read machines
    console.log('\n📌 TEST: Owner reads machines')
    const { data: machines, error: machErr } = await ownerSb.from('machines').select('*').eq('org_id', orgId)
    if (machErr) fail('Read machines', machErr.message)
    else pass(`Read machines (${machines.length} found)`)

    // Test 2: Add a machine
    console.log('\n📌 TEST: Owner adds a machine')
    const { data: newMachine, error: addMachErr } = await ownerSb.from('machines').insert({ org_id: orgId, name: 'Test Loom', rate_per_meter: 5.50 }).select().single()
    if (addMachErr) fail('Add machine', addMachErr.message)
    else pass(`Added machine: ${newMachine.name}`)

    // Test 3: Add a meter worker
    console.log('\n📌 TEST: Owner adds meter worker')
    const { data: newWorker, error: addWErr } = await ownerSb.from('workers').insert({ org_id: orgId, name: 'Deepesh Yadav', is_active: true }).select().single()
    if (addWErr) fail('Add meter worker', addWErr.message)
    else pass(`Added meter worker: ${newWorker.name}`)

    // Test 4: Add a fixed worker
    console.log('\n📌 TEST: Owner adds fixed worker')
    const { data: newFW, error: addFWErr } = await ownerSb.from('fixed_workers').insert({ org_id: orgId, name: 'Priya Devi', role: 'daily', monthly_salary: 9000, is_active: true }).select().single()
    if (addFWErr) fail('Add fixed worker', addFWErr.message)
    else pass(`Added fixed worker: ${newFW.name}`)

    // Test 5: Read workers
    console.log('\n📌 TEST: Owner reads workers')
    const { data: workers, error: readWErr } = await ownerSb.from('workers').select('*').eq('org_id', orgId)
    if (readWErr) fail('Read workers', readWErr.message)
    else pass(`Read workers (${workers.length} found)`)

    // Test 6: Read fixed workers
    console.log('\n📌 TEST: Owner reads fixed workers')
    const { data: fws, error: readFWErr } = await ownerSb.from('fixed_workers').select('*').eq('org_id', orgId)
    if (readFWErr) fail('Read fixed workers', readFWErr.message)
    else pass(`Read fixed workers (${fws.length} found)`)

    // Test 7: Update salary
    console.log('\n📌 TEST: Owner updates fixed worker salary')
    if (fws && fws.length > 0) {
        const { error: updErr } = await ownerSb.from('fixed_workers').update({ monthly_salary: 12000 }).eq('id', fws[0].id)
        if (updErr) fail('Update salary', updErr.message)
        else pass('Updated salary')
    }

    // Test 8: Insert production log
    console.log('\n📌 TEST: Owner inserts production log')
    const today = new Date().toISOString().split('T')[0]
    if (workers?.length > 0 && machines?.length > 0) {
        const { error: logErr } = await ownerSb.from('production_logs').insert({
            org_id: orgId, worker_id: workers[0].id, machine_id: machines[0].id,
            date: today, meters: 100, shift: 'day'
        })
        if (logErr) fail('Insert production log', logErr.message)
        else pass('Inserted production log')
    }

    // Test 9: Read production logs
    console.log('\n📌 TEST: Owner reads production logs')
    const { data: logs, error: logReadErr } = await ownerSb.from('production_logs').select('*').eq('org_id', orgId).eq('date', today)
    if (logReadErr) fail('Read production logs', logReadErr.message)
    else pass(`Read production logs (${logs.length} found)`)

    // Test 10: Read payroll payments
    console.log('\n📌 TEST: Owner reads payroll payments')
    const { data: payroll, error: payErr } = await ownerSb.from('payroll_payments').select('*').eq('org_id', orgId)
    if (payErr) fail('Read payroll payments', payErr.message)
    else pass(`Read payroll payments (${payroll.length} found)`)

    // Test 11: Access code (generate)
    console.log('\n📌 TEST: Owner reads org (for access code)')
    const { data: org, error: orgErr } = await ownerSb.from('organizations').select('*').eq('id', orgId).single()
    if (orgErr) fail('Read organization', orgErr.message)
    else pass(`Org: ${org.name}, join_code: ${org.join_code}`)

    // ═══════════════ SUPERVISOR TESTS ═══════════════
    const supervisor = await testAs('supervisor.qa.test@mailinator.com', 'TestSuper123!', 'Supervisor')
    if (!supervisor) return
    const { supabase: supSb, jwt: supJwt } = supervisor

    // Test 12: Supervisor reads workers
    console.log('\n📌 TEST: Supervisor reads workers')
    const { data: supWorkers, error: supWErr } = await supSb.from('workers').select('*').eq('org_id', supJwt.org_id)
    if (supWErr) fail('Supervisor read workers', supWErr.message)
    else pass(`Supervisor reads workers (${supWorkers.length} found)`)

    // Test 13: Supervisor reads machines
    console.log('\n📌 TEST: Supervisor reads machines')
    const { data: supMachines, error: supMErr } = await supSb.from('machines').select('*').eq('org_id', supJwt.org_id)
    if (supMErr) fail('Supervisor read machines', supMErr.message)
    else pass(`Supervisor reads machines (${supMachines.length} found)`)

    // Test 14: Supervisor inserts production log
    console.log('\n📌 TEST: Supervisor inserts production log')
    if (supWorkers?.length > 0 && supMachines?.length > 0) {
        const { error: supLogErr } = await supSb.from('production_logs').insert({
            org_id: supJwt.org_id, worker_id: supWorkers[0].id, machine_id: supMachines[0].id,
            date: today, meters: 200, shift: 'day'
        })
        if (supLogErr) fail('Supervisor insert production log', supLogErr.message)
        else pass('Supervisor inserted production log')
    }

    // Test 15: Supervisor adds a worker
    console.log('\n📌 TEST: Supervisor adds meter worker')
    const { error: supAddWErr } = await supSb.from('workers').insert({ org_id: supJwt.org_id, name: 'Vikram Mehta', is_active: true })
    if (supAddWErr) fail('Supervisor add worker', supAddWErr.message)
    else pass('Supervisor added worker')

    // Test 16: Supervisor reads fixed workers
    console.log('\n📌 TEST: Supervisor reads fixed workers')
    const { data: supFW, error: supFWErr } = await supSb.from('fixed_workers').select('*').eq('org_id', supJwt.org_id)
    if (supFWErr) fail('Supervisor read fixed workers', supFWErr.message)
    else pass(`Supervisor reads fixed workers (${supFW.length} found)`)

    // Test 17: Supervisor reads attendance
    console.log('\n📌 TEST: Supervisor reads attendance')
    const { data: att, error: attErr } = await supSb.from('attendance').select('*').eq('org_id', supJwt.org_id)
    if (attErr) fail('Supervisor read attendance', attErr.message)
    else pass(`Supervisor reads attendance (${att.length} found)`)

    // Test 18: Supervisor inserts today's attendance
    console.log('\n📌 TEST: Supervisor inserts attendance for today')
    if (supFW?.length > 0) {
        const dailyWorker = supFW.find(w => w.role === 'daily')
        if (dailyWorker) {
            const { error: attInsErr } = await supSb.from('attendance').insert({
                org_id: supJwt.org_id, fixed_worker_id: dailyWorker.id, date: today, present: true
            })
            if (attInsErr) fail('Supervisor insert attendance', attInsErr.message)
            else pass('Supervisor inserted attendance')
        } else {
            console.log('  ⏭️  No daily worker found, skipping attendance test')
        }
    }

    // Test 19: Supervisor manages assignments
    console.log('\n📌 TEST: Supervisor reads assignments')
    const { data: assigns, error: assignErr } = await supSb.from('machine_assignments').select('*').eq('org_id', supJwt.org_id)
    if (assignErr) fail('Supervisor read assignments', assignErr.message)
    else pass(`Supervisor reads assignments (${assigns.length} found)`)

    // Test 20: Supervisor creates an assignment
    console.log('\n📌 TEST: Supervisor creates assignment')
    if (supWorkers?.length > 0 && supMachines?.length > 0) {
        const { error: assignInsErr } = await supSb.from('machine_assignments').upsert({
            org_id: supJwt.org_id, machine_id: supMachines[0].id, worker_id: supWorkers[0].id, shift: 'day'
        }, { onConflict: 'org_id,machine_id,shift' })
        if (assignInsErr) fail('Supervisor create assignment', assignInsErr.message)
        else pass('Supervisor created assignment')
    }

    // ═══════════════ RESULTS ═══════════════
    console.log('\n═══════════════════════════════════════════')
    console.log(`  RESULTS: ${results.pass} passed, ${results.fail} failed`)
    console.log('═══════════════════════════════════════════')
    if (results.issues.length > 0) {
        console.log('\n🔴 ISSUES FOUND:')
        results.issues.forEach((issue, i) => {
            console.log(`  ${i + 1}. ${issue.msg}: ${issue.detail}`)
        })
    }

    // Cleanup test data 
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    await admin.from('production_logs').delete().eq('date', today)
    await admin.from('workers').delete().eq('name', 'Test Worker')
    await admin.from('workers').delete().eq('name', 'Deepesh Yadav')
    await admin.from('workers').delete().eq('name', 'Vikram Mehta')
    await admin.from('fixed_workers').delete().eq('name', 'Test Fixed')
    await admin.from('fixed_workers').delete().eq('name', 'Priya Devi')
    await admin.from('machines').delete().eq('name', 'Test Loom')
    await admin.from('attendance').delete().eq('date', today)
    console.log('\n🧹 Test data cleaned up.')
}

run().catch(console.error)
