-- MIGRATION: Rebrand Vastra to Loomi (Database Update)
-- This migration updates existing organization names to the new Loomi brand.

UPDATE organizations 
SET name = 'Loomi' 
WHERE name ILIKE '%Vastra%' OR name = 'Textile SaaS';
