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
    const message = `*Worker Hisaab - ${data.factoryName}*
------------------------------
*Worker:* ${data.workerName}
*Month:* ${data.month}
------------------------------
*Gross Earnings:* ${formatINR(data.grossPay)}
*Upaad Recovered:* -${formatINR(data.deductions)}
*Hisaab Payout:* ${formatINR(data.netPayout)}
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
    const message = `Upaad (worker advance) recorded for ${data.workerName}
Amount: ${formatINR(data.amount)}
Date: ${data.date}
Reason: ${data.reason || 'General'}
Upaad balance after entry: ${data.balance !== undefined ? formatINR(data.balance) : 'N/A'}
- ${data.factoryName}
(Upaad receipt via Weavly; this is not Kharchi or a Hisaab payout.)`

    const encodedMessage = encodeURIComponent(message)
    const url = `https://wa.me/${data.phone.replace(/\D/g, '')}?text=${encodedMessage}`
    
    window.open(url, '_blank')
}
