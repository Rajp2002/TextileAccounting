import 'server-only'
import { createHash } from 'node:crypto'
import type { FounderCandidate } from './founder'

export function founderCandidateTag(candidate: FounderCandidate) {
    return createHash('sha256').update(`founder-challenge:${candidate.userId}:${candidate.sessionId}`).digest('hex')
}
