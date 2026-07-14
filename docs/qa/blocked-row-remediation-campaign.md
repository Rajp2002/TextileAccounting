# Weavly Blocked-Row Remediation Campaign

Continue the formal Weavly QA campaign from the current repository state.

## Current verified baseline

Batch 8 has already been completed, committed, deployed, and validated in production.

Current formal matrix:

- PASS: 270
- FAIL: 3
- BLOCKED: 103
- NOT APPLICABLE: 1
- Total: 377

Recently completed:

- MASTER-011 moved from blocked to pass.
- Production deployment is Ready at:
  https://textile-accounting.vercel.app
- Batch 8 validation completed successfully.
- No database migration was required for Batch 8.

Do not reopen or regress completed Batch 8 work unless new evidence proves it is broken.

---

# Primary objective

Systematically process all 103 currently blocked matrix rows and convert as many as legitimately possible into evidence-backed PASS results.

Do this as a continuous multi-batch campaign.

You must:

1. Inspect every currently blocked row.
2. Identify correlations and common root causes.
3. Group correlated rows into coherent remediation batches.
4. Work through one batch completely.
5. Validate the batch through real runtime proof.
6. Update the canonical formal matrix and evidence.
7. run the repository’s documentation closeout skill/process.
8. Commit and push the completed batch.
9. Deploy the committed batch to production.
10. Verify the production deployment and affected workflows.
11. Record the production evidence and deployment details.
12. Automatically begin the next batch.
13. Continue until all blocked rows have been processed or only genuine external blockers remain.

Do not stop after preparing a plan.

Do not stop after completing only one batch.

Do not ask for routine approval between batches.

Continue autonomously unless an action would be genuinely irreversible, destructive beyond disposable test data, require unavailable credentials, or affect a real external party.

---

# Source of truth

Before changing anything:

1. Read all applicable repository instructions, including:
   - `AGENTS.md`
   - repository-local skill instructions
   - QA campaign documentation
   - the canonical formal matrix
   - previous batch closeout documents
   - deployment instructions
   - test-account documentation
   - environment documentation
   - migration conventions
2. Locate the repository’s official documentation-closeout skill or equivalent workflow.
3. Identify the exact canonical matrix file.
4. Identify the current campaign tracker and evidence directories.
5. Identify the current branch, working tree state, and latest deployed commit.
6. Preserve all legitimate existing work.
7. Do not create a competing or duplicate formal matrix.
8. Do not replace canonical evidence with a new disconnected tracker.

Use the canonical matrix as the authoritative status record.

If documentation paths have changed, follow the current repository structure rather than assuming old paths.

---

# Environment policy

The production application and production database currently contain disposable test accounts and test data rather than real pilot customers.

This permits safe end-to-end production verification using clearly identified disposable test tenants and accounts.

However:

- Do not expose secrets.
- Do not write production credentials into documentation or evidence.
- Do not modify resources outside this Weavly project.
- Do not reset or drop an entire database merely for convenience.
- Do not purge all existing test data unless a specific test requires cleanup.
- Prefer isolated, clearly named campaign tenants and accounts.
- Record all created test identities so they can later be removed.
- Avoid destructive operations when a scoped cleanup is sufficient.

QA should normally be used for initial diagnosis and validation.

Production must not be left behind.

If a code, schema, policy, RPC, function, trigger, storage, configuration, or migration change is required:

1. Validate it in QA first where practical.
2. Apply the equivalent required change to production.
3. Verify production migration/configuration state.
4. Deploy the corresponding application commit.
5. run production runtime proof.
6. Do not declare the batch complete while the fix exists only in QA.

A QA-only fix is not campaign completion.

Never report “deployed to production” unless the deployed production commit and any required production database changes have both been verified.

---

# Phase 1: Blocked-row inventory and correlation analysis

Load all 103 blocked rows and construct a working inventory containing, at minimum:

- Matrix row ID
- Feature/workflow
- User role
- Current blocked reason
- Original expected behavior
- Existing evidence
- Required prerequisites
- Related routes/components
- Related API calls, RPCs, tables, policies, functions, or migrations
- Environment involved
- Whether the blocker is reproducible
- Whether the blocker is internal and remediable
- Likely root cause
- Related blocked rows
- Upstream and downstream dependency rows
- Proposed batch
- Proposed validation method

