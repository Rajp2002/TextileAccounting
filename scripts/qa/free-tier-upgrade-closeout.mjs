/** Read-only, isolated fixture proof after explicit paid browser save. */
import {readFileSync} from 'node:fs'
import {parseEnv} from 'node:util'
import assert from 'node:assert/strict'
const e=parseEnv(readFileSync('/tmp/weavly-free-local.env','utf8')),f=JSON.parse(readFileSync('/tmp/weavly-free-browser-fixture.json','utf8'))
assert.match(e.API_URL,/^http:\/\/127\.0\.0\.1:\d+$/)
async function rows(table,scope='org_id',id=f.orgId){const r=await fetch(`${e.API_URL}/rest/v1/${table}?select=*&${scope}=eq.${id}`,{headers:{apikey:e.ANON_KEY,Authorization:`Bearer ${e.SERVICE_ROLE_KEY}`}});assert.equal(r.status,200);return r.json()}
assert.equal((await rows('free_saved_costings')).length,1)
assert.equal((await rows('free_saved_costings'))[0].estimate.profitPct,20)
assert.equal((await rows('free_monthly_usage','subject_id',f.userId))[0].used,1)
assert.equal((await rows('estimator_quotes')).length,1)
assert.equal((await rows('estimator_templates')).length,1)
assert((await rows('cost_rate_book')).every(r=>r.review_interval_days!==null))
console.log('PASS: original 20% Free snapshot and one-unit usage preserved after Lite activation and explicit paid save; exactly one paid costing and one saved quality; Rate Book review intervals populated')
