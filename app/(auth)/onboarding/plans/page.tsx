import { redirect } from 'next/navigation'

export const metadata = { title: 'Choose your plan · Weavly', robots: { index: false, follow: false } }

export default async function OnboardingPlansCompatibilityPage() {
    redirect('/plans?from=onboarding')
}
