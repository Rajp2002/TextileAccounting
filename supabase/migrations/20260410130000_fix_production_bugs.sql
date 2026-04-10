-- Fix `get_kpi_today_live` using deprecated column `current_beam_id`
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
    and m.current_order_id is not null;

  return jsonb_build_object(
    'total_meters',     v_total_meters,
    'piece_rate_wages', v_piece_rate_wages,
    'active_machines',  v_active_machines
  );
end;
$$;

-- Fix previously entered zero rates by looking up active orders or jumping back to default
UPDATE production_logs pl
SET worker_rate_snapshot = COALESCE(
  (SELECT o.worker_rate_per_m FROM orders o WHERE o.id = pl.order_id AND o.worker_rate_per_m > 0),
  1.5
)
WHERE worker_rate_snapshot = 0;
