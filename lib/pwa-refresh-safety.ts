type RefreshGuard = () => boolean

const guards = new Set<RefreshGuard>()

/** Mounted editors may flush recoverable drafts or block an explicit app refresh. */
export function registerPwaRefreshGuard(guard: RefreshGuard): () => void {
  guards.add(guard)
  return () => { guards.delete(guard) }
}

export function prepareForPwaRefresh(): boolean {
  for (const guard of guards) {
    try {
      if (!guard()) return false
    } catch {
      return false
    }
  }
  return true
}
