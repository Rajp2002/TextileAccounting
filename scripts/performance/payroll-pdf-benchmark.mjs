// Local PDF first/repeat-use CPU proxy. No downloads, backend or user data.
// This measures Node's jsPDF build, NOT browser chunk transfer or click latency.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cpus } from 'node:os'
import assert from 'node:assert/strict'
import ts from 'typescript'

if (process.argv[2] === '--sample') {
    const workers = Array.from({ length: Number(process.argv[4]) }, (_, i) => ({
        settlementId: `settlement-${i}`, workerId: `worker-${i}`, workerName: `Synthetic worker ${i}`,
        status: 'paid', grossPay: 500, advanceBalanceBefore: 100, advanceRecovered: 100,
        remainingAdvanceBalance: 0, netPayout: 400, paymentMode: 'cash',
        paidAt: '2026-08-31T09:00:00.000Z', meters: 100,
        earnings: [{ machineId: 'loom-1', machineLabel: 'Synthetic loom', costingLabel: 'Synthetic quality',
            rate: 5, meters: 100, grossPay: 500, productionDates: ['2026-08-10'] }],
    }))
    const period = { key: '2026-08-01:2026-08-31', start: '2026-08-01', end: '2026-08-31', workers,
        machines: [], totalMeters: workers.length * 100, totalGrossPay: workers.length * 500,
        totalAdvanceRecovered: workers.length * 100, totalNetPayout: workers.length * 400,
        paymentModes: ['cash'], latestPaidAt: '2026-08-31T09:00:00.000Z' }
    const samples = []
    for (let i = 0; i < 2; i++) {
        const start = performance.now()
        const { generateBasePayrollPdf } = await import(pathToFileURL(process.argv[3]).href)
        const loaded = performance.now()
        const result = await generateBasePayrollPdf(period, { factoryName: 'Synthetic Factory' })
        const end = performance.now()
        assert.ok(result.doc.output().startsWith('%PDF-'))
        assert.equal(result.filename, 'Synthetic-Factory_Payroll_2026-08-01_to_2026-08-31.pdf')
        samples.push({ cache: i ? 'module-warm' : 'module-cold', importMs: loaded - start,
            generationMs: end - loaded, totalMs: end - start, bytes: result.blob.size, pages: result.doc.getNumberOfPages() })
    }
    console.log(JSON.stringify(samples))
} else {
    mkdirSync('tmp', { recursive: true })
    const directory = mkdtempSync(resolve('tmp/payroll-pdf-perf-'))
    try {
        const compiled = join(directory, 'generator.cjs')
        // Type erasure occurs once, outside all measurement processes/timings.
        writeFileSync(compiled, ts.transpileModule(readFileSync('lib/generate-base-payroll-pdf.ts', 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
        }).outputText)
        const results = []
        for (const workers of [1, 20, 100]) {
            const samples = Array.from({ length: 5 }, () => JSON.parse(execFileSync(process.execPath,
                [process.argv[1], '--sample', compiled, String(workers)], { encoding: 'utf8' })))
            const stats = values => {
                const sorted = values.sort((a, b) => a - b)
                return { min: sorted[0], median: sorted[2], max: sorted[4] }
            }
            results.push({ workers,
                firstTotalMs: stats(samples.map(pair => pair[0].totalMs)),
                repeatTotalMs: stats(samples.map(pair => pair[1].totalMs)), samples })
        }
        console.log(JSON.stringify({ node: process.version, cpu: cpus()[0].model,
            method: '5 fresh processes per fixture; actual generator and installed Node jsPDF; first import+generate then repeat; TS compilation excluded; autoSave false; not browser/network evidence', results }, null, 2))
    } finally { rmSync(directory, { recursive: true, force: true }) }
}
