'use client'

import type { CostingRecordKind } from '@/lib/costing-workspace'
import { COSTING_CALCULATION_VERSION } from './estimator'

export type EstimatorQuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected'

export const ESTIMATOR_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const ESTIMATOR_DRAFT_SCHEMA_VERSION = 1
export const ESTIMATOR_DRAFT_ESTIMATOR_VERSION = COSTING_CALCULATION_VERSION
export const ESTIMATOR_DRAFT_DIAGNOSTIC_EVENT = 'weavly:estimator-draft-diagnostic'

const ESTIMATOR_CLIENT_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DRAFT_ID_PATTERN = /^[a-z0-9:_-]{1,128}$/i

/**
 * The persisted shape deliberately contains only estimator inputs and safe
 * recovery metadata. It never contains an auth token, cookie, or secret.
 */
export interface EstimatorAutosaveData<TState = unknown> {
  state: TState
  partyName: string
  qualityLabel: string
  warpInstruction: string
  weftInstruction: string
  schemaVersion: number
  estimatorVersion: string
  draftId: string
  /** The first time this draft was written. It remains stable across edits. */
  createdAt: number
  /** The most recent successful browser-storage write. */
  savedAt: number
  /** A per-tab writer identity used only to resolve same-time tab writes. */
  writerId: string
  /** A monotonic sequence within the shared browser draft key. */
  writeSequence: number
  sourceQuoteId?: string
  sourceQuoteUpdatedAt?: string
  sourceQuoteVersionNumber?: number
  sourceQuoteCreatedAt?: string
  /** Status and inputs of the quotation being reopened, when editing in place. */
  sourceQuoteStatus?: EstimatorQuoteStatus
  sourceState?: TState
  sourceFactoryProfileUpdatedAt?: string
  sourceRecordKind?: CostingRecordKind
  templateId?: string
  /**
   * Stable identity for a quote save/update attempt. Keeping it with the
   * local draft makes a retry idempotent even if the server committed but its
   * response was lost before the browser received it.
   */
  clientRequestId?: string
  /**
   * Marks a draft written by an explicit Saved Cost Estimate action.
   * Generic background autosaves stay opt-in so they still require the
   * existing recovery confirmation on the Estimator screen.
   */
  restoreOnEstimatorEntry?: boolean
}

export type EstimatorDraftInput<TState = unknown> = Omit<
  EstimatorAutosaveData<TState>,
  | 'schemaVersion'
  | 'estimatorVersion'
  | 'draftId'
  | 'createdAt'
  | 'savedAt'
  | 'writerId'
  | 'writeSequence'
>

export type EstimatorDraftStorageFailure = 'read' | 'write' | 'remove'

export type EstimatorDraftDiagnostic = {
  event: 'read' | 'write' | 'remove' | 'invalid_payload' | 'external_update' | 'external_clear'
  reason?: 'storage_unavailable' | 'malformed_or_outdated' | 'stale' | 'replaced'
  schemaVersion: number
  estimatorVersion: string
}

