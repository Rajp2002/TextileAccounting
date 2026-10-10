/**
 * Browser-side PDF rendering for the costing documents.
 *
 * jsPDF's html() draws text with the 14 standard PDF fonts, which cover only
 * Latin-1: Gujarati and Hindi labels, or a party name typed in those scripts,
 * would print as garbage. When the document has such text, the page is
 * rendered by the browser itself (html2canvas, which shapes Indic scripts
 * correctly) and placed as images, page by page, breaking between blocks.
 * Latin-only documents keep selectable vector text.
 */

/** The document is laid out at this width and scaled onto the 523pt A4 text block. */
export const PDF_LAYOUT_WIDTH_PX = 700
const A4 = { widthPt: 595.28, heightPt: 841.89, marginPt: 36 }
const TEXT_WIDTH_PT = A4.widthPt - A4.marginPt * 2

/** Characters the standard PDF fonts can draw (WinAnsi), plus the dashes and quotes the documents use. */
const STANDARD_FONT_TEXT = /^[\u0000-ÿ–—‘’“”•…€]*$/

export function needsRasterPdf(text: string) {
  return !STANDARD_FONT_TEXT.test(text)
}

/**
 * Split a tall document into pages, preferring to break at the bottom of a
 * block (a section, table row or term) so rows are never cut in half. A page
 * is never filled less than half before a block break is accepted.
 */
export function paginate(totalHeight: number, pageHeight: number, breakCandidates: number[]) {
  const candidates = [...new Set(breakCandidates.map(value => Math.round(value)))].sort((a, b) => a - b)
  const pages: Array<{ start: number; end: number }> = []
  let start = 0
  while (start < totalHeight - 1) {
    const limit = start + pageHeight
    if (limit >= totalHeight) {
      pages.push({ start, end: totalHeight })
      break
    }
    const best = candidates.filter(value => value > start + pageHeight / 2 && value <= limit).pop()
    const end = best ?? limit
    pages.push({ start, end })
    start = end
  }
  return pages
}

const BREAK_SELECTOR = 'main > *, section, tr, .term, .spec > div, .figure, .note, .signoff, .gst'

function breakCandidates(host: HTMLElement) {
  const top = host.getBoundingClientRect().top
  return Array.from(host.querySelectorAll<HTMLElement>(BREAK_SELECTOR)).map(element => element.getBoundingClientRect().bottom - top)
}

/** Render a styled document body (see extractStyledCostingBody) into a PDF blob. */
export async function renderDocumentPdf(styledBody: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const host = document.createElement('div')
  // 700px scaled onto the 523pt A4 text block (x0.747): 12px body text prints at about 9pt.
  host.style.width = `${PDF_LAYOUT_WIDTH_PX}px`
  host.style.position = 'fixed'
  host.style.left = '0'
  host.style.top = '0'
  host.style.zIndex = '-1'
  host.style.pointerEvents = 'none'
  host.style.background = '#ffffff'
  host.innerHTML = styledBody
  document.body.appendChild(host)
  try {
    if (!needsRasterPdf(host.textContent ?? '')) {
      await pdf.html(host, {
        margin: [A4.marginPt, A4.marginPt, A4.marginPt, A4.marginPt],
        autoPaging: 'text',
        width: TEXT_WIDTH_PT,
        windowWidth: PDF_LAYOUT_WIDTH_PX,
      })
    } else {
      await rasterizeInto(pdf, host)
    }
  } finally {
    host.remove()
  }
  return pdf.output('blob')
}

async function rasterizeInto(pdf: import('jspdf').jsPDF, host: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  // Make sure the Gujarati/Devanagari fonts the page uses are ready before drawing.
  if (document.fonts?.ready) await document.fonts.ready
  const scale = 2
  const canvas = await html2canvas(host, { scale, backgroundColor: '#ffffff', logging: false, useCORS: false, windowWidth: PDF_LAYOUT_WIDTH_PX })
  const pxPerPt = PDF_LAYOUT_WIDTH_PX / TEXT_WIDTH_PT
  const pageHeightPx = Math.floor((A4.heightPt - A4.marginPt * 2) * pxPerPt)
  const totalHeight = canvas.height / scale
  const pages = paginate(totalHeight, pageHeightPx, breakCandidates(host))

  pages.forEach((page, index) => {
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = Math.max(1, Math.round((page.end - page.start) * scale))
    const context = slice.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable for PDF rendering.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, slice.width, slice.height)
    context.drawImage(canvas, 0, Math.round(page.start * scale), canvas.width, slice.height, 0, 0, slice.width, slice.height)
    if (index > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', A4.marginPt, A4.marginPt, TEXT_WIDTH_PT, (page.end - page.start) / pxPerPt, undefined, 'FAST')
  })
}
