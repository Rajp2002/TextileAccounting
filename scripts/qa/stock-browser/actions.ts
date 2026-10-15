// Only Vite's local harness substitutes this module. Production imports real server actions.
import type { LegacyMovement, LegacyMutation } from '../../../lib/legacy-stock'
import type { QualityStockBoard, StockAdjustmentInput, StockCursor } from '../../../lib/quality-stock'
async function request(path: string, body: unknown) {
    const response = await fetch(`/local-stock/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error('Local test connection failed')
    return response.json()
}
export async function getQualityStockBoard(input: { qualityId?: string; cursor?: StockCursor } = {}): Promise<{data: QualityStockBoard} | {error: string}> { return request('read', input) }
export async function recordQualityStockAdjustment(input: StockAdjustmentInput): Promise<{success: true; duplicate: boolean} | {error: string; errorKey: string}> { return request('adjust', input) }

export async function getLegacyStockHistory(qualityId: string): Promise<{ data: LegacyMovement[] } | { error: string }> { return request('legacy-history', { qualityId }) }
export async function findOnboardedTakas(qualityId: string, lots: string[]): Promise<{ data: { lot: string; at: string }[] } | { error: string }> { return request('legacy-takas', { qualityId, lots }) }
export async function mutateLegacyStock(input: LegacyMutation): Promise<{ success: true; duplicate: boolean } | { error: string; errorKey: string; uncertain?: boolean }> { return request('legacy-mutate', input) }
