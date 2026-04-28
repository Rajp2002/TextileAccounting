# Feature Analysis Part 1

This file now serves as a current implementation snapshot for the owner and floor-operations surface.

## Implemented Today

### Owner operational modules
- analytics dashboard
- estimator
- quotes
- orders
- market runs
- machines
- workers
- dispatches (fabric package tracking)
- stock
- inventory
- ledger
- payroll
- advances
- system health
- billing
- settings and audit

### Supervisor operational modules
- unified dashboard for production and machine assignment
- workers
- attendance
- machines

## What Has Changed Since Earlier Docs

- `/supervisor/production` is no longer the primary working page; it redirects to `/supervisor/dashboard`.
- the owner product surface is broader than the older docs described and now includes Market Runs, ledger, stock, inventory, dispatches, billing, and more compliance tooling
- the floor dashboard combines worker assignment, order linking, machine state, and bulk production logging (with "SUBMIT & PACK" for physical stock entry)

## Current Strengths

- clear owner/supervisor route separation
- practical estimate-to-order-to-production flow
- broad operational coverage beyond pure production logging
- offline-aware floor workflows
- public dispatch tracking support

## Current Friction Points

- some older docs still underspecify the newer owner modules
- timezone handling is not fully normalized in all client screens
- the feature surface is growing faster than the automated test suite
