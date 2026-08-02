'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast, userFacingError } from '@/lib/app-notifications'
import { saveBillingProfile, type BillingProfileInput } from '@/app/(dashboard)/owner/billing/actions'

export type BillingProfileValue = BillingProfileInput & { id?: string | null }

export function BillingProfileForm({ initialProfile }: { initialProfile: BillingProfileValue | null }) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<BillingProfileInput>({
    legalName: initialProfile?.legalName ?? '',
    addressLine1: initialProfile?.addressLine1 ?? '',
    addressLine2: initialProfile?.addressLine2 ?? '',
    city: initialProfile?.city ?? '',
    state: initialProfile?.state ?? '',
    stateCode: initialProfile?.stateCode ?? '',
    postalCode: initialProfile?.postalCode ?? '',
    billingEmail: initialProfile?.billingEmail ?? '',
    gstin: initialProfile?.gstin ?? '',
  })

  const update = (key: keyof BillingProfileInput, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = () => startTransition(async () => {
    const result = await saveBillingProfile(form)
    if (result.error) toast.error(userFacingError(result.error, 'Billing details could not be saved. Try again.'))
    else toast.success('Billing details saved')
  })

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-bold text-slate-950">Billing details</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">A payment receipt is not a GST tax invoice. Complete these details before payment if you need a formal invoice; supplier tax configuration must also be enabled.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="billing-legal-name">Legal or business name</Label><Input id="billing-legal-name" value={form.legalName} onChange={event => update('legalName', event.target.value)} placeholder="Your factory or business name" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="billing-address-1">Billing address</Label><Input id="billing-address-1" value={form.addressLine1} onChange={event => update('addressLine1', event.target.value)} placeholder="Street, building, area" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="billing-address-2">Address line 2 <span className="font-normal text-slate-400">(optional)</span></Label><Input id="billing-address-2" value={form.addressLine2} onChange={event => update('addressLine2', event.target.value)} placeholder="Landmark or additional address" /></div>
        <div className="space-y-1.5"><Label htmlFor="billing-city">City</Label><Input id="billing-city" value={form.city} onChange={event => update('city', event.target.value)} placeholder="Surat" /></div>
        <div className="space-y-1.5"><Label htmlFor="billing-state">State</Label><Input id="billing-state" value={form.state} onChange={event => update('state', event.target.value)} placeholder="Gujarat" /></div>
        <div className="space-y-1.5"><Label htmlFor="billing-state-code">State code</Label><Input id="billing-state-code" inputMode="numeric" maxLength={2} value={form.stateCode} onChange={event => update('stateCode', event.target.value)} placeholder="24" /></div>
        <div className="space-y-1.5"><Label htmlFor="billing-postal-code">PIN code</Label><Input id="billing-postal-code" inputMode="numeric" maxLength={6} value={form.postalCode} onChange={event => update('postalCode', event.target.value)} placeholder="395003" /></div>
        <div className="space-y-1.5"><Label htmlFor="billing-email">Billing email</Label><Input id="billing-email" type="email" value={form.billingEmail} onChange={event => update('billingEmail', event.target.value)} placeholder="accounts@example.com" /></div>
        <div className="space-y-1.5"><Label htmlFor="billing-gstin">GSTIN <span className="font-normal text-slate-400">(optional)</span></Label><Input id="billing-gstin" autoCapitalize="characters" maxLength={15} value={form.gstin} onChange={event => update('gstin', event.target.value)} placeholder="15-character GSTIN" /></div>
      </div>
      <Button type="button" onClick={submit} disabled={pending} className="w-full sm:w-auto">{pending ? 'Saving billing details…' : 'Save billing details'}</Button>
    </div>
  )
}
