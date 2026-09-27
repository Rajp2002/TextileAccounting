import type { TourId } from './tour-types'

let active: TourId | null = null
export function acquireTour(id: TourId): boolean {
    if (active !== null) return false
    active = id
    return true
}
export function releaseTour(id: TourId): void {
    if (active === id) active = null
}
