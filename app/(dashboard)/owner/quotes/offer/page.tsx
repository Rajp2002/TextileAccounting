import { redirect } from 'next/navigation'

/** Existing bookmarks open the comparison over Saved Costings. */
export default async function OfferCheckPage(props: { searchParams: Promise<{ costing?: string }> }) {
    const { costing } = await props.searchParams
    redirect(`/owner/quotes?offer=${encodeURIComponent(costing || 'choose')}`)
}
