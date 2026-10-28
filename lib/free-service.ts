import 'server-only'
import { cache } from 'react'
import { makeFreeDemo } from './free-estimator-defaults'
import { getCachedSession, getSessionHint } from './auth'
import { getOrgPlanAccess } from './subscription'
import { finishFreeProvisioning, getFreeGrant, getFreeRollout } from './free-account'
import { createAdminClient } from './supabase/admin'
import { freeQuotaWindow } from './free-tier-policy'
import { issueFreeRequest, verifyFreeRequest, bindFreeEffectiveInputs, resolveFreeSigningKeys } from './free-request-identity'
import { calcFullTotals, buildCostingResult, COSTING_CALCULATION_VERSION } from './estimator'
import { parseFreeEstimate, canonicalFreeInputs } from './free-estimator-input'
import { FREE_ESTIMATE_VALIDATION_OPTIONS, getEstimatorReadiness, validateEstimatorSnapshot } from './estimator-validation'
import { freeEditWindow } from './free-costing-window'
import type { SavedFreeCosting } from './free-costing-window'
import { checkAuthRateLimit } from './rate-limit'
import { startEarly } from './start-early'

/** The Free workspace's organization row. Request-scoped, so the Free layout can start it early. */
export const getFreeOrganization = cache(async (orgId: string) => (
  createAdminClient().from('organizations').select('owner_id,is_locked_down,name').eq('id',orgId).single()
))
function startFreeOrgReads(orgId: string) {
  const grant = startEarly(getFreeGrant(orgId))
  return {
    orgId,
    grant,
    organization: startEarly(getFreeOrganization(orgId)),
    access: startEarly(getOrgPlanAccess(orgId, grant)),
  }
}
export async function freeContext(options: { allowInactive?: boolean } = {}) {
  // The grant, organization and plan reads need only the org id. Proxy's
  // session hint lets them start while Auth verifies the session; they are
  // used only when the verified identity names the same user and org. The
  // promises are held here because route handlers have no request cache.
  const hint = await getSessionHint()
  const early = hint?.orgId ? startFreeOrgReads(hint.orgId) : null
  const session = await getCachedSession()
  if (!session || session.profile.role !== 'owner') throw new Error('FREE_AUTH_REQUIRED')
  const reads = early && hint?.userId === session.user.id && early.orgId === session.profile.org_id
    ? early : startFreeOrgReads(session.profile.org_id)
  const organizationRead = reads.organization
  const accessRead = reads.access
  // Each result is still checked in order.
  const grant = await reads.grant
  if (!grant && session.user.app_metadata.free_signup === true) {
    if (!await finishFreeProvisioning(session.user, session.profile.org_id)) throw new Error('FREE_PROVISIONING_PENDING')
    // Provisioning changes a previously cached null; read on next request.
    throw new Error('FREE_PROVISIONING_RETRY')
  }
  if (!grant) throw new Error('FREE_ACCESS_DENIED')
  const { data: org, error } = await organizationRead
  if (error || !org || org.owner_id !== session.user.id || org.owner_id !== grant.subjectId || org.is_locked_down) throw new Error('FREE_ACCESS_DENIED')
  const access = await accessRead
  const paid = access.effectiveTier === 'lite' || access.effectiveTier === 'base'
  if (!options.allowInactive && !paid && (access.effectiveTier !== 'free' || grant.state !== 'active')) throw new Error('FREE_ACCESS_INACTIVE')
  return { ...session, grant, paid, access, org }
}
function signing() {
  try {
    return resolveFreeSigningKeys({
      NODE_ENV: process.env.NODE_ENV,
      WEAVLY_FREE_SIGNING_KEY_ID: process.env.WEAVLY_FREE_SIGNING_KEY_ID,
      WEAVLY_FREE_SIGNING_KEYS: process.env.WEAVLY_FREE_SIGNING_KEYS,
    })
  } catch (error) {
    // Setting names only; never log key material.
    console.error('Free signing is unavailable: WEAVLY_FREE_SIGNING_KEYS must be a JSON object with a key of at least 32 bytes for WEAVLY_FREE_SIGNING_KEY_ID (default "launch").')
    throw error
  }
}
export async function freeStatus() {
  const admin = createAdminClient()
  // The rollout and the clock don't depend on the account, so they run with
  // the account reads. Errors still surface in the same order.
  const rolloutRead = startEarly(getFreeRollout())
  // Trusted database time, also used by the actual debit transaction.
  const clockRead = startEarly(Promise.resolve(admin.rpc('free_server_time')))
  const context = await freeContext({ allowInactive:true })
  const rollout = await rolloutRead
  const { data: clock, error: clockError } = await clockRead
  if ((clockError || !clock) && process.env.NODE_ENV === 'production') throw new Error('FREE_TEMPORARY_ERROR')
  const serverTime = clock && !clockError ? new Date(clock as string) : new Date()
  const window = freeQuotaWindow(serverTime)
  const subjectRead = startEarly(Promise.resolve(admin.from('free_account_subjects').select('tour_state').eq('id',context.grant.subjectId).maybeSingle()))
  const { data: usage, error } = await admin.from('free_monthly_usage').select('*').eq('subject_id', context.grant.subjectId).eq('period_start', window.start).maybeSingle()
  const { data: subject, error: subjectError } = await subjectRead
  if (error || (subjectError && subjectError.code !== 'PGRST116')) throw new Error('FREE_TEMPORARY_ERROR')
  const limit = usage?.allowance ?? rollout.policy.monthly_limit
  const used = usage?.used ?? 0
  const active = context.access.effectiveTier === 'free' && context.grant.state === 'active'
  const token = active && !context.paid && rollout.estimation_enabled ? issueFreeRequest({ subjectId:context.grant.subjectId, engineVersion:COSTING_CALCULATION_VERSION, ...signing(), serverTime, lifetimeMs:rollout.policy.receipt_retention_days*86400000 }) : null
  return {
    serverTime: serverTime.toISOString(), plan: context.access.effectiveTier, accessState:context.paid?'paid':active?'active':context.grant.state==='active'?'paid_expired':context.grant.state, estimationEnabled:active && rollout.estimation_enabled,
    tourEnabled:rollout.tour_enabled, tourState:subject?.tour_state ?? 'new', requestToken:token,
    quota: { used, limit, remaining:Math.max(0,limit-used), periodStart:window.start, resetsAt:window.end, policyVersion:usage?.policy_version ?? rollout.policy.version },
    demo: rollout.tour_enabled ? { productionCostPerM:buildCostingResult(makeFreeDemo(),calcFullTotals(makeFreeDemo())).productionCostPerM } : null,
    account: { id:context.user.id, name:context.profile.full_name ?? '', email:context.user.email ?? '', organizationName:context.org.name },
  }
}
export async function calculateFreeSubmission(body: { estimate: unknown; requestToken?: string; warningsAcknowledged?: boolean; label?: string; costingId?: string; expectedRevision?: number }) {
  // The rollout doesn't depend on the account; it is checked after the rate limit as before.
  const rolloutRead = startEarly(getFreeRollout())
  const context = await freeContext()
  const rate = await checkAuthRateLimit(`free-calculate:${context.grant.subjectId}`)
  if (rate !== null) throw new Error('FREE_THROTTLED')
  const rollout = await rolloutRead
  if (!context.paid && !rollout.estimation_enabled) throw new Error('FREE_PAUSED')
  const estimate = parseFreeEstimate(body.estimate)
  const validation = validateEstimatorSnapshot(estimate, FREE_ESTIMATE_VALIDATION_OPTIONS)
  if (validation.warnings?.length && !body.warningsAcknowledged) {
    return { outcome:'review_required' as const, warningFields:validation.warnings.map(w => w.field), needsAcknowledgement:true as const }
  }
  const totals = calcFullTotals(estimate)
  const result = buildCostingResult(estimate,totals)
  const readiness = getEstimatorReadiness({ validation,result,totals,warningsAcknowledged:body.warningsAcknowledged })
  if (!readiness.canPersist) throw new Error('FREE_INVALID_INPUT')
  if (context.paid && body.costingId) throw new Error('FREE_ACCESS_DENIED')
  if (context.paid) return { outcome:'paid_result' as const, result, totals, quota:null, paid:true as const }
  const identity = verifyFreeRequest(body.requestToken ?? '', { subjectId:context.grant.subjectId, engineVersion:COSTING_CALCULATION_VERSION, keys:signing().keys, serverTime:new Date() })
  const label = body.label?.trim() || 'Costing'
  const revising = !!body.costingId
  if (revising !== (body.expectedRevision !== undefined)) throw new Error('FREE_INVALID_INPUT')
  const inputs = canonicalFreeInputs(estimate)
  const inputBinding = bindFreeEffectiveInputs(identity,revising ? { estimate:inputs,label,costingId:body.costingId,expectedRevision:body.expectedRevision } : inputs,signing().keys)
  const { data, error } = await createAdminClient().rpc(revising ? 'recalculate_free_saved_costing' : 'complete_free_saved_costing', {
    p_user_id:context.user.id,p_org_id:context.profile.org_id,p_request_id:identity.requestId,
    p_input_binding:inputBinding,p_engine_version:identity.engineVersion,p_issued_at:identity.issuedAt,
    p_label:label,p_estimate:estimate,p_result:result,p_totals:totals,
    ...(revising ? {p_costing_id:body.costingId,p_expected_revision:body.expectedRevision} : {}),
  })
  if (error) {
    const code = ['FREE_QUOTA_EXHAUSTED','FREE_REQUEST_CONFLICT','FREE_REQUEST_EXPIRED','FREE_ACCESS_DENIED','FREE_PAUSED','FREE_EDIT_WINDOW_EXPIRED','FREE_COSTING_CONFLICT'].find(code => error.message?.includes(code))
    throw new Error(code ?? 'FREE_RETRY_SAME_REQUEST')
  }
  if (!data) throw new Error('FREE_RETRY_SAME_REQUEST')
  // Revision replays return their stored result, even if another revision exists now.
  return { outcome:'saved' as const, result:revising ? data.result : result,totals:revising ? data.totals : totals,
    quota:revising ? data.quota : data,requestId:identity.requestId,savedCostingId:data.savedCostingId,
    editWindow:data.editWindow,costingsUsed:data.costingsUsed }
}

