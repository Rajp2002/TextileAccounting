# GT-B1 — Stock audit tour (BLOCKED)

## Task ID and purpose

GT-B1. A dedicated tour for `/owner/stock/audit`, outlined in [`pages/stock-audit.md`](../pages/stock-audit.md) §D.

## Dependencies and entry conditions (all required)

- GT-17 PASSED.
- [x] PI-06 fixed (2026-09-30): changing the audit date loads that date's audit; the adjustment shown equals the one applied.
- [x] PI-07 fixed (2026-09-30): the audit page's strings go through translation keys in en/gu/hi.
- [ ] The senior designer completes the page spec (steps, copy in three languages, variants) against the fixed page. This is the only entry condition still open, and it is a design task, not code.
- [x] Owner decision recorded (2026-09-27, plan D-20): routine counts use Correct balance; the audit is the full dated record.

## Read first

Page spec (stock-audit.md), plan §4–§9, the GT-03 and GT-13 implementations (live-page pattern).

## Allowed change surface

To be set when unblocked: the audit page files, a new tour module and copy, locales, registry (`stock-audit` TourId added then), tests, harness.

## Required implementation

First, the senior designer completes the page spec (steps, copy in three languages, variants) against the fixed page. The executor then implements it like GT-13.

## Definition of done

Set when unblocked.

## Failure and escalation conditions

Starting while any entry condition is unmet is not allowed.

## Checkpoint

Stays **BLOCKED**, on the page spec only.
