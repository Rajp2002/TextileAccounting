import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals } from '@/lib/estimator'
import {
  buildCostingPrintHtml,
  createCostingExportModel,
  extractStyledCostingBody,
  getCostingExportFilename,
  shortDocumentReference,
  type CostingExportOptions,
} from '@/lib/estimator-export'
import { WEAVLY_LOGO_DATA_URI, WEAVLY_LOGO_HEIGHT, WEAVLY_LOGO_WIDTH } from '@/lib/estimator-export-logo'
import { f1State } from './fixtures/costing-characterization'

// The Internal Cost Sheet and Customer Quotation share one design: Weavly navy
// and saffron on warm neutrals, the Weavly logo in the masthead, unambiguous
// dates and right-aligned numbers. These pin the parts that are easy to lose
// when the template is edited, and that only show up in the real PDF.

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const estimate = f1State()
const totals = calcFullTotals(estimate)
const model = createCostingExportModel({
  state: estimate,
  totals,
  result: buildCostingResult(estimate, totals),
  qualityLabel: 'F1 Shirting',
  createdAt: '2026-10-03T06:00:00.000Z',
})

const options: CostingExportOptions = {
  mode: 'customer',
  businessName: 'Shree Ganesh Textiles',
  customerName: 'Acme Textiles Pvt Ltd',
  validUntil: '2026-10-21',
  notes: 'Payment: 30 days from delivery.\nDelivery: 3 weeks from confirmed order.',
  showGstNote: true,
  documentReference: 'WV-EC4E031D',
}
const customerHtml = buildCostingPrintHtml(model, options)
const internalHtml = buildCostingPrintHtml(model, { ...options, mode: 'internal', notes: 'Check beam availability.' })

describe('Weavly logo on both documents', () => {
  it('embeds a real PNG whose size matches the declared dimensions', () => {
    const base64 = WEAVLY_LOGO_DATA_URI.replace('data:image/png;base64,', '')
    expect(WEAVLY_LOGO_DATA_URI.startsWith('data:image/png;base64,')).toBe(true)
    const png = Buffer.from(base64, 'base64')
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(WEAVLY_LOGO_WIDTH)
    expect(png.readUInt32BE(20)).toBe(WEAVLY_LOGO_HEIGHT)
    // It rides inside every preview, print window and PDF string, so keep it small.
    expect(png.byteLength).toBeLessThan(30_000)
  })

  it.each([['customer quotation', customerHtml], ['internal cost sheet', internalHtml]])('puts the logo in the masthead of the %s', (_name, html) => {
    expect(html).toContain(`<img class="logo" src="${WEAVLY_LOGO_DATA_URI}"`)
    expect(html).toContain('alt="Weavly"')
    expect(html.indexOf('class="logo"')).toBeLessThan(html.indexOf('class="titleblock"'))
  })

  it('keeps the logo on the review-required page for an incomplete historical costing', () => {
    const html = buildCostingPrintHtml(
      createCostingExportModel({ state: estimate, totals, qualityLabel: 'Old quality', reconciliationStatus: 'unreconstructable' }),
      options,
    )
    expect(html).toContain('class="logo"')
    expect(html).toContain('Financial values not shown')
  })
})

describe('print and PDF styling', () => {
  it('uses the Weavly navy and saffron palette, not the old blue and orange', () => {
    for (const html of [customerHtml, internalHtml]) {
      expect(html).toContain('#18252E')
      expect(html).toContain('#E27025')
      expect(html.toLowerCase()).not.toContain('#1d4ed8')
      expect(html.toLowerCase()).not.toContain('#f97316')
    }
  })

  it('draws the top bar from solid segments, because html2canvas paints a hard-stop gradient black in the PDF', () => {
    expect(customerHtml).not.toContain('linear-gradient')
    expect(customerHtml).toContain('<div class="brandbar"><i class="navy"></i><i class="saffron"></i></div>')
  })

  it('right-aligns every numeric column so figures line up under their headers', () => {
    expect(internalHtml).toContain('<th class="num">Cost / m</th>')
    expect(internalHtml).toMatch(/<td class="num">Rs [\d,.]+\/m<\/td>/)
    expect(internalHtml).toContain('<th class="num">Base kg / 100m</th>')
    expect(customerHtml).toContain('<th class="num">Quoted price</th>')
    expect(customerHtml).toMatch(/<td class="num">Rs [\d,.]+\/m<\/td>/)
    expect(customerHtml).toMatch(/th\.num,td\.num\{[^}]*white-space:nowrap/)
  })

  it('shows dates as "3 Oct 2026" rather than an ambiguous 3/10/2026', () => {
    for (const html of [customerHtml, internalHtml]) {
      expect(html).toContain('3 Oct 2026')
      expect(html).not.toMatch(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)
    }
    expect(customerHtml).toContain('21 Oct 2026')
  })

  it('lays the PDF out 700px wide so body text prints near 9pt instead of about 7pt', () => {
    // The dialog hands the document to the shared PDF renderer.
    expect(read('components/estimator/CostingExportDialog.tsx')).toContain('renderDocumentPdf(extractStyledCostingBody(previewHtml))')
    const renderer = read('lib/document-pdf.ts')
    expect(renderer).toContain('export const PDF_LAYOUT_WIDTH_PX = 700')
    expect(renderer).toContain('host.style.width = `${PDF_LAYOUT_WIDTH_PX}px`')
    expect(renderer).toContain('windowWidth: PDF_LAYOUT_WIDTH_PX')
    expect(renderer).not.toContain("'760px'")
  })
})