Look for correlations such as:

- Several rows blocked by the same account-provisioning failure
- Shared authentication or authorization problems
- Shared tenant or organization setup problems
- Shared role/permission/RLS problems
- Shared date, timezone, rate, snapshot, or historical-data behavior
- Shared route, component, form, action, hook, API, or RPC
- Shared database schema or migration prerequisite
- Shared order, quote, loom, worker, production, stock, payroll, dispatch, receipt, commercial, or reporting workflow
- Shared external dependency
- Rows blocked only because an upstream prerequisite row was blocked
- Rows that can be proven together through one end-to-end workflow
- Rows whose original blocker may now have been resolved by earlier batches

Do not simply process rows in matrix order.

Prioritize batches that unlock the largest number of rows.

---

# Batch construction rules

Create ordered batches based on root cause and proof efficiency.

A good batch should generally contain approximately 5–20 rows, but use a different size when the dependency structure justifies it.

Prioritize:

1. Shared setup and provisioning blockers
2. Authentication, tenant, and authorization blockers
3. Upstream workflow prerequisites
4. Root causes blocking several downstream rows
5. Rows likely already fixed by previous work but lacking runtime proof
6. High-risk financial, stock, payroll, tenant-isolation, and historical-data workflows
7. Isolated one-off blockers

Each batch must have:

- Batch ID and descriptive name
- Included matrix row IDs
- Shared root cause or workflow
- Why the rows belong together
- Required code/database/configuration work
- Required test data and user roles
- Runtime-proof plan
- Regression-test plan
- Production deployment plan
- Documentation-closeout plan
- Clear exit criteria

Maintain a persistent campaign checkpoint so another session can resume without redoing completed batches.

---

# Mandatory status semantics

Use the formal statuses honestly.

## PASS

A row may be marked PASS only when its expected behavior has been directly demonstrated through appropriate runtime proof.

PASS normally requires:

- Correct behavior observed in the UI or applicable runtime interface
- Correct role and tenant
- Correct persisted state
- Refresh/reload verification where persistence matters
- Re-login or new-session verification where session boundaries matter
- Cross-role verification where data moves between roles
- Correct calculations where money, stock, rates, payroll, quantity, or totals are involved
- Production verification after deployment when the row represents production behavior
- Evidence linked from the canonical matrix

Unit tests, source inspection, successful compilation, or code review alone are not sufficient to mark a runtime row PASS.

## FAIL

Mark a row FAIL when:

- The required workflow was executed and behaved incorrectly
- The product produced an incorrect result
- A required internal setup step failed because of an application, repository, database, configuration, or deployment defect
- A regression is discovered during proof
- The expected behavior cannot be achieved because the implementation remains defective

Do not label an internal product failure as BLOCKED merely because it prevented downstream testing.

## BLOCKED

A row may remain BLOCKED only when proof cannot proceed because of a genuine dependency outside the repository and outside the available environment or permissions.

Examples may include:

- An unavailable third-party service that cannot be substituted
- Missing credentials that are not available in the environment
- Required hardware or device access unavailable to the session
- A real external approval or account dependency
- A platform outage outside the project

The blocked reason must be precise and supported by evidence.

“Setup failed,” “could not test,” “login did not work,” “account creation failed,” “environment issue,” or “ran out of time” are not sufficient blocked reasons when the cause is internal and potentially fixable.

## NOT APPLICABLE

Use only when the documented requirement genuinely does not apply.

Do not use NOT APPLICABLE as an escape hatch for difficult proof.

## PASS-READY

“Pass-ready” may be used only as an internal working label in batch notes when implementation is complete but final runtime evidence is still pending.

Do not enter PASS-READY as the final formal matrix status unless the canonical matrix explicitly supports that status.

The formal row remains FAIL or BLOCKED until direct proof justifies PASS.

---

# Per-batch execution loop

For every batch, execute the complete lifecycle below.

