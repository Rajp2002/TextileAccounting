import { defineConfig } from 'vitest/config'
import path from 'node:path'
const files=['standalone-plan-chooser.test.ts','free-default-signup.test.ts','signup-legal-acceptance.test.ts','plan-aware-settings-permissions.test.ts','settings-responsive-layout.test.ts','settings-payroll-query-gating.test.ts','paid-plan-standardized-billing.test.ts','free-billing-workspace.test.tsx','sprint4-billing-trust.test.ts','account-deletion.test.ts','account-deletion-preflight.test.ts']
export default defineConfig({test:{globals:true,environment:'node',maxWorkers:4,include:files.map(name=>'__tests__/'+name),env:{NODE_ENV:'test'}},resolve:{alias:{'@':process.cwd(),'next/font/google':path.resolve('__tests__/stubs/next-font-google.ts')}}})
