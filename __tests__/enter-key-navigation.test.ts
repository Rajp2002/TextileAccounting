import { describe, expect, it, vi } from 'vitest'
import {
    findNavigableFormInputs,
    handleEnterKeyNavigation,
    isElementNavigable,
    scrollInputIntoComfortableView,
} from '../lib/form-navigation'

interface MockInputOptions {
    id?: string
    tagName?: string
    type?: string
    disabled?: boolean
    readOnly?: boolean
    tabIndex?: number
    ariaHidden?: string
    preventEnterNav?: string
    value?: string
}

function createMockElement(options: MockInputOptions = {}) {
    const {
        id = 'input-1',
        tagName = 'INPUT',
        type = 'text',
        disabled = false,
        readOnly = false,
        tabIndex = 0,
        ariaHidden,
        preventEnterNav,
        value = '',
    } = options

    const element = {
        id,
        tagName: tagName.toUpperCase(),
        type,
        disabled,
        readOnly,
        tabIndex,
        value,
        offsetParent: {},
        offsetWidth: 100,
        offsetHeight: 40,
        getClientRects: () => [{ width: 100, height: 40 }],
        getAttribute: (attr: string) => {
            if (attr === 'aria-hidden') return ariaHidden ?? null
            if (attr === 'data-prevent-enter-nav') return preventEnterNav ?? null
            return null
        },
        focus: vi.fn(),
        select: vi.fn(),
        scrollIntoView: vi.fn(),
        closest: vi.fn(),
    }
    return element as unknown as HTMLInputElement
}

function createMockContainer(children: HTMLInputElement[]) {
    const container = {
        tagName: 'DIV',
        querySelectorAll: vi.fn(() => {
            return children.filter(child => {
                if (child.tagName !== 'INPUT' && child.tagName !== 'SELECT' && child.tagName !== 'TEXTAREA') return false
                if (child.type === 'hidden') return false
                if (child.type === 'button' || child.type === 'submit' || child.type === 'reset') return false
                if (child.type === 'checkbox' || child.type === 'radio' || child.type === 'file') return false
                if (child.disabled) return false
                if (child.readOnly) return false
                return true
            })
        }),
        getAttribute: (attr: string) => (attr === 'data-enter-navigate-container' ? 'true' : null),
        closest: vi.fn(),
    }

    children.forEach(child => {
        child.closest = (sel: string) => {
            if (sel.includes('data-enter-navigate-container')) return container as unknown as HTMLElement
            return null
        }
    })

    return container as unknown as HTMLElement
}

