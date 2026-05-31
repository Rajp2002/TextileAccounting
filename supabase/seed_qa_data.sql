-- ==============================================================================
-- Weavly QA Seeding Script
-- Seeds active looms, active workers, active orders, and shift assignments
-- for local testing of supervisor meter logging and floor workflows.
-- ==============================================================================

DO $$
DECLARE
  v_org_id UUID;
  v_worker_id_1 BIGINT;
  v_worker_id_2 BIGINT;
  v_order_id UUID;
  v_machine_id_1 UUID;
  v_machine_id_2 UUID;
  v_today DATE;
BEGIN
  -- 1. Resolve date using Asia/Kolkata timezone to match the supervisor board
  v_today := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  -- 2. Locate organization (preferring the profile of 'Raj Patel', fallback to first org)
  SELECT org_id INTO v_org_id FROM profiles WHERE full_name = 'Raj Patel' LIMIT 1;
  
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations LIMIT 1;
  END IF;
  
  IF v_org_id IS NULL THEN
    RAISE WARNING 'No organization found. Please complete the owner sign-up and onboarding process first.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Seeding QA data for organization % on date %', v_org_id, v_today;

  -- 3. Seed active piece-rate workers
  SELECT id INTO v_worker_id_1 FROM workers WHERE org_id = v_org_id AND name = 'QA Worker Vikas' LIMIT 1;
  IF v_worker_id_1 IS NULL THEN
    INSERT INTO workers (org_id, name, rate_per_meter, is_active)
    VALUES (v_org_id, 'QA Worker Vikas', 2.50, TRUE)
    RETURNING id INTO v_worker_id_1;
  END IF;

  SELECT id INTO v_worker_id_2 FROM workers WHERE org_id = v_org_id AND name = 'QA Worker Dwarkesh' LIMIT 1;
  IF v_worker_id_2 IS NULL THEN
    INSERT INTO workers (org_id, name, rate_per_meter, is_active)
    VALUES (v_org_id, 'QA Worker Dwarkesh', 2.50, TRUE)
    RETURNING id INTO v_worker_id_2;
  END IF;

  -- 4. Seed active looms (machines)
  SELECT id INTO v_machine_id_1 FROM machines WHERE org_id = v_org_id AND name = 'QA Loom 1' LIMIT 1;
  IF v_machine_id_1 IS NULL THEN
    INSERT INTO machines (org_id, name, status, default_rate_per_m)
    VALUES (v_org_id, 'QA Loom 1', 'active', 2.50)
    RETURNING id INTO v_machine_id_1;
  END IF;

  SELECT id INTO v_machine_id_2 FROM machines WHERE org_id = v_org_id AND name = 'QA Loom 2' LIMIT 1;
  IF v_machine_id_2 IS NULL THEN
    INSERT INTO machines (org_id, name, status, default_rate_per_m)
    VALUES (v_org_id, 'QA Loom 2', 'active', 2.50)
    RETURNING id INTO v_machine_id_2;
  END IF;

  -- Ensure they are marked active
  UPDATE machines SET status = 'active' WHERE id IN (v_machine_id_1, v_machine_id_2);

  -- 5. Seed an active production order
  SELECT id INTO v_order_id FROM orders WHERE org_id = v_org_id AND party_name = 'QA Seed Party' AND status = 'active' LIMIT 1;
  IF v_order_id IS NULL THEN
    INSERT INTO orders (
      org_id,
      party_name,
      quality_label,
      total_target_meters,
      start_date,
      deadline,
      status,
      notes,
      warp_instruction,
      weft_instruction,
      worker_rate_per_m
    )
    VALUES (
      v_org_id,
      'QA Seed Party',
      'QA Seed Canvas',
      2500,
      v_today,
      v_today + 30,
      'active',
      'Seeded active order for QA floor production logs',
      '50/48 + 70/36',
      '50/48',
      2.50
    )
    RETURNING id INTO v_order_id;
  END IF;

  -- 6. Assign the order to the machines as their current active order
  UPDATE machines
  SET current_order_id = v_order_id
  WHERE id IN (v_machine_id_1, v_machine_id_2);

  -- 7. Pre-populate shift assignments for the timezone-matched current date
  INSERT INTO shift_assignments (org_id, date, shift, machine_id, worker_id, order_id, rate_per_m)
  VALUES
    (v_org_id, v_today, 'day', v_machine_id_1, v_worker_id_1, v_order_id, 2.50),
    (v_org_id, v_today, 'day', v_machine_id_2, v_worker_id_2, v_order_id, 2.50),
    (v_org_id, v_today, 'night', v_machine_id_1, v_worker_id_1, v_order_id, 2.50),
    (v_org_id, v_today, 'night', v_machine_id_2, v_worker_id_2, v_order_id, 2.50)
  ON CONFLICT (org_id, date, shift, machine_id) DO UPDATE
  SET worker_id = EXCLUDED.worker_id,
      order_id = EXCLUDED.order_id,
      rate_per_m = EXCLUDED.rate_per_m;

  RAISE NOTICE 'QA Seeding successfully completed for org %!', v_org_id;
END $$;
