# Feature Analysis: Production & Packing (Submit & Pack)

## Overview
While "Production Logging" records *how much* was woven, "Packing" records the *physical items* created. The "Submit & Pack" feature allows supervisors to turn a meter entry into a "Fabric Package" (roll or bale) in the inventory system with a single tap.

## Why It's Needed
In many factories, production is logged, but the physical rolls sit in a pile until someone manually counts them. This leads to "Ghost Inventory"—you know you produced 500 meters, but you don't know where it is or if it's been packed and graded.

## Pain Points Solved
- **Inventory Mismatch**: Ensures that what is logged as produced is also logged as physical stock.
- **Grading Lag**: Allows for immediate packing and quality tagging on the floor.
- **Dispatch Delays**: You can't dispatch what isn't in stock. packing creates the stock records needed for dispatches.

## Old Workflow Translation
- **Old way**: Supervisor writes down meters. Later, a "Folder" or "Packer" manually creates a "Takka" (roll) list on paper. The owner then types this list into a ledger.
- **Weavly way**: Supervisor logs 100 meters on Machine 5 and clicks "Submit & Pack". The system instantly creates a new "Fabric Package" in the `stock` table, ready for dispatch.

## Value Provided
- **Physical Accountability**: Every meter produced is accounted for as a physical unit.
- **Streamlined Workflow**: Combines two operational steps (Logging + Stock Entry) into one.
- **Dispatch Readiness**: Stock is immediately available to be added to a dispatch challan.

## User Interaction
1.  **Entry**: Supervisor enters meters for multiple machines.
2.  **Action**: Instead of "Submit Shift Logs", they click "Submit & Pack".
3.  **Outcome**: System logs the production and creates one "Bulk Package" per machine-order combination for that shift.
4.  **Refinement**: (Optional) Owner can later go to the Stock module to split bulk packages into individual rolls or bales.

## Technical Logic
- **RPC Logic**: Uses `packProductionIntoBulkPackages` which takes the shift logs and performs a batch insert into the `fabric_packages` table.
- **Order Linkage**: Each package is automatically linked to the `order_id` from the shift assignment, preserving the chain of custody.
- **Tenant Scoping**: All packages are org-scoped to ensure factory data isolation.

## Relation to Other Features
- **Stock Management**: This is the primary "Inflow" for the Stock module.
- **Dispatches**: Only "Packed" packages can be dispatched to a customer.
- **Orders**: Updates the "Produced" vs "Packed" stats for the order.

## Output/Result
- **Fabric Packages**: New entries in the stock ledger with unique package numbers.
- **Updated Inventory**: Increases the "Total Grey Stock" for the factory.
- **Production Audit**: A link between the production log and the physical package ID.
