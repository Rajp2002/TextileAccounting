import React from 'react'
import { createRoot } from 'react-dom/client'
import BaseProductionClient from '../../app/(dashboard)/owner/production/BaseProductionClient'
import { MonthlyOverheadCalculator } from '../../components/settings/monthly-overhead-calculator'
import { calculateBaseWorkerPayables } from '../../lib/base-production-core'
import { mergeBaseSalaryOverhead } from '../../lib/base-salary'
import { buildBasePayrollHistory } from '../../lib/base-payroll-history'
import { generateBasePayrollPdf } from '../../lib/generate-base-payroll-pdf'
import '../../app/globals.css'

const staff = { id:'11111111-1111-4111-8111-111111111111', name:'Meena Patel', role:'Supervisor', pay_type:'fixed_monthly', monthly_salary:30000, start_date:'2026-08-01', end_date:null, salary_effective_from:'2026-08-01', salary_history:[{effective_from:'2026-08-01',monthly_salary:30000}], rate_per_meter:0, shift_availability:'both', is_active:true }
const piece = { id:'22222222-2222-4222-8222-222222222222', name:'Ramesh', pay_type:'piece_rate', rate_per_meter:0, shift_availability:'both', is_active:true }
const data = { orgId:'fixture', today:'2026-08-31', factoryName:'Salary QA Factory', payrollPeriod:{start:'2026-08-01',end:'2026-08-31'}, workers:[staff,piece], costings:[],jobs:[],entries:[],machines:[],assignments:[],machineJobContexts:[],dailyBatches:[],batchRevisions:[],advances:[],settlements:[],settlementLines:[],allocations:[] }
data.payables = calculateBaseWorkerPayables({...data,periodEnd:data.today})
const view = new URLSearchParams(location.search).get('view') || 'operations'
const expenses = mergeBaseSalaryOverhead([{id:'rent',label:'Rent',category:'rent',monthlyAmount:10000,isPreset:true,isLocked:false,source:'manual'}],[staff],data.today)
window.generateSalaryPdf = async () => {
    const history = buildBasePayrollHistory([{id:'paid',worker_id:staff.id,worker_name_snapshot:staff.name,period_start:'2026-08-01',period_end:'2026-08-31',gross_pay:30000,advance_deducted:5000,net_payout:25000,payment_mode:'cash',paid_at:'2026-08-31T12:00:00Z'}],[{id:'line',settlement_id:'paid',worker_id:staff.id,production_date:'2026-08-01',shift:null,machine_id:null,machine_label:'Fixed salary',job_id:null,costing_label:'2026-08-01 to 2026-08-31 (31/31 days)',meters:0,worker_rate_snapshot:30000,gross_pay:30000,source_kind:'fixed_salary'}])[0]
    const result = await generateBasePayrollPdf(history,{factoryName:'Salary QA Factory'})
    return result.doc.output('datauristring')
}
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-6xl p-4"><p className="mb-4 text-sm">Isolated QA fixture · actions mocked · no production access</p>{view==='overhead' ? <MonthlyOverheadCalculator open onOpenChange={()=>{}} savedItems={expenses} salaryStaff={[{id:staff.id,name:staff.name,monthlySalary:30000}]} savedStandardProductionMetres={10000} currentOverheadPerMetre={4} onApply={async input=>{window.__overhead=input;return {success:true}}} /> : <BaseProductionClient initialData={data} view={view} />}</main>)
