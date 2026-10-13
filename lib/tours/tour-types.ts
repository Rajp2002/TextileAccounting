export type TourId = 'cost-estimate' | 'rate-book' | 'saved-costings' | 'configuration' | 'workers' | 'machines' | 'payroll' | 'production' | 'dispatch' | 'fabric-stock' | 'daily-sheet'

export type TourPresentation = 'invite' | 'replay'

export interface TourPreferenceRecord {
    firstShown?: string | boolean
    dismissed?: boolean
    firstStarted?: boolean
    completed?: boolean
    completedVersion?: string
    version?: string
}

export type AllTourPreferences = Partial<Record<TourId, TourPreferenceRecord>>

export interface TourDefinition {
    id: TourId
    contentVersion: string
    invitationPolicyVersion: string
    allowedPlans: ('free' | 'lite' | 'base')[]
    allowedRoles: string[]
    copyKeys: {
        benefit: string
        replayTitle: string
    }
}

export interface TourStepSpec<S extends string = string> {
    id: S
    anchor: string
    context?: string
    kind: 'live' | 'sample' | 'handoff'
    detail?: boolean
}
