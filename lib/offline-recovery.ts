type RecoveryLocation = Pick<Location, 'pathname' | 'assign' | 'reload'>

/** Retry the document the worker replaced, retaining its query and fragment. */
export function retryOfflineNavigation(location: RecoveryLocation): void {
  const pathname = location.pathname.replace(/\/+$/, '')

  if (pathname === '/offline' || pathname === '/_offline') {
    // Direct visits have no interrupted workflow to resume.
    location.assign('/login')
    return
  }

  // A full reload retries the original document request through the worker.
  // Client-side routing here could retain the fallback or lose the task URL.
  location.reload()
}
