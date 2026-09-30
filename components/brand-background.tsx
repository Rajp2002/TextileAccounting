type BrandBackgroundProps = {
    className?: string
    variant?: 'app' | 'auth' | 'billing' | 'payroll' | 'machines' | 'dispatches' | 'workers'
}

/**
 * Warm Weavly atmosphere behind the workspace. Operational routes share one
 * calm, static treatment so tables, forms, and numbers always stay in front;
 * the saffron shapes are a hint of brand, not something to watch.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BrandBackground(_props: BrandBackgroundProps) {
    // Spec §M / §O: Remove blur blobs and cream tint across the app shell;
    // pure paper canvas is provided by body and layout bg-background.
    return null
}


