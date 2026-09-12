'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { BaseProductionMachine } from '@/lib/base-production-core'
import { MachineToolbar } from './MachineToolbar'
import { MachineRow } from './MachineRow'
import { MachineEmptyState } from './MachineEmptyState'

interface MachineRegisterPanelProps {
  machines: BaseProductionMachine[]
  visible: BaseProductionMachine[]
  search: string
  onSearchChange: (value: string) => void
  inactive: boolean
  onInactiveChange: (showInactive: boolean) => void
  onAdd: () => void
  onEdit: (machine: BaseProductionMachine) => void
}

export function MachineRegisterPanel({
  machines,
  visible,
  search,
  onSearchChange,
  inactive,
  onInactiveChange,
  onAdd,
  onEdit,
}: MachineRegisterPanelProps) {
  const { tx } = useTranslation()

  // Display count reflects current scope: search matches, all machines, or active machines
  const displayCount = search.trim()
    ? visible.length
    : inactive
      ? machines.length
      : machines.filter(m => m.is_active).length

  return (
    <section
      aria-labelledby="machine-register-heading"
      className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden"
    >
      {/* Register Header */}
      <header className="px-5 py-3.5 sm:px-6">
        <h2
          id="machine-register-heading"
          className="text-sm sm:text-base font-semibold tracking-tight text-ink"
        >
          {tx('Machine register')} · {displayCount}
        </h2>
      </header>

      {/* Toolbar */}
      <MachineToolbar
        search={search}
        onSearchChange={onSearchChange}
        inactive={inactive}
        onInactiveChange={onInactiveChange}
      />

      {/* Machine List / Empty State */}
      {visible.length > 0 ? (
        <ul role="list" className="divide-y divide-hairline">
          {visible.map(machine => (
            <li key={machine.id} role="listitem">
              <MachineRow machine={machine} onEdit={onEdit} />
            </li>
          ))}
        </ul>
      ) : (
        <MachineEmptyState
          totalCount={machines.length}
          isFiltered={Boolean(search.trim() || !inactive)}
          hasSearch={Boolean(search.trim())}
          isOnlyActive={!inactive}
          onAdd={onAdd}
          onClearSearch={() => onSearchChange('')}
          onShowAll={() => onInactiveChange(true)}
        />
      )}
    </section>
  )
}
