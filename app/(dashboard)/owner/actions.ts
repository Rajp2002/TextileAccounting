'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import crypto from 'crypto'
import { createClient as createServerClient } from '@/lib/supabase/server'



export async function generateAccessCode() {
    const { profile } = await requireRole(['owner'])

    // Generate a random 6-character alphanumeric code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase()

    // Hash it for secure storage
    const hash = crypto.createHash('sha256').update(code).digest('hex')

    // Set expiration to 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const supabase = await createServerClient()
    const { error } = await supabase
        .from('organizations')
        .update({
            access_code_hash: hash,
            access_code_expires_at: expiresAt
        })
        .eq('id', profile.org_id)

    if (error) {
        throw new Error('Failed to generate access code')
    }

    revalidatePath('/owner/settings')
    return { code } // Only sent to the client once
}

export async function validateAndRotateAccessCode(orgId: string, inputCode: string): Promise<boolean> {
    await requireRole(['owner', 'supervisor']) // Both can use codes

    const supabase = await createServerClient()

    // 1. Fetch the current hash and expiration
    const { data: org, error } = await supabase
        .from('organizations')
        .select('access_code_hash, access_code_expires_at')
        .eq('id', orgId)
        .single()

    if (error || !org || !org.access_code_hash) {
        return false
    }

    // 2. Check expiration
    if (new Date(org.access_code_expires_at) < new Date()) {
        return false
    }

    // 3. Hash the input and compare
    const inputHash = crypto.createHash('sha256').update(inputCode.trim().toUpperCase()).digest('hex')

    if (inputHash !== org.access_code_hash) {
        return false
    }

    // 4. Valid! Consume the code (auto-rotate to null)
    await supabase
        .from('organizations')
        .update({
            access_code_hash: null,
            access_code_expires_at: null
        })
        .eq('id', orgId)

    return true
}
