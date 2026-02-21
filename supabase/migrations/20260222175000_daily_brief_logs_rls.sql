-- Enable read access for organization members
CREATE POLICY "Users can view their organization's daily brief logs"
ON daily_brief_logs FOR SELECT
TO authenticated
USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
);