## Step A: Reproduce and validate the existing blocker

For each included row:

1. Read the original requirement and existing evidence.
2. Verify whether the stated blocker still exists.
3. Determine whether an earlier batch has already removed the blocker.
4. Reproduce the workflow using the correct role, tenant, date, and data.
5. Capture the actual observed behavior.
6. Update the working root-cause analysis.

Do not assume the matrix status remains correct without retesting it.

Some blocked rows may already be passable and need only fresh evidence.

## Step B: Investigate the shared root cause

Trace affected behavior through all relevant layers:

- UI and routing
- Client state
- Form validation
- Server actions
- API handlers
- Authentication
- Authorization
- Tenant scoping
- RLS
- Database queries
- RPCs
- Functions and triggers
- Migrations
- Date and timezone handling
- Snapshot behavior
- Financial calculations
- Stock calculations
- Historical records
- Deployment configuration
- Environment variables
- Test-account provisioning
- Browser/runtime behavior

Determine the underlying cause rather than applying unrelated row-by-row patches.

## Step C: Implement the smallest coherent fix

Implement a durable shared fix that addresses the root cause.

Requirements:

- Preserve tenant isolation.
- Preserve financial correctness.
- Preserve historical snapshots.
- Avoid silent fallback behavior.
- Avoid weakening authorization to make tests pass.
- Avoid broad service-role bypasses in normal application paths.
- Avoid test-only production behavior.
- Do not hard-code campaign users, tenants, dates, IDs, or amounts.
- Add or improve regression tests.
- Follow existing repository architecture and conventions.
- Keep the change scoped to the batch.
- Do not silently refactor unrelated areas.

When a migration is needed:

1. Create it using repository conventions.
2. Apply and validate it in QA first where practical.
3. Apply it to production after QA validation.
4. Confirm migration history in both environments.
5. Test old and newly created data where relevant.
6. Record sanitized evidence.
7. Never leave production on an older required schema.

## Step D: Run targeted validation

Before broader testing:

- Run tests directly related to the root cause.
- Run relevant component, unit, integration, database, and browser tests.
- Reproduce the previously blocked workflow.
- Confirm the shared fix resolves all included rows it is expected to resolve.
- Check for regressions in adjacent workflows.

Fix failures before proceeding.

## Step E: Run runtime proof

Use real runtime proof rather than inferred proof.

Where relevant, execute the complete business chain:

Owner setup
→ quote/order or market run
→ assignment
→ supervisor production
→ generated stock
→ stock sale
→ dispatch
→ public receipt/tracking
→ commercials
→ receivable/payment
→ payroll and reporting

Not every batch requires the entire chain, but test enough of the chain to prove both upstream and downstream effects.

For each row, evidence should identify:

- Matrix row ID
- Date and time
- Environment
- Deployment URL
- Commit hash
- Tenant
- User role
- Test account identifier
- Preconditions
- Exact steps performed
- Expected behavior
- Actual behavior
- Relevant values and calculations
- Refresh/reload result
- Re-login/new-session result when applicable
- Cross-role result when applicable
- Sanitized database confirmation when applicable
- Screenshot, trace, log, or JSON evidence paths
- Final status and rationale

Keep the URL visible in browser evidence where possible.

Do not conceal console, network, hydration, authorization, database, or runtime errors.

Do not fabricate screenshots, records, logs, or database evidence.

Do not use manually edited database records as proof that the application workflow works unless the matrix row specifically tests direct database behavior.

## Step F: Verify persistence and historical correctness

When relevant:

- Refresh the page.
- Navigate away and back.
- Sign out and sign back in.
- Open the record under another applicable role.
- Verify the record on the correct production date.
- Verify previous/next date navigation.
- Verify historical rates remain snapshotted.
- Verify historical workers, looms, assignments, orders, production, stock, and payroll do not change when current configuration changes.
- Verify money and quantity calculations independently.
- Verify tenant isolation with a second tenant when applicable.
- Verify stale or cached UI does not falsely appear correct.

## Step G: Full repository validation

After targeted runtime proof passes, run the repository’s complete required validation suite using the commands defined by the repository.

