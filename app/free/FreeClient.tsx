'use client'
import type {SavedFreeCosting} from '@/lib/free-costing-window'
import EstimatorClient from '@/app/(dashboard)/owner/estimator/EstimatorClient'
import {useFreeWorkspace} from './FreeWorkspace'
import {useTranslation} from '@/lib/i18n/context'
import {hasCapability} from '@/lib/subscription-access'
import {freeText} from '@/lib/i18n/free-tier'
import {TrialEndedNotice} from '@/components/billing/TrialEndedNotice'
/** Keep the same mounted estimator and in-memory inputs across verified upgrade. */
export default function FreeClient({initialFreeCosting,userId,orgId,organizationName,userMetadata,tutorialDismissed = false,baseVisible = false,liteTrialEligible = false,trialEndedAt = null}:{initialFreeCosting?:SavedFreeCosting;userId:string;orgId:string;organizationName:string;tutorialDismissed?:boolean;userMetadata?:Record<string,unknown>|null;baseVisible?:boolean;liteTrialEligible?:boolean;trialEndedAt?:string|null}) {
 const {paid,tier,activatePaid}=useFreeWorkspace(),{language}=useTranslation()
 return <>{paid&&<p role="status" className="mb-4 rounded-lg border border-wv-status-success-border bg-wv-status-success-bg text-wv-status-success-fg p-3">{freeText(language,'planActivated',{plan:tier==='lite'?'Lite':'Base'})}</p>}{tier==='free'&&trialEndedAt&&<TrialEndedNotice orgId={orgId} endedAt={trialEndedAt} />}<EstimatorClient initialFreeCosting={initialFreeCosting} freeMode={!paid} mobileTier={tier} onFreeUpgrade={activatePaid} disableAutosave userId={userId} orgId={orgId} organizationName={organizationName} baseVisible={baseVisible} liteTrialEligible={liteTrialEligible} initialTemplates={paid?undefined:[]} initialWorkers={[]} staleDefaultRateNames={[]} canUseProductionPipeline={hasCapability(tier,'production')} tutorialDismissed={tutorialDismissed} userMetadata={userMetadata} wizardDismissed /></>
}
