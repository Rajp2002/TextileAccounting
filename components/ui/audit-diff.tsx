'use client'

import { memo } from 'react'
import { format } from 'date-fns'

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
      return format(new Date(value), 'dd MMM yyyy, hh:mm a')
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
  if (!oldData && !newData) return <span className="text-gray-400 italic">No data</span>

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
    return <span className="text-gray-500 text-xs">No user-visible changes</span>
  }

  return (
    <div className="space-y-2 text-xs font-mono bg-gray-50 p-2.5 rounded-lg border border-gray-150 shadow-sm max-w-sm overflow-x-auto">
      {changes.map((change) => (
        <div key={change.key} className="flex flex-col gap-1 whitespace-nowrap mb-1">
          <span className="font-semibold text-gray-700 font-sans text-[11px] uppercase tracking-wider">{formatKey(change.key)}</span>
          {change.type === 'added' && (
            <span className="text-emerald-700 bg-emerald-100/50 border border-emerald-200/50 px-2 py-0.5 rounded-md self-start">
              + {formatValue(change.key, change.newVal)}
            </span>
          )}
          {change.type === 'removed' && (
            <span className="text-red-700 bg-red-100/50 border border-red-200/50 px-2 py-0.5 rounded-md self-start line-through opacity-80">
              - {formatValue(change.key, change.oldVal)}
            </span>
          )}
          {change.type === 'changed' && (
            <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
              <span className="text-rose-600 bg-rose-50/50 border border-rose-100/50 px-1.5 py-0.5 rounded text-[10px] line-through decoration-rose-300">
                {formatValue(change.key, change.oldVal)}
              </span>
              <span className="text-gray-300 font-sans mx-0.5">→</span>
              <span className="text-emerald-700 bg-emerald-50/50 border border-emerald-100/50 px-1.5 py-0.5 rounded font-bold text-[10px]">
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
