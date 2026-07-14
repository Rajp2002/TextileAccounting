-- B14 dashboard recovery: the worker breakdown RPC referenced the removed
-- production_logs.created_at column. The canonical submission timestamp is
-- production_logs.submitted_at.

create or replace function public.get_worker_breakdown_today(
  p_org_id uuid,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'worker_id', w.id,
        'worker_name', w.name,
        'total_meters', coalesce(worker_totals.total_meters, 0),
        'total_wages', coalesce(worker_totals.total_wages, 0),
        'entries', coalesce(worker_totals.entries, '[]'::jsonb)
      )
      order by worker_totals.total_wages desc
    )
    from public.workers w
    left join lateral (
      select
        sum(pl.meters) as total_meters,
        sum(pl.meters * pl.worker_rate_snapshot) as total_wages,
        jsonb_agg(
          jsonb_build_object(
            'machine_name', m.name,
            'meters', pl.meters,
            'rate', pl.worker_rate_snapshot,
            'wages', pl.meters * pl.worker_rate_snapshot,
            'shift', pl.shift,
            'logged_at', pl.submitted_at
          )
          order by pl.submitted_at, pl.id
        ) as entries
      from public.production_logs pl
      join public.machines m on m.id = pl.machine_id
      where coalesce(pl.meter_worker_id, pl.worker_id) = w.id
        and pl.org_id = p_org_id
        and pl.date = p_date
    ) worker_totals on true
    where w.org_id = p_org_id
      and w.is_active = true
      and coalesce(worker_totals.total_meters, 0) > 0
  ), '[]'::jsonb);
end;
$$;

comment on function public.get_worker_breakdown_today(uuid, date) is
  'Returns one organization/day worker production and wage breakdown using immutable rate snapshots and submitted_at ordering.';
