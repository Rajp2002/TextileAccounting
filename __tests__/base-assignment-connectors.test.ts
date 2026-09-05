import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildWorkerColorMap, DEFAULT_PALETTE, getWorkerPalette, WORKER_PALETTES } from '../app/(dashboard)/owner/production/worker-colors'

describe('BaseAssignmentWorkspace connector color styling', () => {
    function read(relPath: string) {
        return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
    }

    it('provides an expanded palette of 50 distinct matte textile colors', () => {
        expect(WORKER_PALETTES).toHaveLength(50)

        // First 10 maintain our signature hand-curated palette
        expect(WORKER_PALETTES[0].name).toBe('Dusty Saffron')
        expect(WORKER_PALETTES[0].bg).toBe('#F9DFC8')
        expect(WORKER_PALETTES[0].text).toBe('#A94713')
        expect(WORKER_PALETTES[0].stroke).toBe('rgb(224 122 47 / 0.62)')

        expect(WORKER_PALETTES[1].name).toBe('Slate Denim')
        expect(WORKER_PALETTES[2].name).toBe('Muted Sage')
        expect(WORKER_PALETTES[3].name).toBe('Heather Mulberry')
        expect(WORKER_PALETTES[4].name).toBe('Golden Ochre')

        // All 50 palettes have valid properties matching the matte aesthetic
        for (const palette of WORKER_PALETTES) {
            expect(palette.name).toBeTruthy()
            expect(palette.stroke).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.62\)$/)
            expect(palette.strokeActive).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.95\)$/)
            expect(palette.bg).toMatch(/^#[0-9A-F]{6}$/)
            expect(palette.border).toMatch(/^#[0-9A-F]{6}$/)
            expect(palette.text).toMatch(/^#[0-9A-F]{6}$/)
        }

        // Palette wrapping handles arbitrary worker counts
        expect(getWorkerPalette(0)).toBe(WORKER_PALETTES[0])
        expect(getWorkerPalette(49)).toBe(WORKER_PALETTES[49])
        expect(getWorkerPalette(50)).toBe(WORKER_PALETTES[0])
        expect(getWorkerPalette(51)).toBe(WORKER_PALETTES[1])
        expect(getWorkerPalette(-1)).toBe(DEFAULT_PALETTE)
    })

    it('assigns maximally separated high-contrast colors so no two workers look the same', () => {
        // Test with 3 sample workers from the factory: deep, Ramesh, ramu
        const sampleWorkers = [
            { id: 'w1', name: 'deep' },
            { id: 'w2', name: 'Ramesh' },
            { id: 'w3', name: 'ramu' },
        ]
        const colorMap3 = buildWorkerColorMap(sampleWorkers)
        expect(colorMap3.size).toBe(3)

        // Worker 0 is Orange, Worker 1 is Blue, Worker 2 is Green
        expect(colorMap3.get('w1')?.name).toBe('Dusty Saffron') // Orange
        expect(colorMap3.get('w2')?.name).toBe('Slate Denim')   // Blue
        expect(colorMap3.get('w3')?.name).toBe('Muted Sage')     // Green

        const colors3 = sampleWorkers.map(w => colorMap3.get(w.id)?.stroke)
        const uniqueColors3 = new Set(colors3)
        expect(uniqueColors3.size).toBe(3)

        // Test with 50 workers — guarantees 0 collisions across all 50 workers
        const workers50 = Array.from({ length: 50 }, (_, i) => ({ id: `worker-${i}`, name: `Worker ${i}` }))
        const colorMap50 = buildWorkerColorMap(workers50)
        expect(colorMap50.size).toBe(50)

        const colors50 = workers50.map(w => colorMap50.get(w.id)?.stroke)
        const uniqueColors50 = new Set(colors50)
        expect(uniqueColors50.size).toBe(50)

        // Stability: same workers produce identical color assignments
        const colorMapRepeat = buildWorkerColorMap(workers50)
        for (const worker of workers50) {
            expect(colorMapRepeat.get(worker.id)).toBe(colorMap50.get(worker.id))
        }
    })

    it('applies worker color palette in BaseAssignmentWorkspace', () => {
        const fileContent = read('app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx')

        // Imports buildWorkerColorMap from worker-colors
        expect(fileContent).toContain("from './worker-colors'")
        expect(fileContent).toContain('buildWorkerColorMap(initialData.workers)')

        // SVG paths use palette stroke
        expect(fileContent).toContain('stroke={isHighlighted ? palette.strokeActive : palette.stroke}')
        expect(fileContent).toContain('stroke={(workerColorMap.get(draggingWorkerId) ?? DEFAULT_PALETTE).strokeActive}')

        // Worker handle uses palette
        expect(fileContent).toContain('data-worker-handle={worker.id}')
        expect(fileContent).toContain('borderColor: palette.border')
        expect(fileContent).toContain('backgroundColor: palette.bg')
        expect(fileContent).toContain('color: palette.text')

        // Machine handle when assigned reflects workerPalette
        expect(fileContent).toContain('data-machine-handle={machine.id}')
        expect(fileContent).toContain('workerPalette && hasActiveJob')

        // Legend caption updated
        expect(fileContent).toContain('Connectors are color-coded by worker and use separate curved lanes to keep assignments easy to trace.')
    })
})
