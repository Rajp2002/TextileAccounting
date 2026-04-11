-- ============================================================
-- MIGRATION: Fix KPI RPCs for Dashboard (Resilience)
-- Changes INNER JOIN to LEFT JOIN for efficiency calculation
-- to ensure production data is shown even if yarn batch or 
-- quality data is incomplete for that day.
-- ============================================================

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
  -- 1. Get raw totals from production_logs
  select
    case when count(pl.id) = 0 then null else coalesce(sum(pl.meters), 0) end,
    case when count(pl.id) = 0 then null else coalesce(sum(pl.meters * pl.worker_rate_snapshot), 0) end
  into v_total_meters, v_piece_rate_wages
  from production_logs pl
  where pl.org_id = p_org_id
    and pl.date   = p_date;

  -- 2. Fixed payroll calculation
  select count(*), coalesce(sum(fw.monthly_salary), 0), extract(days from date_trunc('month', p_date + interval '1 month') - date_trunc('month', p_date))::int
  into v_active_fixed, v_avg_salary, v_days_in_month
  from fixed_workers fw
  where fw.org_id    = p_org_id
    and fw.is_active = true;

  v_fixed_payroll := case when v_days_in_month > 0 then v_avg_salary / v_days_in_month else 0 end;

  -- 3. Efficiency calculation (now with LEFT JOINs to prevent row filtering)
  -- We only calculate efficiency if there are logs that HAVE a matching yarn batch and quality.
  -- If some logs don't have them, they are just skipped in THIS calculation without zeroing the whole thing.
  select case 
           when coalesce(sum(yb.weight_kg * q.target_yield_per_kg), 0) > 0 
           then round(sum(pl2.meters) / sum(yb.weight_kg * q.target_yield_per_kg) * 100, 1) 
           else null 
         end
  into v_efficiency_pct
  from production_logs pl2
  left join yarn_batches yb on yb.id = pl2.yarn_batch_id
  left join qualities    q  on q.id  = yb.quality_id
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
