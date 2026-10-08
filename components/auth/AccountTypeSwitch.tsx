'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { supervisorText } from '@/lib/i18n/supervisor-access'
import { SUPERVISOR_JOIN_PATH } from '@/lib/supervisor-access'
import { cn } from '@/lib/utils'

type AccountType = 'owner' | 'supervisor'

const OWNER_SIGNUP_PATH = '/signup'

// min-h-[44px], not min-h-11: phones shrink the root font, and rem would give 38px.
const optionClass = 'inline-flex min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-semibold outline-none transition-colors motion-reduce:transition-none focus-visible:ring-[3px] focus-visible:ring-ring/25'

/**
 * Tells the two account types apart on the screens where accounts are created.
 * An owner creates a factory at /signup; a supervisor joins one at /join with
 * the owner's factory code. The current type is plain text; the other is a link.
 * Sign-in is shared, so the login form does not use this.
 */
export function AccountTypeSwitch({ current }: { current: AccountType }) {
    const { language } = useTranslation()
    const options: Array<{ type: AccountType; href: string; label: string }> = [
        { type: 'owner', href: OWNER_SIGNUP_PATH, label: supervisorText(language, 'accountTypeOwner') },
        { type: 'supervisor', href: SUPERVISOR_JOIN_PATH, label: supervisorText(language, 'accountTypeSupervisor') },
    ]

    return (
        <nav aria-label={supervisorText(language, 'accountTypeLabel')} className="grid grid-cols-2 gap-1 rounded-lg border border-hairline bg-surface-soft p-1">
            {options.map(option => option.type === current ? (
                <span key={option.type} aria-current="page" className={cn(optionClass, 'bg-ink text-surface')}>{option.label}</span>
            ) : (
                <Link key={option.type} href={option.href} className={cn(optionClass, 'text-ink hover:bg-surface')}>{option.label}</Link>
            ))}
        </nav>
    )
}
