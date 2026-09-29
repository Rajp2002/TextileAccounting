import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { Switch } from '@/components/ui/switch'
import { SwitchField } from '@/components/ui/switch-field'

describe('LiquidSegmented', () => {
  const options = [
    { value: 'day', label: 'Day shift', id: 'shift-day' },
    { value: 'night', label: 'Night shift' },
  ] as const

  it('renders a radiogroup with the active option checked and the thumb positioned by index', () => {
    const html = renderToStaticMarkup(
      <LiquidSegmented aria-label="Shift" value="night" onValueChange={() => {}} options={options} />
    )
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('--liquid-index:1')
    expect(html).toMatch(/role="radio"[^>]*aria-checked="false"[^>]*>[^<]*(<[^>]*>)*Day shift/)
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('id="shift-day"')
  })

  it('uses tab semantics with a single tab stop when role is tablist', () => {
    const html = renderToStaticMarkup(
      <LiquidSegmented role="tablist" aria-label="Mode" value="day" onValueChange={() => {}} options={options} />
    )
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-selected="true"')
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1)
  })

  it('hides the thumb when the value matches no option', () => {
    const html = renderToStaticMarkup(
      <LiquidSegmented aria-label="Shift" value={'other' as 'day'} onValueChange={() => {}} options={options} />
    )
    expect(html).toContain('opacity-0')
  })
})

describe('Switch', () => {
  it('renders role=switch with the brand fill layer and reflects checked state', () => {
    const html = renderToStaticMarkup(<Switch checked onCheckedChange={() => {}} aria-label="GST note" />)
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('data-slot="switch-fill"')
  })
})

describe('SwitchField', () => {
  it('links the label to the switch so the whole row toggles', () => {
    const html = renderToStaticMarkup(
      <SwitchField variant="pill" checked={false} onCheckedChange={() => {}}>Needs Review</SwitchField>
    )
    const labelFor = html.match(/<label[^>]*for="([^"]+)"/)?.[1]
    expect(labelFor).toBeTruthy()
    expect(html).toContain(`id="${labelFor}"`)
    expect(html).toContain('role="switch"')
    expect(html).toContain('Needs Review')
  })
})
