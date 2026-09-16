'use client'

import React from 'react'
import type { BaseProductionMachineWithReadiness } from '@/lib/machine-readiness'
import { MachineCard } from './MachineCard'

interface MachineGridProps {
  machines: BaseProductionMachineWithReadiness[]
  tourPreview?: boolean
  onEdit: (machine: BaseProductionMachineWithReadiness) => void
}

export function MachineGrid({ machines, onEdit, tourPreview = false }: MachineGridProps) {
  return (
    <ul
      role="list"
      aria-label="Machines list"
      className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2"
    >
      {machines.map(machine => (
        <li key={machine.id} role="listitem" className="min-w-0">
          <MachineCard machine={machine} onEdit={onEdit} tourPreview={tourPreview} />
        </li>
      ))}
    </ul>
  )
}
