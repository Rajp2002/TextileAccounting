'use client'

import { memo } from 'react'

interface AuditDiffProps {
  oldData: any
  newData: any
}

function AuditDiff({ oldData, newData }: AuditDiffProps) {
  if (!oldData && !newData) return <span className="text-gray-400 italic">No data</span>

  const allKeys = Array.from(new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {})
  ]))

  const changes: { key: string; oldVal: any; newVal: any; type: 'added' | 'removed' | 'changed' }[] = []

  // Skip certain internal generated fields to keep diff clean
  const skipFields = ['id', 'org_id', 'created_at', 'updated_at']

  allKeys.forEach(key => {
    if (skipFields.includes(key)) return

    const oldVal = oldData?.[key]
    const newVal = newData?.[key]

    // Convert values to string for simple comparison, handle nulls gracefully
    const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : null
    const newStr = newVal !== null && newVal !== undefined ? String(newVal) : null

    if (oldStr !== newStr) {
      if (oldStr === null) {
        changes.push({ key, oldVal: null, newVal: newStr, type: 'added' })
      } else if (newStr === null) {
        changes.push({ key, oldVal: oldStr, newVal: null, type: 'removed' })
      } else {
        changes.push({ key, oldVal: oldStr, newVal: newStr, type: 'changed' })
      }
    }
  })

  if (changes.length === 0) {
    return <span className="text-gray-500 text-xs">No user-visible changes</span>
  }

  return (
    <div className="space-y-1.5 text-xs font-mono bg-gray-50 p-2 rounded-md border border-gray-100 max-w-sm overflow-x-auto">
      {changes.map((change) => (
        <div key={change.key} className="flex flex-col gap-0.5 whitespace-nowrap">
          <span className="font-semibold text-gray-700">{change.key}:</span>
          {change.type === 'added' && (
            <span className="text-emerald-600 bg-emerald-50 px-1 rounded-sm">+ {change.newVal}</span>
          )}
          {change.type === 'removed' && (
            <span className="text-red-600 bg-red-50 px-1 rounded-sm line-through">- {change.oldVal}</span>
          )}
          {change.type === 'changed' && (
            <div className="flex items-center gap-1.5 pl-2">
              <span className="text-red-500 line-through bg-red-50 rounded-sm px-1">{change.oldVal}</span>
              <span className="text-gray-400">→</span>
              <span className="text-emerald-600 bg-emerald-50 rounded-sm px-1 font-medium">{change.newVal}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default memo(AuditDiff)
