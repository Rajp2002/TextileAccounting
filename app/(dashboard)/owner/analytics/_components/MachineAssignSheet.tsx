'use client'

import { useState } from 'react'
import { assignMachinesToOrder } from '../../actions/orders'
import { cn } from '@/lib/utils'

type MachineAssignSheetProps = {
  orderId: string
  orderName: string
  qualityName: string
  currentMachineIds: string[]
  allMachines: Array<{ id: string, name: string, current_order_id: string | null }>
  onSuccess?: () => void
}

export function MachineAssignSheet({ 
  orderId, 
  orderName, 
  qualityName,
  currentMachineIds,
  allMachines,
  onSuccess
}: MachineAssignSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(currentMachineIds))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const result = await assignMachinesToOrder(orderId, Array.from(selected))
    if ('error' in result && result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      setIsOpen(false)
      setSaving(false)
      onSuccess?.()
    }
  }

  const toggle = (id: string, disabled: boolean) => {
    if (disabled) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  // Very simplified simulation of a bottom sheet trigger and content.
  // Assuming full shadcn or framer-motion is used in the actual platform but defaulting to a tailwind overlay for demonstration.
  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-primary hover:underline ml-2"
      >
        [+ Assign]
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="bg-background w-full rounded-t-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Assign machines to {orderName}</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">Quality: {qualityName}</p>

            {error && (
              <div className="mb-4 text-sm text-danger bg-background-danger p-2 rounded">
                {error}
              </div>
            )}

            <div className="space-y-2 mb-6">
              {allMachines.map(m => {
                const isSelected = selected.has(m.id)
                const isLinkedToOther = m.current_order_id && m.current_order_id !== orderId
                const disabled = false // Owners can always override

                return (
                  <div 
                    key={m.id}
                    onClick={() => toggle(m.id, disabled)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {m.name}
                        {isLinkedToOther && (
                          <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Already Linked
                          </span>
                        )}
                      </div>
                      {isLinkedToOther && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Currently assigned to another active order
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium"
            >
              {saving ? 'Saving...' : 'Save assignment'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
