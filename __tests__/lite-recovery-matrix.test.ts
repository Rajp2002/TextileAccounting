import { describe, expect, it } from 'vitest'
import { runMutationWithTimeout } from '../lib/mutation-outcome'

describe('LST-14: Network Recovery & Mutation Outcome Matrix', () => {
  it('resolves completed outcome when operation succeeds within timeout', async () => {
    const operation = async () => ({ success: true, id: 'quote-123' })
    const outcome = await runMutationWithTimeout(operation, 1000)

    expect(outcome.status).toBe('completed')
    if (outcome.status === 'completed') {
      expect(outcome.value).toEqual({ success: true, id: 'quote-123' })
    }
  })

  it('rejects when operation throws an error before timeout', async () => {
    const operation = async () => {
      throw new Error('Database connection failed')
    }
    await expect(runMutationWithTimeout(operation, 1000)).rejects.toThrow('Database connection failed')
  })

  it('returns unknown status when operation exceeds timeout threshold without mutating client state', async () => {
    const slowOperation = () =>
      new Promise<{ success: boolean }>(resolve => {
        setTimeout(() => resolve({ success: true }), 500)
      })

    // Timeout set to 50ms < 500ms
    const outcome = await runMutationWithTimeout(slowOperation, 50)
    expect(outcome.status).toBe('unknown')
  })
})
