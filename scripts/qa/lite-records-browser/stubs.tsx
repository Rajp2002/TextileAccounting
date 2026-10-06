import React from 'react'
type FixtureControl = { calls: Array<{ name: string; payload: unknown }>; mode: string; delay: number; rates: Record<string, unknown>[]; quotes: Record<string, unknown>[] }
function control() { return Reflect.get(window, '__liteRecords') as FixtureControl }
async function request(name: string, payload: unknown) {
  const fixture = control()
  fixture.calls.push({ name, payload: structuredClone(payload) })
  await new Promise(resolve => setTimeout(resolve, fixture.delay))
  if (fixture.mode === 'throw') throw new Error('Synthetic uncertain response. Refresh and review before trying again.')
  return fixture.mode === 'reject' ? 'Synthetic request rejected. Try again.' : null
}
export function usePathname() { return location.pathname }
export function useSearchParams() { return new URL(location.href).searchParams }
export function useRouter() { return { push: (href: string) => { Reflect.set(window, '__liteNavigation', href) }, refresh: () => { Reflect.set(window, '__liteRefresh', true) }, replace: (href: string) => { Reflect.set(window, '__liteNavigation', href) } } }
export default function Link({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) { return <a href={href} {...props}>{children}</a> }
export async function recordTourEventAction() { return { success: true } }
export async function trackPlanEvent() { return true }
export async function getEstimatorQuoteDetail(id: string) { const error = await request('detail', id); return error ? { error } : { data: control().quotes.find(quote => quote.id === id) } }
export async function auditHistoricalCostingSnapshot(id: string) { const error = await request('audit', id); return error ? { error } : { data: control().quotes.find(quote => quote.id === id) } }
export async function updateSavedCostingLibraryState(payload: { id: string; isArchived?: boolean; isFavorite?: boolean }) { const error = await request('library', payload); return error ? { error } : { data: { is_archived: payload.isArchived, is_favorite: payload.isFavorite, updated_at: '2026-10-06T12:00:00Z' } } }
export async function updateQuotationDocumentMetadata(payload: unknown) { const error = await request('document', payload); return error ? { error } : { data: { updated_at: '2026-10-06T12:00:00Z' } } }
export async function getCostRateUsage() { return { data: control().rates, conflicts: [], yarnReviewIntervalDays: 90 } }
export async function getCostRateHistory(id: string) { const error = await request('history', id); return error ? { error } : { data: [{ id: 'synthetic-history', value: 180, previous_value: 175, event_type: 'changed', effective_date: '2026-10-01', source: 'Synthetic supplier', notes: null, created_at: '2026-10-01T10:00:00Z', changed_by: 'synthetic', actor_name: 'Synthetic owner', actor_role: 'owner' }] } }
export async function saveCostRate(payload: Record<string, unknown>) { const error = await request('rate-save', payload); return error ? { error } : { data: { ...control().rates.find(rate => rate.id === payload.id), id: payload.id ?? 'new-synthetic-rate', name: payload.name, category: payload.category, unit: 'per_kg', current_value: payload.currentValue, effective_date: payload.effectiveDate, source: payload.source, last_reviewed_at: payload.lastReviewedAt, review_interval_days: payload.reviewIntervalDays, updated_at: '2026-10-06T12:00:00Z', is_active: true, is_reviewed: true } } }
export async function confirmCostRateReview(id: string, expectedUpdatedAt: string) { const error = await request('rate-review', { id, expectedUpdatedAt }); return error ? { error } : { data: { ...control().rates.find(rate => rate.id === id), is_reviewed: true, last_reviewed_at: '2026-10-06', updated_at: '2026-10-06T12:00:00Z' } } }
export async function confirmAllCostRateReviews(payload: Array<{ id: string; expectedUpdatedAt: string }>) { const error = await request('rate-review-all', payload); return error ? { error } : { data: payload.map(({ id }) => ({ ...control().rates.find(rate => rate.id === id), is_reviewed: true, last_reviewed_at: '2026-10-06', updated_at: '2026-10-06T12:00:00Z' })), count: payload.length } }
export async function archiveCostRate(id: string, expectedUpdatedAt: string) { const error = await request('rate-archive', { id, expectedUpdatedAt }); return error ? { error } : { data: { updated_at: '2026-10-06T12:00:00Z' } } }
export async function restoreCostRate(id: string, expectedUpdatedAt: string) { const error = await request('rate-restore', { id, expectedUpdatedAt }); return error ? { error } : { data: { ...control().rates.find(rate => rate.id === id), is_active: true, updated_at: '2026-10-06T12:00:00Z' } } }
export async function deleteCostRate(id: string, expectedUpdatedAt: string) { const error = await request('rate-delete', { id, expectedUpdatedAt }); return error ? { error } : { success: true } }
