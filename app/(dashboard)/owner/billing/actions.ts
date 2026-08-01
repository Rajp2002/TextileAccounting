'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export type BillingProfileInput = {
  legalName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  stateCode: string
  postalCode: string
  billingEmail: string
  gstin?: string
}
function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function saveBillingProfile(input: BillingProfileInput) {
  const { user, profile } = await requireRole(['owner'])
  const values = {
    legalName: clean(input.legalName),
    addressLine1: clean(input.addressLine1),
    addressLine2: clean(input.addressLine2),
    city: clean(input.city),
    state: clean(input.state),
    stateCode: clean(input.stateCode),
    postalCode: clean(input.postalCode),
    billingEmail: clean(input.billingEmail),
    gstin: clean(input.gstin).toUpperCase(),
  }

  if (values.legalName.length < 2 || values.legalName.length > 160) return { error: 'Enter the legal or business name.' }
  if (values.addressLine1.length < 3 || values.addressLine1.length > 240) return { error: 'Enter the billing address.' }
  if (values.city.length < 2 || values.state.length < 2) return { error: 'Enter the billing city and state.' }
  if (!/^\d{2}$/.test(values.stateCode)) return { error: 'State code must be two digits.' }
  if (!/^\d{6}$/.test(values.postalCode)) return { error: 'PIN code must be six digits.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.billingEmail)) return { error: 'Enter a valid billing email.' }
  if (values.gstin && !/^\d{2}[A-Z0-9]{13}$/.test(values.gstin)) return { error: 'Enter a valid 15-character GSTIN, or leave it blank.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organization_billing_profiles')
    .upsert({
      org_id: profile.org_id,
      legal_name: values.legalName,
      address_line1: values.addressLine1,
      address_line2: values.addressLine2 || null,
      city: values.city,
      state: values.state,
      state_code: values.stateCode,
      postal_code: values.postalCode,
      billing_email: values.billingEmail,
      gstin: values.gstin || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })

  if (error) {
    console.error('Failed to save billing profile:', error)
    return { error: 'Billing details could not be saved. Please try again.' }
  }

  revalidatePath('/owner/billing')
  revalidatePath('/owner/settings')
  return { success: true }
}
