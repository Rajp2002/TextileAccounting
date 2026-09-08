INSERT INTO auth.users(id,email) VALUES ('10000000-0000-4000-8000-000000000001','stock-test@local.invalid'),('10000000-0000-4000-8000-000000000002','other-test@local.invalid'),('10000000-0000-4000-8000-000000000003','supervisor-test@local.invalid');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
INSERT INTO public.organizations(id,name) VALUES('20000000-0000-4000-8000-000000000001','Local Stock Test'),('20000000-0000-4000-8000-000000000002','Other Local Test');
INSERT INTO public.profiles(id,org_id,role,full_name) VALUES
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','owner','Stock Tester'),
('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','owner','Other Tester'),
('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','supervisor','Supervisor Tester');
INSERT INTO public.org_subscriptions(org_id,plan_tier,status,current_start,current_end) VALUES
('20000000-0000-4000-8000-000000000001','base','active',now()-interval '1 day',now()+interval '1 year'),
('20000000-0000-4000-8000-000000000002','base','active',now()-interval '1 day',now()+interval '1 year');
INSERT INTO public.estimator_quotes(id,org_id,record_kind,quality_label,yarn_denier,meters,yarn_rate_per_kg,landed_cost_per_meter,quote_price_per_meter,intended_margin_percent,worker_rate_per_m) VALUES
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','costing','Cotton',100,1000,100,20,40,50,2),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','costing','Silk',100,1000,100,20,40,50,2);
INSERT INTO public.base_production_jobs(id,org_id,costing_id,quality_label,target_meters,start_date,status) VALUES
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Cotton',10000,'2026-08-01','active'),
('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','Silk',10000,'2026-08-01','active');
INSERT INTO public.base_production_workers(id,org_id,name,rate_per_meter,shift_availability) VALUES
('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Worker One',2,'both'),
('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Worker Two',2,'both');
INSERT INTO public.base_production_machines(id,org_id,name,machine_type) VALUES
('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Loom One','power_loom'),
('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Loom Two','power_loom');
INSERT INTO public.base_worker_machine_assignments(org_id,worker_id,machine_id,shift,effective_from) VALUES
('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','day','2026-08-01'),
('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','day','2026-08-01');

INSERT INTO public.base_machine_job_contexts(org_id,machine_id,job_id,effective_from) VALUES
('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-08-01'),
('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','2026-08-01');