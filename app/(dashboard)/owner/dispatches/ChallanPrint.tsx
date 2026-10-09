import type { ReactNode } from 'react'
import { challanTotals, type Challan } from '@/lib/delivery-challans'
import {
    WEAVLY_LOGO_DATA_URI,
    WEAVLY_LOGO_HEIGHT,
    WEAVLY_LOGO_WIDTH,
} from '@/lib/estimator-export-logo'
import PrintButton from './[id]/print/PrintButton'

const COPIES = [
    'Original — Consignee',
    'Duplicate — Transporter',
    'Triplicate — Consignor',
]
const LOGO_WIDTH = 100
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * WEAVLY_LOGO_HEIGHT) / WEAVLY_LOGO_WIDTH)

/**
 * Weavly navy and saffron on warm neutrals, the palette of the costing
 * documents (PRINT_STYLES in lib/estimator-export.ts). The page rules at the
 * top hide everything but the document when printing and start each copy on
 * its own page.
 */
const DOCUMENT_CSS = `
@page { size: A4; margin: 14mm; }
@media print {
  body:has(.challan-print-root) *:not(.challan-print-root):not(.challan-print-root *):not(:has(.challan-print-root)) { display:none!important; }
  *:has(.challan-print-root) { display:block!important; position:static!important; overflow:visible!important; height:auto!important; min-height:0!important; width:auto!important; margin:0!important; padding:0!important; transform:none!important; }
  .challan-print-root { position:static; width:100%; padding:0; }
  .no-print,.no-print * { display:none!important; }
  .challan-copy { break-after:page; margin:0 auto; }
  .challan-copy:last-child { break-after:auto; }
  thead { display:table-header-group; }
  tr,.signature,.parties,.facts,.refs,.fabricvalue { break-inside:avoid; }
}
.challan-print-root { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.challan-copy { max-width:180mm; margin:0 auto 30px; font:12px/1.5 Arial,Helvetica,sans-serif; color:#2C3331; overflow-wrap:anywhere; }
@media screen { .challan-copy { padding:16px; border:1px solid #DED2BD; border-radius:8px; } }
.challan-copy p { margin:0; }
.challan-copy .brandbar { display:flex; height:6px; margin-bottom:12px; }
.challan-copy .brandbar i { display:block; height:6px; }
.challan-copy .brandbar .navy { width:88%; background:#18252E; }
.challan-copy .brandbar .saffron { width:12%; background:#E27025; }
.challan-copy .masthead { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px 24px; padding-bottom:10px; border-bottom:1px solid #DED2BD; }
.challan-copy .brand { display:flex; align-items:center; min-width:0; }
.challan-copy .logo { display:block; flex:none; }
.challan-copy .issuer { min-width:0; margin-left:16px; padding-left:16px; border-left:1px solid #DED2BD; }
.challan-copy .issuername { color:#18252E; font-size:17px; font-weight:700; line-height:1.2; letter-spacing:-.01em; }
.challan-copy .doctype { margin:3px 0 0; color:#A94713; font-size:10px; font-weight:700; line-height:1.4; letter-spacing:.14em; text-transform:uppercase; }
.challan-copy .docmeta { flex:none; text-align:right; }
.challan-copy .copytag { display:inline-block; margin-bottom:6px; padding:2px 8px; border:1px solid #E27025; border-radius:4px; background:#FAF1E2; color:#A94713; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.challan-copy .docmeta strong { display:block; margin-bottom:3px; color:#18252E; font-size:14px; }
.challan-copy .mrow { display:flex; justify-content:flex-end; gap:8px; font-size:11px; line-height:1.55; }
.challan-copy .ml { color:#4B5350; }
.challan-copy .mv { color:#1E2528; font-weight:700; }
.challan-copy .parties { display:flex; margin-top:12px; overflow:hidden; border:1px solid #DED2BD; border-radius:8px; }
.challan-copy .parties > div { flex:1; min-width:0; padding:8px 14px; }
.challan-copy .parties > div + div { border-left:1px solid #DED2BD; }
.challan-copy .label { display:block; color:#4B5350; font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
.challan-copy .parties strong { display:block; margin:3px 0 2px; color:#18252E; font-size:14px; line-height:1.3; }
.challan-copy .parties p { color:#2C3331; font-size:11px; white-space:pre-wrap; }
.challan-copy .deliverto { margin-top:8px; }
.challan-copy .deliverto strong { color:#18252E; }
.challan-copy .facts { display:grid; grid-template-columns:1.3fr .7fr 1fr 1.4fr; margin-top:8px; overflow:hidden; border:1px solid #DED2BD; border-radius:8px; background:#FAF1E2; }
.challan-copy .facts > div { min-width:0; padding:6px 12px; border-left:1px solid #DED2BD; }
.challan-copy .facts > div:first-child { border-left:0; }
.challan-copy .facts strong { display:block; margin-top:2px; color:#18252E; font-size:12px; }
.challan-copy table { width:100%; margin-top:10px; border-collapse:separate; border-spacing:0; overflow:hidden; border:1px solid #DED2BD; border-radius:8px; }
.challan-copy th { padding:6px 10px; background:#18252E; color:#fff; font-size:9.5px; text-align:left; letter-spacing:.08em; text-transform:uppercase; }
.challan-copy td { padding:3px 10px; border-top:1px solid #EADFCB; text-align:left; }
.challan-copy th.num,.challan-copy td.num { text-align:right; white-space:nowrap; }
.challan-copy tfoot th { border-top:1px solid #DED2BD; background:#FAF1E2; color:#18252E; font-size:11px; letter-spacing:0; text-transform:none; }
.challan-copy .fabricvalue { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:8px; padding:8px 14px; border-radius:8px; background:#18252E; color:#fff; }
.challan-copy .fabricvalue span { color:#F9DFC8; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
.challan-copy .fabricvalue strong { font-size:18px; letter-spacing:-.01em; white-space:nowrap; }
.challan-copy .refs { display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; margin-top:10px; padding:8px 14px; border-left:3px solid #E27025; border-radius:0 8px 8px 0; background:#FAF1E2; font-size:11px; }
.challan-copy .refs .wide { grid-column:1 / -1; }
.challan-copy .refs strong { display:block; color:#A94713; font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; }
.challan-copy .signature { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-top:20px; font-size:11px; }
.challan-copy .signature > div { padding-top:8px; border-top:1px solid #18252E; color:#4B5350; }
.challan-copy .signature .gap { margin-top:24px; }
.challan-copy .docfooter { display:flex; justify-content:space-between; gap:24px; margin-top:12px; padding-top:6px; border-top:1px solid #DED2BD; color:#4B5350; font-size:9.5px; }
.challan-copy .docfooter strong { flex:none; color:#18252E; }
@media (max-width:600px) {
  .challan-copy .parties { flex-direction:column; }
  .challan-copy .parties > div + div { border-left:0; border-top:1px solid #DED2BD; }
  .challan-copy .facts { grid-template-columns:1fr 1fr; }
  .challan-copy .facts > div:nth-child(odd) { border-left:0; }
  .challan-copy .facts > div:nth-child(n+3) { border-top:1px solid #DED2BD; }
  .challan-copy .refs,.challan-copy .signature { grid-template-columns:1fr; }
  .challan-copy .docmeta { text-align:left; }
  .challan-copy .mrow { justify-content:flex-start; }
}
`

