# Feature Analysis: Inventory & Stock Management

## Overview
Weavly tracks three critical layers of inventory:
1.  **Yarn Stock**: Raw material (cones/bags).
2.  **Beams**: Wound yarn ready for the loom.
3.  **Grey Stock**: Finished fabric packages (rolls/bales) ready for dispatch.

## Why It's Needed
Inventory is tied up capital. Knowing exactly how many bags of yarn are in the warehouse or how many meters of a specific quality are in stock prevents over-buying and helps in planning future production.

## Pain Points Solved
- **Stock Outs**: Alerts when yarn for an active order is running low.
- **Wastage Tracking**: Compare "Yarn Issued" vs "Fabric Produced" to identify excessive wastage.
- **Warehouse Confusion**: Clearly see what is "Available" vs "In-Transit" vs "Dispatched".

## Old Workflow Translation
- **Old way**: A "Godown" register where a clerk writes down every bag of yarn that arrives. Fabric rolls are counted manually once a week.
- **Weavly way**: Digital ledgers for Yarn, Beams, and Fabric. Entries are made as soon as material arrives or fabric is packed.

## Value Provided
- **Working Capital Efficiency**: Don't buy yarn you already have.
- **Production Continuity**: Ensure beams are ready before a loom goes "Idle".
- **Dispatch Accuracy**: Ensure you have enough packed stock to fulfill an upcoming dispatch.

## User Interaction
1.  **Yarn Inflow**: Owner records new yarn purchases (Inward).
2.  **Beam Inflow**: Supervisor/Owner records when yarn is wound onto a beam.
3.  **Grey Stock**: Auto-populated via "Submit & Pack" on the supervisor dashboard.
4.  **Inspection**: Owner can "Inspect" a fabric package to mark it as "A Grade" or "B Grade" before it is available for dispatch.

## Technical Logic
- **Package-level Tracking**: Grey stock is tracked as individual `fabric_packages`, each with its own ID, weight, and meter count.
- **Atomic Operations**: Inventory increments and decrements are handled via server actions to ensure data integrity.
- **Relationship Mapping**: Beams are linked to specific machines, and fabric packages are linked to specific orders.

## Relation to Other Features
- **Production & Packing**: The primary source of Grey Stock.
- **Dispatches**: Dispatches remove items from "Grey Stock".
- **Estimator**: Real-world inventory costs can be used to update estimator baselines.

## Output/Result
- **Inventory Dashboard**: Charts and tables showing current stock levels.
- **Stock Audit**: A history of all movements (Inward, Internal, Outward).
- **Grading List**: A list of packed fabric rolls categorized by quality grade.
