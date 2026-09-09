'use client'
import EstimatorClient from '@/app/(dashboard)/owner/estimator/EstimatorClient'
import {useFreeWorkspace} from './FreeWorkspace'
import {useTranslation} from '@/lib/i18n/context'
import {hasCapability, tierSatisfies} from '@/lib/subscription-access'
import {freeText} from '@/lib/i18n/free-tier'
/** Keep the same mounted estimator and in-memory inputs across verified upgrade. */
export default function FreeClient({userId,orgId,organizationName}:{userId:string;orgId:string;organizationName:string}) {
 const {paid,tier,activatePaid}=useFreeWorkspace(),{language}=useTranslation()
 return <>{paid&&<p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">{freeText(language,'planActivated',{plan:tier==='lite'?'Lite':'Base'})}</p>}<EstimatorClient freeMode={!paid} onFreeUpgrade={activatePaid} disableAutosave userId={userId} orgId={orgId} organizationName={organizationName} initialTemplates={paid?undefined:[]} initialWorkers={[]} initialPartyNames={[]} staleDefaultRateNames={[]} canUseProduction={tierSatisfies(tier,'premium')} canUseProductionPipeline={hasCapability(tier,'production')} productionMode="market_run" tutorialDismissed wizardDismissed /></>
}
