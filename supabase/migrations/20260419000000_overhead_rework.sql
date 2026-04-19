-- Migration: Add factory-level loom count and seed expanded overhead presets
ALTER TABLE factory_cost_profile
  ADD COLUMN IF NOT EXISTS loom_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_working_days integer DEFAULT 26,
  ADD COLUMN IF NOT EXISTS avg_output_per_loom_per_day integer DEFAULT 50;

-- Seed expanded overhead presets for existing factory profiles
-- Only updates rows where overhead_items is empty array or has old 4-item structure
UPDATE factory_cost_profile
SET overhead_items = '[
  {"id":"preset-rent","category":"rent","label":"Rent / Lease","monthlyAmount":0,"isPreset":true,"isLocked":false},
  {"id":"preset-elec","category":"electricity","label":"Electricity & Power","monthlyAmount":0,"isPreset":true,"isLocked":false,"meta":{"type":"electricity","mode":"manual"}},
  {"id":"preset-spares","category":"spares_repairs","label":"Machine Spares & Repairs","monthlyAmount":0,"isPreset":true,"isLocked":false},
  {"id":"preset-oil","category":"oil_lubricants","label":"Oil & Lubricants","monthlyAmount":0,"isPreset":true,"isLocked":false},
  {"id":"preset-drawing","category":"drawing_denting","label":"Drawing / Denting / Knotting","monthlyAmount":0,"isPreset":true,"isLocked":false},
  {"id":"preset-bank","category":"bank_interest","label":"Bank Interest / Loan EMI","monthlyAmount":0,"isPreset":true,"isLocked":false},
  {"id":"preset-depreciation","category":"depreciation","label":"Machine Depreciation","monthlyAmount":0,"isPreset":true,"isLocked":true,"meta":{"type":"depreciation","loomCount":0,"avgCostPerLoom":1000000,"usefulLifeYears":10}},
  {"id":"preset-water","category":"water","label":"Water","monthlyAmount":0,"isPreset":true,"isLocked":false},
  {"id":"preset-security","category":"security","label":"Security / Watchman","monthlyAmount":0,"isPreset":true,"isLocked":false},
  {"id":"preset-admin","category":"admin","label":"Administrative","monthlyAmount":0,"isPreset":true,"isLocked":false}
]'::jsonb
WHERE (overhead_items IS NULL OR overhead_items = '[]'::jsonb OR jsonb_array_length(overhead_items) = 0)
  AND factory_id IS NOT NULL;
