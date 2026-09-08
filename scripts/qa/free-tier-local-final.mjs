/** Isolated full-schema Storage, retention and post-upgrade persistence checks. */
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const free=JSON.parse(readFileSync('/tmp/weavly-free-browser-fixture.json','utf8')),paid=JSON.parse(readFileSync('/tmp/weavly-free-ui-fixture.json','utf8'))
for(const id of [free.userId,paid.orgId])assert.match(id,/^[0-9a-f-]{36}$/)
const container='supabase_db_weavly-free-sprint-20260908'
const sql=`BEGIN;
CREATE POLICY free_qa_permissive ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);
INSERT INTO storage.buckets(id,name)VALUES('free-qa','free-qa');
INSERT INTO storage.objects(bucket_id,name)VALUES('free-qa','private-result');
SELECT set_config('request.jwt.claims','{"sub":"${free.userId}","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','${free.userId}',true);
SET LOCAL ROLE authenticated;
DO $$BEGIN IF (SELECT count(*) FROM storage.objects WHERE bucket_id='free-qa')<>0 THEN RAISE EXCEPTION 'Free Storage read leaked'; END IF;
BEGIN INSERT INTO storage.objects(bucket_id,name)VALUES('free-qa','forbidden');RAISE EXCEPTION 'Free Storage write allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END$$;
RESET ROLE;
DO $$BEGIN
IF (SELECT count(*) FROM estimator_quotes WHERE org_id='${paid.orgId}')<>1 THEN RAISE EXCEPTION 'Explicit save must create exactly one costing';END IF;
IF EXISTS(SELECT 1 FROM cost_rate_book WHERE org_id='${paid.orgId}' AND review_interval_days IS NULL) THEN RAISE EXCEPTION 'Missing review interval';END IF;
IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='weavly-free-retention' AND NOT active) THEN RAISE EXCEPTION 'Retention must be inactive';END IF;
END$$;
UPDATE free_calculation_receipts SET issued_at=now()-interval '31 days',completed_at=now()-interval '31 days',expires_at=now()-interval '1 day' WHERE subject_id='${free.userId}';
SELECT prune_free_operational_metadata();
DO $$BEGIN IF EXISTS(SELECT 1 FROM free_calculation_receipts WHERE subject_id='${free.userId}')THEN RAISE EXCEPTION 'Expired receipts not pruned';END IF;END$$;
ROLLBACK;`
execFileSync('docker',['exec','-i',container,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']})
console.log('PASS: restrictive Storage reads/writes deny Free despite a permissive policy; exactly one explicit paid costing; non-null first-save rate review interval; retention inactive; expired receipts pruned; test transaction rolled back')
