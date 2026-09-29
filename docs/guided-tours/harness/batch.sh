#!/bin/bash
# Every scenario at the four standard viewports. Exits 1 if any run failed or timed out,
# so a missing run cannot pass unnoticed (summarize.py also lists runs without a record).
failed=()
for s in production daily-sheet 'daily-sheet?populated=1' fabric-stock yarn-stock dispatch payroll payroll-extra machines workers workers-salary assignments estimator free-estimator rates quotes free-costings; do
  for combo in "en 1440x900" "gu 390x844" "hi 1280x800" "en 1024x768"; do
    set -- $combo
    timeout 170 node run-tour.mjs "$s" "$1" "$2" > /dev/null 2>&1 || failed+=("$s $1 $2")
  done
done
if [ ${#failed[@]} -gt 0 ]; then
  printf 'FAIL %s\n' "${failed[@]}"
  echo "${#failed[@]} run(s) failed"
  exit 1
fi
echo done
