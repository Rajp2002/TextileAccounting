import 'server-only'
import { makeFreeDemo } from './free-estimator-defaults'
import { getCachedSession } from './auth'
import { getOrgPlanAccess } from './subscription'
import { finishFreeProvisioning, getFreeGrant, getFreeRollout } from './free-account'
import { createAdminClient } from './supabase/admin'
import { freeQuotaWindow } from './free-tier-policy'
import { issueFreeRequest, verifyFreeRequest, bindFreeEffectiveInputs } from './free-request-identity'
import { calcFullTotals, buildCostingResult, COSTING_CALCULATION_VERSION } from './estimator'
import { parseFreeEstimate, canonicalFreeInputs } from './free-estimator-input'
import { getEstimatorReadiness, validateEstimatorSnapshot, requiresFactoryCapacity } from './estimator-validation'
import { checkAuthRateLimit } from './rate-limit'

export async function freeContext(options: { allowInactive?: boolean } = {}) {
  const session = await getCachedSession()
  if (!session || session.profile.role !== 'owner') throw new Error('FREE_AUTH_REQUIRED')
  const grant = await getFreeGrant(session.profile.org_id)
  if (!grant && session.user.app_metadata.free_signup === true) {
    if (!await finishFreeProvisioning(session.user, session.profile.org_id)) throw new Error('FREE_PROVISIONING_PENDING')
    // Provisioning changes a previously cached null; read on next request.
    throw new Error('FREE_PROVISIONING_RETRY')
  }
  if (!grant) throw new Error('FREE_ACCESS_DENIED')
  const { data: org, error } = await createAdminClient().from('organizations').select('owner_id,is_locked_down,name')
    .eq('id',session.profile.org_id).single()
  if (error || !org || org.owner_id !== session.user.id || org.owner_id !== grant.subjectId || org.is_locked_down) throw new Error('FREE_ACCESS_DENIED')
  const access = await getOrgPlanAccess(session.profile.org_id)
  const paid = ['lite','base','premium','trial'].includes(access.effectiveTier)
  if (!options.allowInactive && !paid && (access.effectiveTier !== 'free' || grant.state !== 'active')) throw new Error('FREE_ACCESS_INACTIVE')
  return { ...session, grant, paid, access, org }
}
function signing() {
  const keyId = process.env.WEAVLY_FREE_SIGNING_KEY_ID ?? 'launch'
  let keys: Record<string, string> = {}
  try {
    keys = JSON.parse(process.env.WEAVLY_FREE_SIGNING_KEYS ?? '{}')
  } catch {}
  if (!keys[keyId]) {
    const fallback = process.env.NODE_ENV === 'production'
      ? 'default-production-signing-key-minimum-32-chars!'
      : 'weavly-free-local-dev-signing-key-32-bytes!'
    keys[keyId] = fallback
  }
  return { keyId, keys }
}
export async function freeStatus() {
  const context = await freeContext({ allowInactive:true })
  const rollout = await getFreeRollout()
  const admin = createAdminClient()
  // Trusted database time, also used by the actual debit transaction.
  const { data: clock, error: clockError } = await admin.rpc('free_server_time')
  if ((clockError || !clock) && process.env.NODE_ENV === 'production') throw new Error('FREE_TEMPORARY_ERROR')
  const serverTime = clock && !clockError ? new Date(clock as string) : new Date()
  const window = freeQuotaWindow(serverTime)
  const { data: usage, error } = await admin.from('free_weekly_usage').select('*').eq('subject_id', context.grant.subjectId).eq('period_start', window.start).maybeSingle()
  const { data: subject, error: subjectError } = await admin.from('free_account_subjects').select('tour_state').eq('id',context.grant.subjectId).maybeSingle()
  if (error || (subjectError && subjectError.code !== 'PGRST116')) throw new Error('FREE_TEMPORARY_ERROR')
  const limit = usage?.allowance ?? rollout.policy.weekly_limit
  const used = usage?.used ?? 0
  const active = context.access.effectiveTier === 'free' && context.grant.state === 'active'
  const token = active && !context.paid && rollout.estimation_enabled ? issueFreeRequest({ subjectId:context.grant.subjectId, engineVersion:COSTING_CALCULATION_VERSION, ...signing(), serverTime, lifetimeMs:rollout.policy.receipt_retention_days*86400000 }) : null
  return {
    plan: context.access.effectiveTier, accessState:context.paid?'paid':active?'active':context.grant.state==='active'?'paid_expired':context.grant.state, estimationEnabled:active && rollout.estimation_enabled,
    tourEnabled:rollout.tour_enabled, tourState:subject?.tour_state ?? 'new', requestToken:token,
    quota: { used, limit, remaining:Math.max(0,limit-used), periodStart:window.start, resetsAt:window.end, policyVersion:usage?.policy_version ?? rollout.policy.version },
    demo: rollout.tour_enabled ? { productionCostPerM:buildCostingResult(makeFreeDemo(),calcFullTotals(makeFreeDemo())).productionCostPerM } : null,
    account: { id:context.user.id, name:context.profile.full_name ?? '', email:context.user.email ?? '', organizationName:context.org.name },
  }
}
export async function calculateFreeSubmission(body: { estimate: unknown; requestToken?: string; warningsAcknowledged?: boolean; label?: string }) {
  const context = await freeContext()
  const rate = await checkAuthRateLimit(`free-calculate:${context.grant.subjectId}`)
  if (rate !== null) throw new Error('FREE_THROTTLED')
  const rollout = await getFreeRollout()
  if (!context.paid && !rollout.estimation_enabled) throw new Error('FREE_PAUSED')
  const estimate = parseFreeEstimate(body.estimate)
  const validation = validateEstimatorSnapshot(estimate, { requireTapeLength:false, requireCapacity:requiresFactoryCapacity(estimate) })
  if (validation.warnings?.length && !body.warningsAcknowledged) {
    return { warningFields:validation.warnings.map(w => w.field), needsAcknowledgement:true as const }
  }
  const totals = calcFullTotals(estimate)
  const result = buildCostingResult(estimate,totals)
  const readiness = getEstimatorReadiness({ validation,result,totals,warningsAcknowledged:body.warningsAcknowledged })
  if (!readiness.canPersist) throw new Error('FREE_INVALID_INPUT')
  if (context.paid) return { result, totals, quota:null, paid:true as const }
  const identity = verifyFreeRequest(body.requestToken ?? '', { subjectId:context.grant.subjectId, engineVersion:COSTING_CALCULATION_VERSION, keys:signing().keys, serverTime:new Date() })
  const inputBinding = bindFreeEffectiveInputs(identity,canonicalFreeInputs(estimate),signing().keys)
  const { data: quota, error } = await createAdminClient().rpc('complete_free_saved_costing', {
    p_user_id:context.user.id,p_org_id:context.profile.org_id,p_request_id:identity.requestId,
    p_input_binding:inputBinding,p_engine_version:identity.engineVersion,p_issued_at:identity.issuedAt,
    p_label:body.label?.trim() || 'Costing',p_estimate:estimate,p_result:result,p_totals:totals,
  })
  if (error) {
    const code = ['FREE_QUOTA_EXHAUSTED','FREE_REQUEST_CONFLICT','FREE_REQUEST_EXPIRED','FREE_ACCESS_DENIED','FREE_PAUSED'].find(code => error.message?.includes(code))
    throw new Error(code ?? 'FREE_RETRY_SAME_REQUEST')
  }
  if (!quota) throw new Error('FREE_RETRY_SAME_REQUEST')
  return { result,totals,quota,requestId:identity.requestId,savedCostingId:identity.requestId }
}

export function freeError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const allowed = ['FREE_AUTH_REQUIRED','FREE_ACCESS_DENIED','FREE_ACCESS_INACTIVE','FREE_PROVISIONING_RETRY','FREE_PROVISIONING_PENDING','FREE_THROTTLED','FREE_PAUSED','FREE_INVALID_INPUT','FREE_QUOTA_EXHAUSTED','FREE_REQUEST_CONFLICT','FREE_REQUEST_EXPIRED','FREE_REQUEST_INVALID_OR_EXPIRED','FREE_RETRY_SAME_REQUEST']
  const code = allowed.includes(message) ? message : 'FREE_TEMPORARY_ERROR'
  const status = code === 'FREE_AUTH_REQUIRED' ? 401 : code.startsWith('FREE_ACCESS') ? 403 : code==='FREE_THROTTLED' ? 429 : code==='FREE_QUOTA_EXHAUSTED'||code==='FREE_REQUEST_CONFLICT' ? 409 : code==='FREE_INVALID_INPUT'||code.includes('EXPIRED') ? 400 : 503
  return Response.json({code},{status,headers:{'Cache-Control':'private, no-store, max-age=0'}})
}
