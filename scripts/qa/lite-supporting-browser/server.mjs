import { createServer } from 'vite'
import path from 'node:path'
if (!process.argv.includes('--enable-synthetic-fixtures')) throw new Error('Explicit --enable-synthetic-fixtures required')
const root=path.resolve('scripts/qa/lite-supporting-browser'), stub=path.join(root,'stubs.tsx')
const exact=['@/app/(dashboard)/owner/settings/actions','@/app/(dashboard)/owner/settings/account-deletion','@/app/(dashboard)/owner/settings/data-export','@/app/(dashboard)/owner/estimator/actions','@/app/(dashboard)/owner/production/actions','@/lib/auth','@/lib/supabase/client','@/lib/supabase/server','@/lib/subscription','@/lib/referral','@/lib/owner-organization','@/lib/billing-readiness','@/hooks/use-user-profile','@/components/billing/PlanAnalyticsBeacon','@/components/performance/route-milestones','@/lib/plan-analytics','@/lib/browser-download','../FreeWorkspace','next/link','next/navigation','next/dynamic']
const server=await createServer({root,cacheDir:'/tmp/weavly-lite-supporting-vite-cache',publicDir:path.resolve('public'),configFile:false,mode:'development',esbuild:{jsx:'automatic'},resolve:{alias:[...exact.map(find=>({find,replacement:stub})),{find:'@',replacement:process.cwd()}]},server:{host:'127.0.0.1',port:4194,strictPort:true,hmr:false,watch:{ignored:['**/*']},fs:{allow:[process.cwd()]}}})
await server.listen()
console.info('Synthetic Lite supporting fixture on127.0.0.1:4194; remote auth/payment/data boundaries mocked')
