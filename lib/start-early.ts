/**
 * Starts a read whose result is awaited later, and marks it handled so a
 * failure is not reported as unhandled before then. Whoever awaits the
 * returned promise still sees the failure.
 */
export function startEarly<T>(read: Promise<T>): Promise<T> {
    read.catch(() => {})
    return read
}
