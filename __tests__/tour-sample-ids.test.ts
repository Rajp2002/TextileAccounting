import { expect, it } from 'vitest'
import { isSampleRecordId } from '../lib/tours/sample-ids'
it.each(['tour-', 'tour-worker-1', 'tour-costing-v2', 'demo-sample-yarn-rate'])('guards sample id %s', id => expect(isSampleRecordId(id)).toBe(true))
it.each([null, undefined, '', 'tour', 'my-tour-id', 'demo-real', 'Tour-worker', 'record-123'])('does not classify real or absent id %s as sample', id => expect(isSampleRecordId(id)).toBe(false))
