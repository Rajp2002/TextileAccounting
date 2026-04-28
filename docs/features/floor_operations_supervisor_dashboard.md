# Feature Analysis: Floor Operations & Supervisor Dashboard

## Overview
The Supervisor Dashboard is the primary interface for the factory floor. It combines worker attendance, machine assignment, and production logging into a single, mobile-optimized "unified" view.

## Why It's Needed
Floor operations are chaotic. Workers change shifts, machines break down, and production data needs to be captured accurately twice a day. Supervisors need a tool that is fast, resilient to poor internet, and easy to use with one hand.

## Pain Points Solved
- **Paper Trail Lag**: No more waiting for the end of the shift to enter data from a notebook.
- **Assignment Confusion**: Clearly shows which worker is on which machine and which fabric they should be weaving.
- **Breakdown Downtime**: Instant status updates (Running/Idle/Maintenance) allow owners to see why a loom is stopped.
- **Data Entry Errors**: Bulk logging with "Duplicate Guard" prevents supervisors from accidentally entering the same meters twice.

## Old Workflow Translation
- **Old way**: Supervisor walks the floor with a "Hajiri" register and a "Production" register. At 6 PM, they hand these to the owner, who enters them into an Excel sheet.
- **Weavly way**: Supervisor walks the floor with their phone. They tap to assign a worker, enter the "Closing Meters" from the loom, and tap "Submit". Data is instantly synced to the owner's dashboard.

## Value Provided
- **Real-time Oversight**: Owner can see floor activity from anywhere.
- **Accurate Payroll**: Piece-rate wages are derived directly from these logs, eliminating disputes.
- **Historical Context**: "Copy Previous Shift" saves 10 minutes of setup time every morning.

## User Interaction
1.  **Shift Setup**: Select Date and Shift (Day/Night). Use "Copy Yest." to quickly fill assignments.
2.  **Machine Check**: Tap machine cards to update status (e.g., mark as "Service" for a mechanical failure).
3.  **Logging**: Enter the meters produced for each loom.
4.  **Submission**: Tap "Submit Shift Logs" to save all entries. Use "Submit & Pack" if physical fabric packages need to be created immediately.

## Technical Logic
- **Unified State**: Manages a complex grid of machines, workers, and orders using a responsive client-side state.
- **Offline Recovery**: Uses `localStorage` to cache meter entries. If the browser refreshes or internet drops, the numbers are preserved.
- **Atomic Sync**: `upsertShiftAssignment` ensures that worker/order changes are saved instantly even before the final submission.
- **Duplicate Guard**: A server-side check prevents logging the same (Machine, Date, Shift) combination unless an Owner Access Code is provided.

## Relation to Other Features
- **Orders**: The dashboard pulls active orders to link production to them.
- **Payroll**: Production logs are the "source of truth" for piece-rate wage calculations.
- **Machines & Workers**: Consumes the master lists managed by the owner.

## Output/Result
- **Production Logs**: Immutable records of meters produced per machine/worker/shift.
- **Machine History**: A log of maintenance categories (Mechanical, Electrical, Warp Break) and notes.
- **Real-time Dashboard**: Live "Running" vs "Idle" machine counts for the owner.
