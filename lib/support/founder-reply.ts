// The founder screen answers with one reply box: Send keeps the ticket open for the
// customer, Send and resolve closes it. Ticket-state fields are fixed here, not chosen.
export const FOUNDER_SEND = { status: 'in_progress', nextAction: 'Wait for the customer' } as const
export const FOUNDER_RESOLVE = { status: 'resolved', nextAction: 'Resolved', resolutionCode: 'explained_behavior' } as const

export function founderReplyPayload(input: { body: string; resolve: boolean; ticket: { version: number; nextUpdateDueAt: string | null }; clientRequestId: string }): Record<string, unknown> {
    return {
        body: input.body,
        expectedVersion: input.ticket.version,
        clientRequestId: input.clientRequestId,
        ...(input.resolve ? { ...FOUNDER_RESOLVE, resolutionSummary: input.body } : FOUNDER_SEND),
        nextUpdateDueAt: null,
        followUpDueAt: null,
        externalReference: null,
        // A ticket still carrying an AD05 promised-update date must fulfil it with this public reply.
        promiseFulfilled: input.ticket.nextUpdateDueAt !== null,
    }
}

export const founderTabs = ['needs_reply', 'answered', 'resolved'] as const
export type FounderTab = typeof founderTabs[number]
export const founderTabLabels: Record<FounderTab, string> = { needs_reply: 'Needs reply', answered: 'Answered', resolved: 'Resolved' }

export function founderTabQuery(tab: FounderTab): Record<string, string> {
    return tab === 'resolved' ? { queue: 'all', status: 'resolved' } : { queue: tab }
}

export function founderTabFromQuery(queue: string | null): FounderTab {
    return queue === 'answered' || queue === 'resolved' ? queue : 'needs_reply'
}
