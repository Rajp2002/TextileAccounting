# Weavly Factory Showcase & Feedback Playbook

Use this playbook to guide your product walkthrough with your brother at his factory. It is structured to help you demonstrate key workflows, validate Weavly's costing and production logic against real factory data, and systematically capture his feedback, feature preferences, and perceived value adds.

---

## 📅 Meeting Metadata & Factory Profile
*Fill this out at the start of your session to anchor the feedback.*

| Parameter | Value / Notes |
| :--- | :--- |
| **Date & Time** | |
| **Factory Name & Location** | |
| **Owner/Brother's Name** | |
| **Loom Count (Active / Total)**| |
| **Loom Types** *(Water Jet, Rapier, Air Jet, Jacquard, Dobby)* | |
| **Average Monthly Output (Meters)** | |
| **Total Worker Count** *(Meter-based / Fixed salary)* | |
| **Current Tooling** *(Excel, paper registers, parchi, other software)* | |

---

## 🛠️ Prep Checklist
Before you sit down, ensure:
- [ ] You have a staging or production URL running with a clean factory profile or demo organization.
- [ ] You have added 2–3 dummy machines matching his loom types (e.g., a Water Jet running at 700 RPM, a Rapier at 450 RPM).
- [ ] You have created 2–3 dummy workers (including meter-based and fixed-salary workers).
- [ ] You have your phone ready to demonstrate the Supervisor Production screen and show how WhatsApp notifications are received.

---

## 📦 Section 1: The Fabric Estimator & Quote Engine
*Replaces: Handwritten parchi (costing slips) and manual Excel sheets.*

### 🔍 What to Showcase:
1. **Loom Selection & Defaults**: Select a loom type (e.g., Water Jet, Rapier) and show how the default RPM, power (kW), and efficiency autofill. Explain that these remain fully editable.
2. **Warp & Weft Cost Stack**:
   - Add a Warp row (Enter Warp ends, calcDenier, rate, GST %, and custom shortage %).
   - Add a Weft row (Enter picks/PPI, finished reed space in cm, calcDenier, rate, GST %, and shortage %).
   - Adjust **Warp Crimp %** (the take-up factor).
3. **Variable Operations**: Toggle optional sections (Winding, Processing, Finishing, Commission, Transport).
4. **Itemized Overheads**: Show how fixed monthly costs (Rent, Electricity mode *per loom*, Depreciation, Consumables) are input, divided by the monthly output meters, and resolved to an exact overhead cost per meter.
5. **Capacity Dynamics**: Show the **Cost of Idle Capacity** (rupee loss from underutilization) and **Overhead at 100% Capacity**.
6. **Order Calculation**: Enter a target order quantity, commission %, transport ₹/m, and margin % to show the recommended **Quote Price** and **Landed Cost**.
7. **Risk Scenarios**: Show the live scenario generator (e.g., *"Yarn price rises 10%"* or *"Output falls 15%"* and how it instantly impacts margin).

### 💬 Questions to Ask:
- Does the yarn calculation match your paper/Excel math?
  - *Note: Weavly uses `kgPer100m = (Ends × Denier × 100) / 9,000,000` for Warp, and `picks × (finishedWidth / 2.54) × Denier × 100 / 9,000,000` for Weft.*
- Do you use finished cloth width (reed space) in cm or inches? Does Weavly's adjustment of reed width vs finished width make sense?
- Does the pick rate formula (`picks × perPickCostPaisa`) accurately reflect your weaving costs?
- Is the **Cost of Idle Capacity** a metric that is valuable to you, or is it too complex?
- Are the scenario stress tests (Yarn +10%, Output -15%) helpful for quick decision-making?

### 📝 Estimator Feedback Capture:
```markdown
[ ] Costing math is 100% accurate. 
[ ] Costing math has discrepancies. Details: __________________________________________________
[ ] Missing costing parameters. List here: ____________________________________________________
[ ] UI is clear and intuitive.
[ ] UI is too cluttered/complex. Suggestions: _________________________________________________
```

---

## 📈 Section 2: Quote-to-Order & Floor Assignment
*Replaces: Whiteboards, chalkboards, and verbal loom schedules.*

### 🔍 What to Showcase:
1. **Order Creation**: Mark a quote as **Accepted** and convert it to an active order.
2. **Order Dash**: View order progress, target vs produced meters, pace relative to deadline, and projected margin.
3. **Machine Assignment**: Assign specific loom numbers to the order.

### 💬 Questions to Ask:
- How do you track orders on the floor today? (e.g., chalkboards, memory, paper)
- What happens when a loom breaks down? How do you reassign that machine's output to another loom mid-order?
- Is the "Pace & Deadline" tracker useful, or is actual production scheduling more chaotic than a linear target?
- When dispatching, do you dispatch in batches? How do you manage partial dispatches?

### 📝 Order Workflow Feedback Capture:
```markdown
[ ] Order progress tracking adds high value.
[ ] Loom assignment fits the actual factory floor layout.
[ ] Loom assignment needs modifications. Details: ____________________________________________
[ ] Notes on dispatch handling / partial order delivery: ______________________________________
```

---

## 📱 Section 3: Supervisor Shift Logging
*Replaces: Physical production registers and evening handoffs.*

### 🔍 What to Showcase:
1. **Shift Selection**: Open the supervisor dashboard, choose the date and shift.
2. **Speed-Up Features**: Click **Copy Previous Shift** to copy worker and order assignments to save time.
3. **Logging Data**: Log meters produced per machine, update machine status (Running, Idle, Maintenance), and log breakdown notes.
4. **Controls & Protections**: Try to enter duplicate logs or change a past date to demonstrate the validation rules and the Owner Access Code bypass.

