import { z } from 'zod'
import type { BaseDailyProductionStatus } from './base-production-core'

export const machineRecordSchema = z.object({
    machine_id: z.string().uuid(),
    worker_id: z.string().uuid(),
    machine_label: z.string(),
    job_id: z.string().uuid().nullable(),
    job_label: z.string().nullable(),
    state: z.enum(['entered', 'pending', 'not_running', 'absent']),
})
export type BaseMachineRecord = z.infer<typeof machineRecordSchema>

export function readMachineRecords(value: unknown): BaseMachineRecord[] {
    const result = z.array(machineRecordSchema).safeParse(value)
    return result.success ? result.data : []
}

export function compareMachineLabels(a: { machineLabel: string; machineId: string }, b: { machineLabel: string; machineId: string }) {
    return a.machineLabel.localeCompare(b.machineLabel, 'en', { numeric: true, sensitivity: 'base' }) || a.machineId.localeCompare(b.machineId)
}

// Machines with a worker for the shift come first; machines still waiting for one follow.
// Within each group the order is compareMachineLabels: numbered labels 1..N, then A-Z.
export function compareMachineSheetOrder(a: { machineLabel: string; machineId: string; workerId: string | null }, b: { machineLabel: string; machineId: string; workerId: string | null }) {
    return Number(Boolean(b.workerId)) - Number(Boolean(a.workerId)) || compareMachineLabels(a, b)
}

// Empty means unknown. Only an explicit zero means the machine did not run.
export function machineReadingState(value: string | undefined, workerStatus: BaseDailyProductionStatus): BaseMachineRecord['state'] | 'invalid' {
    if (workerStatus === 'absent') return 'absent'
    if (!value?.trim()) return 'pending'
    if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return 'invalid'
    const meters = Number(value)
    if (!Number.isFinite(meters) || meters > 100_000) return 'invalid'
    return meters === 0 ? 'not_running' : 'entered'
}

// A saved shift protects the readings it recorded. A pending reading was never recorded, so it stays open to complete.
// A shift saved before the register existed has no per-machine states, so every reading in it stays protected.
export function isSavedMachineReadingProtected(savedState: BaseMachineRecord['state'] | undefined, hasRegister: boolean) {
    if (!hasRegister) return true
    return savedState !== undefined && savedState !== 'pending'
}

export function machineWorkerStatus(values: string[]): BaseDailyProductionStatus {
    if (values.some(value => machineReadingState(value, 'blank') === 'entered' || machineReadingState(value, 'blank') === 'invalid')) return 'entered'
    if (values.some(value => machineReadingState(value, 'blank') === 'not_running')) return 'zero'
    return 'blank'
}

export function summarizeMachineRegister(states: Array<ReturnType<typeof machineReadingState>>) {
    const pending = states.filter(state => state === 'pending').length
    const invalid = states.filter(state => state === 'invalid').length
    return { total: states.length, accounted: states.length - pending - invalid, pending, invalid, stopped: states.filter(state => state === 'not_running').length }
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function buildMachineCollectionSheet(input: {
    factory: string; date: string; shift: string;
    machines: Array<{ machineLabel: string; workerName: string | null; jobLabel: string | null }>;
}) {
    const rows = input.machines.map((machine, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(machine.machineLabel)}</td><td>${escapeHtml(machine.workerName ?? 'Unassigned')}</td><td>${escapeHtml(machine.jobLabel ?? 'Unassigned')}</td><td></td><td></td></tr>`).join('')
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Production collection sheet</title><style>
    @page{size:A4 portrait;margin:12mm}body{font:14px Arial,sans-serif;color:#111;margin:0}h1{font-size:22px;margin-bottom:8px}p{line-height:1.5}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #777;padding:8px;text-align:left;overflow-wrap:anywhere}th{font-size:12px;background:#eee}td{height:30px}thead{display:table-header-group}tr{break-inside:avoid}button{margin:12px 0;padding:10px 16px}@media print{button{display:none}}
    </style></head><body><h1>${escapeHtml(input.factory)} · Production collection sheet</h1><p>${escapeHtml(input.date)} · ${escapeHtml(input.shift)} shift<br>Supervisor: ____________________</p><p>Write metres produced during this shift (not the cumulative counter). Write 0 if the machine did not run. Leave unknown readings blank. Note worker or job changes.</p><button type="button" id="print-sheet">Print collection sheet</button><table><thead><tr><th style="width:5%">#</th><th style="width:18%">Machine</th><th style="width:16%">Worker</th><th style="width:17%">Job</th><th style="width:17%">Production (m)</th><th>Notes / changes</th></tr></thead><tbody>${rows}</tbody></table><p>Total metres: ____________________ &nbsp; Collected at: ____________________</p></body></html>`
}
