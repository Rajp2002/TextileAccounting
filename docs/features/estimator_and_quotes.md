# Feature Analysis: Estimator & Quotes

## Overview
The Estimator is the commercial heart of Weavly. it allows factory owners to calculate the precise "Landed Cost" of a fabric before they even start production. Once an estimate is refined, it can be saved as a Quote and sent to a Party (Trader).

## Why It's Needed
In weaving factories, margins are often thin. A small miscalculation in yarn weight, wastage, or overhead can turn a profitable order into a loss. Owners need a scientific way to price their fabric that accounts for every variable: yarn rates, GST, crimp, shortage, and factory overheads.

## Pain Points Solved
- **Guesswork Pricing**: No more "feeling out" a price. Every paisa is accounted for.
- **Hidden Costs**: Automatically includes factory overheads (electricity, maintenance, salaries) which are often forgotten.
- **Complex Math**: Handles the "denier to grams" and "ends to weight" conversions that usually require complex Excel sheets or manual registers.
- **Template Management**: Easily reuse successful fabric configurations instead of re-entering data.

## Old Workflow Translation
- **Old way**: Owner uses a calculator and a paper "Parchi" to do rough math. They might forget to add the 5% GST on yarn or miss the 2% transport cost.
- **Weavly way**: A guided UI where the owner enters the quality parameters (Warp, Weft, Reed Space, PPI) and the system provides an instant, itemized cost breakdown.

## Value Provided
- **Profit Protection**: Ensures a minimum desired margin (up to 100%).
- **Faster Quoting**: Respond to Trader inquiries in seconds by applying a saved template.
- **Scenario Analysis**: Instantly see how a change in yarn rate or target price affects the bottom line.

## User Interaction
1.  **Input Quality**: User enters Warp and Weft rows (Denier, Ends, Rate, GST).
2.  **Configure Loom**: Selects Loom Type (Waterjet, Rapier, etc.) which auto-fills RPM and Power usage.
3.  **Adjust Overheads**: System pulls factory-wide overheads (synced from Settings) and allocates them per meter based on monthly output.
4.  **Save/Quote**: User saves as a "Fabric Template" for internal use or generates a "Quote" for a specific Party.

## Technical Logic
- **State Management**: Uses a complex React `useReducer` to manage dozens of interdependent variables in real-time.
- **Calculation Engine**: Centralized logic in `lib/estimator.ts` and `lib/finance.ts` ensures mathematical accuracy.
- **Server Actions**: Uses `upsertFactoryCostProfile` to keep factory-wide baseline costs (like electricity rates) synced across all estimates.

## Relation to Other Features
- **Orders**: An approved Quote is the required starting point for a new Order.
- **Settings**: Factory cost profiles (overhead items) are pulled into every estimate.
- **Market Runs**: Estimates can be used to start speculative production without a quote.

## Output/Result
- **Fabric Template**: A reusable configuration saved to the database.
- **Quote Record**: A timestamped price offer linked to a Party.
- **Cost Stack**: A visual pill-based breakdown showing Warp vs Weft vs Overhead vs Wage.