function statusLabel(status: Challan['delivery_status']) {
    return status === 'draft'
        ? 'DRAFT — NOT ISSUED'
        : status === 'reversed'
          ? 'REVERSED — SEE HISTORY'
          : 'ISSUED'
}

/** One labelled reference line; `wide` spans both columns. */
function Ref({
    label,
    children,
    wide,
}: {
    label: string
    children: ReactNode
    wide?: boolean
}) {
    return (
        <div className={wide ? 'wide' : undefined}>
            <strong>{label}</strong>
            {children}
        </div>
    )
}

export default function ChallanPrint({
    d,
    businessName,
}: {
    d: Challan
    /** The factory's name from its account; the consignor's name is used when it is blank. */
    businessName?: string
}) {
    const doc = d.document
    const issuer = businessName?.trim() || doc.sender_name
    const value = challanTotals(d.lines, Number(d.selling_rate)).value
    return (
        <div
            data-i18n-skip="true"
            className="challan-print-root bg-white p-6 text-black"
        >
            <style>{DOCUMENT_CSS}</style>
            <div className="no-print mx-auto mb-6 max-w-3xl space-y-3 rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PrintButton />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Print Preview · 3 Copies</span>
                </div>
                <div className="space-y-1 text-xs text-body leading-relaxed border-t border-hairline pt-3">
                    <p>
                        Choose “Save as PDF” in the print destination to download.
                        Three labelled copies are included.
                    </p>
                    <p className="text-muted-foreground">
                        This delivery record does not replace a tax invoice or e-way
                        bill where required. Tax details below are entered
                        references; this app does not calculate or file GST.
                    </p>
                </div>
            </div>
            {COPIES.map((copy) => (
                <article className="challan-copy" key={copy}>
                    <div className="brandbar">
                        <i className="navy" />
                        <i className="saffron" />
                    </div>
                    <header className="masthead">
                        <div className="brand">
                            {/* Embedded data URI, as in the costing PDFs: it prints with no network request. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                className="logo"
                                src={WEAVLY_LOGO_DATA_URI}
                                width={LOGO_WIDTH}
                                height={LOGO_HEIGHT}
                                alt="Weavly"
                            />
                            <div className="issuer">
                                <div className="issuername">{issuer}</div>
                                <h1 className="doctype">Delivery challan</h1>
                            </div>
                        </div>
                        <div className="docmeta">
                            <span className="copytag">{copy}</span>
                            <strong>{d.number}</strong>
                            <div className="mrow">
                                <span className="ml">Date</span>
                                <span className="mv">{doc.date}</span>
                            </div>
                            <div className="mrow">
                                <span className="ml">Status</span>
                                <span className="mv">
                                    {statusLabel(d.delivery_status)}
                                </span>
                            </div>
                        </div>
                    </header>
                    <section className="parties">
                        <div>
                            <span className="label">Consignor / Sender</span>
                            <strong>{doc.sender_name}</strong>
                            <p>{doc.sender_address}</p>
                            <p>GSTIN: {doc.sender_gstin || '—'}</p>
                        </div>
                        <div>
                            <span className="label">Consignee / Customer</span>
                            <strong>{doc.customer_name}</strong>
                            <p>{doc.customer_address}</p>
                            <p>GSTIN: {doc.customer_gstin || '—'}</p>
                            <p>Phone: {doc.customer_phone || '—'}</p>
                        </div>
                    </section>
                    <p className="deliverto">
                        <strong>Deliver to:</strong> {doc.delivery_address}
                    </p>
                    <section className="facts">
                        <div>
                            <span className="label">Quality</span>
                            <strong>{d.quality_label}</strong>
                        </div>
                        <div>
                            <span className="label">HSN</span>
                            <strong>{doc.hsn || '—'}</strong>
                        </div>
                        <div>
                            <span className="label">Place of supply</span>
                            <strong>{doc.place_of_supply || '—'}</strong>
                        </div>
                        <div>
                            <span className="label">Agreed selling rate</span>
                            <strong>Rs {Number(d.selling_rate).toFixed(2)} / m</strong>
                        </div>
                    </section>
                    <table>
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Lot / Taka identifier</th>
                                <th className="num">Metres sent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {d.lines.map((line, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{line.lot}</td>
                                    <td className="num">
                                        {Number(line.meters).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colSpan={2}>
                                    {d.lines.length} lots — Total sent
                                </th>
                                <th className="num">
                                    {Number(d.sent_meters).toFixed(2)} m
                                </th>
                            </tr>
                        </tfoot>
                    </table>
                    <div className="fabricvalue">
                        <span>Fabric value (before applicable taxes / charges)</span>
                        <strong>Rs {value.toFixed(2)}</strong>
                    </div>
                    <section className="refs">
                        <Ref label="Tax rates / amounts / taxable value reference" wide>
                            {doc.tax_details ||
                                'Not entered — refer to applicable invoice'}
                        </Ref>
                        <Ref label="Transport / Vehicle">
                            {doc.transport || '—'} / {doc.vehicle || '—'}
                        </Ref>
                        <Ref label="LR / Transport reference">
                            {doc.lr_reference || '—'}
                        </Ref>
                        <Ref label="Invoice">{doc.invoice_reference || '—'}</Ref>
                        <Ref label="E-way bill">
                            {doc.eway_bill_reference || '—'}
                        </Ref>
                        <Ref label="External challan">
                            {doc.external_reference || '—'}
                        </Ref>
                        <Ref label="Full payment due date (at issue)">
                            {doc.payment_due_date || 'Not set'}
                        </Ref>
                        {doc.payment_terms && (
                            <Ref label="Agreed payment terms (at issue)" wide>
                                {doc.payment_terms}
                            </Ref>
                        )}
                        {doc.notes && (
                            <Ref label="Notes" wide>
                                {doc.notes}
                            </Ref>
                        )}
                    </section>
                    <div className="signature">
                        <div>
                            <p>Received quantity: _________________ m</p>
                            <p>Name / Date: ______________________</p>
                            <p className="gap">Recipient signature / stamp</p>
                        </div>
                        <div>
                            <p>For {doc.sender_name}</p>
                            <p className="gap">Authorized sender signature</p>
                        </div>
                    </div>
                    <footer className="docfooter">
                        <span>
                            Delivery record only. Carry the applicable tax invoice
                            and e-way bill as required. Receipt settlement and
                            payments are retained separately in transaction history.
                        </span>
                        <strong>Generated by Weavly</strong>
                    </footer>
                </article>
            ))}
        </div>
    )
}
