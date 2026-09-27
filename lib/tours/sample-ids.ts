export function isSampleRecordId(id: string | null | undefined): boolean { return Boolean(id?.startsWith('tour-') || id === 'demo-sample-yarn-rate') }
