'use client'

import { memo } from 'react'
import { formatToSurat } from '@/lib/time'

interface AuditDiffProps {
  oldData: any
  newData: any
}

function formatKey(key: string) {
  // Convert basic _id to ID
  if (key === 'id') return 'ID'
  
  return key
    .split('_')
    .map(word => {
      if (word.toLowerCase() === 'id') return 'ID'
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function formatValue(key: string, value: any) {
  if (value === null || value === undefined || value === '') return '—'
  
  const strVal = String(value)

  // Format booleans
  if (typeof value === 'boolean' || strVal === 'true' || strVal === 'false') {
    return (value === true || strVal === 'true') ? 'Yes' : 'No'
  }

  // Format timestamps
  const isDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(strVal)
  if (isDate) {
    try {
      return formatToSurat(new Date(value), 'dd MMM yyyy, hh:mm a')
    } catch {
      // fallback to raw string
    }
  }

  // Handle specific keys like amounts
  const lowerKey = key.toLowerCase()
  const moneyKeys = ['pay', 'payout', 'deducted', 'debt', 'salary', 'price', 'amount', 'cost', 'total', 'rate', 'advance']
  if (moneyKeys.some(mk => lowerKey.includes(mk)) && !isNaN(Number(value))) {
    return `₹${Number(value).toLocaleString('en-IN')}`
  }

  // Handle IDs
  if (lowerKey.endsWith('_id') && !isNaN(Number(value))) {
    return `#${value}`
  }

  // Handle Objects/Arrays - Fix `[object Object]` bug
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).substring(0, 30) + '...'
    } catch {
      return '{...}'
    }
  }

  return strVal
}

function AuditDiff({ oldData, newData }: AuditDiffProps) {
  if (!oldData && !newData) return <span className="italic text-muted-foreground">No data</span>

  const allKeys = Array.from(new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {})
  ]))

  const changes: { key: string; oldVal: any; newVal: any; type: 'added' | 'removed' | 'changed' }[] = []

  // Skip certain internal generated fields to keep diff clean
  const skipFields = ['id', 'org_id', 'created_at', 'updated_at', 'is_deleted']

  allKeys.forEach(key => {
    if (skipFields.includes(key)) return

    const oldValRaw = oldData?.[key]
    const newValRaw = newData?.[key]

    const oldStr = oldValRaw !== null && oldValRaw !== undefined ? String(oldValRaw) : null
    const newStr = newValRaw !== null && newValRaw !== undefined ? String(newValRaw) : null

    if (oldStr !== newStr) {
      if (oldStr === null) {
        changes.push({ key, oldVal: null, newVal: newValRaw, type: 'added' })
      } else if (newStr === null) {
        changes.push({ key, oldVal: oldValRaw, newVal: null, type: 'removed' })
      } else {
        changes.push({ key, oldVal: oldValRaw, newVal: newValRaw, type: 'changed' })
      }
    }
  })

  if (changes.length === 0) {
    return <span className="text-xs text-muted-foreground">No user-visible changes</span>
  }

  return (
    <div className="max-w-sm space-y-2 overflow-x-auto rounded-lg border border-hairline bg-surface-soft p-2.5 font-mono text-xs shadow-sm">
      {changes.map((change) => (
        <div key={change.key} className="flex flex-col gap-1 whitespace-nowrap mb-1">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-body">{formatKey(change.key)}</span>
          {change.type === 'added' && (
            <span className="self-start rounded-md border border-success-soft bg-success-soft px-2 py-0.5 text-success">
              + {formatValue(change.key, change.newVal)}
            </span>
          )}
          {change.type === 'removed' && (
            <span className="self-start rounded-md border border-risk-soft bg-risk-soft px-2 py-0.5 text-risk line-through opacity-80">
              - {formatValue(change.key, change.oldVal)}
            </span>
          )}
          {change.type === 'changed' && (
            <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
              <span className="rounded border border-risk-soft bg-risk-soft px-1.5 py-0.5 text-[10px] text-risk line-through decoration-risk">
                {formatValue(change.key, change.oldVal)}
              </span>
              <span className="mx-0.5 font-sans text-muted-foreground">→</span>
              <span className="rounded border border-success-soft bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
                {formatValue(change.key, change.newVal)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default memo(AuditDiff)
