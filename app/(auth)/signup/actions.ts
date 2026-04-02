'use server'

/**
 * @deprecated This file is superseded by app/(auth)/actions/auth.ts (F1 spec).
 * Re-exports signOut and getUser for backward compatibility.
 * All new auth logic lives in the actions/ directory.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}

export async function getUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}
