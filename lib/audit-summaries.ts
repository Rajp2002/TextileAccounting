/**
 * Audit Trail TLDR Summary Mapping
 * Provides human-readable summaries for all system changes.
 */

export interface AuditLogEntry {
  table_name: string
  action: string
  new_data?: any
  old_data?: any
  record_id?: string
}

export function getAuditSummary(log: AuditLogEntry): string {
  const { table_name, action, new_data, old_data } = log

  // 1. Handle Manual Custom Actions (payroll.settle, etc)
  if (action === 'payroll.settle') return 'Worker paid'
  if (action === 'payroll.unsettle') return 'Payment reverted'

  // 2. Map Table + Action to human-readable summaries
  switch (table_name) {
    case 'attendance':
      if (action === 'INSERT') {
        return new_data?.present ? 'Worker marked present' : 'Worker marked absent'
      }
      if (action === 'UPDATE') return 'Attendance record corrected'
      if (action === 'DELETE') return 'Attendance record removed'
      break

    case 'worker_advances':
      if (action === 'INSERT') return 'Advance (Upaad) given'
      if (action === 'UPDATE') return 'Advance details updated'
      if (action === 'DELETE') return 'Advance record deleted'
      break

    case 'payroll_settlements':
      if (action === 'INSERT') return 'Worker paid'
      if (action === 'DELETE') return 'Payment record removed'
      break

    case 'production_logs':
      if (action === 'INSERT') return 'Production recorded'
      if (action === 'UPDATE') return 'Production log corrected'
      if (action === 'DELETE') return 'Production log removed'
      break

    case 'machine_assignments':
      if (action === 'INSERT') return 'Order assigned to machine'
      if (action === 'UPDATE') return 'Machine assignment changed'
      if (action === 'DELETE') return 'Order unlinked from machine'
      break

    case 'orders':
      if (action === 'INSERT') return 'New order launched'
      if (action === 'UPDATE') return 'Order details updated'
      if (action === 'DELETE') return 'Order deleted'
      break

    case 'workers':
    case 'fixed_workers':
      if (action === 'INSERT') return 'New worker registered'
      if (action === 'UPDATE') return 'Worker profile updated'
      if (action === 'DELETE') return 'Worker record removed'
      break

    case 'machines':
      if (action === 'INSERT') return 'New machine added'
      if (action === 'UPDATE') return 'Machine details changed'
      if (action === 'DELETE') return 'Machine removed'
      break

    case 'yarn_batches':
      if (action === 'INSERT') return 'New yarn batch added'
      if (action === 'UPDATE') return 'Yarn batch updated'
      if (action === 'DELETE') return 'Yarn batch removed'
      break

    case 'qualities':
      if (action === 'INSERT') return 'New fabric quality defined'
      if (action === 'UPDATE') return 'Quality details updated'
      if (action === 'DELETE') return 'Quality removed'
      break

    case 'estimator_quotes':
      if (action === 'INSERT') return 'New quote generated'
      if (action === 'UPDATE') return 'Quote updated'
      if (action === 'DELETE') return 'Quote deleted'
      break

    case 'estimator_templates':
      if (action === 'INSERT') return 'Fabric template saved'
      if (action === 'UPDATE') return 'Template updated'
      if (action === 'DELETE') return 'Template removed'
      break

    case 'profiles':
      return 'User profile updated'

    case 'payroll_configs':
      return 'Payroll settings updated'

    case 'incidents':
      if (action === 'INSERT') return 'Incident report filed'
      return 'Incident report updated'

    case 'factory_cost_profile':
      return 'Factory overheads updated'

    default:
      // Generic fallback logic
      if (action === 'INSERT') return `New ${table_name.replace(/_/g, ' ')} created`
      if (action === 'UPDATE') return `${table_name.replace(/_/g, ' ')} updated`
      if (action === 'DELETE') return `${table_name.replace(/_/g, ' ')} removed`
      return `${table_name} ${action.toLowerCase()}`
  }

  return `${table_name} ${action.toLowerCase()}`
}
