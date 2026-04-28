# Feature Analysis: Order Management & Market Runs

## Overview
Orders represent the live commitments a factory has with its customers (Parties). Market Runs are a specialized type of "speculative" order where the factory produces fabric for its own stock to sell later in the market.

## Why It's Needed
Factories need to track production progress against specific deadlines and quantities. Without centralized tracking, it's difficult to know which looms are free, which orders are overdue, and how much fabric is ready to be dispatched.

## Pain Points Solved
- **Deadline Blindness**: Owners get real-time alerts for orders at risk of missing their deadlines.
- **Machine Under-utilization**: Clearly see which machines are assigned to which order and move them as needed.
- **Speculative Risk**: Market Runs allow owners to keep the factory running even when customer orders are low, with full cost tracking.

## Old Workflow Translation
- **Old way**: A "Whiteboard" or "Chopdi" (register) listing active orders. Supervisors manually count rolls at the end of the day to estimate progress.
- **Weavly way**: A digital dashboard showing `Progress %`, `Pace Index` (are we fast enough?), and `Days Remaining`. Progress is updated automatically as supervisors log production.

## Value Provided
- **Operational Clarity**: Real-time visibility into what the factory is currently "weaving".
- **Customer Trust**: Provide accurate delivery estimates to Traders.
- **Financial Control**: Track the "Total Order Value" and "Landed Cost" to ensure the order remains profitable throughout its lifecycle.

## User Interaction
1.  **Creation**: Converts an approved Quote into an Order by setting a `Target Quantity` and `Deadline`.
2.  **Machine Assignment**: Owner assigns specific machines to the order via a drag-and-drop or checklist interface.
3.  **Monitoring**: Tracks the "Progress Bar" and "Pace Index" on the Orders dashboard.
4.  **Completion**: When target is reached, the order is marked "Completed", freeing up machines for the next task.

## Technical Logic
- **Progress Tracking**: Calculated via an RPC that aggregates `production_logs` against the `total_target_meters` of the order.
- **Pace Index**: A specialized calculation (`meters_produced / (meters_targeted / total_days) * days_elapsed`) to determine if the current speed will meet the deadline.
- **Access Codes**: Sensitive edits (like changing the target quantity after production has started) require an "Owner Access Code" for security.

## Relation to Other Features
- **Estimator**: Every Order/Market Run must originate from a fabric estimate.
- **Supervisor Dashboard**: Assignments made here dictate what the supervisor sees on the floor.
- **Stock & Dispatches**: Finished fabric packages are linked to the Order for tracking.

## Output/Result
- **Order Progress Dashboard**: Visual cards with pace and deadline markers.
- **Machine Assignments**: Linkages between looms and specific fabric qualities.
- **Market Run Stock**: Fabric produced without a party is tagged as "Market Stock".
