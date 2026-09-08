export default function StockLoading() {
    return <div role="status" aria-label="Loading stock" className="animate-pulse space-y-5"><div className="h-9 w-48 rounded bg-muted" /><div className="h-28 rounded-xl bg-muted" /><div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map(id => <div key={id} className="h-40 rounded-xl bg-muted" />)}</div></div>
}
