import { calendarContract } from "./invariants";

export interface CalendarOrdinalRecord {
  calendarOrdinalId: string;
  dayOfMonth: number;
  monthName: string;
  monthNumber: number;
  ordinalDay: number;
  weekdayName: string;
}

export interface CalendarMonthProjection {
  days: CalendarOrdinalRecord[];
  monthName: string;
  monthNumber: number;
}

export function projectCalendarOrdinals(rows: readonly CalendarOrdinalRecord[]): CalendarMonthProjection[] {
  if (rows.length === 0) return [];
  const expectedCount = calendarContract.monthsPerYear * calendarContract.daysPerMonth;
  if (rows.length !== expectedCount) throw new Error(`Calendar ordinals must contain exactly ${expectedCount} days.`);
  const ordered = [...rows].sort((left, right) => left.ordinalDay - right.ordinalDay);
  const months = new Map<number, CalendarMonthProjection>();
  ordered.forEach((row, index) => {
    if (row.ordinalDay !== index + 1) throw new Error("Calendar ordinal days must be contiguous and one-based.");
    if (row.monthNumber < 1 || row.monthNumber > calendarContract.monthsPerYear) throw new Error("Calendar month number is outside the governed range.");
    if (row.dayOfMonth < 1 || row.dayOfMonth > calendarContract.daysPerMonth) throw new Error("Calendar day of month is outside the governed range.");
    if (!row.monthName.trim() || !row.weekdayName.trim()) throw new Error("Calendar month and weekday names are required.");
    if (row.weekdayName === calendarContract.excludedWeekday) throw new Error(`${calendarContract.excludedWeekday} cannot occupy a counted calendar day.`);
    const month = months.get(row.monthNumber) ?? { days: [], monthName: row.monthName, monthNumber: row.monthNumber };
    if (month.monthName !== row.monthName) throw new Error("A calendar month number cannot have multiple names.");
    month.days.push(row);
    months.set(row.monthNumber, month);
  });
  const result = [...months.values()].sort((left, right) => left.monthNumber - right.monthNumber);
  if (result.length !== calendarContract.monthsPerYear || result.some((month) => month.days.length !== calendarContract.daysPerMonth)) {
    throw new Error("Calendar ordinals must provide every governed month and day.");
  }
  return result;
}
