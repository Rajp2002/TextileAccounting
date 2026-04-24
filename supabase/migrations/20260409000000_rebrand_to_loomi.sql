-- MIGRATION: Rebrand Vastra to Weavly (Database Update)
-- This migration updates existing organization names to the new Weavly brand.

UPDATE organizations 
SET name = 'Weavly' 
WHERE name ILIKE '%Vastra%' OR name = 'Textile SaaS';
