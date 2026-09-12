import type { YarnBoard, YarnFilter, YarnMutation } from '../../../lib/yarn-stock'
async function request(path: string, input: unknown) {
    const response = await fetch(`/local-yarn/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    return response.json()
}
export async function getYarnStockBoard(input: YarnFilter = {}): Promise<{ data: YarnBoard } | { error: string }> { return request('read', input) }
export async function mutateYarnStock(input: YarnMutation): Promise<{ success: true } | { error: string; uncertain: boolean }> { return request('save', input) }
