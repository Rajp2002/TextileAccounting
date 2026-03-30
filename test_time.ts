import { getSuratDate, formatToSurat, getSuratTodayString } from './lib/time'
console.log(getSuratDate())
console.log(formatToSurat(new Date(), 'yyyy-MM-dd HH:mm:ss'))
console.log(getSuratTodayString())