export async function getSavedFreeCosting(id: string): Promise<SavedFreeCosting> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error('FREE_INVALID_INPUT')
  const { grant, profile, paid } = await freeContext()
  if (paid) throw new Error('FREE_ACCESS_DENIED')
  const admin = createAdminClient()
  const { data, error } = await admin.from('free_saved_costings').select('*').eq('id',id).eq('subject_id',grant.subjectId).eq('org_id',profile.org_id).maybeSingle()
  if (error) throw new Error('FREE_TEMPORARY_ERROR')
  if (!data) throw new Error('FREE_ACCESS_DENIED')
  const { data: serverTime, error: clockError } = await admin.rpc('free_server_time')
  if (clockError || !serverTime) throw new Error('FREE_TEMPORARY_ERROR')
  return { ...data, editWindow:freeEditWindow(data,serverTime) }

}

export function freeError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const allowed = ['FREE_AUTH_REQUIRED','FREE_ACCESS_DENIED','FREE_ACCESS_INACTIVE','FREE_PROVISIONING_RETRY','FREE_PROVISIONING_PENDING','FREE_THROTTLED','FREE_PAUSED','FREE_INVALID_INPUT','FREE_QUOTA_EXHAUSTED','FREE_REQUEST_CONFLICT','FREE_REQUEST_EXPIRED','FREE_REQUEST_INVALID_OR_EXPIRED','FREE_RETRY_SAME_REQUEST','FREE_EDIT_WINDOW_EXPIRED','FREE_COSTING_CONFLICT']
  const code = allowed.includes(message) ? message : 'FREE_TEMPORARY_ERROR'
  const status = code === 'FREE_AUTH_REQUIRED' ? 401 : code.startsWith('FREE_ACCESS') ? 403 : code==='FREE_THROTTLED' ? 429 : code==='FREE_QUOTA_EXHAUSTED'||code==='FREE_REQUEST_CONFLICT'||code==='FREE_COSTING_CONFLICT' ? 409 : code==='FREE_INVALID_INPUT'||code.includes('EXPIRED') ? 400 : 503
  return Response.json({code},{status,headers:{'Cache-Control':'private, no-store, max-age=0'}})
}