At minimum, include applicable equivalents of:

- Unit/integration tests
- Browser/runtime tests
- TypeScript/type checking
- Lint
- Production build
- Matrix consistency validation
- Documentation validation
- Script syntax checks
- Migration checks
- Changed-file/diff checks
- Security or tenant-isolation tests relevant to the batch

Do not omit failing checks.

Document any intentional skip and prove that it is unrelated.

## Step H: Update the canonical formal matrix

Update every row included in the batch.

Each updated row must contain:

- Correct final status
- Concise but specific status rationale
- Runtime-proof summary
- Exact evidence references
- Environment
- Commit/deployment reference
- Remaining limitations, if any

Recalculate global counts programmatically where possible.

Confirm:

- No row has disappeared.
- No duplicate row exists.
- Total row count remains consistent unless an explicitly documented matrix correction is required.
- Status counts sum to the matrix total.
- Evidence links resolve.
- No completed PASS row was accidentally downgraded.
- No status was changed without evidence.

Do not create status-count drift between summaries and the canonical matrix.

## Step I: Documentation closeout

Run the repository’s official documentation-closeout skill or process.

The closeout must update all applicable canonical documentation, including:

- Batch closeout report
- Canonical formal matrix
- Evidence index
- Bug/fix summary
- Test summary
- Deployment summary
- Migration summary
- Disposable test-account inventory
- Production verification evidence
- Remaining blocked-row inventory
- Campaign checkpoint
- Any workflow/runbook documentation affected by changed behavior

Do not claim the documentation-closeout skill ran unless it actually ran successfully.

Resolve broken links, stale counts, duplicate summaries, and contradictory status statements before committing.

## Step J: Git closeout

Before committing:

1. Review `git status`.
2. Review the complete diff.
3. Confirm no secrets or generated junk are included.
4. Confirm the matrix, evidence, tests, code, and docs agree.
5. Confirm the batch scope is coherent.
6. Confirm no unrelated user changes were discarded.

Create a descriptive batch commit, for example:

`fix(qa): unblock batch 09 organization provisioning workflows`

Use the actual next batch number and root-cause description.

Push the commit to the campaign branch.

Record:

- Branch
- Commit hash
- Commit message
- Push result

A completed batch must not remain only as uncommitted local work.

## Step K: Production deployment

Deploy the pushed batch to the live production application.

Confirm:

- The deployment is associated with the expected commit.
- The production deployment reaches Ready.
- No deployment/build error occurred.
- Required environment variables are present.
- Required production migrations/configuration changes are active.
- The live application loads successfully.
- Authentication and organization access still work.
- The affected workflows work in production.
- No severe console or network errors appear.

Do not treat a preview deployment as the final production deployment.

Do not treat a successful Vercel build alone as runtime proof.

## Step L: Production proof and evidence amendment

After the deployment is Ready:

1. Execute the relevant production workflow using disposable campaign accounts.
2. Verify data persistence.
3. Verify relevant cross-role behavior.
4. Confirm any database effects with sanitized reads where appropriate.
5. Add production evidence to the batch closeout.
6. Add the production deployment and commit to the canonical matrix evidence.
7. Amend documentation if production behavior differs from QA.
8. Commit and push any evidence-only closeout amendment when required.

The batch is complete only after production proof and documentation are aligned.

## Step M: Continue automatically

Immediately load the next highest-value batch.

Do not stop merely to tell the user that one batch succeeded.

Update the persistent campaign checkpoint and continue.

---

# Opportunistic handling of the three existing FAIL rows

The primary scope is the 103 blocked rows.

However, if one of the three existing FAIL rows shares the same root cause or workflow as the active batch:

- Include it in that batch.
- Fix and prove it without creating a separate unnecessary campaign.
- Update its evidence and matrix status honestly.

Do not let unrelated FAIL rows derail the blocked-row campaign.

---

# Evidence quality requirements

Evidence must be sufficient for an independent reviewer to understand and reproduce the result.

Strong evidence includes:

