import { Order } from '../../actions/dashboard'
import { formatDate } from '@/lib/format'
import { MachineAssignSheet } from './MachineAssignSheet'

type OrderCardProps = {
  order: Order
  variant: 'hero' | 'grid' | 'carousel'
}

function PaceIndexBadge({ paceIndex, daysRemaining }: { paceIndex: number, daysRemaining: number }) {
  if (daysRemaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-background-danger text-danger px-2 py-0.5 text-sm font-medium">
        Deadline today
      </span>
    )
  }

  if (paceIndex >= 1.0) {
    // We could calculate actual buffer days precisely here, but defaulting to a generic success for illustration
    return (
      <span className="inline-flex items-center gap-1 rounded bg-background-success text-success px-2 py-0.5 text-sm font-medium">
        On schedule
      </span>
    )
  }
  if (paceIndex >= 0.8) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-background-warning text-warning px-2 py-0.5 text-sm font-medium">
        Running slow — add machines
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-background-danger text-danger px-2 py-0.5 text-sm font-medium">
      Will miss deadline at current pace
    </span>
  )
}

function ForecastLabel({ projectedFinishDate, deadline }: { projectedFinishDate: string | null, deadline: string }) {
  if (!projectedFinishDate) {
    return <span className="text-secondary text-sm">No recent production</span>
  }

  const projected = new Date(projectedFinishDate)
  const due       = new Date(deadline)
  const diffDays  = Math.round((projected.getTime() - due.getTime()) / 86_400_000)

  if (diffDays <= 0) {
    return (
      <span className="text-success text-sm">
        Forecast {formatDate(projectedFinishDate)}
        {diffDays < 0 && ` (${Math.abs(diffDays)}d buffer)`}
      </span>
    )
  }

  return (
    <span className="text-danger text-sm">
      Forecast {formatDate(projectedFinishDate)} ({diffDays}d late)
    </span>
  )
}

export function OrderCard({ order, variant }: OrderCardProps) {
  const isComplete = order.meters_remaining <= 0
  const widthClasses = {
    hero: 'w-full',
    grid: 'w-full',
    carousel: 'min-w-[320px] w-[320px] shrink-0'
  }

  return (
    <div className={`flex flex-col p-5 bg-card border border-border shadow-sm rounded-xl ${widthClasses[variant]}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-semibold text-lg">{order.party_name}</h4>
          <p className="text-sm text-muted-foreground">[{order.quality_name}]</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>{order.progress_pct}%</span>
          <span className="text-muted-foreground text-xs">
            ({order.meters_produced.toLocaleString('en-IN')} / {order.total_target_meters.toLocaleString('en-IN')} m)
          </span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full ${isComplete ? 'bg-success' : 'bg-primary'}`} 
            style={{ width: `${Math.min(100, order.progress_pct)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          {isComplete ? (
            <span className="text-success font-medium">Complete</span>
          ) : (
            <PaceIndexBadge paceIndex={order.pace_index} daysRemaining={order.days_remaining} />
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Deadline ({formatDate(order.deadline)})</p>
          {!isComplete && <ForecastLabel projectedFinishDate={order.projected_finish_date} deadline={order.deadline} />}
        </div>
      </div>

      <div className="pt-4 border-t border-border mt-auto">
        <div className="flex items-center flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Machines:</span>
          {order.assigned_machines.length === 0 ? (
            <span className="italic">None</span>
          ) : (
            order.assigned_machines.map((m: { id: string, name: string }) => (
              <span key={m.id} className="bg-muted px-2 py-0.5 rounded text-foreground">
                [{m.name}]
              </span>
            ))
          )}
          {/* Note: allMachines prop requires context wrapper so passing empty for now; to be connected via parent context */}
          <MachineAssignSheet 
            orderId={order.id}
            orderName={order.party_name}
            qualityName={order.quality_name}
            currentMachineIds={order.assigned_machines.map((m: { id: string, name: string }) => m.id)}
            allMachines={[]} 
          />
        </div>
      </div>
    </div>
  )
}
