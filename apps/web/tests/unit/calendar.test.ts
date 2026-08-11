import { describe, expect, it } from "vitest";

import { projectCalendarOrdinals, type CalendarOrdinalRecord } from "../../src/domain/calendar";

function calendarRows(): CalendarOrdinalRecord[] {
  return Array.from({ length: 18 * 27 }, (_, index) => ({
    calendarOrdinalId: `DAY-${index + 1}`,
    dayOfMonth: index % 27 + 1,
    monthName: `Month ${Math.floor(index / 27) + 1}`,
    monthNumber: Math.floor(index / 27) + 1,
    ordinalDay: index + 1,
    weekdayName: `Weekday ${index % 8 + 1}`,
  }));
}

describe("calendar ordinal projection", () => {
  it("projects all 486 contiguous persisted ordinals into 18 ordered months", () => {
    const months = projectCalendarOrdinals(calendarRows().reverse());
    expect(months).toHaveLength(18);
    expect(months[0]).toMatchObject({ monthName: "Month 1", monthNumber: 1 });
    expect(months[0]!.days).toHaveLength(27);
    expect(months[17]!.days[26]).toMatchObject({ dayOfMonth: 27, ordinalDay: 486 });
  });

  it("allows an empty authoritative table but rejects partial, invalid, or excluded ordinals", () => {
    expect(projectCalendarOrdinals([])).toEqual([]);
    expect(() => projectCalendarOrdinals(calendarRows().slice(0, -1))).toThrow(/exactly 486/);
    const discontinuous = calendarRows();
    discontinuous[20] = { ...discontinuous[20]!, ordinalDay: 900 };
    expect(() => projectCalendarOrdinals(discontinuous)).toThrow(/contiguous/);
    const excluded = calendarRows();
    excluded[0] = { ...excluded[0]!, weekdayName: "Sonntag" };
    expect(() => projectCalendarOrdinals(excluded)).toThrow(/cannot occupy/);
  });
});
