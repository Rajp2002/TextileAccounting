import { challanTotals, type Challan } from '@/lib/delivery-challans'
import PrintButton from './[id]/print/PrintButton'
export default function ChallanPrint({ d }: { d: Challan }) {
    const doc = d.document
    return (
        <div data-i18n-skip="true" className="challan-print-root bg-white p-6 text-black">
            <style>{`@page { size: A4; margin: 14mm; } @media print { body:has(.challan-print-root) *:not(.challan-print-root):not(.challan-print-root *):not(:has(.challan-print-root)) { display:none!important; } *:has(.challan-print-root) { display:block!important; position:static!important; overflow:visible!important; height:auto!important; min-height:0!important; width:auto!important; margin:0!important; padding:0!important; transform:none!important; } .challan-print-root { position:static;width:100%;padding:0; } .no-print,.no-print * {display:none!important;} .challan-copy {break-after:page;} .challan-copy:last-child {break-after:auto;} table{width:100%;border-collapse:collapse;} thead {display:table-header-group;} tr,.signature {break-inside:avoid;} } .challan-copy {max-width:180mm;margin:0 auto 30px;font:12px/1.5 Arial,sans-serif;overflow-wrap:anywhere;} .challan-copy td,.challan-copy th {border:1px solid #ccc;padding:6px;text-align:left;} .challan-copy h1 {font-size:24px;font-weight:700;} .challan-copy h2 {font-size:14px;font-weight:700;} `}</style>
            <div className="no-print mx-auto mb-6 max-w-3xl space-y-2">
                <PrintButton />
                <p>
                    Choose “Save as PDF” in the print destination to download.
                    Three labelled copies are included.
                </p>
                <p>
                    This delivery record does not replace a tax invoice or e-way
                    bill where required. Tax details below are entered
                    references; this app does not calculate or file GST.
                </p>
            </div>
            {[
                'Original — Consignee',
                'Duplicate — Transporter',
                'Triplicate — Consignor',
            ].map((copy) => (
                <article className="challan-copy" key={copy}>
                    <header className="mb-5 flex justify-between gap-4">
                        <div>
                            <h1>DELIVERY CHALLAN</h1>
                            <p>{copy}</p>
                        </div>
                        <div>
                            <h2>{d.number}</h2>
                            <p>Date: {doc.date}</p>
                            <strong>
                                {d.delivery_status === 'draft'
                                    ? 'DRAFT — NOT ISSUED'
                                    : d.delivery_status === 'reversed'
                                      ? 'REVERSED — SEE HISTORY'
                                      : 'ISSUED'}
                            </strong>
                        </div>
                    </header>
                    <div className="mb-4 grid grid-cols-2 gap-6">
                        <section>
                            <h2>Consignor / Sender</h2>
                            <p>{doc.sender_name}</p>
                            <p>{doc.sender_address}</p>
                            <p>GSTIN: {doc.sender_gstin || '—'}</p>
                        </section>
                        <section>
                            <h2>Consignee / Customer</h2>
                            <p>{doc.customer_name}</p>
                            <p>{doc.customer_address}</p>
                            <p>GSTIN: {doc.customer_gstin || '—'}</p>
                            <p>Phone: {doc.customer_phone || '—'}</p>
                        </section>
                    </div>
                    <p>
                        <strong>Deliver to:</strong> {doc.delivery_address}
                    </p>
                    <p>
                        <strong>Place of supply:</strong>{' '}
                        {doc.place_of_supply || '—'}
                    </p>
                    <p className="my-3">
                        <strong>Quality:</strong> {d.quality_label} ·{' '}
                        <strong>HSN:</strong> {doc.hsn || '—'} ·{' '}
                        <strong>Agreed selling rate:</strong> Rs{' '}
                        {Number(d.selling_rate).toFixed(2)} / m
                    </p>
                    <table className="my-4 w-full border-collapse">
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Lot / Taka identifier</th>
                                <th>Metres sent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {d.lines.map((line, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{line.lot}</td>
                                    <td>{Number(line.meters).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colSpan={2}>
                                    {d.lines.length} lots — Total sent
                                </th>
                                <th>{Number(d.sent_meters).toFixed(2)} m</th>
                            </tr>
                        </tfoot>
                    </table>
                    <p>
                        <strong>Fabric value:</strong> Rs{' '}
                        {challanTotals(d.lines, Number(d.selling_rate)).value.toFixed(2)}{' '}
                        (before applicable taxes / charges)
                    </p>
                    <p>
                        <strong>
                            Tax rates / amounts / taxable value reference:
                        </strong>{' '}
                        {doc.tax_details ||
                            'Not entered — refer to applicable invoice'}
                    </p>
                    <p>
                        <strong>Transport / Vehicle:</strong>{' '}
                        {doc.transport || '—'} / {doc.vehicle || '—'}
                    </p>
                    <p>
                        <strong>LR / Transport reference:</strong>{' '}
                        {doc.lr_reference || '—'}
                    </p>
                    <p>
                        <strong>Invoice:</strong> {doc.invoice_reference || '—'}{' '}
                        · <strong>E-way bill:</strong>{' '}
                        {doc.eway_bill_reference || '—'}
                    </p>
                    <p>
                        <strong>External challan:</strong>{' '}
                        {doc.external_reference || '—'}
                    </p>
                    {doc.notes && (
                        <p>
                            <strong>Notes:</strong> {doc.notes}
                        </p>
                    )}
                    <div className="signature mt-8 grid grid-cols-2 gap-8 border-t pt-4">
                        <div>
                            <p>Received quantity: _________________ m</p>
                            <p>Name / Date: ______________________</p>
                            <p className="mt-8">Recipient signature / stamp</p>
                        </div>
                        <div>
                            <p>For {doc.sender_name}</p>
                            <p className="mt-16">Authorized sender signature</p>
                        </div>
                    </div>
                    <p className="mt-5 text-[10px]">
                        Delivery record only. Carry the applicable tax invoice
                        and e-way bill as required. Receipt settlement and
                        payments are retained separately in transaction history.
                    </p>
                </article>
            ))}
        </div>
    )
}
