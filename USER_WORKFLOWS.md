# Weavly User Workflows

This document provides a comprehensive map of how users interact with the Weavly platform, the lifecycle of core entities, and the data flow between modules.

---

## 1. Fabric Design & Commercial Workflow (Owner)

**Entry Point**: `/owner/estimator`

The "Estimator-First" design ensures that every order starts with a technically accurate cost breakdown.

### Lifecycle
1.  **Baseline Setup**: The owner configures the factory's cost profile (warping, sizing, electricity, overheads) in Settings.
2.  **Design Entry**: Input warp/weft specifications (yarn type, denier, rate, ends, picks).
3.  **Cost Discovery**: The engine calculates total yarn weight (kg), conversion costs, and effective overheads per meter.
4.  **Quotation**: The owner adds a profit margin (up to 100%) and saves the result as a **Quote**.
5.  **Iteration**: Quotes can be updated if yarn market rates change before acceptance.

### Data Flow
-   **Inputs**: Yarn specs, machine parameters (RPM, Power), margin %, party name.
-   **Outputs**: 
    -   `Fabric Design`: A reusable recipe for production.
    -   `Quote`: A commercial offer with landed cost and quote price.
    -   `Worker Rate`: The weaver's piece-rate (derived from picks and pick-rate).

---

## 2. Order & Production Lifecycle (Owner)

**Entry Point**: `/owner/quotes` → `/owner/orders`

Transitioning from a commercial quote to a live factory floor instruction.

### Lifecycle
1.  **Acceptance**: A Quote is marked as `Accepted` after party confirmation.
2.  **Activation**: The owner converts the Accepted Quote into an **Order**.
3.  **Speculative Production**: For market-driven fabrics, the owner creates a **Market Run** directly from the Estimator (auto-accepts).
4.  **Inventory Planning**: On order creation, the system automatically calculates `Yarn Requirements` (kg) and `Beam Capacity` (estimated beams needed).
5.  **Visibility**: The order appears as `Active` on the Supervisor Dashboard for machine assignment.

### Data Flow
-   **Inputs**: Target meters, deadline, notes.
-   **Outputs**: 
    -   `Order Record`: The primary production anchor.
    -   `Requirement Snapshot`: Exact KG of warp/weft yarn needed.
    -   `Tracking Token`: A unique token for public shipment tracking.

---

## 3. Floor Operations & Production (Supervisor)

**Entry Point**: `/supervisor/dashboard`

The real-time workspace for managing the factory floor and logging output.

### Lifecycle
1.  **Shift Setup**: Supervisor assigns workers and active orders to specific machines for the current shift (Day/Night).
2.  **Execution**: Update machine status (Running, Idle, Maintenance) to maintain floor visibility.
3.  **Production Logging**: At the end of the shift, the supervisor logs meter readings.
    -   **Submit Shift Logs**: Records production for payroll and analytics only.
    -   **Submit & Pack**: Records production and immediately creates **Fabric Packages** (rolls/bales) in the digital warehouse.
4.  **Handover**: Machines are cleared for the next shift assignment.

### Data Flow
-   **Inputs**: Machine-Order mapping, worker assignment, meter readings, breakdown notes.
-   **Outputs**: 
    -   `Production Logs`: Piece-rate data for payroll.
    -   `Fabric Packages`: Physical inventory records (Stock state: `uninspected`).

---

## 4. Inventory & Quality Assurance (Owner/QC)

**Entry Point**: `/owner/stock`

Bridging the gap between raw production and shippable goods.

### Lifecycle
1.  **Production Output**: Packages created by supervisors land here as `uninspected`.
2.  **Inspection**: QC staff/Owner inspects the physical roll for defects.
3.  **Grading**: Marks the package as `Pass` (Grade A), `Minor Defect` (Grade B), or `Reject`.
4.  **Readying**: Only `Pass` or `Minor Defect` packages can be moved to the `Ready` state.
5.  **Corrections**: If a meter reading was wrong, the owner uses an **Access Code** to correct the package meters.

### Data Flow
-   **Inputs**: Inspection status, grade, location, photo, correction notes.
-   **Outputs**: 
    -   `Ready Stock`: Packages eligible for dispatch.
    -   `Audit Trail`: Record of who inspected and when.

---

## 5. Dispatch & Fulfillment (Owner)

**Entry Point**: `/owner/dispatches`

Fulfilling orders and providing transparency to the buyer.

### Lifecycle
1.  **Batching**: Owner selects an active order and chooses from the `Ready` packages assigned to that order.
2.  **Dispatch Creation**: A new Dispatch record is created. Selected packages are automatically moved to `dispatched` state.
3.  **Documentation**: System generates a **Challan PDF** (Delivery Note) for the driver.
4.  **Tracking**: The buyer receives a link to the **Public Tracking Portal** (token-based).
5.  **Reconciliation**: Once delivered, the owner records the `Received Meters` (confirmed by buyer) to track shortages.

### Data Flow
-   **Inputs**: Package selection, transport details, party confirmation.
-   **Outputs**: 
    -   `Dispatch Record`: Linked to the order and party ledger.
    -   `Challan PDF`: Physical proof of shipment.
    -   `Shortage Analytics`: Discrepancy between sent and received meters.

---

## 6. Financial & Payroll Settlement (Owner)

**Entry Point**: `/owner/ledger` & `/owner/payroll`

The final step in the factory loop: settling accounts with parties and workers.

### Lifecycle
1.  **Party Ledger**: Every dispatch impacts the party balance. Owner records payments (Receipts) and claims (Shortage adjustments).
2.  **Worker Payroll**:
    -   **Piece-Rate**: System sums meters from `Production Logs` for the month.
    -   **Fixed-Rate**: Derived from the monthly Attendance registry.
    -   **Deductions**: Automatically recovers Advances (Upaad), applies PF/ESI (if eligible), and fines.
3.  **Payout**: Owner settles the cycle. Payslips are generated and sent via **WhatsApp**.

### Data Flow
-   **Inputs**: Invoices, Payments, Attendance, Manual adjustments (Bonuses/Fines).
-   **Outputs**: 
    -   `Ledger Statement`: Comprehensive financial history for the party.
    -   `Payslip PDF`: Itemized breakdown of earnings and deductions.

---

## 7. Governance & Security (Admin / Owner)

**Entry Point**: `/admin` & `/owner/settings`

System-wide controls for compliance and operational integrity.

### Lifecycle
1.  **Access Codes**: Supervisors request codes for "protected" actions (deleting workers, overwriting production). Owner receives a WhatsApp request and generates a one-time code.
2.  **DPDP Compliance**: Admin manages **Data Processing Agreements (DPA)**. Owners track worker signatures and upload proof of compliance.
3.  **Audit Logs**: Every critical action (machine rename, salary change, code usage) is recorded in the Audit log with the actor's identity.
4.  **Emergency Lockdown**: Owner can trigger a tenant-wide lockdown in case of a breach, requiring Admin intervention to restore.

### Data Flow
-   **Inputs**: DPA Templates, Access code requests, Audit filters.
-   **Outputs**: 
    -   `Compliance Status`: Org-level visibility into legal readiness.
    -   `Audit Report`: Immutable history of system changes.

---

## Authentication and Onboarding

-   **Signup**: Owner registers the organization.
-   **Onboarding**: Step-by-step setup of looms, workers, and cost baseline.
-   **Join Flow**: Supervisors join an existing organization using a secure Join Code.
-   **Redirects**: Owners land on Analytics; Supervisors land on the Unified Production Dashboard.
