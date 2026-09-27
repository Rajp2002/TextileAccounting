import React, { Suspense } from 'react'
export default function dynamic(loader: () => Promise<any>, _opts?: any) {
  const Lazy = React.lazy(() => loader().then(m => ({ default: m.default ?? m })))
  return function Dynamic(props: any) { return <Suspense fallback={null}><Lazy {...props} /></Suspense> }
}
