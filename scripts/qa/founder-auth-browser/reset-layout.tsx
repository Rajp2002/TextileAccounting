import type { ReactNode } from 'react'
export default function ResetFixtureLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return <main className="mx-auto max-w-lg bg-surface p-6"><h1>{title}</h1><p>{subtitle}</p>{children}</main>
}
