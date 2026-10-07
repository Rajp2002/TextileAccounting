import { afterEach, describe, expect, it, vi } from 'vitest'
import { focusFieldOnPress, selectFieldAfterTap } from '../lib/field-press-selection'

function field() {
    return { focus: vi.fn(), select: vi.fn() }
}

function press(target: ReturnType<typeof field>, pointerType: string) {
    const event = { currentTarget: target, pointerType, preventDefault: vi.fn() }
    focusFieldOnPress(event as unknown as Parameters<typeof focusFieldOnPress>[0])
    return event
}

function tap(target: ReturnType<typeof field>) {
    selectFieldAfterTap({ currentTarget: target } as unknown as Parameters<typeof selectFieldAfterTap>[0])
}

afterEach(() => vi.unstubAllGlobals())

describe('selecting a pressed estimator field', () => {
    it('leaves a finger press alone, so a scroll that starts on a field never opens the keyboard', () => {
        vi.stubGlobal('document', { activeElement: null })
        const input = field()
        const event = press(input, 'touch')
        expect(event.preventDefault).not.toHaveBeenCalled()
        expect(input.focus).not.toHaveBeenCalled()
        expect(input.select).not.toHaveBeenCalled()
    })

    it('selects the value once a finger tap has focused the field, so typing replaces it', () => {
        vi.stubGlobal('document', { activeElement: null })
        const input = field()
        press(input, 'touch')
        tap(input)
        expect(input.select).toHaveBeenCalledOnce()
    })

    it('keeps the caret where a finger puts it inside an already focused field', () => {
        const input = field()
        vi.stubGlobal('document', { activeElement: input })
        press(input, 'touch')
        tap(input)
        expect(input.select).not.toHaveBeenCalled()
    })

    it('does not select on a later tap after a press turned into a scroll', () => {
        vi.stubGlobal('document', { activeElement: null })
        const input = field()
        press(input, 'touch')
        vi.stubGlobal('document', { activeElement: input })
        press(input, 'touch')
        tap(input)
        expect(input.select).not.toHaveBeenCalled()
    })

    it('focuses and selects on a mouse press before the click can collapse the selection', () => {
        vi.stubGlobal('document', { activeElement: null })
        const input = field()
        const event = press(input, 'mouse')
        expect(event.preventDefault).toHaveBeenCalledOnce()
        expect(input.focus).toHaveBeenCalledOnce()
        expect(input.select).toHaveBeenCalledOnce()
        tap(input)
        expect(input.select).toHaveBeenCalledOnce()
    })
})
