-- Update default compliance settings to match the final policy
UPDATE compliance_settings
SET 
    gro_name = 'Raj Patel',
    gro_email = 'rajpatel86420@gmail.com',
    updated_at = now()
WHERE id = TRUE;

-- Update the default values in the table definition for future resets
ALTER TABLE compliance_settings 
ALTER COLUMN gro_name SET DEFAULT 'Raj Patel',
ALTER COLUMN gro_email SET DEFAULT 'rajpatel86420@gmail.com';
