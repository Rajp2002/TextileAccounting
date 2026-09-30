'use client'
import EstimatorClient from '@/app/(dashboard)/owner/estimator/EstimatorClient'
import {useFreeWorkspace} from './FreeWorkspace'
import {useTranslation} from '@/lib/i18n/context'
import {hasCapability} from '@/lib/subscription-access'
import {freeText} from '@/lib/i18n/free-tier'
/** Keep the same mounted estimator and in-memory inputs across verified upgrade. */
export default function FreeClient({userId,orgId,organizationName,userMetadata,tutorialDismissed = false}:{userId:string;orgId:string;organizationName:string;tutorialDismissed?:boolean;userMetadata?:Record<string,unknown>|null}) {
 const {paid,tier,activatePaid}=useFreeWorkspace(),{language}=useTranslation()
 return <>{paid&&<p role="status" className="mb-4 rounded-lg border border-wv-status-success-border bg-wv-status-success-bg text-wv-status-success-fg p-3">{freeText(language,'planActivated',{plan:tier==='lite'?'Lite':'Base'})}</p>}<EstimatorClient freeMode={!paid} onFreeUpgrade={activatePaid} disableAutosave userId={userId} orgId={orgId} organizationName={organizationName} initialTemplates={paid?undefined:[]} initialWorkers={[]} staleDefaultRateNames={[]} canUseProductionPipeline={hasCapability(tier,'production')} tutorialDismissed={tutorialDismissed} userMetadata={userMetadata} wizardDismissed /></>
}
