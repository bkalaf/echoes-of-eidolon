export const numericControlContracts = Object.freeze({
  book: { label: "Book", max: 18, min: 1, step: 1 },
  gameHour: { label: "Game hour", max: 23, min: 0, step: 1 },
  gameMinute: { label: "Game minute", max: 59, min: 0, step: 1 },
  gameOrdinalDay: { label: "Game ordinal day", max: 489, min: 1, step: 1 },
  gameYear: { label: "Game year", max: 4040, min: 0, step: 1 },
  latitude: { label: "Latitude", max: 90, min: -90, step: "any" },
  longitude: { label: "Longitude", max: 180, min: -180, step: "any" },
} as const);

export type NumericControlKey = keyof typeof numericControlContracts;
