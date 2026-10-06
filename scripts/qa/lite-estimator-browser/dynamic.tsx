import React, { lazy, Suspense } from 'react'
export default function dynamic(loader: () => Promise<unknown>, options?: { loading?: React.ComponentType; ssr?: boolean }) {
    const Component = lazy(async () => {
        const result = await loader() as { default?: React.ComponentType<Record<string, unknown>> } | React.ComponentType<Record<string, unknown>>
        return { default: (typeof result === 'function' ? result : result.default) as React.ComponentType<Record<string, unknown>> }
    })
    const Loading = options?.loading
    return function FixtureDynamic(props: Record<string, unknown>) { return <Suspense fallback={Loading ? <Loading /> : null}><Component {...props} /></Suspense> }
}
