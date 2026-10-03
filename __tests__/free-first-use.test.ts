import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { freeText } from '@/lib/i18n/free-tier'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('FR04 signup tells the truth about an uncertain response', () => {
  const signup = read('app/(auth)/signup/page.tsx')
  const catchBlock = signup.slice(signup.indexOf('} catch (err) {'), signup.indexOf('setLoading(false)', signup.indexOf('} catch (err) {')))

  it('never claims no account exists after a network failure, and points to account access instead', () => {
    expect(catchBlock).not.toContain('was not created')
    expect(catchBlock).toContain("freeText(language, 'signupUncertain')")
    expect(freeText('en', 'signupUncertain')).toMatch(/log in/i)
  })

  it('a Free signup creates a Free account, not a factory', () => {
    expect(signup).toContain("selectedPlan === 'free' ? freeText(language, 'createFreeAccount') : 'Create factory'")
    expect(signup).toContain("selectedPlan === 'free' ? freeText(language, 'creatingFreeAccount') : 'Creating factory...'")
  })
})

describe('FR04 saved history labels the example and hides it reversibly', () => {
  const history = read('app/free/costings/SavedFreeCostings.tsx')

  it('labels the demonstration as an example that is not one of the owner\'s costings', () => {
    expect(history).toContain("freeText(language, 'exampleNotYours')")
    // The example was never saved by this account.
    expect(history).not.toContain("{tx('Saved')} {formatTimestampDate(demoCosting.created_at")
  })

  it('hides rather than deletes, and offers a way to show it again', () => {
    expect(history).toContain("freeText(language, 'hideExample')")
    expect(history).toContain("freeText(language, 'showExample')")
    expect(history).not.toContain("freeText(language, 'deleteDemoSample')")
  })
})

describe('FR04 counted action is explained before Calculate', () => {
  it('the Free estimator states the monthly policy and what stays available at zero', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    expect(estimator).toContain("freeText(language, 'calculatePolicy')")
    expect(freeText('en', 'calculatePolicy')).toMatch(/1st/)
    expect(freeText('en', 'calculatePolicy')).toMatch(/PDF/)
  })

  it('the public example says it uses none of the visitor\'s Free costings', () => {
    expect(read('components/landing/cost-sheet-demo.tsx')).toContain('This example uses none of your Free costings.')
  })
})

describe('FR04 copy exists in all three languages', () => {
  const keys = ['signupUncertain', 'createFreeAccount', 'creatingFreeAccount', 'exampleBadge', 'exampleNotYours', 'hideExample', 'showExample', 'calculatePolicy'] as const
  for (const language of ['en', 'gu', 'hi'] as const) {
    it(language, () => {
      for (const key of keys) expect(freeText(language, key).trim().length).toBeGreaterThan(0)
      if (language === 'gu') for (const key of keys) expect(freeText(language, key)).toMatch(/\p{Script=Gujarati}/u)
      if (language === 'hi') for (const key of keys) expect(freeText(language, key)).toMatch(/\p{Script=Devanagari}/u)
    })
  }
})
