const { format, subDays } = require('date-fns');

const today = "2026-04-11";
const last7Days = Array.from({ length: 7 }, (_, i) =>
  format(subDays(new Date(today), 6 - i), 'yyyy-MM-dd')
);
console.log("trend days:", last7Days);
