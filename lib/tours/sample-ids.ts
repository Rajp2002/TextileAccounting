export function isSampleRecordId(id: string | null | undefined): boolean {
    return typeof id === 'string' && (id.startsWith('tour-') || id === 'demo-sample-yarn-rate')
}
