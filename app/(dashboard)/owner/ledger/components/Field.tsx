import { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
    return (
        <div className={cn('space-y-2', className)}>
            <Label className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</Label>
            {children}
            {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
        </div>
    )
}
