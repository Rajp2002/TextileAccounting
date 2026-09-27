#!/bin/bash
for s in production fabric-stock yarn-stock dispatch payroll machines workers assignments estimator free-estimator rates quotes free-costings; do
  for combo in "en 1440x900" "gu 390x844" "hi 1280x800" "en 1024x768"; do
    set -- $combo
    timeout 170 node run-tour.mjs $s $1 $2 > /dev/null 2>&1 || echo "FAIL $s $1 $2"
  done
done
echo done
