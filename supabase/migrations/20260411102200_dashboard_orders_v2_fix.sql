-- ============================================================
-- MIGRATION: Fix dashboard RPCs for Orders V2
-- Changed INNER JOIN to LEFT JOIN for qualities in get_active_orders_with_pace
-- so that orders without a quality_id are not filtered out.
-- ============================================================

create or replace function get_active_orders_with_pace(
  p_org_id uuid,
  p_date   date
)
returns jsonb language plpgsql stable security definer as $$
declare
  v_result jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',                o.id,
      'party_name',        o.party_name,
      'quality_name',      coalesce(q.name, o.quality_label, 'Unnamed'),
      'total_target_meters', o.total_target_meters,
      'deadline',          o.deadline,
      'days_remaining',    (o.deadline - p_date)::int,
      'meters_produced',   coalesce(progress.meters_produced, 0),
      'meters_remaining',  o.total_target_meters - coalesce(progress.meters_produced, 0),
      'progress_pct',      round(
                             coalesce(progress.meters_produced, 0)
                             / nullif(o.total_target_meters, 0) * 100
                           , 1),
      'pace_index',        case
                             when (o.deadline - p_date) <= 0 then 0
                             else round(
                               coalesce(trailing_avg.avg_meters_per_day, 0)
                               / nullif(
                                 (o.total_target_meters - coalesce(progress.meters_produced, 0))
                                 / nullif((o.deadline - p_date), 0)
                               , 0)
                             , 2)
                           end,
      'projected_finish_date', case
                                 when coalesce(trailing_avg.avg_meters_per_day, 0) = 0 then null
                                 else (p_date + (
                                   (o.total_target_meters - coalesce(progress.meters_produced, 0))
                                   / trailing_avg.avg_meters_per_day
                                 )::int)
                               end,
      'assigned_machines', coalesce(machines.machine_list, '[]'::jsonb)
    )
    order by o.deadline asc
  ), '[]'::jsonb)
  into v_result
  from orders o
  left join qualities q on q.id = o.quality_id -- changed from JOIN
  left join lateral (
    select sum(pl.meters) as meters_produced
    from production_logs pl
    where pl.order_id = o.id
  ) progress on true
  left join lateral (
    -- 7-day trailing average
    select coalesce(
      sum(pl2.meters) filter (where pl2.date >= p_date - 6)
      / nullif(count(distinct pl2.date) filter (where pl2.date >= p_date - 6), 0)
    , 0) as avg_meters_per_day
    from production_logs pl2
    where pl2.order_id = o.id
  ) trailing_avg on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name))
    as machine_list
    from machines m
    where m.current_order_id = o.id
      and m.status = 'active'
  ) machines on true
  where o.org_id = p_org_id
    and o.status = 'active';

  return v_result;
end;
$$;