describe('Form Enter-Key Navigation Engine', () => {
    it('identifies navigable input elements correctly and filters out buttons/hidden/disabled fields', () => {
        const in1 = createMockElement({ id: 'in1', type: 'text' })
        const in2 = createMockElement({ id: 'in2', type: 'number' })
        const inDisabled = createMockElement({ id: 'in-disabled', disabled: true })
        const inReadonly = createMockElement({ id: 'in-readonly', readOnly: true })
        const inHidden = createMockElement({ id: 'in-hidden', type: 'hidden' })
        const inCheckbox = createMockElement({ id: 'in-checkbox', type: 'checkbox' })
        const btn = createMockElement({ id: 'btn', tagName: 'BUTTON' })
        const in3 = createMockElement({ id: 'in3', type: 'number' })

        expect(isElementNavigable(in1)).toBe(true)
        expect(isElementNavigable(inDisabled)).toBe(false)
        expect(isElementNavigable(inReadonly)).toBe(false)

        const container = createMockContainer([in1, in2, inDisabled, inReadonly, inHidden, inCheckbox, btn, in3])

        const navigable = findNavigableFormInputs(container)
        const ids = navigable.map(el => el.id)

        expect(ids).toEqual(['in1', 'in2', 'in3'])
    })

    it('navigates to next field and selects its content on Enter', () => {
        const fieldQuality = createMockElement({ id: 'field-quality', type: 'text', value: '60g Georgette' })
        const fieldCrimp = createMockElement({ id: 'field-crimp', type: 'number', value: '5' })
        const fieldWaste = createMockElement({ id: 'field-waste', type: 'number', value: '10' })

        const container = createMockContainer([fieldQuality, fieldCrimp, fieldWaste])

        const enterEvent = {
            key: 'Enter',
            target: fieldQuality,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handled1 = handleEnterKeyNavigation(enterEvent as unknown as KeyboardEvent, { container: container })

        expect(handled1).toBe(true)
        expect(enterEvent.preventDefault).toHaveBeenCalled()
        expect(fieldCrimp.focus).toHaveBeenCalled()
        expect(fieldCrimp.select).toHaveBeenCalled()
        expect(fieldCrimp.scrollIntoView).toHaveBeenCalled()

        // Press Enter on crimp -> goes to waste
        const enterEvent2 = {
            key: 'Enter',
            target: fieldCrimp,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }
        const handled2 = handleEnterKeyNavigation(enterEvent2 as unknown as KeyboardEvent, { container: container })
        expect(handled2).toBe(true)
        expect(fieldWaste.focus).toHaveBeenCalled()
        expect(fieldWaste.select).toHaveBeenCalled()
    })

    it('centers a marked section when navigating into one of its inputs', () => {
        const previousField = createMockElement({ id: 'default-waste', type: 'number', value: '10' })
        const componentName = createMockElement({ id: 'warp-component-name', value: 'Warp 1' })
        const container = createMockContainer([previousField, componentName])
        const rowCard = {
            tagName: 'DIV',
            scrollIntoView: vi.fn(),
        } as unknown as HTMLElement

        componentName.closest = ((selector: string) => {
            if (selector === '[data-enter-scroll-target]') return rowCard
            if (selector.includes('data-enter-navigate-container')) return container
            return null
        }) as typeof componentName.closest

        const enterEvent = {
            key: 'Enter',
            target: previousField,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        expect(handleEnterKeyNavigation(enterEvent as unknown as KeyboardEvent, { container })).toBe(true)
        expect(componentName.focus).toHaveBeenCalled()
        expect(rowCard.scrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
        })
        expect(componentName.scrollIntoView).not.toHaveBeenCalled()
    })

    it('allows explicit scroll options to override marked-section defaults', () => {
        const input = createMockElement()
        const rowCard = {
            tagName: 'DIV',
            scrollIntoView: vi.fn(),
        } as unknown as HTMLElement
        input.closest = ((selector: string) => selector === '[data-enter-scroll-target]' ? rowCard : null) as typeof input.closest

        scrollInputIntoComfortableView(input, { behavior: 'auto', block: 'start' })

        expect(rowCard.scrollIntoView).toHaveBeenCalledWith({
            behavior: 'auto',
            block: 'start',
            inline: 'nearest',
        })
    })

    it('centres the active input when its section cannot fit above the mobile keyboard', () => {
        vi.stubGlobal('window', {
            innerHeight: 900,
            visualViewport: { height: 400 },
            matchMedia: () => ({ matches: false }),
        })
        try {
            const input = createMockElement()
            const section = {
                getBoundingClientRect: () => ({ height: 600 }),
                scrollIntoView: vi.fn(),
            } as unknown as HTMLElement
            input.closest = (() => section) as typeof input.closest
            scrollInputIntoComfortableView(input)
            expect(input.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'nearest' })
            expect(section.scrollIntoView).not.toHaveBeenCalled()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    describe('on a touch phone, where the keyboard covers the lower layout viewport', () => {
        function phone(fieldRect: { top: number; bottom: number }) {
            const scrollBy = vi.fn()
            const body = {}
            vi.stubGlobal('document', { body })
            vi.stubGlobal('window', {
                innerHeight: 900,
                visualViewport: { height: 400, offsetTop: 0, scale: 1 },
                matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' }),
                getComputedStyle: () => ({ overflowY: 'visible' }),
                scrollBy,
            })
            const input = createMockElement()
            // The card fits above the keyboard, so the desktop rule would centre it.
            const section = { getBoundingClientRect: () => ({ height: 200 }), scrollIntoView: vi.fn() } as unknown as HTMLElement
            Object.assign(input, { isConnected: true, parentElement: body, getBoundingClientRect: () => fieldRect })
            input.closest = (() => section) as typeof input.closest
            return { input, section, scrollBy }
        }

        it('lifts a field behind the keyboard into the visible band instead of centring its section', () => {
            try {
                const { input, section, scrollBy } = phone({ top: 500, bottom: 544 })
                scrollInputIntoComfortableView(input, { behavior: 'auto', block: 'center' })
                expect(section.scrollIntoView).not.toHaveBeenCalled()
                expect(input.scrollIntoView).not.toHaveBeenCalled()
                expect(scrollBy).toHaveBeenCalledWith({ top: 224, behavior: 'auto' })
            } finally {
                vi.unstubAllGlobals()
            }
        })

        it('leaves a field that is already visible above the keyboard where it is', () => {
            try {
                const { input, section, scrollBy } = phone({ top: 200, bottom: 244 })
                scrollInputIntoComfortableView(input)
                expect(section.scrollIntoView).not.toHaveBeenCalled()
                expect(input.scrollIntoView).not.toHaveBeenCalled()
                expect(scrollBy).not.toHaveBeenCalled()
            } finally {
                vi.unstubAllGlobals()
            }
        })
    })

    it('respects reduced motion when centring a section', () => {
        vi.stubGlobal('window', {
            innerHeight: 900,
            matchMedia: (query: string) => ({ matches: query.includes('reduced-motion') }),
        })
        try {
            const input = createMockElement()
            const section = {
                getBoundingClientRect: () => ({ height: 300 }),
                scrollIntoView: vi.fn(),
            } as unknown as HTMLElement
            input.closest = (() => section) as typeof input.closest
            scrollInputIntoComfortableView(input)
            expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center', inline: 'nearest' })
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('navigates to previous field on Shift+Enter', () => {
        const step1 = createMockElement({ id: 'step1', type: 'text', value: 'First' })
        const step2 = createMockElement({ id: 'step2', type: 'text', value: 'Second' })
        const step3 = createMockElement({ id: 'step3', type: 'text', value: 'Third' })

        const container = createMockContainer([step1, step2, step3])

        const shiftEnterEvent = {
            key: 'Enter',
            shiftKey: true,
            target: step2,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handled = handleEnterKeyNavigation(shiftEnterEvent as unknown as KeyboardEvent, { container: container })
        expect(handled).toBe(true)
        expect(step1.focus).toHaveBeenCalled()
        expect(step1.select).toHaveBeenCalled()
    })

    it('does not intercept Enter in textarea elements by default', () => {
        const textarea = createMockElement({ id: 'notes', tagName: 'TEXTAREA' })
        const nextInput = createMockElement({ id: 'next-input', type: 'text' })

        const container = createMockContainer([textarea, nextInput])

        const enterEvent = {
            key: 'Enter',
            target: textarea,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handled = handleEnterKeyNavigation(enterEvent as unknown as KeyboardEvent, { container: container })
        expect(handled).toBe(false)
        expect(enterEvent.preventDefault).not.toHaveBeenCalled()
        expect(nextInput.focus).not.toHaveBeenCalled()
    })

    it('handles boundary conditions at first and last elements gracefully', () => {
        const single = createMockElement({ id: 'single', type: 'text', value: 'Only one' })
        const container = createMockContainer([single])

        const enterEvent = {
            key: 'Enter',
            target: single,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handledLast = handleEnterKeyNavigation(enterEvent as unknown as KeyboardEvent, { container: container, loop: false })
        expect(handledLast).toBe(false)

        const shiftEnterEvent = {
            key: 'Enter',
            shiftKey: true,
            target: single,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }
        const handledFirst = handleEnterKeyNavigation(shiftEnterEvent as unknown as KeyboardEvent, { container: container, loop: false })
        expect(handledFirst).toBe(false)
    })

    it('supports looping if loop option is explicitly enabled', () => {
        const f1 = createMockElement({ id: 'f1', type: 'text', value: 'A' })
        const f2 = createMockElement({ id: 'f2', type: 'text', value: 'B' })
        const container = createMockContainer([f1, f2])

        const enterEvent = {
            key: 'Enter',
            target: f2,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handled = handleEnterKeyNavigation(enterEvent as unknown as KeyboardEvent, { container: container, loop: true })
        expect(handled).toBe(true)
        expect(f1.focus).toHaveBeenCalled()
    })

    it('dynamically adapts when rows or inputs are added to the DOM', () => {
        const w1Rate = createMockElement({ id: 'w1-rate', type: 'number', value: '110' })
        const w1Gst = createMockElement({ id: 'w1-gst', type: 'number', value: '5' })
        const children = [w1Rate, w1Gst]
        const container = createMockContainer(children)

        const enterEvent = {
            key: 'Enter',
            target: w1Gst,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }
        expect(handleEnterKeyNavigation(enterEvent as unknown as KeyboardEvent, { container: container })).toBe(false)

        // Dynamically append Warp row 2
        const w2Rate = createMockElement({ id: 'w2-rate', type: 'number', value: '120' })
        children.push(w2Rate)

        // Hitting Enter on w1-gst now advances to w2-rate
        const handledNew = handleEnterKeyNavigation(enterEvent as unknown as KeyboardEvent, { container: container })
        expect(handledNew).toBe(true)
        expect(w2Rate.focus).toHaveBeenCalledWith({ preventScroll: true })
    })

    it('focuses next element with preventScroll: true to avoid abrupt browser snapping', () => {
        const input1 = createMockElement({ id: 'input-1' })
        const input2 = createMockElement({ id: 'input-2' })
        const container = createMockContainer([input1, input2])

        const enterEvent = {
            key: 'Enter',
            target: input1,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }
        const handled = handleEnterKeyNavigation(enterEvent as unknown as KeyboardEvent, { container })
        expect(handled).toBe(true)
        expect(input2.focus).toHaveBeenCalledWith({ preventScroll: true })
    })
})
