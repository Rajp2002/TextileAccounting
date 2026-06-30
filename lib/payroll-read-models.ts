export type PieceRateWageLog = {
    meters: number | string | null
    worker_rate_snapshot: number | string | null
}

function toNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

export function calculatePieceRateGrossWages(logs: PieceRateWageLog[]): number {
    return logs.reduce((sum, log) => {
        const meters = Math.max(toNumber(log.meters), 0)
        const rate = Math.max(toNumber(log.worker_rate_snapshot), 0)
        return sum + meters * rate
    }, 0)
}
