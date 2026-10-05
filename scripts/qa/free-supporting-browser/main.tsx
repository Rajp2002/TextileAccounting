import React from 'react'
import { createRoot } from 'react-dom/client'
import { PaymentHistoryDialog } from '../../../components/billing/PaymentHistoryDialog'
import { PlanAwareSettingsView } from '../../../components/settings/plan-aware/plan-aware-settings-view'
import FreeAccount from '../../../app/free/account/FreeAccount'
import FreeBillingClient from '../../../app/free/billing/FreeBillingClient'
import { SupportInbox, SupportThread } from '../../../components/support/support-workspace'
import { I18nProvider } from '../../../lib/i18n/context'
import '../../../app/globals.css'
const params = new URL(location.href).searchParams
const language = params.get('lang') ?? 'en'
localStorage.setItem('weavly_language', language)
const view = params.get('view') ?? (location.pathname.startsWith('/support/') ? 'thread' : location.pathname === '/support' ? 'support' : 'account')
const fixture = view === 'default-history' ? <><h1>Default payment history</h1><PaymentHistoryDialog entries={[{id:'synthetic-payment-1',kind:'payment',date:'2026-10-01T10:00:00Z',planTier:'lite',purchaseType:'initial_purchase',amountPaise:125000,method:'upi',paymentId:'pay_synthetic_12345678901234567890',orderId:'order_synthetic_12345678901234567890',receiptPaymentId:'payment-1',status:'captured'}]} /></> : view === 'paid-account' ? <PlanAwareSettingsView profile={{userId:'11111111-1111-4111-8111-111111111111',fullName:'Synthetic Owner',email:'synthetic@example.test',emailVerified:true,phone:'+919999900000',role:'owner'}} factory={{id:'22222222-2222-4222-8222-222222222222',name:'Synthetic Weaving Factory',isAuthorizedEditor:true}} tier={params.get('tier') === 'base' ? 'base' : 'lite'} canEditDefaults /> : view === 'billing' ? <FreeBillingClient organizationName="Synthetic Weaving Factory" initialTier={params.get('tier') ?? 'free'} grantState={params.get('grant') ?? 'active'} billingHistory={params.get('records') ? [{id:'synthetic-payment-1',kind:'payment',date:'2026-10-01T10:00:00Z',planTier:'lite',purchaseType:'initial_purchase',amountPaise:125000,method:'upi',paymentId:'pay_synthetic_12345678901234567890',orderId:'order_synthetic_12345678901234567890',receiptPaymentId:'payment-1',status:'captured'}] : []} />
  : view === 'support' ? <SupportInbox founder={false} compactMobile />
  : view === 'thread' ? <SupportThread founder={false} compactMobile id="33333333-3333-4333-8333-333333333333" />
  : <FreeAccount name="Synthetic Owner" email="synthetic@example.test" phone="+919999900000" organizationName="Synthetic Weaving Factory" organizationId="22222222-2222-4222-8222-222222222222" userId="11111111-1111-4111-8111-111111111111" emailVerified={params.get('verified') !== 'false'} />
createRoot(document.getElementById('root')!).render(<I18nProvider><main className="mx-auto min-h-screen max-w-7xl bg-background px-3 py-4 text-ink" style={{ fontFamily: 'system-ui, sans-serif' }}><p className="mb-3 text-xs text-subtle" data-i18n-skip="true">Synthetic Free component fixture · no account or device evidence</p>{fixture}</main></I18nProvider>)
