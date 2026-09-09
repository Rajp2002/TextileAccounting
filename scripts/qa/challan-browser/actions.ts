import type {
    Challan,
    ChallanEvent,
    ChallanMutation,
} from '../../../lib/delivery-challans'
export async function request(path: string, body: unknown = {}) {
    return (
        await fetch(`/local-challan/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
    ).json()
}
export async function listChallans(
    history = false,
    search = '',
    offset = 0,
): Promise<{ data?: Challan[]; error?: string }> {
    return request('list', { history, search, offset })
}
export async function getChallan(
    id: string,
): Promise<{ data?: Challan; events?: ChallanEvent[]; error?: string }> {
    return request('get', { id })
}
export async function mutateChallan(
    input: ChallanMutation,
): Promise<
    { success: true; id: string } | { error: string; uncertain?: boolean }
> {
    return request('mutate', input)
}
