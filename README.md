# Weavly — The Estimator-First Textile OS

Weavly is a professional profit-protection platform designed for the Surat textile ecosystem. It enforces mathematical discipline by ensuring every production order is quoted for profitability before it hits the factory floor.

## Core Proposition: Profit Protection
- **Estimator-First Workflow**: No orders without a blueprint.
- **Mathematical Precision**: PPI-based costing with itemized overheads.
- **Auditable Floor**: Real-time production tracking linked directly to original quotes.
- **Automated Settlement**: Indian labour law compliant payroll and advances (Upaad).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Technology Stack
- **Framework**: Next.js (App Router)
- **Database**: Supabase (PostgreSQL + RLS)
- **Logic**: Decimal.js for financial precision, date-fns-tz for IST consistency.
- **Notifications**: Interakt WhatsApp API.