describe('customer quotation layout', () => {
  it('quotes the fabric as a line item with a prominent total', () => {
    for (const heading of ['Description', 'Order quantity', 'Quoted price', 'Amount']) {
      expect(customerHtml).toContain(`>${heading}</th>`)
    }
    expect(customerHtml).toContain('class="quotevalue"><span>Quotation value</span>')
    expect(customerHtml).toContain('Priced per metre of finished fabric')
  })

  it('names who issued it, who it is for and until when it is valid', () => {
    expect(customerHtml).toContain('<span>Issued by</span><strong>Shree Ganesh Textiles</strong>')
    expect(customerHtml).toContain('<span>Prepared for</span><strong>Acme Textiles Pvt Ltd</strong>')
    expect(customerHtml).toContain('<span>Valid until</span><strong>21 Oct 2026</strong>')
  })

  it('numbers each line of the terms and leaves room to sign and accept', () => {
    expect(customerHtml).toContain('<span class="n">1.</span><p>Payment: 30 days from delivery.</p>')
    expect(customerHtml).toContain('<span class="n">2.</span><p>Delivery: 3 weeks from confirmed order.</p>')
    expect(customerHtml).toContain('Authorised signatory')
    expect(customerHtml).toContain('Customer acceptance')
  })

  it('never prints the Weavly product name where the issuing business belongs', () => {
    const bare = buildCostingPrintHtml(model, { ...options, businessName: '' })
    expect(bare).not.toContain('class="issuername"')
    expect(bare).not.toContain('Issued by')
    expect(customerHtml).toContain('<div class="issuername">Shree Ganesh Textiles</div>')
  })

  it('escapes user text in names and terms', () => {
    const html = buildCostingPrintHtml(model, { ...options, businessName: '<b>Evil</b> & Co', customerName: '"Q" <i>', notes: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<b>Evil</b>')
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt; &amp; Co')
  })
})

describe('document reference', () => {
  it('turns a record UUID into a short readable reference', () => {
    expect(shortDocumentReference('ec4e031d-69a8-43ab-a2a0-44da4672532c')).toBe('WV-EC4E031D')
    expect(shortDocumentReference('tour-preview-v2')).toBe('WV-TOURPREV')
    expect(shortDocumentReference(undefined)).toBe('')
    expect(shortDocumentReference('---')).toBe('')
  })

  it('keeps the UUID out of the document and the filename', () => {
    const id = 'ec4e031d-69a8-43ab-a2a0-44da4672532c'
    const withShort = { ...options, documentReference: shortDocumentReference(id) }
    expect(buildCostingPrintHtml(model, withShort)).not.toContain(id)
    expect(getCostingExportFilename(model, withShort)).toBe('quotation-wv-ec4e031d-acme-textiles-pvt-ltd-f1-shirting-2026-10-03.pdf')
  })

  it('is what Free costings pass to the export dialog', () => {
    expect(read('app/free/costings/SavedFreeCostings.tsx')).toContain('documentReference={shortDocumentReference(selected?.id)}')
  })
})

describe('on-screen preview', () => {
  it('frames the document as a page with print margins instead of running edge to edge', () => {
    expect(internalHtml).toContain('body>.document{max-width:794px;padding:45px 49px 53px')
    expect(internalHtml).toContain('@media screen and (max-width:480px){body:has(>.document){padding:0}')
  })

  it('keeps the page framing out of the PDF renderer, which wraps the body instead', () => {
    const styled = extractStyledCostingBody(internalHtml)
    expect(styled).toContain('<div class="costing-pdf-root"')
    expect(styled).not.toMatch(/<body[\s>]/)
    // A phone's viewport must not restyle the 700px PDF host, so every screen rule is scoped to the standalone page.
    const screenRules = [...internalHtml.matchAll(/@media screen[^{]*\{((?:[^{}]*\{[^{}]*\})*)\}/g)].map(match => match[1])
    expect(screenRules).toHaveLength(3)
    const selectors = screenRules.flatMap(rules => [...rules.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(match => match[1].split(',')))
    for (const selector of selectors) expect(selector).toMatch(/^(html:has\(>body>\.document\)|body:has\(>\.document\)|body>\.document)/)
  })
})
