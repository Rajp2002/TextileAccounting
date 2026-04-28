# Feature Analysis: Compliance & Admin Console

## Overview
The Admin Console is the "Governance" layer of Weavly. It manages sensitive legal and data requirements, such as Data Processing Agreements (DPAs), legal notices, and worker grievances.

## Why It's Needed
As factories scale, they face increasing regulatory pressure (e.g., DPDP Act, labor laws). Centralizing compliance documentation and response workflows ensures that the factory owner is protected against legal liabilities.

## Pain Points Solved
- **Compliance Fragility**: No more losing paper DPAs or forgetting to respond to a legal notice.
- **Audit Stress**: A single place to show regulators all signatures and grievance resolutions.
- **Data Privacy**: Ensures that all factory-trader interactions are governed by a valid legal agreement.

## Old Workflow Translation
- **Old way**: Physical folders for "Legal" and "Staff Issues". These are often disorganized and hard to search during an emergency.
- **Weavly way**: A structured database of all notices, agreements, and grievances with expiration dates and priority levels.

## Value Provided
- **Risk Mitigation**: Protects the factory from fines and legal disputes.
- **Worker Harmony**: A formal grievance system shows workers that their issues are taken seriously.
- **Centralized Oversight**: Owners (or their lawyers) can oversee multiple factories' compliance status from one screen.

## User Interaction
1.  **DPA Management**: Admin creates a new DPA version and assigns it to factories.
2.  **Notice Registry**: Record incoming legal or government notices and track the "Response Deadline".
3.  **Grievance Handling**: Workers or supervisors can log a grievance, which the Admin then reviews and "Resolves".
4.  **Lockdown State**: In case of a major data or security breach, Admins can trigger a "Lockdown" to protect tenant data.

## Technical Logic
- **Template Versioning**: DPAs are versioned to ensure that old signatures remain valid while new requirements are rolled out.
- **Signed Proofs**: Uses Supabase Storage to store PDF/image proofs of physical signatures.
- **Role-based Access**: Admin routes are strictly guarded to ensure only authorized personnel can see factory-wide compliance data.

## Relation to Other Features
- **Settings**: Factory profiles link to the compliance status.
- **Workers**: Grievances are often linked to specific worker profiles.
- **Audit Logs**: Every compliance action is recorded in the system-wide audit log.

## Output/Result
- **Compliance Scorecard**: A bird's-eye view of which factories are "Compliant" vs "At Risk".
- **Grievance Resolution Log**: An audit trail of how worker issues were addressed.
- **Exportable Compliance Packs**: Bundles of documents for legal or regulatory review.
