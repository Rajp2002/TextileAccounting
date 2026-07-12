# Estimator Release Checklist

- [x] Estimator changes isolated from dirty concurrent work
- [x] Logical commits reviewed and pushed
- [x] Clean `npm ci`, tests, TypeScript, lint, and production build
- [x] 41/41 static pages generated
- [x] Local production smoke
- [x] Three production migrations verified
- [x] Preview built and authenticated smoke tested
- [x] Exact preview promoted to production
- [x] Public production Base and Premium paths verified
- [x] Calculation, quality, quote, isolation, and responsive core paths verified
- [x] PWA update prompt verified without aggressive reload
- [x] Audit resources inventoried, deleted exactly, and zero-row rechecked
- [ ] Complete successful Razorpay Test Mode payment
- [ ] Verify captured payment row, subscription dates, access, webhook, and replay idempotency
- [ ] Repair and verify Sentry source-map upload
- [ ] Manually verify 125%/150% zoom and mobile keyboard occlusion
- [ ] Run controlled hosted network-loss and expired-session recovery
- [ ] Triage 12 dependency advisories

Deployment updates should prompt users to save drafts and refresh. Do not introduce forced refresh loops. If a server-action signature mismatch occurs, refresh to load the latest bundle; closing/reopening should not be the sole documented recovery.

Paying-customer promotion remains blocked until the two payment checklist items pass against the intended production configuration. Live credentials and a separately authorized controlled live payment remain distinct later gates.