- Browser screenshots with visible URL and relevant values
- Browser automation traces
- Exact runtime steps
- Console output
- Network response details
- Sanitized database JSON
- Test command output
- Deployment URL and status
- Commit hash
- Before/after behavior
- Refresh and re-login proof
- Cross-role proof
- Independent calculation checks

Weak or unacceptable evidence includes:

- “Code looks correct”
- “Tests should cover it”
- “Build passed”
- “Likely fixed”
- Source-code citations alone for a runtime row
- A screenshot without context
- Manually inserted database data pretending to be UI-created data
- QA evidence presented as production evidence
- A local environment presented as a production deployment

---

# Financial and operational correctness

Treat the following as high-risk:

- Quote totals
- Cost estimates
- Worker rates
- Dated worker assignments
- Dated rate snapshots
- Payroll gross/net calculations
- Production metres
- Stock generation
- Stock sales
- Dispatch quantities
- Receivables
- Payments
- Historical order data
- Tenant isolation

For these rows:

- Independently calculate the expected result.
- Record the inputs and formula.
- Compare the expected result with both UI and persisted values.
- Test decimal/sub-unit values where supported.
- Test historical persistence after current configuration changes.
- Test the correct production date.
- Test applicable owner and supervisor views.
- Never mark PASS based only on a visually plausible number.

---

# Campaign checkpoint

Maintain a machine-readable and human-readable checkpoint containing:

- Starting counts
- Current counts
- Completed batches
- Active batch
- Planned remaining batches
- Rows moved to PASS
- Rows moved to FAIL
- Rows remaining BLOCKED
- Rows marked NOT APPLICABLE
- Root causes fixed
- Commits
- Production deployments
- Migrations
- Created test accounts and tenants
- Outstanding external dependencies
- Last successful validation
- Exact next action

Update the checkpoint after every completed batch.

If interrupted, resume from the checkpoint rather than restarting the campaign.

---

# Stopping conditions

Continue until one of the following is true:

## Successful campaign completion

All originally blocked rows have been reviewed and now have an evidence-backed final state, and:

- Every internally remediable blocker has been fixed or converted to an honest FAIL with evidence.
- Every PASS has direct runtime proof.
- Any remaining BLOCKED rows have specific genuine external dependencies.
- The canonical matrix is internally consistent.
- All completed code is committed and pushed.
- The latest completed batch is deployed to production.
- Required production database changes are active.
- Production smoke/runtime proof has passed.
- Documentation closeout is complete.
- Final counts are verified.

## Genuine hard stop

Continue no further only when blocked by something such as:

- Missing credentials that cannot be obtained from the repository/environment
- A required external service being unavailable
- An irreversible action requiring explicit user approval
- A platform outage
- A real external account or hardware dependency

Before stopping for a hard blocker:

1. Complete all other independent batches that do not require it.
2. Record exactly what is blocked.
3. Record what was attempted.
4. Record the evidence.
5. State the smallest specific user action needed.
6. Preserve a clean checkpoint for immediate resumption.

Do not stop because the campaign is lengthy, because one row is difficult, because one batch was completed, or because the context is becoming large.

---

# Required final campaign report

At final completion, provide:

- Starting matrix counts
- Final matrix counts
- Total blocked rows reviewed
- Number converted from BLOCKED to PASS
- Number converted from BLOCKED to FAIL
- Number remaining genuinely BLOCKED
- Any NOT APPLICABLE changes
- Batch-by-batch summary
- Root causes fixed
- Rows closed per batch
- Test results
- Migration results
- Production deployment results
- Production runtime-proof summary
- Commit list
- Branch
- Evidence index
- Disposable test-account inventory
- Remaining external blockers
- Pilot-readiness recommendation
- Exact unresolved risks

The report must distinguish clearly between:

- Code implemented
- QA proof completed
- Production deployment completed
- Production runtime proof completed
- Documentation closeout completed

Do not describe the application as pilot-ready unless the remaining evidence genuinely supports that conclusion.

Begin now by inspecting the canonical matrix, repository instructions, current Git/deployment state, and all 103 blocked rows. Produce the correlation inventory and batch plan, then immediately execute the highest-leverage first batch and continue through subsequent batches.
