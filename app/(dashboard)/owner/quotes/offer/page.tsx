import { getEstimatorQuotes, getEstimatorTemplates } from '../../estimator/actions'
import { findOfferCandidate, listOfferCandidates, type OfferCandidateRecord, type OfferCandidateTemplate } from '@/lib/offer-check'
import { getOfferBase } from './actions'
import OfferCheckClient from './OfferCheckClient'

/**
 * Check a trader's offer against a saved costing. The Saved Costings cards link
 * here with `?costing=<id>`; without it the owner picks the quality.
 */
export default async function OfferCheckPage(props: { searchParams: Promise<{ costing?: string }> }) {
    const searchParams = await props.searchParams
    const [quotes, templates] = await Promise.all([
        getEstimatorQuotes(),
        getEstimatorTemplates({ includeArchived: true, summary: true }),
    ])
    const loadError = Boolean(quotes.error || templates.error)
    const candidates = loadError
        ? []
        : listOfferCandidates((quotes.data ?? []) as unknown as OfferCandidateRecord[], (templates.data ?? []) as unknown as OfferCandidateTemplate[])
    // A link names one costing; a library with a single quality has nothing to choose.
    const initial = findOfferCandidate(candidates, searchParams.costing) ?? (candidates.length === 1 ? candidates[0] : null)
    const initialBase = initial?.checkable ? await getOfferBase(initial.latestId) : null

    return (
        <OfferCheckClient
            candidates={candidates}
            loadError={loadError}
            initialKey={initial?.key ?? null}
            initialBase={initialBase && 'data' in initialBase ? initialBase.data : null}
        />
    )
}
