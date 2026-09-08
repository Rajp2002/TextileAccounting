// Only Vite's local harness substitutes this module. Production imports real server actions.
import type { QualityStockBoard, StockAdjustmentInput, StockCursor } from '../../../lib/quality-stock'
async function request(path: string, body: unknown) {
    const response = await fetch(`/local-stock/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error('Local test connection failed')
    return response.json()
}
export async function getQualityStockBoard(input: { qualityId?: string; cursor?: StockCursor } = {}): Promise<{data: QualityStockBoard} | {error: string}> { return request('read', input) }
export async function recordQualityStockAdjustment(input: StockAdjustmentInput): Promise<{success: true; duplicate: boolean} | {error: string; errorKey: string}> { return request('adjust', input) }
