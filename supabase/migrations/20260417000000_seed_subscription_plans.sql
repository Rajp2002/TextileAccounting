-- Seed the subscription plans into the database
-- This ensures the foreign key constraints in org_subscriptions don't fail

INSERT INTO public.subscription_plans (id, name, amount_paise, interval)
VALUES 
  ('plan_SeGvwQdsTlRbZd', 'Base Tier', 236000, 'monthly'),
  ('plan_SeGwtIQO8LE25h', 'Premium Tier', 590000, 'monthly')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  amount_paise = EXCLUDED.amount_paise,
  interval = EXCLUDED.interval;
