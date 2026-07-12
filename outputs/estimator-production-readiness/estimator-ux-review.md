# Estimator UX Review

Passed hosted checks include Base navigation limited to Estimator, Quotes, and Billing; a clear Premium upgrade wall; Premium navigation preservation; stable quality update; explicit duplicate/delete actions; normalized duplicate-name inline validation; alert semantics; draft-collision choice; quote reload/update/delete; and sign-out/sign-in persistence.

Responsive checks passed at 360×800, 390×844, 768×1024, 1024×768, 1366×768, and 1440×900. The discovered mobile defect had a 421px action row inside a 309px container and clipped Duplicate. Commit `d49ef57` makes the row wrap, after which document width equalled viewport width and the action container had `scrollWidth == clientWidth` at all measured sizes.

The PWA now checks for an update immediately after registration. A stale public-production session displayed “App update ready” with an explicit Refresh action and no forced reload loop.

Blocked UX evidence: browser zoom 125%/150% could not be changed by the in-app automation surface; numeric-keyboard occlusion was not emulated; forced network loss and expired-session recovery were not safely executed against production. These require manual/device follow-up and are not marked passed.
