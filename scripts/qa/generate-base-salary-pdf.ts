import { writeFileSync } from 'node:fs'
import { buildBasePayrollHistory } from '../../lib/base-payroll-history'
import { generateBasePayrollPdf } from '../../lib/generate-base-payroll-pdf'

async function main() {
    const period = buildBasePayrollHistory([{ id: 'paid', worker_id: 'staff', worker_name_snapshot: 'Meena Patel', period_start: '2026-08-01', period_end: '2026-08-31', gross_pay: 30000, advance_deducted: 5000, net_payout: 25000, advance_balance_before: 5000, remaining_advance_balance: 0, payment_mode: 'cash', paid_at: '2026-08-31T12:00:00Z' }], [{ id: 'line', settlement_id: 'paid', worker_id: 'staff', production_date: '2026-08-01', shift: null, machine_id: null, machine_label: 'Fixed salary', job_id: null, costing_label: '2026-08-01 to 2026-08-31 (31/31 days)', meters: 0, worker_rate_snapshot: 30000, gross_pay: 30000, source_kind: 'fixed_salary' }])[0]
    const { blob } = await generateBasePayrollPdf(period, { factoryName: 'Salary QA Factory' })
    const target = process.argv[2]
    if (!target) throw new Error('Pass an output PDF path.')
    writeFileSync(target, Buffer.from(await blob.arrayBuffer()))
    console.log(target)
}
void main()
