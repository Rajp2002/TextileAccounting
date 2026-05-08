-- Fix dashboard KPI RPC after yarn inventory schema renamed yield columns.
-- Previous versions referenced yarn_batches.weight_kg and qualities.target_yield_per_kg,
-- which are not present in the current schema.

create or replace function get_kpi_yesterday(
  p_org_id uuid,
  p_date   date
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_total_meters       numeric;
  v_piece_rate_wages   numeric;
  v_fixed_payroll      numeric;
  v_efficiency_pct     numeric;
  v_days_in_month      int;
  v_fixed_salary_total numeric;
begin
  select
    case when count(pl.id) = 0 then null else coalesce(sum(pl.meters), 0) end,
    case when count(pl.id) = 0 then null else coalesce(sum(pl.meters * coalesce(pl.worker_rate_snapshot, 0)), 0) end
  into v_total_meters, v_piece_rate_wages
  from production_logs pl
  where pl.org_id = p_org_id
    and pl.date   = p_date;

  select
    coalesce(sum(fw.monthly_salary), 0),
    extract(days from date_trunc('month', p_date + interval '1 month')
                   - date_trunc('month', p_date))::int
  into v_fixed_salary_total, v_days_in_month
  from fixed_workers fw
  where fw.org_id    = p_org_id
    and fw.is_active = true;

  v_fixed_payroll := case
    when v_days_in_month > 0 then v_fixed_salary_total / v_days_in_month
    else 0
  end;

  select case
           when coalesce(sum((yb.total_weight_kg - coalesce(yb.leftover_weight_kg, 0)) * q.target_yield), 0) > 0
           then round(
             sum(pl2.meters) filter (where yb.id is not null and q.id is not null)
             / sum((yb.total_weight_kg - coalesce(yb.leftover_weight_kg, 0)) * q.target_yield)
             * 100,
             1
           )
           else null
         end
  into v_efficiency_pct
  from production_logs pl2
  left join yarn_batches yb on yb.id = pl2.yarn_batch_id
  left join qualities q on q.id = yb.quality_id
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
