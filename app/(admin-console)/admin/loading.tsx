export default function FounderLoading() {
    return <div role="status" aria-live="polite" className="rounded-xl border border-hairline bg-surface p-6"><p className="text-sm font-medium text-ink">Loading the latest records…</p><p className="mt-2 text-xs text-subtle">Checking the source before showing a snapshot.</p><div aria-hidden="true" className="mt-6 space-y-4"><div className="h-4 w-1/3 rounded bg-surface-soft"/><div className="h-4 w-2/3 rounded bg-surface-soft"/><div className="h-4 w-1/2 rounded bg-surface-soft"/></div></div>
}