export function getEstimatorDraftStorageKey(orgId: string, userId: string): string {
  return `weavly-estimator-draft-${orgId}-${userId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function normalizeDraftId(value: unknown, savedAt: number) {
  return typeof value === 'string' && DRAFT_ID_PATTERN.test(value)
    ? value
    : `legacy-${savedAt}`
}

function normalizeWriterId(value: unknown) {
  return typeof value === 'string' && DRAFT_ID_PATTERN.test(value)
    ? value
    : 'legacy'
}

function normalizeWriteSequence(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0
}

/**
 * Emit only bounded, non-business metadata. In production the event can be
 * observed by application diagnostics without putting party names, rates, or
 * estimator state into the console or telemetry payload.
 */
export function reportEstimatorDraftDiagnostic(diagnostic: EstimatorDraftDiagnostic) {
  const safeDetail = {
    feature: 'estimator_draft',
    ...diagnostic,
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[estimator-draft]', safeDetail)
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(ESTIMATOR_DRAFT_DIAGNOSTIC_EVENT, { detail: safeDetail }))
    } catch {
      // Diagnostics must never affect recovery.
    }
  }
}

export function createEstimatorDraft<TState>(
  input: EstimatorDraftInput<TState>,
  options: Partial<Pick<EstimatorAutosaveData<TState>, 'draftId' | 'createdAt' | 'savedAt' | 'writerId' | 'writeSequence'>> = {},
): EstimatorAutosaveData<TState> {
  const now = options.savedAt ?? Date.now()
  const createdAt = options.createdAt ?? now

  return {
    ...input,
    schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
    estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
    draftId: options.draftId ?? createEstimatorDraftId(),
    createdAt,
    savedAt: now,
    writerId: options.writerId ?? 'external',
    writeSequence: options.writeSequence ?? 1,
  }
}

export function createEstimatorDraftId() {
  try {
    const randomUuid = globalThis.crypto?.randomUUID
    if (typeof randomUuid === 'function') return `draft-${randomUuid()}`
  } catch {
    // Fall through to the non-secret best-effort fallback.
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Parse and validate a browser draft without throwing. Missing metadata is
 * treated as a legacy pre-versioned draft for one migration window; an
 * explicitly supplied old schema/calculation version is rejected.
 */
export function parseEstimatorDraft<TState = unknown>(
  raw: string | null,
  nowMs = Date.now(),
  maxAgeMs = ESTIMATOR_DRAFT_MAX_AGE_MS,
  validateState?: (state: unknown) => state is TState,
): EstimatorAutosaveData<TState> | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<EstimatorAutosaveData<TState>>
    if (!isRecord(parsed)) return null

    const schemaVersion = parsed.schemaVersion === undefined
      ? ESTIMATOR_DRAFT_SCHEMA_VERSION
      : parsed.schemaVersion
    const estimatorVersion = parsed.estimatorVersion === undefined
      ? ESTIMATOR_DRAFT_ESTIMATOR_VERSION
      : parsed.estimatorVersion
    if (schemaVersion !== ESTIMATOR_DRAFT_SCHEMA_VERSION) return null
    if (estimatorVersion !== ESTIMATOR_DRAFT_ESTIMATOR_VERSION) return null
    if (!isFiniteTimestamp(parsed.savedAt)) return null
    if (nowMs - Number(parsed.savedAt) > maxAgeMs || nowMs - Number(parsed.savedAt) < -maxAgeMs) return null
    if (!('state' in parsed) || !isRecord(parsed.state)) return null
    if (validateState && !validateState(parsed.state)) return null

    const savedAt = Number(parsed.savedAt)
    const createdAt = isFiniteTimestamp(parsed.createdAt) ? Number(parsed.createdAt) : savedAt
    if (createdAt > savedAt) return null

    return {
      state: parsed.state as TState,
      partyName: typeof parsed.partyName === 'string' ? parsed.partyName : '',
      qualityLabel: typeof parsed.qualityLabel === 'string' ? parsed.qualityLabel : '',
      warpInstruction: typeof parsed.warpInstruction === 'string' ? parsed.warpInstruction : '',
      weftInstruction: typeof parsed.weftInstruction === 'string' ? parsed.weftInstruction : '',
      schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
      estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
      draftId: normalizeDraftId(parsed.draftId, savedAt),
      createdAt,
      savedAt,
      writerId: normalizeWriterId(parsed.writerId),
      writeSequence: normalizeWriteSequence(parsed.writeSequence),
      sourceQuoteId: typeof parsed.sourceQuoteId === 'string' ? parsed.sourceQuoteId : undefined,
      sourceQuoteUpdatedAt: typeof parsed.sourceQuoteUpdatedAt === 'string' ? parsed.sourceQuoteUpdatedAt : undefined,
      sourceQuoteVersionNumber: Number.isFinite(parsed.sourceQuoteVersionNumber)
        ? Number(parsed.sourceQuoteVersionNumber)
        : undefined,
      sourceQuoteCreatedAt: typeof parsed.sourceQuoteCreatedAt === 'string' ? parsed.sourceQuoteCreatedAt : undefined,
      sourceQuoteStatus: parsed.sourceQuoteStatus === 'draft'
        || parsed.sourceQuoteStatus === 'sent'
        || parsed.sourceQuoteStatus === 'accepted'
        || parsed.sourceQuoteStatus === 'rejected'
        ? parsed.sourceQuoteStatus
        : undefined,
      sourceState: isRecord(parsed.sourceState) ? parsed.sourceState as TState : undefined,
      sourceFactoryProfileUpdatedAt: typeof parsed.sourceFactoryProfileUpdatedAt === 'string' ? parsed.sourceFactoryProfileUpdatedAt : undefined,
      sourceRecordKind: parsed.sourceRecordKind === 'costing' || parsed.sourceRecordKind === 'quotation' || parsed.sourceRecordKind === 'market_run'
        ? parsed.sourceRecordKind
        : undefined,
      templateId: typeof parsed.templateId === 'string' ? parsed.templateId : undefined,
      clientRequestId:
        typeof parsed.clientRequestId === 'string' &&
        ESTIMATOR_CLIENT_REQUEST_ID_PATTERN.test(parsed.clientRequestId)
          ? parsed.clientRequestId
          : undefined,
      restoreOnEstimatorEntry: parsed.restoreOnEstimatorEntry === true ? true : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Deterministic ordering for the shared localStorage key. Sequence is the
 * primary clock; timestamp and writer id break ties across tabs that write in
 * the same event loop turn.
 */
export function compareEstimatorDrafts<TState>(
  left: EstimatorAutosaveData<TState>,
  right: EstimatorAutosaveData<TState>,
) {
  if (left.writeSequence !== right.writeSequence) return left.writeSequence - right.writeSequence
  if (left.savedAt !== right.savedAt) return left.savedAt - right.savedAt
  return left.writerId.localeCompare(right.writerId)
}

export function shouldWarnBeforeQuoteRestore<TState>(
  existingDraft: EstimatorAutosaveData<TState> | null,
  sourceQuoteId: string
): boolean {
  return Boolean(existingDraft && existingDraft.sourceQuoteId !== sourceQuoteId)
}

export function shouldAutoRestoreEstimatorDraft<TState>(
  draft: EstimatorAutosaveData<TState> | null
): boolean {
  return Boolean(draft && (draft.restoreOnEstimatorEntry || draft.sourceQuoteId))
}
