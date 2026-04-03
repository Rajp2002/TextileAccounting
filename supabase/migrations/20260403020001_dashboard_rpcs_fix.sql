create or replace function get_kpi_yesterday(
  p_org_id uuid,
  p_date   date
)
returns jsonb language plpgsql stable security definer as $$
declare
  v_total_meters       numeric;
  v_piece_rate_wages   numeric;
  v_fixed_payroll      numeric;
  v_efficiency_pct     numeric;
  v_days_in_month      int;
  v_active_fixed       int;
  v_avg_salary         numeric;
begin
  select
    case when count(pl.id) = 0 then null else coalesce(sum(pl.meters), 0) end,
    case when count(pl.id) = 0 then null else coalesce(sum(pl.meters * pl.worker_rate_snapshot), 0) end
  into v_total_meters, v_piece_rate_wages
  from production_logs pl
  where pl.org_id = p_org_id
    and pl.date   = p_date;

  select count(*), coalesce(sum(fw.monthly_salary), 0), extract(days from date_trunc('month', p_date + interval '1 month') - date_trunc('month', p_date))::int
  into v_active_fixed, v_avg_salary, v_days_in_month
  from fixed_workers fw
  where fw.org_id    = p_org_id
    and fw.is_active = true;

  v_fixed_payroll := case when v_days_in_month > 0 then v_avg_salary / v_days_in_month else 0 end;

  select case when coalesce(sum(yb.weight_kg * q.target_yield_per_kg), 0) > 0 then round(sum(pl2.meters) / sum(yb.weight_kg * q.target_yield_per_kg) * 100, 1) else null end
  into v_efficiency_pct
  from production_logs pl2
  join yarn_batches yb on yb.id = pl2.yarn_batch_id
  join qualities    q  on q.id  = yb.quality_id
  where pl2.org_id = p_org_id
    and pl2.date   = p_date;

  return jsonb_build_object(
    'total_meters',     v_total_meters,
    'piece_rate_wages', v_piece_rate_wages,
    'fixed_payroll',    v_fixed_payroll,
    'efficiency_pct',   v_efficiency_pct
  );
end;
$$;

create or replace function get_kpi_today_live(
  p_org_id uuid,
  p_date   date
)
returns jsonb language plpgsql stable security definer as $$
declare
  v_total_meters     numeric;
  v_piece_rate_wages numeric;
  v_active_machines  int;
begin
  select
    case when count(pl.id) = 0 then null else coalesce(sum(pl.meters), 0) end,
    case when count(pl.id) = 0 then null else coalesce(sum(pl.meters * pl.worker_rate_snapshot), 0) end
  into v_total_meters, v_piece_rate_wages
  from production_logs pl
  where pl.org_id = p_org_id
    and pl.date   = p_date;

  select case when count(distinct m.id) = 0 then null else count(distinct m.id) end
  into v_active_machines
  from machines m
  where m.org_id    = p_org_id
    and m.status = 'active'
    and m.current_beam_id is not null;

  return jsonb_build_object(
    'total_meters',     v_total_meters,
    'piece_rate_wages', v_piece_rate_wages,
    'active_machines',  v_active_machines
  );
end;
$$;

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
      'quality_name',      q.name,
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
  join qualities q on q.id = o.quality_id
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
