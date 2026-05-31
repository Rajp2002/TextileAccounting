-- ============================================================
-- MIGRATION: Auto Unlink Closed Market Runs
-- Automatically completes backing orders, unlinks assigned looms
-- (machines), and clears shift assignments when a market run is closed.
-- ============================================================

-- 1. TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.trg_handle_market_run_closed()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'closed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'closed') THEN
        -- 1. Update backing orders to completed
        UPDATE public.orders
        SET status = 'completed'
        WHERE market_run_id = NEW.id;

        -- 2. Unlink machines and set them to inactive
        UPDATE public.machines
        SET current_order_id = NULL,
            status = 'inactive'
        WHERE current_order_id IN (
            SELECT id FROM public.orders WHERE market_run_id = NEW.id
        );

        -- 3. Clear order_id on shift_assignments
        UPDATE public.shift_assignments
        SET order_id = NULL
        WHERE order_id IN (
            SELECT id FROM public.orders WHERE market_run_id = NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. CREATE TRIGGER
DROP TRIGGER IF EXISTS trg_market_run_closed ON public.market_runs;
CREATE TRIGGER trg_market_run_closed
    AFTER INSERT OR UPDATE ON public.market_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_handle_market_run_closed();

-- 3. RETROACTIVE DATA CLEANUP (Fix existing inconsistent closed market runs)
-- Complete backing orders of closed runs
UPDATE public.orders
SET status = 'completed'
WHERE status = 'active'
  AND market_run_id IN (
    SELECT id FROM public.market_runs WHERE status = 'closed'
  );

-- Unlink machines and set them to inactive
UPDATE public.machines
SET current_order_id = NULL,
    status = 'inactive'
WHERE current_order_id IN (
    SELECT id FROM public.orders WHERE market_run_id IN (
        SELECT id FROM public.market_runs WHERE status = 'closed'
    )
);

-- Clear order_id on shift_assignments
UPDATE public.shift_assignments
SET order_id = NULL
WHERE order_id IN (
    SELECT id FROM public.orders WHERE market_run_id IN (
        SELECT id FROM public.market_runs WHERE status = 'closed'
    )
);
