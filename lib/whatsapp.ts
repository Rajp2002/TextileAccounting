import { formatINR } from './finance'

interface WhatsAppPayload {
    phone: string
    workerName: string
    month: string
    grossPay: number
    deductions: number
    netPayout: number
    remainingDebt: number
    factoryName: string
}

export function sendWhatsAppPayslip(data: WhatsAppPayload) {
    const message = `*PAYROLL SLIP - ${data.factoryName}*
------------------------------
*Worker:* ${data.workerName}
*Month:* ${data.month}
------------------------------
*Gross Earnings:* ${formatINR(data.grossPay)}
*Advances Deducted:* -${formatINR(data.deductions)}
*Net Payout:* ${formatINR(data.netPayout)}
------------------------------
${data.remainingDebt > 0 ? `*Carry-Forward Debt:* ${formatINR(data.remainingDebt)}` : '*Advance Clear!*'}

_Thank you for your hard work!_`

    const encodedMessage = encodeURIComponent(message)
    const url = `https://wa.me/${data.phone.replace(/\D/g, '')}?text=${encodedMessage}`
    
    window.open(url, '_blank')
}

interface AdvancePayload {
    phone: string
    workerName: string
    amount: number
    date: string
    reason?: string
    balance?: number
    factoryName: string
}

export function sendWhatsAppAdvanceReceipt(data: AdvancePayload) {
    const message = `Advance recorded for ${data.workerName}
Amount: ${formatINR(data.amount)}
Date: ${data.date}
Reason: ${data.reason || 'General'}
Balance after advance: ${data.balance !== undefined ? formatINR(data.balance) : 'N/A'}
- ${data.factoryName}
(Receipt via Weavly)`

    const encodedMessage = encodeURIComponent(message)
    const url = `https://wa.me/${data.phone.replace(/\D/g, '')}?text=${encodedMessage}`
    
    window.open(url, '_blank')
}
