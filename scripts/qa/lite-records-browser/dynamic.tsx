import React, { lazy, Suspense, type ComponentType } from 'react'
export default function dynamic<Props extends object>(loader: () => Promise<ComponentType<Props> | { default: ComponentType<Props> }>, options?: { loading?: ComponentType }) {
  const Component = lazy(async () => { const loaded = await loader(); return typeof loaded === 'function' ? { default: loaded } : loaded })
  return function Dynamic(props: Props) { return <Suspense fallback={options?.loading ? <options.loading /> : null}><Component {...props} /></Suspense> }
}