### 💬 Questions to Ask:
- Will your supervisors actually use this on their mobile phones? What would stop them? (e.g., UI font size, language barrier, too many taps)
- Is the **Copy Previous Shift** feature sufficient to speed up logging, or is typing still too tedious?
- What are the most common machine breakdown reasons? Do the options in Weavly cover them?
- Is the Owner Access Code security check (for duplicates/retroactive edits) too strict, or is it necessary to prevent worker fraud?

### 📝 Supervisor Feedback Capture:
```markdown
[ ] Supervisors can adopt this easily.
[ ] UI is too hard for supervisors. Obstacles: ________________________________________________
[ ] Validation rules are: [ ] Too strict  [ ] Too loose  [ ] Just right
[ ] Missing fields/features: __________________________________________________________________
```

---

## 📦 Section 4: Godown, Stock Ledger & Dispatches
*Replaces: Loose godown ledger books and disputes over delivered meters.*

### 🔍 What to Showcase:
1. **Expected Stock**: Show how completed production automatically creates a draft stock lot in the Godown list.
2. **Dispatch Challan**: Create a dispatch batch with package lines (Taka rolls, weights, meters) and generate a public tracking link.
3. **Receipt Reconciliation**: Show how the buyer or owner inputs the *received* meters, generating a "Needs Review" flag if there is a shortage or weight discrepancy.

### 💬 Questions to Ask:
- How do you track stock in the godown? Do you count in "Takas" (bolts), total meters, or total weight (kg)?
- How common are shortages where the buyer claims they received fewer meters than you dispatched? How do you resolve those disputes today?
- Is a public tracking link shared via WhatsApp something your buyers would use, or do they only care about the physical paper challan?

### 📝 Stock & Dispatch Feedback Capture:
```markdown
[ ] We track stock by: [ ] Meters  [ ] Takas  [ ] Kilograms  [ ] Combination of all
[ ] Public tracking link is: [ ] Highly valuable  [ ] Unlikely to be used
[ ] Dispute tracking logic (Sent vs Received) matches real-world pain points: [ ] Yes [ ] No
[ ] Notes on godown flows: ____________________________________________________________________
```

---

## 💸 Section 5: Payroll & Advances (Upaad Book)
*Replaces: The physical Upaad notebook and manual monthly wage calculations.*

### 🔍 What to Showcase:
1. **Advances Ledger**: Record a worker advance ("Upaad") with amount and date.
2. **Monthly Payroll Run**: Open the payroll summary, choose a month, and show how the system aggregates:
   - Meter-worker earnings (calculated automatically from logged production meters).
   - Fixed-worker salaries.
   - Deductions (automatically recovering outstanding Upaad balances).
3. **Settlement**: Mark payroll as settled and send an itemized payslip summary to the worker's phone via WhatsApp.

### 💬 Questions to Ask:
- How do you calculate worker wages? Is it 100% piece-rate (paise/meters), fixed monthly salary, or a mix of both?
- How do you handle advance (Upaad) limits? Do you limit how much a worker can borrow relative to their monthly earnings?
- Will workers trust a digital WhatsApp/PDF payslip, or is a cash packet with a physical slip always required?
- How are deductions like PF/ESI or food/lodging costs calculated in your payroll?

### 📝 Payroll & Upaad Feedback Capture:
```markdown
[ ] Automated meter-to-pay calculation is a major time-saver.
[ ] Advance tracking matches current notebook method.
[ ] WhatsApp payslips will improve worker trust.
[ ] Payroll calculations need options for: ___________________________________________________
```

---

## 📊 Section 6: High-Level Value & Priority Matrix
*Ask your brother to rate the following features from 1 (No Value) to 5 (Extremely Valuable).*

### Perceived Value Ratings
| Feature / Screen | Rating (1 - 5) | Comments / Feedback |
| :--- | :---: | :--- |
| **Fabric Estimator & Quotes** *(Parchi math)* | | |
| **Order Progress & Machine Assignment** | | |
| **Supervisor Shift Logging** | | |
| **Godown Stock Ledger & Dispatches** | | |
| **Upaad (Advance) & Payroll Automation** | | |
| **WhatsApp Daily Briefs / Payslips** | | |
| **Idle Capacity & Financial Analytics** | | |

### Roadmap Prioritization
*Which of these represent the biggest immediate value add? Group them based on his feedback.*

```
🚨 MUST-HAVE (Fixes immediate day-to-day pain points):
1. __________________________________________________________________________________________
2. __________________________________________________________________________________________
3. __________________________________________________________________________________________

✨ NICE-TO-HAVE (Good for growth or premium management):
1. __________________________________________________________________________________________
2. __________________________________________________________________________________________
3. __________________________________________________________________________________________

🚫 NOT NEEDED / TOO COMPLEX (Skip or archive for now):
1. __________________________________________________________________________________________
2. __________________________________________________________________________________________
```

---

## 📝 General Observations & Raw Notes
*Jot down unexpected pain points, factory-floor realities, or quotes from your brother during the walkthrough.*

*   **Workflow Friction Points:**
    *   
    *   
*   **Brother's Quotes / Direct Feedback:**
    *   *"..."*
    *   *"..."*
*   **Follow-up Tasks / Next Steps:**
    *   [ ] 
    *   [ ] 
