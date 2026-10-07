import type { Metadata } from 'next'
import { JoinForm } from './join-form'

export const metadata: Metadata = { title: 'Join your factory · Weavly' }

/** Public: a supervisor joins a Base factory with the owner's factory code. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const { code } = await searchParams
    return <JoinForm initialCode={typeof code === 'string' ? code : ''} />
}
