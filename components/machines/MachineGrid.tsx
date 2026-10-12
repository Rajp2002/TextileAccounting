'use client'

import React from 'react'
import type { BaseProductionMachineWithReadiness } from '@/lib/machine-readiness'
import { cn } from '@/lib/utils'
import { MachineCard } from './MachineCard'

interface MachineGridProps {
  machines: BaseProductionMachineWithReadiness[]
  tourPreview?: boolean
  /** Machines added since the page opened; their cards play the arrival highlight. */
  arrivedIds?: ReadonlySet<string>
  onEdit: (machine: BaseProductionMachineWithReadiness) => void
}

export function MachineGrid({ machines, onEdit, tourPreview = false, arrivedIds }: MachineGridProps) {
  return (
    // In a window-high page the grid takes what is left and scrolls; the 4px inset keeps hover lift and shadows unclipped.
    <ul
      role="list"
      aria-label="Machines list"
      className="machine-card-grid grid grid-cols-1 gap-4 sm:gap-5 fit-screen:-mx-1 fit-screen:-mt-1 fit-screen:min-h-0 fit-screen:overflow-y-auto fit-screen:overscroll-contain fit-screen:p-1"
    >
      {machines.map(machine => (
        <li key={machine.id} role="listitem" className={cn('min-w-0', arrivedIds?.has(machine.id) && 'ui-row-arrive')}>
          <MachineCard machine={machine} onEdit={onEdit} tourPreview={tourPreview} />
        </li>
      ))}
    </ul>
  )
}
